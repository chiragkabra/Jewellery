"""python -m backend: serve, worker, admin, backup and account checks."""
import argparse
import secrets
from .core import *


def main():
    from .app import load_env,worker_tick
    load_env()
    parser = argparse.ArgumentParser(description='Lumera Python backend')
    commands = parser.add_subparsers(dest='command',required=True)
    serve = commands.add_parser('serve')
    serve.add_argument('--port',type=int,default=8000)
    serve.add_argument('--host',default='127.0.0.1')
    worker = commands.add_parser('worker')
    worker.add_argument('--watch',action='store_true')
    admin = commands.add_parser('admin')
    admin.add_argument('--email',required=True)
    admin.add_argument('--name',default='Owner')
    admin.add_argument('--reset',action='store_true')
    backup = commands.add_parser('backup')
    backup.add_argument('output',nargs='?')
    commands.add_parser('check-whatsapp')
    credentials = commands.add_parser('import-whatsapp')
    credentials.add_argument('--credentials',required=True)
    credentials.add_argument('--project',default='.')
    args = parser.parse_args()
    if args.command == 'import-whatsapp':
        from .credentials import import_credentials
        print(dumps(import_credentials(args.credentials,args.project)))
        return
    if args.command == 'serve':
        import uvicorn
        uvicorn.run('backend.app:app',host=args.host,port=args.port,proxy_headers=os.getenv('TRUST_PROXY')=='true',access_log=True)
        return
    if args.command == 'backup':
        source = Path(os.getenv('DATABASE_PATH','data/lumera.sqlite')).resolve()
        target = Path(args.output or f'backups/lumera-{now()}.sqlite').resolve()
        check(source != target,'Backup destination must differ from source')
        target.parent.mkdir(parents=True,exist_ok=True)
        db = sqlite3.connect(f'{source.as_uri()}?mode=ro',uri=True)
        try:
            with sqlite3.connect(target) as output: db.backup(output)
        finally:
            db.close()
        print(f'Database backup saved: {target}')
        return
    if args.command == 'check-whatsapp':
        import httpx
        check(os.getenv('WHATSAPP_ACCESS_TOKEN') and os.getenv('WHATSAPP_PHONE_NUMBER_ID') and os.getenv('WHATSAPP_GRAPH_VERSION'),'Configure WhatsApp credentials first')
        response = httpx.get(f'https://graph.facebook.com/{os.environ["WHATSAPP_GRAPH_VERSION"]}/{os.environ["WHATSAPP_PHONE_NUMBER_ID"]}',params={'fields':'verified_name,display_phone_number,quality_rating'},headers={'Authorization':'Bearer '+os.environ['WHATSAPP_ACCESS_TOKEN']},timeout=15)
        print(f'WhatsApp account HTTP {response.status_code}')
        if not response.is_success: raise SystemExit(1)
        print(dumps({k:v for k,v in response.json().items() if k in ('verified_name','display_phone_number','quality_rating')}))
        return
    db = connect()
    try:
        initialize(db)
        with database(db):
            if args.command == 'admin':
                address = email(args.email)
                with transaction():
                    existing = one('SELECT id,role FROM users WHERE email=?',address)
                    check(not existing or args.reset,'Account already exists. Use --reset to recover an admin account.',409)
                    check(not args.reset or existing and existing['role']=='admin','Reset requires an existing admin account')
                    password = secrets.token_urlsafe(18)
                    if existing:
                        run('UPDATE users SET password=? WHERE id=?',hash_password(password),existing['id'])
                        run('DELETE FROM sessions WHERE user_id=?',existing['id'])
                    else:
                        run('INSERT INTO users VALUES(?,?,?,?,?,?)',uid(),address,text(args.name,'name',150),hash_password(password),'admin',iso())
                print(f'Admin credentials ready. Save securely.\nEmail: {address}\nPassword: {password}\nLogin: /account\nCRM: /crm')
            elif args.command == 'worker':
                check(os.getenv('AUTOMATION_WORKER_ENABLED','true')=='false' or not args.watch,'Disable the embedded worker before running a separate watch worker')
                while True:
                    print(dumps(worker_tick()))
                    if not args.watch: break
                    time.sleep(60)
    finally:
        db.close()


if __name__ == '__main__':
    try:
        main()
    except ApiError as exc:
        print(exc.message)
        raise SystemExit(1)
