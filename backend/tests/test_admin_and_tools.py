import json
import subprocess
import sys
import pytest
from backend.core import *
from backend import messaging as wa, workflows as wf
from backend.credentials import parse_credentials, import_credentials


def test_whatsapp_settings_permissions_and_validation(admin,store):
    data=admin.get('/api/whatsapp/overview').json()['settings']
    response=admin.post('/api/whatsapp/settings',json=data)
    assert response.status_code==200
    for patch in ({'quietStart':24},{'quietEnd':9},{'perMinute':0},{'rules':[]},{'enabled':'yes'}):
        assert admin.post('/api/whatsapp/settings',json={**data,**patch}).status_code==400
    from backend.tests.test_api import login
    login(admin,'staff')
    assert admin.post('/api/whatsapp/settings',json=data).status_code==403
    assert admin.post('/api/automations/save',json={'definition':{}}).status_code==403
    assert admin.post('/api/automations/test',json={'definition':seed('automations')[0]['definition']}).status_code==200
    assert admin.post('/api/whatsapp/dispatch',json={}).status_code==403


def test_whatsapp_consent_and_message_api(admin,contact,store):
    message=wa.queue_whatsapp('enquiry_received','ENQ-1',contact['id'],['Asha','ENQ-1'])
    response=admin.post('/api/whatsapp/consent',json={'customerId':contact['id'],'phone':contact['phone'],'optedIn':True,'source':'Synthetic opt-in'})
    assert response.status_code==200
    response=admin.post('/api/whatsapp/messages/'+message['id'],json={'action':'retry'})
    assert response.status_code==200 and response.json()['item']['mode']=='preview'
    assert admin.post('/api/whatsapp/messages/'+message['id'],json={'action':'release'}).status_code==409
    assert admin.post('/api/whatsapp/messages/'+message['id'],json={'action':'cancel'}).status_code==200
    assert admin.post('/api/whatsapp/dispatch',json={}).json()['paused']
    assert 'synthetic-meta-signing-secret' not in admin.get('/api/whatsapp/overview').text


@pytest.mark.parametrize('entry',[None,{},[None],['bad'],[{'changes':'bad'}],[{'changes':[{'value':{'metadata':'bad'}}]}],[{'changes':[{'value':{'metadata':{'phone_number_id':'123456'},'statuses':[{'id':'x','status':'read','timestamp':'9'*100}],'messages':[{'id':'bad-text','from':'919876543210','text':'unexpected'}]}}]}]])
def test_webhook_nested_shapes_safe(store,entry):
    assert wa.receive_webhook({'object':'whatsapp_business_account','entry':entry})['duplicate'] is False


def test_credential_parser_and_preview_import(tmp_path,monkeypatch):
    token='EAA'+'x'*40
    payload={'template':{'name':'synthetic_purchase','language':{'code':'en_US'},'components':[{'type':'body','parameters':[{}, {}, {}]}]}}
    raw=f"curl https://graph.facebook.com/v23.0/123456/messages -H 'Authorization: Bearer {token}' -d '{json.dumps(payload)}'"
    values,template=parse_credentials(raw)
    assert values['WHATSAPP_ACCESS_TOKEN']==token and template['parameterCount']==3
    source=tmp_path/'cred';source.write_text(raw)
    project=tmp_path/'project';project.mkdir()
    db=connect(project/'data/lumera.sqlite');initialize(db);db.close()
    result=import_credentials(source,project)
    assert result['mode']=='preview' and token not in dumps(result)
    from dotenv import dotenv_values
    imported=dotenv_values(project/'.env.local')
    assert imported['WHATSAPP_ACCESS_TOKEN']==token and len(imported['WHATSAPP_CRON_SECRET'])>=32
    db=connect(project/'data/lumera.sqlite')
    with database(db):
        settings=record('settings','whatsapp')
        assert settings['enabled'] is False and settings['templates']['purchase_confirmed']['approved'] is False
    db.close()


def test_cli_admin_reset_and_online_backup(tmp_path,monkeypatch):
    path=tmp_path/'cli.sqlite'
    env={**os.environ,'DATABASE_PATH':str(path),'AUTOMATION_WORKER_ENABLED':'false'}
    def cli(*args):return subprocess.run([sys.executable,'-m','backend',*args],env=env,capture_output=True,text=True,timeout=30)
    response=cli('admin','--email','owner@example.test')
    assert response.returncode==0 and 'Password:' in response.stdout
    assert cli('admin','--email','owner@example.test').returncode==1
    assert cli('admin','--email','owner@example.test','--reset').returncode==0
    backup=tmp_path/'backup.sqlite'
    assert cli('backup',str(backup)).returncode==0
    db=connect(backup)
    with database(db):assert one('SELECT email FROM users')['email']=='owner@example.test'
    db.close()
    assert cli('backup',str(path)).returncode==1


def test_workflow_http_actions(admin,store,contact):
    definition=seed('automations')[0]['definition']
    key=admin.post('/api/automations/save',json={'definition':definition}).json()['id']
    assert admin.post('/api/automations/publish/'+key,json={}).status_code==200
    assert admin.post('/api/automations/native-rule',json={'event':'follow_up','enabled':False,'delayMinutes':15}).status_code==200
    assert admin.post('/api/automations/process',json={}).status_code==200
    assert admin.post('/api/automations/test',json={'definition':definition,'eventId':'missing'}).status_code==404
    assert admin.post('/api/automations/test',json={'definition':definition,'eventId':{}}).status_code==400
    assert admin.post('/api/automations/retry/missing',json={}).status_code==409
    assert admin.post('/api/automations/native-rule',json={'event':{},'enabled':True,'delayMinutes':0}).status_code==400
    assert admin.post('/api/automations/emails/missing',json={'action':'release'}).status_code==404


def test_worker_cli_preview(tmp_path):
    env={**os.environ,'DATABASE_PATH':str(tmp_path/'worker.sqlite'),'AUTOMATION_WORKER_ENABLED':'false','WHATSAPP_MODE':'preview','EMAIL_MODE':'preview'}
    result=subprocess.run([sys.executable,'-m','backend','worker'],env=env,capture_output=True,text=True,timeout=30)
    assert result.returncode==0,result.stderr
    assert json.loads(result.stdout)['whatsapp']['paused'] is True


def test_embedded_scheduler_start_and_shutdown(client,tmp_path):
    import time
    from fastapi.testclient import TestClient
    from backend.app import create_app
    app=create_app(str(tmp_path/'embedded.sqlite'),worker_enabled=True)
    with TestClient(app) as live:
        assert live.get('/api/health').status_code==200
        checked=False
        for _ in range(50):
            db=connect(app.state.database_path)
            with database(db):checked=bool(record('settings','automation-worker'))
            db.close()
            if checked:break
            time.sleep(.02)
        assert checked,'Embedded scheduler did not process its first cycle'
