import hashlib
import hmac
import json
from concurrent.futures import ThreadPoolExecutor
import pytest
from backend.core import *
from backend.tests.conftest import PASSWORD


def login(client,role):
    response = client.post('/api/auth',json={'action':'login','email':role+'@example.test','password':PASSWORD})
    assert response.status_code == 200
    return client


def test_health_and_catalogue(client):
    response = client.get('/api/health')
    assert response.json() == {'ok':True,'backend':'python','schemaVersion':3}
    assert response.headers['x-lumera-backend'] == 'python'
    assert response.headers['cache-control'] == 'no-store'
    assert len(client.get('/api/products').json()['products']) == 18
    assert client.get('/api/rates').json()['live'] is False


@pytest.mark.parametrize('route',['/api/account','/api/crm/customers','/api/crm/attachments/private','/api/whatsapp/overview','/api/automations/overview'])
def test_unauthenticated_routes(client,route):
    assert client.get(route).status_code == 401


def test_login_cookie_rotation_logout(client,store):
    assert client.post('/api/auth',json={'action':'login','email':'admin@example.test','password':'wrong'}).status_code == 401
    login(client,'admin')
    cookie = client.cookies.get('lumera_session')
    row = one('SELECT * FROM sessions')
    assert cookie != row['token'] and row['token'] == hashlib.sha256(cookie.encode()).hexdigest()
    assert client.get('/api/auth').json()['user']['role'] == 'admin'
    response = client.post('/api/auth',json={'action':'change-password','oldPassword':PASSWORD,'password':'Changed-owner-password!'})
    assert response.status_code == 200 and 'HttpOnly' in response.headers['set-cookie']
    assert client.cookies.get('lumera_session') != cookie
    assert one('SELECT count(*) AS n FROM sessions')['n'] == 1
    assert client.post('/api/auth',json={'action':'logout'}).status_code == 200
    assert client.get('/api/account').status_code == 401
    assert one('SELECT count(*) AS n FROM sessions')['n'] == 0


def test_expired_session(client,store):
    login(client,'admin')
    run('UPDATE sessions SET expires_at=0')
    assert client.get('/api/account').status_code == 401


@pytest.mark.parametrize('route',['/api/crm/users','/api/crm/export'])
def test_staff_admin_boundaries(client,route):
    login(client,'staff')
    assert client.get(route).status_code == 403


@pytest.mark.parametrize('route',['/api/crm/orders','/api/crm/attachments/x','/api/whatsapp/overview','/api/automations/overview'])
def test_trade_isolation(client,route):
    login(client,'trade')
    assert client.get(route).status_code == 403


@pytest.mark.parametrize('headers',[{'Origin':'https://evil.example'},{'Sec-Fetch-Site':'cross-site'}])
def test_csrf(client,headers):
    assert client.post('/api/enquiry',json={'form':'newsletter','email':'a@example.test'},headers=headers).status_code == 403


@pytest.mark.parametrize('content,status',[(b'{',400),(b'[]',400),(b'null',400),(b'{"x":NaN}',400),(b'\xff',400),(b'{"x":"'+b'a'*66000+b'"}',413)],ids=['broken','array','null','nan','encoding','oversize'])
def test_malformed_json(client,content,status):
    assert client.post('/api/enquiry',content=content,headers={'Content-Type':'application/json'}).status_code == status


def test_json_required(client):
    assert client.post('/api/enquiry',content='hello').status_code == 415


@pytest.mark.parametrize('data',[{'form':'unknown','email':'a@example.test'},{'form':'contact','email':'bad','name':'X'},{'form':'contact','email':'a@example.test'},{'form':'trade-application','email':'a@example.test','name':'X'}])
def test_invalid_enquiry(client,data):
    assert client.post('/api/enquiry',json=data).status_code == 400


def test_customer_dedup_newsletter_and_pipeline(admin,store):
    data = {'form':'contact','email':'asha@example.test','name':'Asha','message':'Ring enquiry'}
    response = admin.post('/api/enquiry',json=data)
    assert response.status_code == 201
    key = response.json()['reference']
    assert admin.post('/api/enquiry',json={'form':'newsletter','email':'ASHA@example.test'}).status_code == 201
    assert admin.post('/api/enquiry',json={**data,'form':'quote','items':[]}).status_code == 201
    contacts = admin.get('/api/crm/customers').json()['items']
    assert len(contacts) == 1 and contacts[0]['newsletter'] is True
    response = admin.patch('/api/crm/enquiries/'+key,json={'status':'qualified','assignee':'Owner','notes':'Call Friday'})
    assert response.json()['item']['status'] == 'qualified'
    assert len(admin.get('/api/crm/enquiries').json()['items']) == 3


@pytest.mark.parametrize('file,mime,expected',[(b'%PDF-1.7\nDocument','application/pdf',201),(b'\x89PNG\r\n\x1a\nimage','image/png',201),(b'\xff\xd8\xffimage','image/jpeg',201),(b'<script>','application/pdf',400),(b'','application/pdf',400),(b'%PDF-'+b'x'*(5*1024*1024),'application/pdf',400)],ids=['pdf','png','jpeg','spoofed','empty','oversize'])
def test_private_uploads(admin,file,mime,expected):
    response = admin.post('/api/enquiry',data={'payload':json.dumps({'form':'trade-application','name':'Asha','email':'asha@example.test','company':'Asha Jewels'})},files={'gst':('proof.pdf',file,mime)})
    assert response.status_code == expected,response.text
    if expected == 201:
        lead = admin.get('/api/crm/enquiries/'+response.json()['reference']).json()['item']
        key = lead['attachments'][0]['id']
        attachment = admin.get('/api/crm/attachments/'+key)
        assert attachment.content == file and 'attachment;' in attachment.headers['content-disposition']
        admin.cookies.clear()
        assert admin.get('/api/crm/attachments/'+key).status_code == 401


def test_tasks_and_dashboard(admin,contact):
    response = admin.post('/api/crm/tasks',json={'customerId':contact['id'],'title':'Resize ring','kind':'repair','dueAt':'2020-01-01T10:00:00Z'})
    assert response.status_code == 201
    key = response.json()['item']['id']
    assert admin.get('/api/crm/dashboard').json()['overdue'] == 1
    assert admin.patch('/api/crm/tasks/'+key,json={'status':'done'}).status_code == 200
    assert admin.get('/api/crm/dashboard').json()['overdue'] == 0


def test_unpriced_checkout(client):
    slug = client.get('/api/products').json()['products'][0]['slug']
    assert client.post('/api/checkout',json={'items':[{'slug':slug,'qty':1}]}).status_code == 409


@pytest.mark.parametrize('item',[{'qty':0},{'qty':1.5},{'qty':True},{'qty':'1'},{'variant':'invalid'},{'colour':'invalid'},{'slug':'missing'},{'qty':1001}])
def test_invalid_order_items(client,product,item):
    response = client.post('/api/checkout',json={'items':[{'slug':product['id'],'qty':1,**item}]})
    assert response.status_code == 400,response.text


def test_checkout_idempotency_and_stock(admin,order_data,store,product):
    data = {**order_data,'items':[{'slug':product['id'],'qty':2}],'expectedTotalPaise':2500000,'totalPaise':1}
    preview = admin.post('/api/checkout',json={'items':data['items']})
    assert preview.json()['totalPaise'] == 2500000
    placed = admin.post('/api/orders',json=data)
    assert placed.status_code == 201 and placed.json()['totalPaise'] == 2500000
    key = placed.json()['reference']
    assert admin.post('/api/orders',json=data).json()['reference'] == key
    assert record('products',product['id'])['stock'] == 8
    assert admin.post('/api/orders',json={**data,'name':'Other'}).status_code == 409
    assert admin.patch('/api/crm/orders/'+key,json={'status':'shipped'}).status_code == 409
    assert admin.patch('/api/crm/orders/'+key,json={'status':'cancelled'}).status_code == 200
    assert admin.patch('/api/crm/orders/'+key,json={'status':'cancelled'}).status_code == 200
    assert record('products',product['id'])['stock'] == 10


def test_stale_price_and_duplicate_lines(client,order_data,product,store):
    assert client.post('/api/orders',json={**order_data,'expectedTotalPaise':1}).status_code == 409
    assert record('products',product['id'])['stock'] == 10
    save('products',product['id'],{**product,'stock':1})
    item = {'slug':product['id'],'qty':1}
    assert client.post('/api/checkout',json={'items':[item,item]}).status_code == 409


def test_concurrent_last_item(app,order_data,product,store):
    from fastapi.testclient import TestClient
    save('products',product['id'],{**product,'stock':1})
    def place(_):
        with TestClient(app) as client:
            return client.post('/api/orders',json={**order_data,'requestId':uid()}).status_code
    with ThreadPoolExecutor(max_workers=2) as pool:
        assert sorted(pool.map(place,range(2))) == [201,409]
    assert record('products',product['id'])['stock'] == 0


def test_order_lifecycle_messages_and_refund(admin,order_data,store):
    key = admin.post('/api/orders',json=order_data).json()['reference']
    assert admin.patch('/api/crm/orders/'+key,json={'paymentStatus':'refunded'}).status_code == 409
    for status in ('confirmed','processing','shipped','delivered'):
        response = admin.patch('/api/crm/orders/'+key,json={'status':status,'paymentStatus':'paid','carrier':'Synthetic carrier','trackingNumber':'TRACK-1','trackingUrl':'https://example.test/track/1'})
        assert response.status_code == 200,response.text
    events = [r['event'] for r in all_rows('SELECT event FROM wa_outbox')]
    assert events.count('purchase_confirmed') == 1 and events.count('order_shipped') == 1
    assert admin.patch('/api/crm/orders/'+key,json={'paymentStatus':'refunded'}).status_code == 200
    assert one("SELECT count(*) AS n FROM wa_outbox WHERE event='refund_recorded'")['n'] == 1


@pytest.mark.parametrize('url',['http://example.test/x','https://u:p@example.test','javascript:alert(1)','https://'])
def test_tracking_url_validation(admin,order_data,url):
    key = admin.post('/api/orders',json=order_data).json()['reference']
    assert admin.patch('/api/crm/orders/'+key,json={'trackingUrl':url}).status_code == 400


def test_rates_and_gold_price(admin,product):
    assert admin.patch('/api/crm/settings/rates',json={'gold24':10000,'gold22':9200,'gold18':7500,'silver999':100000}).status_code == 200
    slug = 'aurelia-band-ring'
    assert admin.patch('/api/crm/products/'+slug,json={'price':None,'weightGrams':1,'makingChargePct':10,'stock':2}).status_code == 200
    response = admin.post('/api/checkout',json={'items':[{'slug':slug,'variant':'22K','qty':1}]})
    assert response.json()['totalPaise'] == 1042360


def test_catalogue_create_hide_and_export(admin):
    data = {'slug':'python-test-ring','name':'Python Ring','description':'Synthetic ring','material':'gold','category':'rings','variants':['22K'],'metalColours':['Yellow'],'images':['/images/ring.jpg'],'stock':1,'price':5000}
    response = admin.post('/api/crm/products',json=data)
    assert response.status_code == 201 and response.json()['item']['id'] == data['slug']
    assert any(p['slug']==data['slug'] for p in admin.get('/api/products').json()['products'])
    assert admin.patch('/api/crm/products/'+data['slug'],json={'active':False}).status_code == 200
    assert not any(p['slug']==data['slug'] for p in admin.get('/api/products').json()['products'])
    export = admin.get('/api/crm/export')
    assert set(export.json()) == set(ENTITIES)
    assert 'attachment' in export.headers['content-disposition']


def test_user_management_and_account_isolation(admin,order_data,store):
    admin.post('/api/orders',json=order_data)
    response = admin.post('/api/auth',json={'action':'create-user','email':'asha@example.test','name':'Asha','password':PASSWORD,'role':'trade'})
    assert response.status_code == 201
    assert admin.post('/api/auth',json={'action':'create-user','email':'asha@example.test','name':'Asha','password':PASSWORD,'role':'trade'}).status_code == 409
    admin.post('/api/auth',json={'action':'login','email':'asha@example.test','password':PASSWORD})
    orders = admin.get('/api/account').json()['orders']
    assert len(orders)==1 and 'notes' not in orders[0]
    login(admin,'trade')
    assert admin.get('/api/account').json()['orders'] == []


def test_rate_limit(client):
    for _ in range(10):
        assert client.post('/api/auth',json={'action':'login','email':'no@example.test','password':'wrong'}).status_code == 401
    assert client.post('/api/auth',json={'action':'login','email':'no@example.test','password':'wrong'}).status_code == 429


def test_worker_auth_and_preview(client):
    assert client.post('/api/automations/run').status_code == 401
    response = client.post('/api/automations/run',headers={'Authorization':'Bearer synthetic-cron-secret-at-least-32-characters'})
    assert response.status_code == 200 and response.json()['whatsapp']['paused'] is True and response.json()['email']['paused'] is True


@pytest.mark.parametrize('route',['/api/crm/missing','/api/crm/customers/x/y','/api/whatsapp/missing','/api/automations/missing'])
def test_unknown_paths(admin,route):
    assert admin.get(route).status_code == 404
