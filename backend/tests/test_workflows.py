import copy
import httpx
import pytest
from backend.core import *
from backend import workflows as wf, messaging as wa, mail, business


def definition(trigger='inventory_low',mode='live'):
    return {'name':'Synthetic workflow','trigger':trigger,'mode':mode,'match':'all','conditions':[],'steps':[{'id':'alert','type':'staff_alert','title':'Review {{reference}}','body':'Synthetic staff alert','priority':'normal'}],'cooldownMinutes':0,'scheduleHour':9,'scheduleMinute':0}


def publish(data):
    key = wf.save_workflow(data,'admin')
    wf.publish_workflow(key,'admin')
    return key


def stock_event(product):
    save('products',product['id'],{**product,'stock':1})
    return wf.emit_event('inventory_low','stock:'+uid(),product['id'],None,{'stock':1,'productName':product['name']})


@pytest.mark.parametrize('patch',[{'name':''},{'trigger':'unknown'},{'mode':'bad'},{'match':'bad'},{'conditions':None},{'steps':[]},{'steps':[{'id':'a','type':'delay','minutes':1}]},{'cooldownMinutes':-1},{'scheduleHour':24},{'scheduleMinute':60},{'steps':[{'id':'../x','type':'staff_alert','title':'T','body':'B'}]},{'steps':[{'id':'a','type':'staff_alert','title':'{{secret}}','body':'B'}]},{'steps':[{'id':'a','type':'staff_alert','title':'{{broken','body':'B'}]},{'steps':[{'id':'a','type':'whatsapp'}]},{'steps':[{'id':'a','type':'email','title':'T','body':'B','recipient':'customer'}]},{'conditions':[{'field':'stock','operator':'greater_than','value':'abc'}]}])
def test_definition_validation(patch):
    with pytest.raises(ApiError): wf.validate_definition({**definition(),**patch})


@pytest.mark.parametrize('value',[None,[],1,'bad'])
def test_invalid_definition_shape(value):
    with pytest.raises(ApiError): wf.validate_definition(value)


@pytest.mark.parametrize('operator,value,expected',[('equals','1',True),('not_equals','1',False),('contains','1',True),('greater_than','0',True),('less_than','2',True),('equals','3',False)])
def test_condition_operators(operator,value,expected):
    data = definition();data['conditions']=[{'field':'stock','operator':operator,'value':value}]
    assert wf.conditions_match(data,{'stock':1}) is expected
    assert wf.conditions_match(data,{}) is False


def test_all_any_and_required_variables():
    data = definition();data['conditions']=[{'field':'stock','operator':'equals','value':'1'},{'field':'status','operator':'equals','value':'paid'}]
    assert wf.conditions_match(data,{'stock':1}) is False
    data['match']='any'
    assert wf.conditions_match(data,{'stock':1}) is True
    with pytest.raises(ApiError,match='Missing'): wf.render('{{customerName}}',{})
    assert wf.render('Stock {{stock}}',{'stock':0})=='Stock 0'


def test_dry_run_has_no_side_effects(store):
    result = wf.test_workflow(definition())
    assert result['dryRun'] and result['matches'] and result['steps'][0]['title']=='Review PREVIEW-001'
    for table in ('auto_runs','auto_alerts','auto_tasks','auto_emails'):
        assert one(f'SELECT count(*) AS n FROM {table}')['n']==0


def test_draft_preview_publish_pause_and_history(admin,store,product):
    data = definition(mode='preview')
    key = admin.post('/api/automations/save',json={'definition':data}).json()['id']
    stock_event(product);wf.process()
    assert one('SELECT count(*) AS n FROM auto_runs')['n']==0
    assert admin.post('/api/automations/publish/'+key,json={}).status_code==200
    stock_event(product);wf.process()
    result = one('SELECT * FROM auto_runs')
    assert result['status']=='completed' and json.loads(result['logs'])[0]['output']['preview'] is True
    assert one('SELECT count(*) AS n FROM auto_alerts')['n']==0
    assert admin.post('/api/automations/pause/'+key,json={}).status_code==200
    stock_event(product);wf.process()
    assert one('SELECT count(*) AS n FROM auto_runs')['n']==1
    overview = admin.get('/api/automations/overview').json()
    assert overview['workflows'] and overview['runs'] and overview['worker']['lastCheckedAt']


def test_event_watermark_and_exactly_once_steps(store,product):
    stock_event(product)
    key = publish(definition())
    wf.process()
    assert not one('SELECT * FROM auto_runs')
    stock_event(product)
    wf.process();wf.process()
    assert one('SELECT count(*) AS n FROM auto_alerts')['n']==1
    assert one('SELECT count(*) AS n FROM auto_runs')['n']==1


def test_delay_and_immutable_published_definition(store,product):
    data = definition();data['steps']=[{'id':'delay','type':'delay','minutes':5},*data['steps']]
    key = publish(data)
    stock_event(product)
    timestamp = now()
    wf.process(timestamp)
    assert one('SELECT status FROM auto_runs')['status']=='waiting'
    wf.save_workflow({**data,'steps':[{'id':'changed','type':'staff_alert','title':'Changed','body':'Changed'}]},'admin',key)
    wf.process(timestamp+5*60000)
    assert one('SELECT status FROM auto_runs')['status']=='completed'
    assert one('SELECT title FROM auto_alerts')['title'].startswith('Review ')


def test_long_delay_not_expired_by_source_age(store,contact):
    data = definition('enquiry_received');data['steps']=[{'id':'delay','type':'delay','minutes':43200},*data['steps']]
    publish(data)
    wf.emit_event('enquiry_received',uid(),'ENQ-LONG',contact['id'],{})
    timestamp = now();wf.process(timestamp);wf.process(timestamp+30*86400000)
    assert one('SELECT status FROM auto_runs')['status']=='completed'


def test_pause_and_republish_cancel_pending_channels(store,product):
    data = definition();data['steps']=[{'id':'delay','type':'delay','minutes':5},*data['steps']]
    key = publish(data);stock_event(product);wf.process()
    wf.publish_workflow(key,'admin')
    assert one('SELECT status FROM auto_runs')['status']=='cancelled'
    stock_event(product);wf.process();wf.pause_workflow(key,'admin')
    wf.process(now()+300000)
    assert all(r['status']=='cancelled' for r in all_rows('SELECT status FROM auto_runs'))
    assert not one('SELECT * FROM auto_alerts')


def test_retry_resumes_cursor_without_repeating_action(store,contact):
    data = definition('enquiry_received');data['steps'].append({'id':'missing','type':'staff_alert','title':'{{tracking}}','body':'Missing tracking'})
    publish(data)
    wf.emit_event('enquiry_received',uid(),'ENQ-FAIL',contact['id'],{})
    wf.process()
    item = one('SELECT * FROM auto_runs')
    assert item['status']=='failed' and item['cursor']==1
    wf.retry_run(item['id'],'admin');wf.process()
    assert one('SELECT count(*) AS n FROM auto_alerts')['n']==1
    assert one('SELECT status FROM auto_runs')['status']=='failed'


def test_stale_stock_and_condition_recheck(store,product):
    data = definition();data['steps']=[{'id':'delay','type':'delay','minutes':1},*data['steps']]
    publish(data);stock_event(product)
    timestamp=now();wf.process(timestamp)
    save('products',product['id'],{**product,'stock':10})
    wf.process(timestamp+60000)
    assert one('SELECT status FROM auto_runs')['status']=='skipped'
    assert not one('SELECT * FROM auto_alerts')


def test_cooldown_and_expired_events(store,product):
    publish({**definition(),'cooldownMinutes':60})
    stock_event(product);stock_event(product);wf.process()
    statuses = [r['status'] for r in all_rows('SELECT status FROM auto_runs')]
    assert sorted(statuses)==['completed','skipped']
    key = stock_event(product)
    run('UPDATE auto_events SET available_at=? WHERE id=?',now()-8*86400000,key)
    wf.process()
    assert one('SELECT error FROM auto_runs WHERE event_id=?',key)['error']=='Event expired'


def test_daily_ist_schedule_once_per_day(store,monkeypatch):
    due = parse_date('2026-11-15T09:00:00+05:30')
    monkeypatch.setattr(wf,'now',lambda:due-1000)
    publish(definition('daily_schedule'))
    wf.process(due-1)
    assert not one('SELECT * FROM auto_runs')
    wf.process(due);wf.process(due+1000)
    assert one('SELECT count(*) AS n FROM auto_runs')['n']==1
    wf.process(due+86400000)
    assert one('SELECT count(*) AS n FROM auto_runs')['n']==2


def test_native_whatsapp_takeover_and_no_recursion(store,contact):
    data = definition('enquiry_received');data['steps']=[{'id':'wa','type':'whatsapp'}]
    key = wf.save_workflow(data,'admin')
    with pytest.raises(ApiError,match='Confirm taking over'): wf.publish_workflow(key,'admin')
    wf.publish_workflow(key,'admin',True)
    with pytest.raises(ApiError): wf.set_native_rule('enquiry_received',True,0,'admin')
    other = wf.save_workflow(data,'admin')
    with pytest.raises(ApiError,match='Another'): wf.publish_workflow(other,'admin',True)
    wa.set_consent(contact['id'],contact['phone'],True,'Synthetic consent')
    wa.queue_whatsapp('enquiry_received','ENQ-WF',contact['id'],['Asha','ENQ-WF'])
    wf.process();wf.process()
    assert one('SELECT count(*) AS n FROM auto_events')['n']==1
    assert one('SELECT count(*) AS n FROM auto_runs')['n']==1
    messages = all_rows('SELECT * FROM wa_outbox')
    assert len(messages)==2 and sorted(m['status'] for m in messages)==['cancelled','queued']


def email_run(store,contact):
    data = definition('enquiry_received')
    data['steps']=[{'id':'email','type':'email','title':'Enquiry {{reference}}','body':'Hello {{customerName}}','recipient':'customer'}]
    key = publish(data)
    wf.emit_event('enquiry_received',uid(),'ENQ-EMAIL',contact['id'],{})
    wf.process()
    return key,one('SELECT * FROM auto_emails')


def live_email(monkeypatch):
    for key,value in {'EMAIL_MODE':'live','RESEND_API_KEY':'synthetic-key','EMAIL_FROM':'desk@example.test'}.items(): monkeypatch.setenv(key,value)


@pytest.mark.parametrize('status,payload,expected',[(200,{'id':'email.fake'},'sent'),(400,{},'failed'),(500,{},'uncertain'),(200,{},'uncertain'),(429,{},'queued')])
def test_email_provider_outcomes(store,contact,monkeypatch,status,payload,expected):
    _,message=email_run(store,contact)
    live_email(monkeypatch)
    mail.manage_email(message['id'],'release','admin')
    sent=[]
    def provider(request):
        sent.append(request)
        return httpx.Response(status,json=payload)
    with httpx.Client(transport=httpx.MockTransport(provider)) as client: mail.dispatch(client)
    assert one('SELECT status FROM auto_emails')['status']==expected
    assert sent[0].headers['Idempotency-Key']=='lumera/'+message['id']


def test_email_preview_timeout_pause_and_uncertain_guard(store,contact,monkeypatch):
    key,message=email_run(store,contact)
    assert message['status']=='preview'
    live_email(monkeypatch)
    assert mail.dispatch()['accepted']==0
    mail.manage_email(message['id'],'release','admin')
    def timeout(request): raise httpx.ReadTimeout('Synthetic timeout')
    with httpx.Client(transport=httpx.MockTransport(timeout)) as client:
        assert mail.dispatch(client)['uncertain']==1
        assert mail.dispatch(client)['uncertain']==0
    with pytest.raises(ApiError,match='Reconcile'): mail.manage_email(message['id'],'release','admin')
    wf.pause_workflow(key,'admin')
    with pytest.raises(ApiError,match='paused'): mail.manage_email(message['id'],'release','admin',True)
    mail.manage_email(message['id'],'cancel','admin')


def test_email_allowlist_and_expired_preview(store,contact,monkeypatch):
    _,message=email_run(store,contact)
    run('UPDATE auto_emails SET created_at=?',now()-8*86400000)
    with pytest.raises(ApiError,match='expired'): mail.manage_email(message['id'],'release','admin')
    run('UPDATE auto_emails SET created_at=?',now())
    live_email(monkeypatch);mail.manage_email(message['id'],'release','admin')
    monkeypatch.setenv('EMAIL_ALLOWED_RECIPIENTS','other@example.test')
    with httpx.Client(transport=httpx.MockTransport(lambda request:pytest.fail('Unexpected email'))) as client: mail.dispatch(client)
    assert one('SELECT status FROM auto_emails')['status']=='cancelled'


def test_operations_tasks_alert_ack_and_duplicate(admin,store,product):
    data=definition();data['steps'].append({'id':'task','type':'create_task','title':'Restock {{productName}}','body':'Review inventory','minutes':1440})
    key=publish(data);stock_event(product);wf.process()
    alert=one('SELECT * FROM auto_alerts');task=one('SELECT * FROM auto_tasks')
    assert admin.post('/api/automations/alerts/'+alert['id'],json={}).status_code==200
    assert admin.post('/api/automations/tasks/'+task['id'],json={'status':'done'}).status_code==200
    assert one('SELECT acknowledged FROM auto_alerts')['acknowledged']==1
    assert one('SELECT status FROM auto_tasks')['status']=='done'
    duplicate=admin.post('/api/automations/duplicate/'+key,json={})
    assert duplicate.status_code==200
    copy=one('SELECT * FROM auto_workflows WHERE id=?',duplicate.json()['id'])
    assert not copy['enabled'] and json.loads(copy['draft'])['mode']=='preview'
