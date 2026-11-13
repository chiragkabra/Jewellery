"""Transactional email outbox with provider idempotency and uncertain-send holds."""
import httpx
from .core import *
from .workflows import delivery_reason


def configured():
    return os.getenv('EMAIL_MODE') == 'live' and bool(os.getenv('RESEND_API_KEY')) and bool(os.getenv('EMAIL_FROM'))


def manage_email(key,action,actor,confirmed=False):
    with transaction():
        row = one('SELECT * FROM auto_emails WHERE id=?',key)
        check(row,'Email not found',404)
        check(row['status'] in ('queued','preview','failed','uncertain'),'Email cannot be changed in this state',409)
        if action == 'cancel':
            run("UPDATE auto_emails SET status='cancelled',updated_at=? WHERE id=?",now(),key)
        else:
            check(action in ('release','retry'),'Invalid action')
            check(row['status'] != 'uncertain' or confirmed,'Reconcile the provider outcome before retrying',409)
            reason = 'Email preview expired; prepare a fresh event' if now() > row['created_at']+7*86400000 else delivery_reason(row['run_id'])
            check(not reason,reason or 'Run unavailable',409)
            if action == 'release':
                check(configured(),'Configure EMAIL_MODE, RESEND_API_KEY and EMAIL_FROM first',409)
            run('UPDATE auto_emails SET mode=?,status=?,error=NULL,next_at=?,lease_until=NULL,updated_at=? WHERE id=?','live' if action == 'release' else 'preview','queued' if action == 'release' else 'preview',now(),now(),key)
        audit(actor,f'automation.email.{action}',key)


def claim(timestamp,maximum):
    with transaction():
        bucket = f'email-send:{timestamp//60000}'
        rate = one('SELECT count FROM rate_limits WHERE id=?',bucket)
        if rate and rate['count'] >= maximum:
            return None
        candidate = one("SELECT * FROM auto_emails WHERE mode='live' AND status='queued' AND next_at<=? ORDER BY next_at LIMIT 1",timestamp)
        if not candidate:
            return None
        item = one("UPDATE auto_emails SET status='sending',attempts=attempts+1,lease_until=?,updated_at=? WHERE id=? AND status='queued' RETURNING *",timestamp+120000,timestamp,candidate['id'])
        if item:
            run('INSERT INTO rate_limits VALUES(?,1,?) ON CONFLICT(id) DO UPDATE SET count=count+1',bucket,timestamp+120000)
        return item


def dispatch(client=None,timestamp=None):
    timestamp = now() if timestamp is None else timestamp
    run("UPDATE auto_emails SET status='uncertain',error='Worker lease expired; reconcile before retry',updated_at=? WHERE status='sending' AND lease_until<?",timestamp,timestamp)
    result = {'accepted':0,'failed':0,'uncertain':0,'paused':not configured()}
    if result['paused']:
        return result
    sender = email(os.getenv('EMAIL_FROM'))
    try:
        maximum = min(20,max(1,int(os.getenv('EMAIL_PER_MINUTE','10'))))
    except ValueError:
        maximum = 10
    own_client = client is None
    client = client or httpx.Client(timeout=15,follow_redirects=False)
    try:
        for _ in range(maximum):
            row = claim(timestamp,maximum)
            if not row:
                break
            allowed = [v.strip().lower() for v in os.getenv('EMAIL_ALLOWED_RECIPIENTS','').split(',') if v.strip()]
            reason = 'Email expired' if timestamp > row['next_at']+7*86400000 else delivery_reason(row['run_id'],timestamp)
            reason = reason or ('Recipient outside email test allowlist' if allowed and row['recipient'].lower() not in allowed else None)
            if reason:
                run("UPDATE auto_emails SET status='cancelled',error=?,lease_until=NULL,updated_at=? WHERE id=?",reason,timestamp,row['id'])
                continue
            try:
                response = client.post('https://api.resend.com/emails',headers={'Authorization':'Bearer '+os.environ['RESEND_API_KEY'],'Idempotency-Key':'lumera/'+row['id']},json={'from':sender,'to':[row['recipient']],'subject':row['subject'],'text':row['body']})
                try:
                    payload = response.json()
                except ValueError:
                    payload = {}
                if response.is_success and isinstance(payload,dict) and isinstance(payload.get('id'),str):
                    run("UPDATE auto_emails SET status='sent',provider_id=?,lease_until=NULL,error=NULL,updated_at=? WHERE id=?",payload['id'],timestamp,row['id'])
                    result['accepted'] += 1
                elif response.status_code == 429 and row['attempts'] < 5:
                    run("UPDATE auto_emails SET status='queued',next_at=?,lease_until=NULL,error='Provider rate limit; retry scheduled',updated_at=? WHERE id=?",timestamp+min(3600000,60000*2**row['attempts']),timestamp,row['id'])
                else:
                    uncertain = response.is_success or response.status_code >= 500
                    status = 'uncertain' if uncertain else 'failed'
                    run('UPDATE auto_emails SET status=?,error=?,lease_until=NULL,updated_at=? WHERE id=?',status,f'Email provider HTTP {response.status_code}'+('; reconcile before retry' if uncertain else ''),timestamp,row['id'])
                    result[status] += 1
            except (httpx.HTTPError,ValueError,KeyError,TypeError):
                run("UPDATE auto_emails SET status='uncertain',error='Network outcome unknown; reconcile before retry',lease_until=NULL,updated_at=? WHERE id=?",timestamp,row['id'])
                result['uncertain'] += 1
    finally:
        if own_client:
            client.close()
    return result
