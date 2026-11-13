import os
import pytest
from fastapi.testclient import TestClient
from backend.core import connect, database, hash_password, iso, run
from backend.app import create_app

PASSWORD = 'Synthetic-owner-password!'


@pytest.fixture
def app(tmp_path,monkeypatch):
    settings = {'APP_URL':'http://testserver','COOKIE_SECURE':'false','NODE_ENV':'test','AUTOMATION_WORKER_ENABLED':'false','WHATSAPP_MODE':'preview','EMAIL_MODE':'preview','WHATSAPP_ACCESS_TOKEN':'','WHATSAPP_APP_SECRET':'synthetic-meta-signing-secret','WHATSAPP_PHONE_NUMBER_ID':'123456','WHATSAPP_GRAPH_VERSION':'v23.0','WHATSAPP_VERIFY_TOKEN':'synthetic-verify','WHATSAPP_CRON_SECRET':'synthetic-cron-secret-at-least-32-characters','AUTOMATION_CRON_SECRET':'','RESEND_API_KEY':'','EMAIL_FROM':'','WHATSAPP_ALLOWED_RECIPIENTS':'','EMAIL_ALLOWED_RECIPIENTS':'','TRUST_PROXY':'false'}
    for key,value in settings.items(): monkeypatch.setenv(key,value)
    app = create_app(str(tmp_path/'test.sqlite'),worker_enabled=False)
    with TestClient(app,raise_server_exceptions=False) as client:
        db = connect(app.state.database_path)
        with database(db):
            for role in ('admin','staff','trade'):
                run('INSERT INTO users VALUES(?,?,?,?,?,?)',role,role+'@example.test',role,hash_password(PASSWORD),role,iso())
        db.close()
        app.state.client = client
        yield app


@pytest.fixture
def client(app):
    return app.state.client


@pytest.fixture
def admin(client):
    response = client.post('/api/auth',json={'action':'login','email':'admin@example.test','password':PASSWORD})
    assert response.status_code == 200,response.text
    return client


@pytest.fixture
def store(app):
    db = connect(app.state.database_path)
    with database(db):
        yield db
    db.close()


@pytest.fixture
def product(store):
    from backend.core import records,save
    p = records('products')[0]
    return save('products',p['id'],{**p,'stock':10,'price':12500})


@pytest.fixture
def contact(store):
    from backend.business import customer
    return customer({'name':'Asha Test','email':'asha@example.test','phone':'+919876543210'})


@pytest.fixture
def order_data(product):
    from backend.core import uid
    return {'name':'Asha Test','email':'asha@example.test','phone':'+919876543210','address':'Synthetic address, Mumbai','items':[{'slug':product['id'],'qty':1}],'requestId':uid(),'expectedTotalPaise':1250000,'whatsappConsent':True}
