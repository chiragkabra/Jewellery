"""Catalogue, pricing, CRM and atomic order lifecycle."""
import hashlib
import math
import re
from urllib.parse import urlparse
from .core import *


def catalogue():
    return [p for p in records('products') if p.get('active') is True]


def metal_rates():
    stored = record('settings', 'rates')
    return {'rates': [{'key': key, 'label': label, 'unit': unit, 'value': (stored or {}).get(key), 'change': None} for key, label, unit in [('gold24','Gold 24K','/g'),('gold22','Gold 22K','/g'),('gold18','Gold 18K','/g'),('silver999','Silver 999','/kg')]], 'updatedAt': (stored or {}).get('updatedAt', iso()), 'source': 'Store-managed rates' if stored else 'Rates not configured', 'live': False}


def price_total(product, variant):
    if product.get('price') is not None:
        return product['price']
    key = 'silver999' if product['material'] == 'silver' else {'24K':'gold24','22K':'gold22'}.get(variant, 'gold18') if product['material'] == 'gold' else 'gold18'
    rate = next(r['value'] for r in metal_rates()['rates'] if r['key'] == key)
    if rate is None or product.get('weightGrams') is None or product.get('makingChargePct') is None:
        return None
    metal = rate * product['weightGrams'] * (14/18 if variant == '14K' else 1) * (0.925/1000 if product['material'] == 'silver' else 1)
    stone = product.get('stoneValue') if product['material'] == 'diamond' else 0
    return None if stone is None else (metal * (1 + product['makingChargePct']/100) + stone) * 1.03


def customer(data):
    address = email(data.get('email'))
    existing = one('SELECT id FROM customers WHERE email=?', address)
    if existing:
        return record('customers', existing['id'])
    return save('customers', uid(), {'name': text(data.get('name') or data.get('contact') or address.split('@')[0], 'name',150), 'email': address, 'phone':text(data.get('phone'),'phone',40,False), 'company':text(data.get('company'),'company',200,False), 'country':text(data.get('country'),'country',100,False), 'segment': 'trade' if data.get('form') in ('trade-application','trade-enquiry') else 'retail', 'notes':'', 'newsletter':data.get('form') == 'newsletter'})


def validate_items(value, priced):
    check(isinstance(value,list) and 1 <= len(value) <= 50, 'Add between 1 and 50 items')
    result = []
    for item in value:
        check(isinstance(item,dict), 'Invalid item')
        p = record('products', item.get('slug',''))
        check(p and p.get('active') is True, 'Product unavailable')
        qty = number(item.get('qty'), 'quantity', 1000)
        check(qty > 0 and qty == int(qty), 'Invalid quantity')
        variant = choice(item.get('variant') or p['variants'][0], p['variants'], 'variant')
        colour = choice(item.get('colour') or p['metalColours'][0], p['metalColours'], 'colour')
        size = choice(item.get('size') or p['sizes'][0], p['sizes'], 'size') if p.get('sizes') else ''
        total = price_total(p,variant)
        if priced:
            check(total is not None and total > 0, f'{p["name"]}: price not set. Please request a quote.',409)
        paise = None if total is None else math.floor(total*100 + 0.5)
        if priced:
            check(0 < paise <= 9007199254740991, 'Product price is outside supported limits',409)
        result.append({'slug':p['id'],'name':p['name'],'qty':qty,'variant':variant,'colour':colour,'size':size,'unitPaise':paise})
    return result


def preview_order(items):
    lines = validate_items(items,True)
    counts = {}
    for line in lines:
        counts[line['slug']] = counts.get(line['slug'],0) + line['qty']
    for slug,qty in counts.items():
        p = record('products',slug)
        check(p['stock'] >= qty, f'{p["name"]}: insufficient stock',409)
    total = sum(line['unitPaise']*line['qty'] for line in lines)
    check(0 < total <= 9007199254740991,'Order total is outside supported limits',409)
    return {'items':lines,'totalPaise':total}


def enquiry(data,uploads=()):
    from .messaging import capture_consent, queue_whatsapp
    form = choice(data.get('form'),['contact','newsletter','trade-enquiry','trade-application','quote'],'form')
    if form != 'newsletter':
        text(data.get('name') or data.get('contact'),'name',150)
    email(data.get('email'))
    if form in ('trade-application','trade-enquiry'):
        text(data.get('company'),'company',200)
    text(data.get('message'),'message',5000,False)
    if data.get('items') is not None and not (data['items'] == [] and form == 'quote'):
        validate_items(data['items'],False)
    with transaction():
        contact = customer(data)
        capture_consent(contact['id'],data)
        if form == 'newsletter':
            save('customers',contact['id'],{**contact,'newsletter':True})
        key = 'ENQ-'+uid()[:12].upper()
        files = [{**f,'id':uid()} for f in uploads]
        save('enquiries',key,{'form':form,'payload':data,'status':'new','assignee':'','notes':'','attachments':[{'id':f['id'],'name':f['name']} for f in files]},contact['id'])
        for f in files:
            run('INSERT INTO attachments VALUES(?,?,?,?,?)',f['id'],key,f['name'],f['mime'],f['content'])
        if form != 'newsletter':
            queue_whatsapp('enquiry_received',key,contact['id'],[contact['name'],key])
        audit('website','enquiry.created',key)
        return key


def create_order(data,actor):
    from .messaging import capture_consent, queue_order_messages
    from .workflows import emit_inventory
    text(data.get('name'),'name',150)
    address = text(data.get('address'),'delivery address',2000)
    email(data.get('email'))
    text(data.get('phone'),'phone',40)
    with transaction():
        request_id = text(data.get('requestId'),'request ID',100) if data.get('requestId') else None
        digest = hashlib.sha256(dumps(data).encode()).hexdigest()
        if request_id:
            previous = one('SELECT * FROM order_requests WHERE id=?', request_id)
            if previous:
                check(previous['request_hash'] == digest,'This request ID was already used for a different order',409)
                return record('orders',previous['order_id'])
        preview = preview_order(data.get('items'))
        if 'expectedTotalPaise' in data:
            check(data['expectedTotalPaise'] == preview['totalPaise'],'Price changed. Refresh checkout before placing your order.',409)
        for item in preview['items']:
            product = record('products',item['slug'])
            updated = save('products',product['id'],{**product,'stock':product['stock']-item['qty']})
            emit_inventory(product,updated)
        contact = customer(data)
        capture_consent(contact['id'],data)
        key = 'ORD-'+uid()[:12].upper()
        result = save('orders',key,{'items':preview['items'],'totalPaise':preview['totalPaise'],'currency':'INR','address':address,'phone':data['phone'],'name':data['name'],'email':email(data['email']),'status':'pending','paymentStatus':'unpaid','paymentMethod':'manual','notes':'','shippingPaise':0,'pricingNote':'Product total includes configured GST. Delivery is included. Payment is confirmed separately by staff.'},contact['id'])
        queue_order_messages(result)
        if request_id:
            run('INSERT INTO order_requests VALUES(?,?,?)',request_id,digest,key)
        audit(actor,'order.created',key)
        return result


def update_order(key,data,actor):
    from .messaging import queue_order_messages
    with transaction():
        old = record('orders',key)
        check(old,'Order not found',404)
        status = choice(data.get('status',old['status']),['pending','confirmed','processing','shipped','delivered','cancelled'],'status')
        allowed = {'pending':['confirmed','cancelled'],'confirmed':['processing','cancelled'],'processing':['shipped','cancelled'],'shipped':['delivered'],'delivered':[],'cancelled':[]}
        check(status == old['status'] or status in allowed[old['status']],'Order status transition not allowed',409)
        payment = choice(data.get('paymentStatus',old['paymentStatus']),['unpaid','paid','refunded'],'payment status')
        check(not (payment == 'refunded' and old['paymentStatus'] == 'unpaid'),'An unpaid order cannot be marked refunded',409)
        check(not (payment == 'paid' and old['paymentStatus'] != 'paid' and status == 'cancelled'),'A cancelled order cannot receive a new payment',409)
        extra = {field:text(data.get(field,old.get(field)),label,maximum,False) for field,label,maximum in [('carrier','carrier',100),('trackingNumber','tracking number',150),('trackingUrl','tracking URL',2000),('notes','notes',5000)]}
        if extra['trackingUrl']:
            try:
                url = urlparse(extra['trackingUrl'])
                check(url.scheme == 'https' and url.hostname and not url.username and not url.password,'Use an HTTPS tracking URL without credentials')
            except ValueError:
                raise ApiError(400,'Invalid tracking URL')
        if status == 'cancelled' and old['status'] != 'cancelled':
            for item in old['items']:
                p = record('products',item['slug'])
                save('products',p['id'],{**p,'stock':p['stock']+item['qty']})
        result = save('orders',key,{**old,**extra,'status':status,'paymentStatus':payment,'paidAt':iso() if payment == 'paid' and old['paymentStatus'] != 'paid' else old.get('paidAt')},old['customerId'])
        queue_order_messages(result,old)
        audit(actor,'order.updated',key)
        return result


def mutate_crm(resource,key,data,actor,creating):
    from .messaging import queue_task_messages
    from .workflows import emit_inventory
    check(resource in ENTITIES,'Unknown resource',404)
    check(not key if creating else key,'Invalid resource path')
    key = uid() if creating else key
    old = {} if creating else record(resource,key)
    if not creating and not (resource == 'settings' and key == 'rates'):
        check(old,'Not found',404)
    old = old or {}
    if resource == 'orders':
        return create_order(data,actor['id']) if creating else update_order(key,data,actor['id'])
    value = dict(old)
    get = lambda field,default=None: data.get(field,old.get(field,default))
    customer_id = old.get('customerId')
    with transaction():
        if resource == 'customers':
            address = email(get('email'))
            check(not one('SELECT id FROM customers WHERE email=? AND id<>?',address,key),'Email already exists',409)
            value.update({'email':address,'segment':choice(get('segment','retail'),['retail','trade','vip'],'segment'),'newsletter':get('newsletter') is True})
            for field,max_len,required in [('name',150,True),('phone',40,False),('company',200,False),('country',100,False),('notes',5000,False)]:
                value[field] = text(get(field),field,max_len,required)
        elif resource == 'enquiries':
            check(not creating,'Enquiries are created through website forms')
            value.update({'status':choice(get('status'),['new','contacted','qualified','quoted','won','lost'],'status'),'assignee':text(get('assignee'),'assignee',150,False),'notes':text(get('notes'),'notes',5000,False)})
        elif resource == 'tasks':
            customer_id = customer_id or text(data.get('customerId'),'customer',100)
            check(record('customers',customer_id),'Customer not found')
            value.update({'title':text(get('title'),'title',200),'kind':choice(get('kind','follow-up'),['follow-up','repair','custom-order','appointment'],'type'),'status':choice(get('status','open'),['open','in-progress','ready','done'],'status'),'dueAt':iso(parse_date(text(get('dueAt'),'due date',50))),'assignee':text(get('assignee'),'assignee',150,False),'notes':text(get('notes'),'notes',5000,False)})
        elif resource == 'products':
            slug = text(data.get('slug'),'slug',100) if creating else key
            check(re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*',slug),'Invalid slug')
            if creating:
                check(not record('products',slug),'Product already exists',409)
            value.update({'slug':slug,'name':text(get('name'),'name',200),'description':text(get('description'),'description',5000),'material':choice(get('material'),['gold','silver','diamond'],'material'),'category':choice(get('category'),['rings','necklaces','earrings','bangles-bracelets','pendants','chains'],'category'),'trade':old.get('trade',{'moq':'On request','leadTime':'On request'}),'active':get('active',True) is True,'stock':number(get('stock',0),'stock',1000000)})
            check(value['stock'] == int(value['stock']),'Stock must be a whole number')
            for field in ('price','weightGrams','makingChargePct','stoneValue'):
                value[field] = None if get(field) is None else number(get(field),field)
            for field in ('variants','metalColours','images'):
                v = get(field)
                check(isinstance(v,list) and 1 <= len(v) <= 20 and all(isinstance(x,str) and 0<len(x)<500 for x in v),f'Invalid {field}')
                value[field] = v
            check(all(v.startswith('/images/') and '..' not in v for v in value['images']),'Use local /images/ product photos')
            value.update({'sizes':old.get('sizes',[]),'certificateNo':text(get('certificateNo'),'certificate',100,False) or None,'certificateUrl':old.get('certificateUrl')})
            result = save(resource,slug,value)
            if old:
                emit_inventory(old,result)
            audit(actor['id'],'product.created' if creating else 'product.updated',slug)
            return result
        else:
            check(actor['role'] == 'admin','Admin access required',403)
            check(not creating and key == 'rates','Use PATCH settings/rates')
            value = {'updatedAt':iso()}
            for field in ('gold24','gold22','gold18','silver999'):
                value[field] = None if field in data and data[field] is None else number(data.get(field),field)
        result = save(resource,key,value,customer_id)
        if resource == 'tasks':
            queue_task_messages(result,old)
        audit(actor['id'],f'{resource}.{"created" if creating else "updated"}',key)
        return result
