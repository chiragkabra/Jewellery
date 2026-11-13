"""Import local credentials without echoing tokens or activating sending."""
import re
import secrets
from .core import *

KEYS = ['WHATSAPP_ACCESS_TOKEN','WHATSAPP_PHONE_NUMBER_ID','WHATSAPP_GRAPH_VERSION','WHATSAPP_APP_SECRET','WHATSAPP_VERIFY_TOKEN','WHATSAPP_TEST_RECIPIENT','WHATSAPP_BUSINESS_ACCOUNT_ID']


def parse_credentials(raw):
    values = {}
    for line in raw.splitlines():
        match = re.fullmatch(r'([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*',line.strip())
        if match and (match[1].startswith('WHATSAPP_') or match[1]=='META_APP_SECRET'):
            values[match[1]] = match[2].strip('"\'')
    url = re.search(r'https://graph\.facebook\.com/(v\d+\.\d+)/(\d+)/messages',raw)
    if url:
        values.setdefault('WHATSAPP_GRAPH_VERSION',url[1]);values.setdefault('WHATSAPP_PHONE_NUMBER_ID',url[2])
    tokens = re.findall(r'\b(EAA[A-Za-z0-9_-]{30,})',raw)
    if tokens: values.setdefault('WHATSAPP_ACCESS_TOKEN',tokens[-1])
    values.setdefault('WHATSAPP_APP_SECRET',values.get('META_APP_SECRET',''))
    template = None
    data = re.search(r"-d\s+'([\s\S]*?)'",raw)
    if data:
        try:
            payload = json.loads(data[1].replace('\\"','"'))
            definition = payload.get('template',{})
            if definition.get('name'):
                component = next((c for c in definition.get('components',[]) if c.get('type')=='body'),{})
                template = {'name':definition['name'],'language':definition.get('language',{}).get('code','en'),'parameterCount':len(component.get('parameters',[]))}
        except (ValueError,TypeError,AttributeError):
            pass
    return values,template


def import_credentials(filename,project):
    root = Path(project).resolve()
    values,template = parse_credentials(Path(filename).read_text(encoding='utf-8'))
    check(values.get('WHATSAPP_ACCESS_TOKEN') and re.fullmatch(r'[0-9]+',values.get('WHATSAPP_PHONE_NUMBER_ID','')) and re.fullmatch(r'v[0-9]+\.[0-9]+',values.get('WHATSAPP_GRAPH_VERSION','')),'Credentials must contain a token, phone number ID and version')
    from dotenv import dotenv_values
    target = root/'.env.local'
    existing = dict(dotenv_values(target)) if target.exists() else {}
    content = target.read_text(encoding='utf-8') if target.exists() else ''
    updates = {'WHATSAPP_MODE':'preview',**{key:values[key] for key in KEYS if values.get(key)}}
    if not existing.get('WHATSAPP_VERIFY_TOKEN') and not updates.get('WHATSAPP_VERIFY_TOKEN'): updates['WHATSAPP_VERIFY_TOKEN']=secrets.token_hex(24)
    if not existing.get('WHATSAPP_CRON_SECRET'): updates['WHATSAPP_CRON_SECRET']=secrets.token_hex(32)
    if values.get('WHATSAPP_TEST_RECIPIENT'): updates['WHATSAPP_ALLOWED_RECIPIENTS']=re.sub(r'\D','',values['WHATSAPP_TEST_RECIPIENT'])
    for key,value in updates.items():
        check(not any(c in value for c in '\r\n'),'Unexpected newline in credential value')
        line = key+'='+value
        content = re.sub('^'+key+r'=.*$',lambda _:line,content,flags=re.M) if re.search('^'+key+'=',content,re.M) else content.rstrip()+'\n'+line+'\n'
    root.mkdir(parents=True,exist_ok=True)
    target.write_text(content,encoding='utf-8')
    database_path = Path(existing.get('DATABASE_PATH') or 'data/lumera.sqlite')
    if not database_path.is_absolute(): database_path=root/database_path
    if template and re.fullmatch(r'[a-z][a-z0-9_]{0,127}',template['name']) and template['parameterCount']==3 and database_path.exists():
        db=connect(database_path)
        try:
            initialize(db)
            with database(db),transaction():
                stored=record('settings','whatsapp') or {}
                stored.update({'enabled':False,'templates':{**stored.get('templates',{}),'purchase_confirmed':{'name':template['name'],'language':template['language'],'approved':False}},'importedTemplate':{'name':template['name'],'language':template['language'],'parameterOrder':['customer name','order reference','purchase date'],'providerApprovalVerified':False}})
                save('settings','whatsapp',stored)
        finally: db.close()
    return {'ok':True,'mode':'preview','importedKeys':[key for key in updates if key != 'WHATSAPP_MODE'],'template':template}
