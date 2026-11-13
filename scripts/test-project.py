"""Production frontend -> Python integration checks, using a temporary DB only."""
import hashlib
import hmac
import json
import os
from pathlib import Path
import secrets
import socket
import subprocess
import sys
import tempfile
import time
import uuid
import httpx

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from backend.core import connect, database, hash_password, initialize, iso, run


def free_port():
    with socket.socket() as sock:
        sock.bind(('127.0.0.1',0))
        return sock.getsockname()[1]


def main():
    results=[]
    with tempfile.TemporaryDirectory(prefix='lumera-python-e2e-') as folder:
        python_port,next_port=free_port(),free_port()
        base=f'http://127.0.0.1:{next_port}'
        backend=f'http://127.0.0.1:{python_port}'
        password=secrets.token_urlsafe(20)
        db_path=str(Path(folder)/'integration.sqlite')
        env={**os.environ,'DATABASE_PATH':db_path,'APP_URL':base,'PYTHON_BACKEND_URL':backend,'COOKIE_SECURE':'false','AUTOMATION_WORKER_ENABLED':'false','WHATSAPP_WORKER_ENABLED':'false','EMAIL_MODE':'preview','EMAIL_FROM':'','RESEND_API_KEY':'','WHATSAPP_MODE':'preview','WHATSAPP_ACCESS_TOKEN':'','WHATSAPP_APP_SECRET':'synthetic-signature-secret','WHATSAPP_VERIFY_TOKEN':'synthetic-verify','WHATSAPP_PHONE_NUMBER_ID':'123456','AUTOMATION_CRON_SECRET':'synthetic-secret-with-at-least-32-characters','WHATSAPP_CRON_SECRET':'','NEXT_TELEMETRY_DISABLED':'1'}
        db=connect(db_path)
        initialize(db)
        with database(db):run('INSERT INTO users VALUES(?,?,?,?,?,?)','owner','owner@example.test','Owner',hash_password(password),'admin',iso())
        db.close()
        processes=[]
        output=open(Path(folder)/'servers.log','w',encoding='utf-8')
        def start(args):
            p=subprocess.Popen(args,cwd=ROOT,env=env,stdout=output,stderr=output,creationflags=subprocess.CREATE_NO_WINDOW if os.name=='nt' else 0)
            processes.append(p)
        def wait(url):
            for _ in range(120):
                if any(p.poll() is not None for p in processes):raise RuntimeError('Integration server exited')
                try:
                    if httpx.get(url,timeout=1).status_code==200:return
                except httpx.HTTPError:pass
                time.sleep(.5)
            raise RuntimeError('Integration server did not become ready')
        def passed(name):results.append(name);print('PASS '+name,flush=True)
        try:
            start([sys.executable,'-m','backend','serve','--port',str(python_port)])
            wait(backend+'/api/health')
            start(['node','node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','-p',str(next_port)])
            wait(base+'/api/health')
            with httpx.Client(base_url=base,timeout=30,follow_redirects=False,headers={'Origin':base}) as client:
                response=client.get('/api/health');assert response.json()['backend']=='python' and response.headers['x-lumera-backend']=='python'
                passed('Production frontend reaches Python API on a runtime-configured port')
                assert client.get('/crm').status_code==307
                response=client.post('/api/auth',json={'action':'login','email':'owner@example.test','password':password})
                assert response.status_code==200 and client.cookies.get('lumera_session') and 'HttpOnly' in response.headers['set-cookie']
                assert client.get('/crm').status_code==200
                passed('Python session cookies authenticate the server-rendered CRM')
                assert client.post('/api/crm/customers',json={'name':'Blocked','email':'x@example.test'},headers={'Origin':'https://evil.example'}).status_code==403
                passed('Frontend proxy preserves origin security checks')
                data={'form':'contact','name':'Asha','email':'asha@example.test','phone':'+919876543210','whatsappConsent':True}
                response=client.post('/api/enquiry',json=data);assert response.status_code==201
                lead=response.json()['reference']
                payload=json.dumps({**data,'form':'trade-application','company':'Asha Jewels'})
                response=client.post('/api/enquiry',data={'payload':payload},files={'gst':('proof.pdf',b'%PDF-1.7\nSynthetic','application/pdf')});assert response.status_code==201,response.text
                uploaded=client.get('/api/crm/enquiries/'+response.json()['reference']).json()['item']['attachments'][0]['id']
                assert client.get('/api/crm/attachments/'+uploaded).content==b'%PDF-1.7\nSynthetic'
                passed('Enquiry JSON and private multipart documents survive the proxy')
                product=client.get('/api/products').json()['products'][0];slug=product['slug']
                assert client.patch('/api/crm/products/'+slug,json={'price':12500,'stock':2}).status_code==200
                assert product['name'] in client.get('/gold').text or product['name'] in client.get('/silver').text or product['name'] in client.get('/diamonds').text
                assert client.get('/product/'+slug).status_code==200
                passed('Python catalogue updates render in collection and product pages')
                items=[{'slug':slug,'qty':1}]
                total=client.post('/api/checkout',json={'items':items}).json()['totalPaise'];assert total==1250000
                order={**data,'address':'Synthetic Mumbai address','items':items,'expectedTotalPaise':total,'requestId':str(uuid.uuid4())}
                response=client.post('/api/orders',json=order);assert response.status_code==201,response.text
                key=response.json()['reference'];assert client.post('/api/orders',json=order).json()['reference']==key
                assert client.patch('/api/crm/orders/'+key,json={'status':'confirmed','paymentStatus':'paid'}).status_code==200
                overview=client.get('/api/whatsapp/overview').json();assert sum(m['event']=='purchase_confirmed' for m in overview['messages'])==1
                passed('Checkout, idempotent retries and purchase notifications run in Python')
                overview=client.get('/api/automations/overview').json()
                definition=overview['starters'][0]['definition']
                result=client.post('/api/automations/test',json={'definition':definition});assert result.json()['dryRun'] and result.json()['matches']
                workflow=client.post('/api/automations/save',json={'definition':definition}).json()['id']
                assert client.post('/api/automations/publish/'+workflow,json={}).status_code==200
                assert client.post('/api/automations/pause/'+workflow,json={}).status_code==200
                passed('CRM workflow test, save, preview publication and pause use Python')
                payload={'object':'whatsapp_business_account','entry':[{'changes':[{'value':{'metadata':{'phone_number_id':'123456'},'messages':[{'id':'wamid.integration','from':'919876543210','type':'text','text':{'body':'STOP'}}]}}]}]}
                raw=json.dumps(payload,separators=(',',':')).encode()
                signature='sha256='+hmac.new(b'synthetic-signature-secret',raw,hashlib.sha256).hexdigest()
                response=client.post('/api/whatsapp/webhook',content=raw,headers={'Content-Type':'application/json','x-hub-signature-256':signature});assert response.status_code==200,response.text
                rejected=client.post('/api/whatsapp/webhook',json=payload)
                assert rejected.status_code==401,f'Unsigned webhook returned {rejected.status_code}: {rejected.text[:300]}'
                passed('Proxy preserves raw signed Meta webhook bodies')
                assert client.post('/api/automations/run').status_code==401
                result=client.post('/api/automations/run',headers={'Authorization':'Bearer '+env['AUTOMATION_CRON_SECRET']}).json()
                assert result['whatsapp']['paused'] and result['email']['paused']
                passed('Worker authorization and preview delivery gates survive the proxy')
                assert client.get('/api/docs').status_code==200
                assert client.post('/api/auth',json={'action':'logout'}).status_code==200
                assert client.get('/api/crm/customers').status_code==401
                passed('Python API docs and logout work through the production frontend')
        finally:
            for p in reversed(processes):
                p.terminate()
                try:p.wait(timeout=10)
                except subprocess.TimeoutExpired:p.kill();p.wait(timeout=10)
            output.close()
            if sys.exc_info()[0] is not None:
                log_path=ROOT/'test-results'/'python-integration-server.log';log_path.parent.mkdir(exist_ok=True)
                log_path.write_text((Path(folder)/'servers.log').read_text(encoding='utf-8'),encoding='utf-8')
        report=ROOT/'test-results'/'python-integration.json';report.parent.mkdir(exist_ok=True)
        report.write_text(json.dumps({'passed':len(results),'checks':results},indent=2)+'\n')
        print(f'{len(results)} production integration checks passed')


if __name__=='__main__':main()
