"""Consent-based WhatsApp outbox, provider dispatch and signed webhook processing."""
import hashlib
import os
import re
import httpx
from .core import *

EVENTS = seed('whatsapp')
ORDER_EVENTS = ('order_received','order_status','order_shipped','payment_received','purchase_confirmed','refund_recorded','payment_reminder')
TASK_EVENTS = ('follow_up','repair_ready','appointment_confirmed')


def object_value(value):
    return value if isinstance(value,dict) else {}


def objects(value):
    return [v for v in value if isinstance(v,dict)] if isinstance(value,list) else []


def normalise_phone(value):
    if not isinstance(value,str) or not re.fullmatch(r'[+\d\s().-]+',value):
        return None
    phone = re.sub(r'[\s().-]','',value)
    if phone.startswith('00'):
        phone = '+'+phone[2:]
    return phone[1:] if re.fullmatch(r'\+[1-9][0-9]{7,14}',phone) else None


def settings():
    stored = record('settings','whatsapp') or {}
    return {'enabled':stored.get('enabled') is True,'quietStart':stored.get('quietStart',9),'quietEnd':stored.get('quietEnd',20),'perMinute':stored.get('perMinute',10), 'rules':{event:stored.get('rules',{}).get(event,{'enabled':event != 'payment_received','delayMinutes':definition['delayMinutes']}) for event,definition in EVENTS.items()},'templates':{event:stored.get('templates',{}).get(event,{'name':definition['template'],'language':'en','approved':False}) for event,definition in EVENTS.items()}}


def readiness():
    origin = os.getenv('APP_URL','')
    from urllib.parse import urlparse
    host = urlparse(origin).hostname or ''
    configured = {'accessToken':bool(os.getenv('WHATSAPP_ACCESS_TOKEN')),'phoneNumberId':bool(re.fullmatch(r'[0-9]+',os.getenv('WHATSAPP_PHONE_NUMBER_ID',''))),'graphVersion':bool(re.fullmatch(r'v[0-9]+\.[0-9]+',os.getenv('WHATSAPP_GRAPH_VERSION',''))),'appSecret':bool(os.getenv('WHATSAPP_APP_SECRET')),'verifyToken':bool(os.getenv('WHATSAPP_VERIFY_TOKEN')),'worker':bool(os.getenv('AUTOMATION_CRON_SECRET') or os.getenv('WHATSAPP_CRON_SECRET')),'publicOrigin':origin.startswith('https://') and bool(host) and host not in ('localhost','::1') and not host.startswith('127.')}
    enabled = settings()['enabled']
    mode = 'live' if os.getenv('WHATSAPP_MODE') == 'live' else 'preview'
    return {'mode':mode,'enabled':enabled,'configured':configured,'ready':mode == 'live' and enabled and all(configured.values())}


def save_settings(data,actor):
    current = settings()
    check(type(data.get('enabled')) is bool,'Choose whether live sending is enabled')
    for field in ('quietStart','quietEnd','perMinute'):
        check(type(data.get(field)) is int,f'Invalid {field}')
    check(0 <= data['quietStart'] < data['quietEnd'] <= 24,'Sending hours must be a same-day range from 0 to 24 (IST)')
    check(1 <= data['perMinute'] <= 60,'Use 1–60 messages per minute')
    check(isinstance(data.get('rules',{}),dict) and isinstance(data.get('templates',{}),dict),'Invalid settings')
    rules,templates = {},{}
    for event in EVENTS:
        rule = data.get('rules',{}).get(event,current['rules'][event])
        template = data.get('templates',{}).get(event,current['templates'][event])
        check(isinstance(rule,dict) and type(rule.get('enabled')) is bool and type(rule.get('delayMinutes')) is int and 0 <= rule['delayMinutes'] <= 43200,'Invalid automation delay')
        check(isinstance(template,dict) and isinstance(template.get('name'),str) and re.fullmatch(r'[a-z][a-z0-9_]{0,127}',template['name']) and isinstance(template.get('language'),str) and re.fullmatch(r'[a-z]{2,3}(?:_[A-Z]{2})?',template['language']) and type(template.get('approved')) is bool,'Invalid template mapping')
        if rule['enabled']:
            from .workflows import ensure_native_available
            ensure_native_available(event)
        rules[event] = {'enabled':rule['enabled'],'delayMinutes':rule['delayMinutes']}
        templates[event] = {k:template[k] for k in ('name','language','approved')}
    # Preserve import metadata; do not expose credentials in settings.
    result = save('settings','whatsapp',{**(record('settings','whatsapp') or {}),**{k:data[k] for k in ('enabled','quietStart','quietEnd','perMinute')},'rules':rules,'templates':templates})
    audit(actor,'whatsapp.settings.updated','whatsapp')
    return result


def consented(phone,customer_id):
    consent = one('SELECT * FROM wa_consents WHERE phone=?',phone)
    return bool(consent and consent['opted_in'] == 1 and consent['customer_id'] == customer_id)


def set_consent(customer_id,phone,opted_in,source):
    contact = record('customers',customer_id)
    check(contact,'Customer not found',404)
    normalised = normalise_phone(phone)
    check(normalised,'Enter a WhatsApp number with +country code')
    check(type(opted_in) is bool,'Consent must be true or false')
    text(source,'consent evidence / source',500)
    run('INSERT INTO wa_consents VALUES(?,?,?,?,?) ON CONFLICT(phone) DO UPDATE SET customer_id=excluded.customer_id,opted_in=excluded.opted_in,source=excluded.source,updated_at=excluded.updated_at',normalised,customer_id,int(opted_in),source,now())
    save('customers',customer_id,{**contact,'phone':phone})
    if not opted_in:
        run("UPDATE wa_outbox SET status='blocked',error='Customer opted out',updated_at=? WHERE phone=? AND status IN ('queued','blocked')",now(),normalised)


def capture_consent(customer_id,data):
    if data.get('whatsappConsent') is True or data.get('whatsappConsent') == 'yes':
        set_consent(customer_id,str(data.get('phone','')),True,f'Website explicit opt-in: {data.get("form","checkout")}')


def queue_whatsapp(event,entity_id,customer_id,parameters,version='',due_at=None,context=None):
    from .workflows import emit_event
    context = context or {}
    contact = record('customers',customer_id)
    check(contact,'Customer not found')
    conf = settings()
    rule = conf['rules'][event]
    phone = normalise_phone(contact.get('phone')) or ''
    eligible = phone and consented(phone,customer_id)
    enabled = bool(context.get('workflowRunId')) or rule['enabled']
    mode = 'live' if readiness()['ready'] and conf['templates'][event]['approved'] else 'preview'
    status = 'cancelled' if not enabled else 'queued' if eligible else 'blocked'
    error = 'Automation rule disabled' if not enabled else 'Country-coded WhatsApp number required' if not phone else 'WhatsApp consent required' if not eligible else None
    timestamp = now()
    when = (timestamp if due_at is None else due_at) + (0 if context.get('workflowRunId') else rule['delayMinutes'] * 60000)
    key = f'{event}:{entity_id}:{version}'
    preview = re.sub(r'\{\{(\d+)\}\}',lambda m: str(parameters[int(m[1])-1]) if int(m[1]) <= len(parameters) else '',EVENTS[event]['body'])
    inserted = run('INSERT OR IGNORE INTO wa_outbox(id,event_key,customer_id,event,entity_id,phone,parameters,context,preview,mode,status,not_before,created_at,updated_at,error) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',uid(),key,customer_id,event,entity_id,phone,dumps(parameters),dumps(context),preview,mode,status,when,timestamp,timestamp,error).rowcount
    message = one('SELECT * FROM wa_outbox WHERE event_key=?',key)
    if inserted and not context.get('workflowRunId'):
        emit_event(event,'whatsapp:'+message['id'],entity_id,customer_id,{'sourceMessageId':message['id']},when)
    return message


def queue_order_messages(order,previous=None):
    contact = record('customers',order['customerId'])
    key,cid,name = order['id'],contact['id'],order.get('name') or contact['name']
    amount = f'INR {order["totalPaise"]/100:.2f}'
    if not previous:
        queue_whatsapp('order_received',key,cid,[name,key,amount])
        queue_whatsapp('payment_reminder',key,cid,[name,key,amount])
        return
    if order['status'] != previous['status'] or (order['status'] == 'shipped' and any(order.get(k) != previous.get(k) for k in ('carrier','trackingNumber'))):
        if order['status'] == 'shipped':
            queue_whatsapp('order_shipped',key,cid,[name,key,order.get('carrier') or 'Our delivery partner',order.get('trackingNumber') or 'Contact our team'],f'{order.get("carrier") or ""}:{order.get("trackingNumber") or ""}')
        else:
            queue_whatsapp('order_status',key,cid,[name,key,order['status']],order['status'])
    if order['paymentStatus'] == 'paid' and previous['paymentStatus'] != 'paid' and order['status'] != 'cancelled':
        date = datetime.fromtimestamp(parse_date(order.get('paidAt') or iso())/1000,IST).strftime('%b %d, %Y').replace(' 0',' ')
        queue_whatsapp('purchase_confirmed',key,cid,[name,key,date])
    if order['paymentStatus'] == 'refunded' and previous['paymentStatus'] != 'refunded':
        queue_whatsapp('refund_recorded',key,cid,[name,key])
    if order['paymentStatus'] != 'unpaid' or order['status'] == 'cancelled':
        run("UPDATE wa_outbox SET status='cancelled',error='Order no longer needs payment reminder',updated_at=? WHERE entity_id=? AND event='payment_reminder' AND status IN ('queued','blocked')",now(),key)


def queue_task_messages(task,previous=None):
    previous = previous or {}
    contact = record('customers',task['customerId'])
    key,cid,name = task['id'],contact['id'],contact['name']
    if task['kind'] in ('repair','custom-order') and task['status'] == 'ready' and previous.get('status') != 'ready':
        queue_whatsapp('repair_ready',key,cid,[name,task['title']])
    if task['kind'] in ('appointment','follow-up') and task['status'] not in ('ready','done'):
        due = task['dueAt']
        date = datetime.fromtimestamp(parse_date(due)/1000,IST).strftime('%d/%m/%Y, %I:%M %p IST')
        if task['kind'] == 'appointment' and previous.get('dueAt') != due:
            queue_whatsapp('appointment_confirmed',key,cid,[name,task['title'],date],due,context={'dueAt':due})
        queue_whatsapp('follow_up',key,cid,[name,task['title'],date],due,max(now(),parse_date(due)-3600000),{'dueAt':due})
    if task['status'] == 'done':
        run("UPDATE wa_outbox SET status='cancelled',error='Task completed',updated_at=? WHERE entity_id=? AND event IN ('follow_up','repair_ready','appointment_confirmed') AND status IN ('queued','blocked')",now(),key)


def business_reason(event,entity_id,parameters,context,timestamp):
    if event in ORDER_EVENTS:
        order = record('orders',entity_id)
        if not order:
            return 'Order no longer exists'
        if event == 'payment_reminder' and (order['status'] == 'cancelled' or order['paymentStatus'] != 'unpaid'):
            return 'Order no longer needs payment reminder'
        if event == 'order_received' and order['status'] == 'cancelled':
            return 'Order cancelled'
        if event in ('payment_received','purchase_confirmed') and (order['paymentStatus'] != 'paid' or order['status'] == 'cancelled'):
            return 'Payment status changed'
        if event == 'refund_recorded' and order['paymentStatus'] != 'refunded':
            return 'Refund status changed'
        if event == 'order_status' and parameters and order['status'] != parameters[2]:
            return 'Superseded order status'
        if event == 'order_shipped' and (order['status'] != 'shipped' or parameters and ((order.get('trackingNumber') or 'Contact our team') != parameters[3] or (order.get('carrier') or 'Our delivery partner') != parameters[2])):
            return 'Dispatch details superseded'
    if event in TASK_EVENTS:
        task = record('tasks',entity_id)
        if not task or task['status'] == 'done':
            return 'Task completed or missing'
        if event == 'repair_ready' and task['status'] != 'ready':
            return 'Service is no longer ready'
        if event != 'repair_ready':
            if context and task['dueAt'] != context.get('dueAt'):
                return 'Task was rescheduled'
            if parse_date(task['dueAt']) < timestamp-86400000:
                return 'Task reminder is too old'
    return None


def relevance(message,timestamp=None):
    timestamp = now() if timestamp is None else timestamp
    contact = record('customers',message['customer_id'])
    if not contact or normalise_phone(contact.get('phone')) != message['phone']:
        return 'Customer phone changed; review recipient'
    if not message['phone'] or not consented(message['phone'],message['customer_id']):
        return 'WhatsApp consent required or withdrawn'
    allowed = [re.sub(r'\D','',v) for v in os.getenv('WHATSAPP_ALLOWED_RECIPIENTS','').split(',') if v.strip()]
    if allowed and message['phone'] not in allowed:
        return 'Recipient is not in the configured test-number allowlist'
    context = json.loads(message['context'])
    if context.get('workflowRunId'):
        from .workflows import delivery_reason
        reason = delivery_reason(context['workflowRunId'],timestamp)
        if reason:
            return reason
        if settings()['rules'][message['event']]['enabled']:
            return 'Built-in WhatsApp rule enabled; custom message held'
    elif not settings()['rules'][message['event']]['enabled']:
        return 'Automation rule disabled'
    if timestamp > message['not_before']+7*86400000:
        return 'Message expired; create a fresh update'
    return business_reason(message['event'],message['entity_id'],json.loads(message['parameters']),context,timestamp)


def manage_message(key,action,actor,confirmed=False):
    with transaction():
        message = one('SELECT * FROM wa_outbox WHERE id=?',key)
        check(message,'Message not found',404)
        check(message['status'] in ('queued','blocked','failed','uncertain'),'Message cannot be changed in this state',409)
        if action == 'cancel':
            run("UPDATE wa_outbox SET status='cancelled',updated_at=? WHERE id=?",now(),key)
        else:
            check(action in ('release','retry'),'Invalid message action')
            check(message['status'] != 'uncertain' or confirmed,'Reconcile the provider first, then confirm duplicate-send risk',409)
            contact = record('customers',message['customer_id']) or {}
            message['phone'] = normalise_phone(contact.get('phone')) or ''
            reason = relevance(message)
            check(not reason,reason or 'Message not eligible',409)
            if action == 'release':
                check(readiness()['ready'] and settings()['templates'][message['event']]['approved'],'Live credentials, enabled sending and approved template are required',409)
            run("UPDATE wa_outbox SET phone=?,mode=?,status='queued',error=NULL,not_before=?,lease_until=NULL,updated_at=? WHERE id=?",message['phone'],'live' if action == 'release' else 'preview',max(now(),message['not_before']),now(),key)
        audit(actor,f'whatsapp.message.{action}',key)
        return one('SELECT * FROM wa_outbox WHERE id=?',key)


def apply_statuses(provider_id):
    row = one('SELECT * FROM wa_outbox WHERE provider_id=?',provider_id)
    if not row:
        return
    ranks = {'processing':0,'uncertain':0,'failed':0,'sent':1,'delivered':2,'read':3}
    for event in all_rows('SELECT * FROM wa_status_events WHERE provider_id=? ORDER BY occurred_at',provider_id):
        next_status = event['status']
        if next_status not in ranks:
            continue
        if (ranks.get(row['status'],0)<2 if next_status == 'failed' else ranks[next_status]>ranks.get(row['status'],0)):
            row['status'] = next_status
            run('UPDATE wa_outbox SET status=?,error=?,updated_at=? WHERE id=?',next_status,(event['error'] or 'Provider delivery failed') if next_status == 'failed' else None,now(),row['id'])


def claim_message(timestamp,maximum):
    with transaction():
        bucket = f'whatsapp-send:{timestamp//60000}'
        rate = one('SELECT count FROM rate_limits WHERE id=?',bucket)
        if rate and rate['count'] >= maximum:
            return None
        candidate = one("SELECT * FROM wa_outbox WHERE mode='live' AND status='queued' AND not_before<=? ORDER BY not_before LIMIT 1",timestamp)
        if not candidate:
            return None
        claimed = one("UPDATE wa_outbox SET status='processing',attempts=attempts+1,lease_until=?,updated_at=? WHERE id=? AND status='queued' RETURNING *",timestamp+120000,timestamp,candidate['id'])
        if claimed:
            run('INSERT INTO rate_limits VALUES(?,1,?) ON CONFLICT(id) DO UPDATE SET count=count+1',bucket,timestamp+120000)
        return claimed


def dispatch(client=None,timestamp=None):
    timestamp = now() if timestamp is None else timestamp
    run("UPDATE wa_outbox SET status='uncertain',error='Worker lease expired; reconcile before retry',updated_at=? WHERE status='processing' AND lease_until<?",timestamp,timestamp)
    result = {'sent':0,'blocked':0,'failed':0,'uncertain':0,'preview':one("SELECT count(*) AS n FROM wa_outbox WHERE mode='preview' AND status='queued'")['n'],'paused':not readiness()['ready']}
    if result['paused']:
        return result
    conf = settings()
    hour = datetime.fromtimestamp(timestamp/1000,IST).hour
    if not conf['quietStart'] <= hour < conf['quietEnd']:
        return {**result,'quietHours':True}
    own_client = client is None
    client = client or httpx.Client(timeout=15,follow_redirects=False)
    try:
        for _ in range(conf['perMinute']):
            message = claim_message(timestamp,conf['perMinute'])
            if not message:
                break
            template = settings()['templates'][message['event']]
            reason = relevance(message,timestamp)
            if reason or not template['approved'] or not readiness()['ready']:
                run("UPDATE wa_outbox SET status='blocked',error=?,lease_until=NULL,updated_at=? WHERE id=?",reason or 'Approved template / live setup required',timestamp,message['id'])
                result['blocked'] += 1
                continue
            try:
                response = client.post(f'https://graph.facebook.com/{os.environ["WHATSAPP_GRAPH_VERSION"]}/{os.environ["WHATSAPP_PHONE_NUMBER_ID"]}/messages',headers={'Authorization':'Bearer '+os.environ['WHATSAPP_ACCESS_TOKEN']},json={'messaging_product':'whatsapp','recipient_type':'individual','to':message['phone'],'type':'template','template':{'name':template['name'],'language':{'code':template['language']},'components':[{'type':'body','parameters':[{'type':'text','text':str(v)} for v in json.loads(message['parameters'])]}]},'biz_opaque_callback_data':message['id']})
                try:
                    payload = response.json()
                except ValueError:
                    payload = {}
                provider_id = (payload.get('messages') or [{}])[0].get('id') if isinstance(payload,dict) else None
                if response.is_success and isinstance(provider_id,str):
                    with transaction():
                        run("UPDATE wa_outbox SET status=CASE WHEN status IN ('delivered','read') THEN status ELSE 'sent' END,provider_id=?,error=NULL,lease_until=NULL,updated_at=? WHERE id=?",provider_id,timestamp,message['id'])
                        apply_statuses(provider_id)
                    result['sent'] += 1
                elif response.status_code == 429 and isinstance(payload,dict) and payload.get('error') and message['attempts'] < 5:
                    run("UPDATE wa_outbox SET status='queued',error='Provider rate limit; retry scheduled',not_before=?,lease_until=NULL,updated_at=? WHERE id=?",timestamp+min(3600000,60000*2**message['attempts']),timestamp,message['id'])
                else:
                    uncertain = response.is_success or response.status_code >= 500
                    status = 'uncertain' if uncertain else 'failed'
                    run('UPDATE wa_outbox SET status=?,error=?,lease_until=NULL,updated_at=? WHERE id=?',status,f'Provider HTTP {response.status_code}; '+('reconcile before retry' if uncertain else 'check template/account/recipient'),timestamp,message['id'])
                    result[status] += 1
            except (httpx.HTTPError,ValueError,KeyError,TypeError,IndexError):
                run("UPDATE wa_outbox SET status='uncertain',error='Network outcome unknown; reconcile before retry',lease_until=NULL,updated_at=? WHERE id=?",timestamp,message['id'])
                result['uncertain'] += 1
    finally:
        if own_client:
            client.close()
    return result


def receive_webhook(payload):
    check(payload.get('object') == 'whatsapp_business_account','Unexpected webhook object')
    digest = hashlib.sha256(dumps(payload).encode()).hexdigest()
    with transaction():
        if one('SELECT id FROM wa_webhooks WHERE id=?',digest):
            return {'duplicate':True}
        run('INSERT INTO wa_webhooks VALUES(?,?)',digest,now())
        for entry in objects(payload.get('entry')):
            for change in objects(entry.get('changes')):
                value = object_value(change.get('value'))
                if object_value(value.get('metadata')).get('phone_number_id') != os.getenv('WHATSAPP_PHONE_NUMBER_ID'):
                    continue
                for status in objects(value.get('statuses')):
                    if not isinstance(status,dict) or not isinstance(status.get('id'),str) or status.get('status') not in ('sent','delivered','read','failed'):
                        continue
                    try:
                        timestamp = int(status['timestamp'])*1000
                    except (ValueError,KeyError,TypeError,OverflowError):
                        continue
                    if not 0 <= timestamp <= 253402300799000:
                        continue
                    key = hashlib.sha256(f'{status["id"]}:{status["status"]}:{timestamp}'.encode()).hexdigest()
                    code = next(iter(objects(status.get('errors'))),{}).get('code')
                    run('INSERT OR IGNORE INTO wa_status_events VALUES(?,?,?,?,?)',key,status['id'],status['status'],timestamp,f'Provider delivery code {str(code)[:20]}' if code else None)
                    callback = status.get('biz_opaque_callback_data')
                    if isinstance(callback,str):
                        pending = one("SELECT * FROM wa_outbox WHERE id=? AND provider_id IS NULL AND mode='live' AND status IN ('processing','uncertain')",callback)
                        if pending and pending['phone'] == status.get('recipient_id'):
                            run('UPDATE wa_outbox SET provider_id=? WHERE id=?',status['id'],pending['id'])
                    apply_statuses(status['id'])
                for message in objects(value.get('messages')):
                    if not isinstance(message,dict) or not isinstance(message.get('id'),str) or not isinstance(message.get('from'),str):
                        continue
                    phone = normalise_phone('+'+message['from'])
                    if not phone:
                        continue
                    interactive = object_value(message.get('interactive'))
                    content = str(object_value(message.get('text')).get('body') or object_value(message.get('button')).get('text') or object_value(interactive.get('button_reply')).get('title') or object_value(interactive.get('list_reply')).get('title') or f'[{message.get("type","message")}]')[:4000]
                    inserted = run('INSERT OR IGNORE INTO wa_inbox VALUES(?,?,?,?,?)',message['id'],phone,content,str(message.get('type','unknown'))[:40],now()).rowcount
                    command = content.strip().upper()
                    if inserted and command in ('STOP','UNSUBSCRIBE','START','SUBSCRIBE'):
                        previous = one('SELECT customer_id FROM wa_consents WHERE phone=?',phone)
                        contact = record('customers',previous['customer_id']) if previous and previous['customer_id'] else next((c for c in records('customers') if normalise_phone(c.get('phone')) == phone),None)
                        opted_in = command in ('START','SUBSCRIBE')
                        run('INSERT INTO wa_consents VALUES(?,?,?,?,?) ON CONFLICT(phone) DO UPDATE SET opted_in=excluded.opted_in,source=excluded.source,updated_at=excluded.updated_at',phone,contact['id'] if contact else None,int(opted_in),'WhatsApp inbound '+command,now())
                        if not opted_in:
                            run("UPDATE wa_outbox SET status='blocked',error='Customer opted out via WhatsApp',updated_at=? WHERE phone=? AND status IN ('queued','blocked')",now(),phone)
        return {'duplicate':False}


def overview():
    return {'settings':settings(),'readiness':readiness(),'credentialImport':(record('settings','whatsapp') or {}).get('importedTemplate'),'definitions':EVENTS,'messages':all_rows('SELECT * FROM wa_outbox ORDER BY created_at DESC LIMIT 500'),'inbox':all_rows('SELECT * FROM wa_inbox ORDER BY received_at DESC LIMIT 200'),'consents':all_rows('SELECT * FROM wa_consents ORDER BY updated_at DESC')}
