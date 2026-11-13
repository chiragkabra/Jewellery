"""Persistent versioned workflow engine. Actions and cursors commit atomically."""
import math
import re
from .core import *
from . import messaging as wa

TRIGGERS = {**{k:v['label'] for k,v in wa.EVENTS.items()},'inventory_low':'Inventory below threshold','daily_schedule':'Daily schedule (IST)'}
VARIABLES = ['customerName','email','reference','amount','status','paymentStatus','segment','productName','stock','dueAt','tracking','date']
DAY = 86400000


def template(value,label,maximum):
    result = text(value,label,maximum)
    for key in re.findall(r'\{\{([^{}]+)\}\}',result):
        check(key.strip() in VARIABLES,'Unknown variable: '+key)
    check('{{' not in re.sub(r'\{\{\s*\w+\s*\}\}','',result),'Invalid template token')
    return result


def validate_definition(data):
    check(isinstance(data,dict),'Workflow definition required')
    name = text(data.get('name'),'workflow name',120)
    trigger = choice(data.get('trigger'),TRIGGERS,'trigger')
    mode = choice(data.get('mode'),['preview','live'],'mode')
    match = choice(data.get('match'),['all','any'],'condition match')
    check(isinstance(data.get('conditions'),list) and len(data['conditions']) <= 10,'Use up to 10 conditions')
    conditions = []
    for c in data['conditions']:
        check(isinstance(c,dict),'Invalid condition')
        cond = {'field':choice(c.get('field'),VARIABLES,'condition field'),'operator':choice(c.get('operator'),['equals','not_equals','contains','greater_than','less_than'],'condition operator'),'value':text(c.get('value'),'condition value',300)}
        if cond['operator'] in ('greater_than','less_than'):
            try:
                check(math.isfinite(float(cond['value'])),'Numeric conditions require a number')
            except ValueError:
                raise ApiError(400,'Numeric conditions require a number')
        conditions.append(cond)
    check(isinstance(data.get('steps'),list) and 1 <= len(data['steps']) <= 12,'Use 1–12 steps')
    ids,steps = set(),[]
    for step in data['steps']:
        check(isinstance(step,dict),'Invalid action')
        key = text(step.get('id'),'step ID',100)
        check(re.fullmatch(r'[A-Za-z0-9_-]+',key),'Step IDs must use letters, numbers, underscores or hyphens')
        check(key not in ids,'Step IDs must be unique')
        ids.add(key)
        kind = choice(step.get('type'),['delay','staff_alert','create_task','email','whatsapp'],'action')
        value = {'id':key,'type':kind}
        if kind in ('delay','create_task'):
            check(type(step.get('minutes')) is int and 0 <= step['minutes'] <= 43200,'Use a delay/due time from 0 to 43200 minutes')
            value['minutes'] = step['minutes']
        if kind in ('staff_alert','create_task','email'):
            value.update({'title':template(step.get('title'),'title / subject',200),'body':template(step.get('body'),'message / task notes',5000)})
        if kind == 'staff_alert':
            value['priority'] = choice(step.get('priority') or 'normal',['normal','high'],'priority')
        if kind == 'email':
            value['recipient'] = choice(step.get('recipient'),['customer','staff'],'email recipient')
            if value['recipient'] == 'staff':
                value['staffEmail'] = email(step.get('staffEmail'))
            else:
                check(trigger in wa.EVENTS,'This trigger has no customer email; choose a staff recipient')
        if kind == 'whatsapp':
            check(trigger in wa.EVENTS,'This trigger has no customer WhatsApp message')
        steps.append(value)
    check(any(s['type'] != 'delay' for s in steps),'Add at least one action')
    check(sum(s['type']=='whatsapp' for s in steps) <= 1,'Use one WhatsApp action per workflow')
    value = {'name':name,'trigger':trigger,'mode':mode,'match':match,'conditions':conditions,'steps':steps}
    for field,default,maximum in [('cooldownMinutes',0,43200),('scheduleHour',9,23),('scheduleMinute',0,59)]:
        v = data.get(field,default)
        check(type(v) is int and 0 <= v <= maximum,'Invalid '+field)
        value[field] = v
    return value


def render(template_text,values):
    def replace(match):
        key = match[1]
        check(values.get(key) is not None and values[key] != '',f'Missing value for {key}')
        return str(values[key])
    return re.sub(r'\{\{\s*(\w+)\s*\}\}',replace,template_text)


def emit_event(trigger,key,entity_id,customer_id,payload,available_at=None):
    key_id = uid()
    run('INSERT OR IGNORE INTO auto_events VALUES(?,?,?,?,?,?,?,?,NULL)',key_id,key,trigger,entity_id,customer_id,dumps(payload),now() if available_at is None else available_at,now())
    return key_id


def emit_inventory(before,after):
    threshold = (record('settings','automation') or {}).get('lowStockThreshold',2)
    if after['stock'] < before['stock'] and after['stock'] <= threshold:
        emit_event('inventory_low',f'stock:{after["id"]}:{uid()}',after['id'],None,{'productName':after['name'],'stock':after['stock'],'reference':after['id']})


def event_data(event):
    payload = json.loads(event['payload'])
    contact = (record('customers',event['customer_id']) if event.get('customer_id') else None) or {}
    source = one('SELECT * FROM wa_outbox WHERE id=?',payload['sourceMessageId']) if payload.get('sourceMessageId') else None
    order = record('orders',event['entity_id']) if event['trigger'] in wa.ORDER_EVENTS else None
    task = record('tasks',event['entity_id']) if event['trigger'] in wa.TASK_EVENTS else None
    product = record('products',event['entity_id']) if event['trigger'] == 'inventory_low' else None
    values = {'customerName':contact.get('name'),'email':contact.get('email'),'segment':contact.get('segment'),'reference':event['entity_id'],'amount':order['totalPaise']/100 if order else None,'status':(order or task or {}).get('status'),'paymentStatus':(order or {}).get('paymentStatus'),'productName':(product or {}).get('name',payload.get('productName')),'stock':(product or {}).get('stock',payload.get('stock')),'dueAt':datetime.fromtimestamp(parse_date(task['dueAt'])/1000,IST).strftime('%d/%m/%Y, %I:%M %p IST') if task and task.get('dueAt') else None,'tracking':(order or {}).get('trackingNumber'),'date':datetime.fromtimestamp(event['created_at']/1000,IST).strftime('%d/%m/%Y')}
    return values,source,payload,product


def conditions_match(definition,values):
    results = []
    for c in definition['conditions']:
        v = values.get(c['field'])
        if v is None:
            results.append(False)
            continue
        value,target = str(v).lower(),c['value'].lower()
        operator = c['operator']
        if operator == 'equals': result = value == target
        elif operator == 'not_equals': result = value != target
        elif operator == 'contains': result = target in value
        else:
            try:
                n = float(v)
                result = math.isfinite(n) and (n > float(target) if operator == 'greater_than' else n < float(target))
            except (ValueError,TypeError):
                result = False
        results.append(result)
    return not results or (all(results) if definition['match'] == 'all' else any(results))


def obsolete(event,timestamp,started=False):
    if not started and timestamp > event['available_at']+7*DAY:
        return 'Event expired'
    _,source,_,product = event_data(event)
    reason = wa.business_reason(event['trigger'],event['entity_id'],json.loads(source['parameters']) if source else [],json.loads(source['context']) if source else {},timestamp)
    if reason:
        return reason
    if event['trigger'] == 'inventory_low' and (not product or product['stock'] > (record('settings','automation') or {}).get('lowStockThreshold',2)):
        return 'Stock replenished'
    return None


def cancel_pending(key,reason):
    timestamp = now()
    run("UPDATE auto_runs SET status='cancelled',error=?,updated_at=? WHERE workflow_id=? AND status IN ('queued','waiting','running','failed')",reason,timestamp,key)
    run("UPDATE auto_emails SET status='cancelled',error=?,updated_at=? WHERE run_id IN (SELECT id FROM auto_runs WHERE workflow_id=?) AND status IN ('queued','preview','failed')",reason,timestamp,key)
    run("UPDATE wa_outbox SET status='cancelled',error=?,updated_at=? WHERE json_extract(context,'$.workflowRunId') IN (SELECT id FROM auto_runs WHERE workflow_id=?) AND status IN ('queued','blocked','failed')",reason,timestamp,key)


def save_workflow(data,actor,key=None):
    with transaction():
        definition = validate_definition(data)
        if key:
            check(one('SELECT id FROM auto_workflows WHERE id=?',key),'Workflow not found',404)
        key = key or uid()
        timestamp = now()
        run('INSERT INTO auto_workflows(id,name,draft,created_at,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,draft=excluded.draft,updated_at=excluded.updated_at',key,definition['name'],dumps(definition),timestamp,timestamp)
        audit(actor,'automation.draft.saved',key)
        return key


def owns_whatsapp(definition,event):
    return definition['trigger'] == event and any(s['type'] == 'whatsapp' for s in definition['steps'])


def ensure_native_available(event):
    for row in all_rows('SELECT published FROM auto_workflows WHERE enabled=1'):
        check(not owns_whatsapp(json.loads(row['published']),event),'Pause the custom WhatsApp workflow before enabling the built-in rule',409)


def publish_workflow(key,actor,take_over=False):
    with transaction():
        row = one('SELECT * FROM auto_workflows WHERE id=?',key)
        check(row,'Workflow not found',404)
        definition = validate_definition(json.loads(row['draft']))
        if any(s['type']=='whatsapp' for s in definition['steps']):
            for other in all_rows('SELECT published FROM auto_workflows WHERE enabled=1 AND id<>?',key):
                check(not owns_whatsapp(json.loads(other['published']),definition['trigger']),'Another published WhatsApp workflow already owns this trigger',409)
            conf = wa.settings()
            if conf['rules'][definition['trigger']]['enabled']:
                check(take_over,'Confirm taking over this built-in WhatsApp rule before publishing',409)
                conf['rules'][definition['trigger']]['enabled'] = False
                save('settings','whatsapp',{**(record('settings','whatsapp') or {}),**conf})
                run("UPDATE wa_outbox SET status='cancelled',error='Replaced by custom workflow',updated_at=? WHERE event=? AND json_extract(context,'$.workflowRunId') IS NULL AND status IN ('queued','blocked')",now(),definition['trigger'])
        cancel_pending(key,'Workflow republished; pending previous version cancelled')
        timestamp = now()
        definition.update({'_publishedAt':timestamp,'_afterEventSequence':one('SELECT coalesce(max(rowid),0) AS n FROM auto_events')['n']})
        run('UPDATE auto_workflows SET published=?,version=version+1,enabled=1,updated_at=? WHERE id=?',dumps(definition),timestamp,key)
        audit(actor,'automation.published',key)


def pause_workflow(key,actor):
    with transaction():
        check(one('SELECT id FROM auto_workflows WHERE id=?',key),'Workflow not found',404)
        run('UPDATE auto_workflows SET enabled=0,updated_at=? WHERE id=?',now(),key)
        cancel_pending(key,'Workflow paused')
        audit(actor,'automation.paused',key)


def set_native_rule(event,enabled,delay,actor):
    with transaction():
        check(isinstance(event,str) and event in wa.EVENTS,'Unknown WhatsApp event')
        check(type(enabled) is bool and type(delay) is int and 0 <= delay <= 43200,'Invalid delay')
        if enabled:
            ensure_native_available(event)
        conf = wa.settings()
        conf['rules'][event] = {'enabled':enabled,'delayMinutes':delay}
        save('settings','whatsapp',{**(record('settings','whatsapp') or {}),**conf})
        audit(actor,'automation.native-rule.updated',event)


def test_workflow(data,event_id=None):
    definition = validate_definition(data)
    event = one('SELECT * FROM auto_events WHERE id=?',event_id) if event_id else None
    if event_id:
        check(event,'Event not found',404)
        check(event['trigger'] == definition['trigger'],'Select an event with the same trigger')
    values = event_data(event)[0] if event else {'customerName':'Preview Customer','email':'preview@example.test','segment':'retail','reference':'PREVIEW-001','amount':12500,'status':'confirmed','paymentStatus':'paid','productName':'Preview Ring','stock':1,'dueAt':'Tomorrow, 11:00 IST','tracking':'PREVIEW-TRACK','date':datetime.now(IST).strftime('%d/%m/%Y')}
    steps = []
    for step in definition['steps']:
        out = {'type':step['type']}
        for field in ('title','body'):
            if field in step:
                out[field] = render(step[field],values)
        if 'minutes' in step: out['minutes'] = step['minutes']
        if step['type'] == 'email': out['recipient'] = step.get('staffEmail') if step['recipient']=='staff' else values.get('email')
        if step['type'] == 'whatsapp': out['whatsapp'] = 'Uses the matching approved WhatsApp template; consent and delivery setup still required'
        steps.append(out)
    return {'dryRun':True,'matches':conditions_match(definition,values),'source':'stored event' if event else 'sample data','values':values,'steps':steps}


def schedule_daily(timestamp):
    day = datetime.fromtimestamp(timestamp/1000,IST).strftime('%Y-%m-%d')
    for row in all_rows('SELECT * FROM auto_workflows WHERE enabled=1'):
        definition = json.loads(row['published'])
        if definition['trigger'] != 'daily_schedule':
            continue
        due = parse_date(f'{day}T{definition["scheduleHour"]:02}:{definition["scheduleMinute"]:02}:00+05:30')
        if timestamp >= due and definition.get('_publishedAt',0) <= due:
            emit_event('daily_schedule',f'daily:{row["id"]}:{day}',day,None,{'targetWorkflowId':row['id']},due)


def execute_step(step,workflow_run,event,timestamp):
    values,source,_,_ = event_data(event)
    title = render(step['title'],values) if step.get('title') else ''
    body = render(step['body'],values) if step.get('body') else ''
    recipient = step.get('staffEmail') if step.get('recipient') == 'staff' else values.get('email')
    if workflow_run['mode'] == 'preview':
        return {'preview':True,'type':step['type'],'title':title,'body':body,'recipient':recipient if step['type']=='email' else None}
    key = f'{workflow_run["id"]}:{step["id"]}'
    if step['type'] == 'staff_alert':
        run('INSERT OR IGNORE INTO auto_alerts(id,run_id,step_id,title,body,priority,created_at) VALUES(?,?,?,?,?,?,?)',key,workflow_run['id'],step['id'],title,body,step.get('priority','normal'),timestamp)
        return {'alertId':key}
    if step['type'] == 'create_task':
        run('INSERT OR IGNORE INTO auto_tasks(id,run_id,step_id,customer_id,title,body,due_at,created_at) VALUES(?,?,?,?,?,?,?,?)',key,workflow_run['id'],step['id'],event['customer_id'],title,body,timestamp+step['minutes']*60000,timestamp)
        return {'taskId':key}
    if step['type'] == 'email':
        recipient = email(recipient)
        from .mail import configured
        mode = 'live' if configured() else 'preview'
        run('INSERT OR IGNORE INTO auto_emails(id,run_id,step_id,recipient,subject,body,mode,status,next_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)',key,workflow_run['id'],step['id'],recipient,title,body,mode,'queued' if mode == 'live' else 'preview',timestamp,timestamp,timestamp)
        return {'emailId':key,'mode':mode}
    if step['type'] == 'whatsapp':
        check(source,'This event has no WhatsApp message payload')
        check(not wa.settings()['rules'][source['event']]['enabled'],'Built-in WhatsApp rule was re-enabled; custom send held',409)
        context = {**json.loads(source['context']),'workflowRunId':workflow_run['id']}
        message = wa.queue_whatsapp(source['event'],event['entity_id'],event['customer_id'],json.loads(source['parameters']),'workflow:'+key,timestamp,context)
        return {'whatsappId':message['id'],'mode':message['mode'],'status':message['status']}
    return {}


def process(timestamp=None):
    timestamp = now() if timestamp is None else timestamp
    with transaction():
        schedule_daily(timestamp)
        matched,executed = 0,0
        for event in all_rows('SELECT rowid AS sequence,* FROM auto_events WHERE processed_at IS NULL AND available_at<=? ORDER BY available_at LIMIT 100',timestamp):
            for workflow in all_rows('SELECT * FROM auto_workflows WHERE enabled=1'):
                definition = json.loads(workflow['published'])
                payload = json.loads(event['payload'])
                if definition['trigger'] != event['trigger'] or event['sequence'] <= definition.get('_afterEventSequence',0) or payload.get('targetWorkflowId') and payload['targetWorkflowId'] != workflow['id']:
                    continue
                reason = obsolete(event,timestamp)
                if not reason and not conditions_match(definition,event_data(event)[0]):
                    reason = 'Conditions did not match'
                if not reason and definition['cooldownMinutes']:
                    if one("SELECT r.id FROM auto_runs r JOIN auto_events e ON e.id=r.event_id WHERE r.workflow_id=? AND r.version=? AND e.entity_id=? AND r.status NOT IN ('skipped','cancelled') AND r.created_at>? LIMIT 1",workflow['id'],workflow['version'],event['entity_id'],timestamp-definition['cooldownMinutes']*60000):
                        reason = 'Cooldown active'
                run('INSERT OR IGNORE INTO auto_runs(id,workflow_id,event_id,definition,version,mode,status,next_at,error,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)',uid(),workflow['id'],event['id'],workflow['published'],workflow['version'],definition['mode'],'skipped' if reason else 'queued',timestamp,reason,timestamp,timestamp)
                matched += 1
            run('UPDATE auto_events SET processed_at=? WHERE id=? AND processed_at IS NULL',timestamp,event['id'])
        for item in all_rows("SELECT * FROM auto_runs WHERE status IN ('queued','waiting') AND next_at<=? ORDER BY next_at LIMIT 100",timestamp):
            workflow = one('SELECT enabled,version FROM auto_workflows WHERE id=?',item['workflow_id'])
            if not workflow or not workflow['enabled'] or workflow['version'] != item['version']:
                run("UPDATE auto_runs SET status='cancelled',error='Workflow paused or superseded',updated_at=? WHERE id=?",timestamp,item['id'])
                continue
            event = one('SELECT * FROM auto_events WHERE id=?',item['event_id'])
            definition = json.loads(item['definition'])
            reason = 'Run overdue; prepare a fresh event' if timestamp > item['next_at']+7*DAY else obsolete(event,timestamp,True)
            if not reason and not conditions_match(definition,event_data(event)[0]): reason = 'Conditions no longer match'
            if reason:
                run("UPDATE auto_runs SET status='skipped',error=?,updated_at=? WHERE id=?",reason,timestamp,item['id'])
                continue
            logs,cursor,status,next_at,error = json.loads(item['logs']),item['cursor'],'completed',timestamp,None
            while cursor < len(definition['steps']):
                step = definition['steps'][cursor]
                try:
                    if step['type'] == 'delay':
                        logs.append({'stepId':step['id'],'type':'delay','minutes':step['minutes'],'at':timestamp})
                        cursor += 1
                        if step['minutes']:
                            status,next_at = 'waiting',timestamp+step['minutes']*60000
                            break
                        continue
                    output = execute_step(step,item,event,timestamp)
                    logs.append({'stepId':step['id'],'type':step['type'],'at':timestamp,'output':output})
                    cursor += 1
                    executed += 1
                except ApiError as exc:
                    status,error = 'failed',exc.message
                    logs.append({'stepId':step['id'],'type':step['type'],'at':timestamp,'error':error})
                    break
            run('UPDATE auto_runs SET status=?,cursor=?,next_at=?,logs=?,error=?,updated_at=? WHERE id=?',status,cursor,next_at,dumps(logs),error,timestamp,item['id'])
        save('settings','automation-worker',{'lastCheckedAt':timestamp,'matched':matched,'executed':executed})
        return {'matched':matched,'executed':executed}


def retry_run(key,actor):
    with transaction():
        item = one('SELECT * FROM auto_runs WHERE id=?',key)
        check(item and item['status'] == 'failed','Only failed runs can be retried',409)
        workflow = one('SELECT enabled,version FROM auto_workflows WHERE id=?',item['workflow_id'])
        check(workflow and workflow['enabled'] and workflow['version'] == item['version'],'Publish a current workflow and wait for a new event',409)
        run("UPDATE auto_runs SET status='queued',error=NULL,next_at=?,updated_at=? WHERE id=?",now(),now(),key)
        audit(actor,'automation.run.retried',key)


def delivery_reason(key,timestamp=None):
    item = one('SELECT * FROM auto_runs WHERE id=?',key)
    if not item: return 'Run missing'
    workflow = one('SELECT enabled,version FROM auto_workflows WHERE id=?',item['workflow_id'])
    if not workflow or not workflow['enabled'] or workflow['version'] != item['version']: return 'Workflow paused or superseded'
    event = one('SELECT * FROM auto_events WHERE id=?',item['event_id'])
    reason = obsolete(event,now() if timestamp is None else timestamp,True)
    if not reason and not conditions_match(json.loads(item['definition']),event_data(event)[0]): return 'Conditions no longer match'
    return reason


def overview():
    return {'workflows':[{**r,'draft':json.loads(r['draft']),'published':json.loads(r['published']) if r['published'] else None} for r in all_rows('SELECT * FROM auto_workflows ORDER BY created_at DESC')],'runs':[{**r,'logs':json.loads(r['logs'])} for r in all_rows('SELECT r.*,w.name,e.trigger,e.entity_id FROM auto_runs r JOIN auto_workflows w ON w.id=r.workflow_id JOIN auto_events e ON e.id=r.event_id ORDER BY r.created_at DESC LIMIT 300')],'events':all_rows('SELECT id,trigger,entity_id,available_at,created_at FROM auto_events ORDER BY created_at DESC LIMIT 100'),'alerts':all_rows('SELECT * FROM auto_alerts ORDER BY created_at DESC LIMIT 300'),'tasks':all_rows('SELECT * FROM auto_tasks ORDER BY created_at DESC LIMIT 300'),'emails':all_rows('SELECT * FROM auto_emails ORDER BY created_at DESC LIMIT 300'),'triggers':TRIGGERS,'variables':VARIABLES,'starters':seed('automations'),'native':wa.settings(),'connections':{'whatsapp':wa.readiness(),'email':{'mode':'live' if os.getenv('EMAIL_MODE')=='live' else 'preview','apiKey':bool(os.getenv('RESEND_API_KEY')),'from':bool(os.getenv('EMAIL_FROM'))}},'worker':record('settings','automation-worker')}
