"""FastAPI HTTP contract for the existing Lumera storefront and CRM."""
import asyncio
import hashlib
import hmac
import logging
import secrets
from contextlib import asynccontextmanager
from urllib.parse import urlparse
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, Response
from starlette.datastructures import UploadFile
from starlette.concurrency import run_in_threadpool
from .core import *
from . import business, messaging as wa, workflows as wf, mail

log = logging.getLogger('lumera')
COOKIE = 'lumera_session'


def load_env():
    from dotenv import load_dotenv
    load_dotenv(ROOT.parent / '.env.local', override=False)


def create_app(database_path=None,worker_enabled=None):
    @asynccontextmanager
    async def lifespan(app):
        db = connect(app.state.database_path)
        try:
            initialize(db)
        finally:
            db.close()
        enabled = app.state.worker_enabled
        if enabled is None:
            enabled = os.getenv('AUTOMATION_WORKER_ENABLED',os.getenv('WHATSAPP_WORKER_ENABLED','true')) != 'false'
        stop = asyncio.Event()
        async def loop():
            while not stop.is_set():
                try:
                    await run_in_threadpool(worker_tick,app.state.database_path)
                except Exception:
                    log.exception('Automation worker cycle failed')
                try:
                    await asyncio.wait_for(stop.wait(),timeout=60)
                except asyncio.TimeoutError:
                    pass
        task = asyncio.create_task(loop()) if enabled else None
        yield
        stop.set()
        if task:
            await task
    app = FastAPI(title='Lumera Python API',version='1.0.0',lifespan=lifespan,docs_url='/api/docs',openapi_url='/api/openapi.json',redoc_url=None)
    app.state.database_path = database_path or os.getenv('DATABASE_PATH','data/lumera.sqlite')
    app.state.worker_enabled = worker_enabled

    @app.middleware('http')
    async def database_scope(request,call_next):
        db = connect(app.state.database_path)
        try:
            with database(db):
                try:
                    response = await call_next(request)
                except ApiError as exc:
                    response = JSONResponse({'ok':False,'error':exc.message},status_code=exc.status)
                except Exception:
                    log.exception('Backend request failed')
                    response = JSONResponse({'ok':False,'error':'Unable to complete request'},status_code=500)
            response.headers['Cache-Control'] = 'no-store'
            response.headers['X-Content-Type-Options'] = 'nosniff'
            response.headers['X-Lumera-Backend'] = 'python'
            return response
        finally:
            db.close()

    @app.exception_handler(ApiError)
    async def api_error(request,exc):
        return JSONResponse({'ok':False,'error':exc.message},status_code=exc.status)

    @app.get('/api/health')
    def health():
        return {'ok':True,'backend':'python','schemaVersion':one('PRAGMA user_version')['user_version']}

    @app.get('/api/products')
    def products():
        return {'products':business.catalogue()}

    @app.get('/api/rates')
    def rates():
        return business.metal_rates()

    @app.get('/api/auth')
    def auth_get(request:Request):
        return {'user':current_user(request)}

    @app.post('/api/auth')
    async def auth_post(request:Request):
        same_origin(request)
        rate_limit(request,'auth',30)
        data = await body(request)
        action = data.get('action')
        response = JSONResponse({'ok':True})
        if action == 'logout':
            token = request.cookies.get(COOKIE)
            if token:
                run('DELETE FROM sessions WHERE token=?',hashlib.sha256(token.encode()).hexdigest())
            response.delete_cookie(COOKIE,path='/')
            return response
        if action == 'change-password':
            actor = require_user(request)
            old = text(data.get('oldPassword'),'current password',128)
            password = text(data.get('password'),'new password',128)
            check(len(password)>=12,'Use at least 12 characters')
            row = one('SELECT password FROM users WHERE id=?',actor['id'])
            check(verify_password(old,row['password']),'Current password is incorrect',401)
            with transaction():
                run('UPDATE users SET password=? WHERE id=?',hash_password(password),actor['id'])
                run('DELETE FROM sessions WHERE user_id=?',actor['id'])
                create_session(response,actor['id'])
                audit(actor['id'],'password.changed',actor['id'])
            return response
        if action == 'create-user':
            actor = require_user(request,True,True)
            address,name,password = email(data.get('email')),text(data.get('name'),'name',150),text(data.get('password'),'password',128)
            check(len(password)>=12,'Use at least 12 characters')
            role = choice(data.get('role'),['admin','staff','trade'],'role')
            with transaction():
                check(not one('SELECT id FROM users WHERE email=?',address),'User already exists',409)
                key = uid()
                run('INSERT INTO users VALUES(?,?,?,?,?,?)',key,address,name,hash_password(password),role,iso())
                contact = one('SELECT id FROM customers WHERE email=?',address)
                if role == 'trade' and contact:
                    person = record('customers',contact['id'])
                    wa.queue_whatsapp('trade_account_ready',key,contact['id'],[person['name'],os.getenv('APP_URL','http://localhost:3000').rstrip('/')+'/account'])
                audit(actor['id'],'user.created',key)
            return JSONResponse({'ok':True},status_code=201)
        check(action == 'login','Invalid action')
        address,password = email(data.get('email')),text(data.get('password'),'password',128)
        rate_limit(request,'login-email',10,identity=address)
        row = one('SELECT * FROM users WHERE email=?',address)
        valid = verify_password(password,row['password'] if row else '0'*32+':'+'00'*64)
        check(row and valid,'Invalid email or password',401)
        response = JSONResponse({'ok':True,'role':row['role']})
        with transaction():
            create_session(response,row['id'])
            audit(row['id'],'login','session')
        return response

    @app.get('/api/account')
    def account(request:Request):
        actor = require_user(request)
        contact = one('SELECT id FROM customers WHERE email=?',actor['email'])
        fields = ('id','items','status','paymentStatus','totalPaise','createdAt','carrier','trackingNumber','trackingUrl')
        orders = [{k:o[k] for k in fields if k in o} for o in records('orders') if contact and o['customerId'] == contact['id']]
        return {'user':actor,'orders':orders}

    @app.post('/api/enquiry')
    async def enquiry(request:Request):
        same_origin(request)
        rate_limit(request,'enquiry',30)
        uploads = []
        if 'multipart/form-data' in request.headers.get('content-type',''):
            await limited_bytes(request,21*1024*1024)
            try:
                form = await request.form(max_files=4,max_fields=5,max_part_size=5*1024*1024)
            except Exception:
                raise ApiError(400,'Invalid multipart form')
            try:
                raw = form.get('payload')
                check(isinstance(raw,str) and len(raw)<65536,'Invalid payload')
                try:
                    data = json.loads(raw)
                except ValueError:
                    raise ApiError(400,'Invalid payload')
                check(isinstance(data,dict),'Invalid payload')
                for key,file in form.multi_items():
                    if key == 'payload': continue
                    check(isinstance(file,UploadFile),'Invalid file')
                    content = await file.read(5*1024*1024+1)
                    check(0<len(content)<=5*1024*1024 and len(uploads)<4,'Upload up to four files, 5 MB each')
                    mime = 'application/pdf' if content.startswith(b'%PDF-') else 'image/png' if content.startswith(b'\x89PNG\r\n\x1a\n') else 'image/jpeg' if content.startswith(b'\xff\xd8\xff') else None
                    check(mime,'Only PDF, PNG and JPEG files are accepted')
                    uploads.append({'name':re.sub(r'[^a-zA-Z0-9._ -]','_',file.filename or 'document')[:150],'mime':mime,'content':content})
            finally:
                await form.close()
        else:
            data = await body(request)
        return JSONResponse({'ok':True,'reference':business.enquiry(data,uploads)},status_code=201)

    @app.post('/api/checkout')
    async def checkout(request:Request):
        same_origin(request)
        rate_limit(request,'preview',100)
        return business.preview_order((await body(request)).get('items'))

    @app.post('/api/orders')
    async def orders(request:Request):
        same_origin(request)
        rate_limit(request,'checkout',10)
        data = await body(request)
        check(isinstance(data.get('requestId'),str) and len(data['requestId'])>=16,'Request ID required')
        check(type(data.get('expectedTotalPaise')) in (int,float),'Price confirmation required')
        result = business.create_order(data,'website')
        return JSONResponse({'ok':True,'reference':result['id'],'totalPaise':result['totalPaise']},status_code=201)

    @app.get('/api/crm/{path:path}')
    def crm_get(path:str,request:Request):
        actor = require_user(request,True)
        resource,key = resource_path(path)
        if resource == 'dashboard':
            enquiries,orders,tasks,products = (records(k) for k in ('enquiries','orders','tasks','products'))
            return {'customers':len(records('customers')),'openEnquiries':sum(e['status'] not in ('won','lost') for e in enquiries),'openOrders':sum(o['status'] not in ('cancelled','delivered') for o in orders),'paidPaise':sum(o['totalPaise'] for o in orders if o['paymentStatus']=='paid' and o['status']!='cancelled'),'overdue':sum(t['status']!='done' and t['dueAt']<iso() for t in tasks),'lowStock':sum(p.get('stock',0)<=2 for p in products)}
        if resource == 'audit': return {'items':all_rows('SELECT * FROM audit ORDER BY created_at DESC LIMIT 200')}
        if resource == 'users':
            require_admin(actor)
            return {'items':all_rows('SELECT id,email,name,role,created_at FROM users ORDER BY created_at DESC')}
        if resource == 'export':
            require_admin(actor)
            audit(actor['id'],'crm.exported','all')
            return JSONResponse({e:records(e) for e in ENTITIES},headers={'Content-Disposition':'attachment; filename="lumera-crm-export.json"'})
        if resource == 'attachments':
            file = one('SELECT * FROM attachments WHERE id=?',key or '')
            check(file,'File not found',404)
            name = re.sub(r'[^a-zA-Z0-9._ -]','_',file['name'])
            return Response(file['content'],media_type=file['mime'],headers={'Content-Disposition':f'attachment; filename="{name}"'})
        check(resource in ENTITIES,'Unknown resource',404)
        if key:
            item = record(resource,key)
            check(item,'Not found',404)
            return {'item':item}
        return {'items':records(resource)}

    @app.api_route('/api/crm/{path:path}',methods=['POST','PATCH'])
    async def crm_mutate(path:str,request:Request):
        same_origin(request)
        actor = require_user(request,True)
        resource,key = resource_path(path)
        result = business.mutate_crm(resource,key,await body(request),actor,request.method=='POST')
        return JSONResponse({'item':result},status_code=201 if request.method=='POST' else 200)

    @app.get('/api/whatsapp/webhook')
    def verify_webhook(request:Request):
        token = os.getenv('WHATSAPP_VERIFY_TOKEN')
        check(token,'Webhook verification not configured',503)
        params = request.query_params
        check(params.get('hub.mode')=='subscribe' and secrets.compare_digest(params.get('hub.verify_token','').encode(),token.encode()),'Verification rejected',403)
        challenge = params.get('hub.challenge','')
        check(re.fullmatch(r'[0-9]{1,100}',challenge),'Invalid challenge')
        return Response(challenge,media_type='text/plain')

    @app.post('/api/whatsapp/webhook')
    async def webhook(request:Request):
        secret = os.getenv('WHATSAPP_APP_SECRET')
        check(secret,'Webhook signing secret not configured',503)
        check('application/json' in request.headers.get('content-type',''),'JSON required',415)
        raw = await limited_bytes(request,256*1024)
        expected = 'sha256='+hmac.new(secret.encode(),raw,hashlib.sha256).hexdigest()
        check(secrets.compare_digest(request.headers.get('x-hub-signature-256','').encode(),expected.encode()),'Invalid webhook signature',401)
        try:
            data = json.loads(raw)
        except ValueError:
            raise ApiError(400,'Invalid JSON')
        check(isinstance(data,dict),'Invalid payload')
        return {'ok':True,**wa.receive_webhook(data)}

    @app.post('/api/whatsapp/run')
    def whatsapp_run(request:Request):
        worker_auth(request)
        return wa.dispatch()

    @app.post('/api/automations/run')
    def automation_run(request:Request):
        worker_auth(request)
        return {'automations':wf.process(),'whatsapp':wa.dispatch(),'email':mail.dispatch()}

    @app.get('/api/whatsapp/{path:path}')
    def whatsapp_get(path:str,request:Request):
        require_user(request,True)
        check(path=='overview','Not found',404)
        return wa.overview()

    @app.post('/api/whatsapp/{path:path}')
    async def whatsapp_post(path:str,request:Request):
        same_origin(request)
        actor = require_user(request,True)
        resource,key = resource_path(path)
        data = await body(request)
        if resource == 'settings':
            require_admin(actor)
            with transaction(): return {'item':wa.save_settings(data,actor['id'])}
        if resource == 'consent':
            with transaction():
                wa.set_consent(text(data.get('customerId'),'customer',100),text(data.get('phone'),'phone',40),data.get('optedIn'),text(data.get('source'),'consent source',500))
                audit(actor['id'],'whatsapp.consent.recorded' if data['optedIn'] else 'whatsapp.consent.withdrawn',data['customerId'])
            return {'ok':True}
        if resource == 'messages':
            check(key,'Message ID required')
            if data.get('action') == 'release': require_admin(actor)
            return {'item':wa.manage_message(key,text(data.get('action'),'action',30),actor['id'],data.get('confirmUncertain') is True)}
        if resource == 'dispatch':
            require_admin(actor)
            return await run_in_threadpool(wa.dispatch)
        raise ApiError(404,'Not found')

    @app.get('/api/automations/{path:path}')
    def automations_get(path:str,request:Request):
        require_user(request,True)
        check(path=='overview','Not found',404)
        return wf.overview()

    @app.post('/api/automations/{path:path}')
    async def automations_post(path:str,request:Request):
        same_origin(request)
        actor = require_user(request,True)
        resource,key = resource_path(path)
        data = await body(request)
        if resource in ('alerts','tasks'):
            check(key,'Record ID required')
            table = 'auto_alerts' if resource == 'alerts' else 'auto_tasks'
            check(one(f'SELECT id FROM {table} WHERE id=?',key),'Not found',404)
            if resource == 'alerts': run('UPDATE auto_alerts SET acknowledged=1 WHERE id=?',key)
            else: run('UPDATE auto_tasks SET status=? WHERE id=?',choice(data.get('status'),['open','done'],'status'),key)
            audit(actor['id'],f'automation.{resource}.updated',key)
            return {'ok':True}
        if resource == 'test': return wf.test_workflow(data.get('definition'),text(data.get('eventId'),'event ID',100,False) or None)
        require_admin(actor)
        if resource == 'save': return {'id':wf.save_workflow(data.get('definition'),actor['id'],key)}
        if resource in ('publish','pause','retry','emails'):
            check(key,'Record ID required')
            if resource == 'publish': wf.publish_workflow(key,actor['id'],data.get('takeOverWhatsApp') is True)
            elif resource == 'pause': wf.pause_workflow(key,actor['id'])
            elif resource == 'retry': wf.retry_run(key,actor['id'])
            else: mail.manage_email(key,str(data.get('action')),actor['id'],data.get('confirmUncertain') is True)
            return {'ok':True}
        if resource == 'duplicate':
            row = one('SELECT draft FROM auto_workflows WHERE id=?',key or '')
            check(row,'Workflow not found',404)
            definition = json.loads(row['draft'])
            definition.update({'name':(definition['name']+' copy')[:120],'mode':'preview','steps':[{**s,'id':uid()} for s in definition['steps']]})
            return {'id':wf.save_workflow(definition,actor['id'])}
        if resource == 'native-rule':
            wf.set_native_rule(data.get('event'),data.get('enabled'),data.get('delayMinutes'),actor['id'])
            return {'ok':True}
        if resource == 'process':
            return await run_in_threadpool(lambda:{'automations':wf.process(),'email':mail.dispatch()})
        raise ApiError(404,'Not found')

    return app


def worker_tick(path=None):
    db = connect(path)
    try:
        with database(db):
            return {'automations':wf.process(),'whatsapp':wa.dispatch(),'email':mail.dispatch()}
    finally:
        db.close()


def resource_path(path):
    parts = path.split('/')
    check(1 <= len(parts) <= 2 and all(parts),'Invalid resource path',404)
    return parts[0],parts[1] if len(parts)>1 else None


def same_origin(request):
    origin = request.headers.get('origin')
    expected = os.getenv('APP_URL') or str(request.base_url).rstrip('/')
    parsed = urlparse(expected)
    check(not origin or origin == f'{parsed.scheme}://{parsed.netloc}','Cross-origin request rejected',403)
    check(request.headers.get('sec-fetch-site') != 'cross-site','Cross-site request rejected',403)


async def limited_bytes(request,maximum):
    if hasattr(request,'_body'):
        check(len(request._body) <= maximum,'Request too large',413)
        return request._body
    chunks,size = [],0
    async for chunk in request.stream():
        size += len(chunk)
        check(size <= maximum,'Request too large',413)
        chunks.append(chunk)
    request._body = b''.join(chunks)
    return request._body


async def body(request):
    check('application/json' in request.headers.get('content-type',''),'JSON required',415)
    raw = await limited_bytes(request,65536)
    try:
        value = json.loads(raw,parse_constant=lambda _: (_ for _ in ()).throw(ValueError()))
    except (ValueError,UnicodeDecodeError):
        raise ApiError(400,'Invalid JSON')
    check(isinstance(value,dict),'Object required')
    return value


def rate_limit(request,scope,maximum,window_ms=600000,identity=None):
    address = request.headers.get('x-forwarded-for','shared').split(',')[0] if os.getenv('TRUST_PROXY')=='true' else 'shared'
    key = hashlib.sha256(f'{scope}:{identity or address}'.encode()).hexdigest()
    timestamp = now()
    with transaction():
        run('DELETE FROM rate_limits WHERE resets_at<?',timestamp)
        row = one('INSERT INTO rate_limits VALUES(?,1,?) ON CONFLICT(id) DO UPDATE SET count=count+1 RETURNING count',key,timestamp+window_ms)
    check(row['count']<=maximum,'Too many requests. Please try again later.',429)


def current_user(request):
    token = request.cookies.get(COOKIE)
    if not token: return None
    return one('SELECT u.id,u.email,u.name,u.role FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token=? AND s.expires_at>?',hashlib.sha256(token.encode()).hexdigest(),now())


def require_user(request,staff=False,admin=False):
    user = current_user(request)
    check(user,'Please sign in',401)
    if staff: check(user['role'] != 'trade','Staff access required',403)
    if admin: require_admin(user)
    return user


def require_admin(user):
    check(user['role']=='admin','Admin access required',403)


def create_session(response,user_id):
    token = secrets.token_hex(32)
    run('DELETE FROM sessions WHERE expires_at<?',now())
    run('INSERT INTO sessions VALUES(?,?,?)',hashlib.sha256(token.encode()).hexdigest(),user_id,now()+8*3600000)
    secure = os.getenv('NODE_ENV')=='production' and os.getenv('COOKIE_SECURE')!='false'
    response.set_cookie(COOKIE,token,max_age=8*3600,httponly=True,secure=secure,samesite='lax',path='/')


def worker_auth(request):
    secret = os.getenv('AUTOMATION_CRON_SECRET') or os.getenv('WHATSAPP_CRON_SECRET')
    check(secret and len(secret)>=32,'Worker secret missing',503)
    check(secrets.compare_digest(request.headers.get('authorization','').encode(),('Bearer '+secret).encode()),'Worker authentication required',401)


load_env()
app = create_app()
