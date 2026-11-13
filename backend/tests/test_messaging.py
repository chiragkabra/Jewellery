import hashlib
import hmac
import json
import httpx
import pytest
from backend.core import *
from backend import messaging as wa, business, workflows as wf


@pytest.mark.parametrize('value,expected',[('+91 98765 43210','919876543210'),('0091-9876543210','919876543210'),('+1 (212) 555-0100','12125550100'),('9876543210',None),('+0123456789',None),('+1234567',None),('+1234567890123456',None),('abc',None),(None,None),('+91+9876543210',None)])
def test_phone_normalisation(value,expected):
    assert wa.normalise_phone(value)==expected


def live(monkeypatch):
    for key,value in {'WHATSAPP_MODE':'live','WHATSAPP_ACCESS_TOKEN':'synthetic-token','APP_URL':'https://shop.example.test'}.items(): monkeypatch.setenv(key,value)
    conf = wa.settings()
    conf.update({'enabled':True,'quietStart':0,'quietEnd':24,'perMinute':10})
    conf['templates']['enquiry_received']['approved'] = True
    save('settings','whatsapp',conf)


def queued(contact,monkeypatch,ready=True):
    wa.set_consent(contact['id'],contact['phone'],True,'Synthetic explicit consent')
    if ready: live(monkeypatch)
    return wa.queue_whatsapp('enquiry_received','ENQ-TEST',contact['id'],['Asha','ENQ-TEST'])


def test_preview_never_auto_released(store,contact,monkeypatch):
    message = queued(contact,monkeypatch,False)
    assert message['mode']=='preview' and message['status']=='queued'
    live(monkeypatch)
    with httpx.Client(transport=httpx.MockTransport(lambda request:pytest.fail('Preview must not send'))) as client:
        assert wa.dispatch(client)['sent']==0
    assert one('SELECT mode FROM wa_outbox')['mode']=='preview'


def test_consent_dedup_and_withdrawal(store,contact):
    first = wa.queue_whatsapp('enquiry_received','ENQ-X',contact['id'],['Asha','ENQ-X'])
    assert first['status']=='blocked'
    assert wa.queue_whatsapp('enquiry_received','ENQ-X',contact['id'],['Asha','ENQ-X'])['id']==first['id']
    assert one('SELECT count(*) AS n FROM auto_events')['n']==1
    wa.set_consent(contact['id'],contact['phone'],True,'Explicit checkbox')
    released = wa.manage_message(first['id'],'retry','admin')
    assert released['mode']=='preview' and released['status']=='queued'
    wa.set_consent(contact['id'],contact['phone'],False,'Opt out')
    assert one('SELECT status FROM wa_outbox')['status']=='blocked'


@pytest.mark.parametrize('status,payload,expected',[(200,{'messages':[{'id':'wamid.fake'}]},'sent'),(400,{'error':{'code':100}},'failed'),(500,{'error':{}},'uncertain'),(200,{},'uncertain'),(429,{'error':{'code':4}},'queued')])
def test_dispatch_provider_outcomes(store,contact,monkeypatch,status,payload,expected):
    message = queued(contact,monkeypatch)
    requests = []
    def send(request):
        requests.append(json.loads(request.content))
        return httpx.Response(status,json=payload)
    with httpx.Client(transport=httpx.MockTransport(send)) as client:
        wa.dispatch(client)
    result = one('SELECT * FROM wa_outbox WHERE id=?',message['id'])
    assert result['status']==expected and result['attempts']==1
    assert requests[0]['to']=='919876543210' and requests[0]['biz_opaque_callback_data']==message['id']
    if expected=='queued': assert result['not_before']>now()


def test_timeout_requires_reconciliation(store,contact,monkeypatch):
    message = queued(contact,monkeypatch)
    def timeout(request): raise httpx.ReadTimeout('Synthetic timeout')
    with httpx.Client(transport=httpx.MockTransport(timeout)) as client:
        assert wa.dispatch(client)['uncertain']==1
        assert wa.dispatch(client)['uncertain']==0
    with pytest.raises(ApiError,match='Reconcile'):
        wa.manage_message(message['id'],'release','admin')
    assert wa.manage_message(message['id'],'cancel','admin')['status']=='cancelled'


@pytest.mark.parametrize('change,reason',[('phone','phone changed'),('consent','consent'),('rule','rule disabled'),('allowlist','allowlist'),('expired','expired')])
def test_send_rechecks_eligibility(store,contact,monkeypatch,change,reason):
    message = queued(contact,monkeypatch)
    if change=='phone': save('customers',contact['id'],{**contact,'phone':'+919876543211'})
    elif change=='consent': run('UPDATE wa_consents SET opted_in=0')
    elif change=='rule':
        conf = wa.settings(); conf['rules']['enquiry_received']['enabled']=False;save('settings','whatsapp',conf)
    elif change=='allowlist': monkeypatch.setenv('WHATSAPP_ALLOWED_RECIPIENTS','919876543211')
    else: run('UPDATE wa_outbox SET not_before=?',now()-8*86400000)
    with httpx.Client(transport=httpx.MockTransport(lambda request:pytest.fail('Ineligible message sent'))) as client:
        assert wa.dispatch(client)['blocked']==1
    assert reason.lower() in one('SELECT error FROM wa_outbox')['error'].lower()


def test_quiet_hours_and_global_rate_limit(store,contact,monkeypatch):
    queued(contact,monkeypatch)
    conf = wa.settings();conf.update({'quietStart':9,'quietEnd':20,'perMinute':1});save('settings','whatsapp',conf)
    timestamp = parse_date('2026-11-14T03:00:00+05:30')
    with httpx.Client(transport=httpx.MockTransport(lambda request:pytest.fail('Quiet hours send'))) as client:
        assert wa.dispatch(client,timestamp)['quietHours'] is True
    conf.update({'quietStart':0,'quietEnd':24});save('settings','whatsapp',conf)
    wa.queue_whatsapp('enquiry_received','ENQ-2',contact['id'],['Asha','ENQ-2'])
    with httpx.Client(transport=httpx.MockTransport(lambda request:httpx.Response(200,json={'messages':[{'id':uid()}]}))) as client:
        timestamp = now()
        assert wa.dispatch(client,timestamp)['sent']==1
        assert wa.dispatch(client,timestamp)['sent']==0


def incoming(command='STOP',identifier='wamid.inbound'):
    return {'object':'whatsapp_business_account','entry':[{'changes':[{'value':{'metadata':{'phone_number_id':'123456'},'messages':[{'id':identifier,'from':'919876543210','type':'text','text':{'body':command}}]}}]}]}


def test_signed_webhook_stop_start_and_dedup(admin,store,contact):
    wa.set_consent(contact['id'],contact['phone'],True,'Synthetic consent')
    wa.queue_whatsapp('enquiry_received','ENQ-X',contact['id'],['Asha','ENQ-X'])
    data = incoming()
    assert admin.post('/api/whatsapp/webhook',json=data).status_code==401
    def send(data):
        raw = dumps(data).encode()
        signature = 'sha256='+hmac.new(b'synthetic-meta-signing-secret',raw,hashlib.sha256).hexdigest()
        return admin.post('/api/whatsapp/webhook',content=raw,headers={'Content-Type':'application/json','x-hub-signature-256':signature})
    assert send(data).json()['duplicate'] is False
    assert send(data).json()['duplicate'] is True
    assert not wa.consented('919876543210',contact['id'])
    assert one('SELECT status FROM wa_outbox')['status']=='blocked'
    assert send(incoming('START','wamid.start')).status_code==200
    assert wa.consented('919876543210',contact['id'])
    assert one('SELECT count(*) AS n FROM wa_inbox')['n']==2


def test_webhook_verify_token(client):
    assert client.get('/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=123').status_code==403
    assert client.get('/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=synthetic-verify&hub.challenge=123').text=='123'
    assert client.get('/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=synthetic-verify&hub.challenge=abc').status_code==400


def test_provider_status_ordering_and_callback_reconciliation(store,contact,monkeypatch):
    message = queued(contact,monkeypatch)
    run("UPDATE wa_outbox SET status='uncertain' WHERE id=?",message['id'])
    def payload(status,timestamp):
        return {'object':'whatsapp_business_account','entry':[{'changes':[{'value':{'metadata':{'phone_number_id':'123456'},'statuses':[{'id':'wamid.status','status':status,'timestamp':str(timestamp),'recipient_id':message['phone'],'biz_opaque_callback_data':message['id']}]}}]}]}
    wa.receive_webhook(payload('read',3))
    wa.receive_webhook(payload('sent',1))
    wa.receive_webhook(payload('failed',4))
    result = one('SELECT * FROM wa_outbox WHERE id=?',message['id'])
    assert result['provider_id']=='wamid.status' and result['status']=='read'


def test_expired_lease_is_uncertain(store,contact,monkeypatch):
    message = queued(contact,monkeypatch)
    run("UPDATE wa_outbox SET status='processing',lease_until=? WHERE id=?",now()-1,message['id'])
    wa.dispatch()
    assert one('SELECT status FROM wa_outbox')['status']=='uncertain'


def test_task_messages_reschedule_and_completion(store,contact):
    wa.set_consent(contact['id'],contact['phone'],True,'Synthetic appointment consent')
    task = save('tasks','TASK-1',{'title':'Appointment','kind':'appointment','status':'open','dueAt':iso(now()+DAY)},contact['id'])
    wa.queue_task_messages(task)
    assert one('SELECT count(*) AS n FROM wa_outbox')['n']==2
    newer = save('tasks',task['id'],{**task,'dueAt':iso(now()+2*DAY)},contact['id'])
    wa.queue_task_messages(newer,task)
    old = one("SELECT * FROM wa_outbox WHERE event='follow_up' ORDER BY created_at LIMIT 1")
    assert 'rescheduled' in wa.relevance(old)
    done = save('tasks',task['id'],{**newer,'status':'done'},contact['id'])
    wa.queue_task_messages(done,newer)
    assert all(r['status']=='cancelled' for r in all_rows('SELECT status FROM wa_outbox'))


DAY = 86400000
