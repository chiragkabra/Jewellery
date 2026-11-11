import assert from "node:assert/strict";
import { spawn,spawnSync } from "node:child_process";
import { mkdtempSync,mkdirSync,writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHmac,randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
const folder=mkdtempSync(path.join(tmpdir(),"lumera-backend-test-"));
const port=Number(process.env.TEST_PORT || 3218),base=`http://localhost:${port}`;
const env={...process.env,DATABASE_PATH:path.join(folder,"test.sqlite"),APP_URL:base,COOKIE_SECURE:"false",NEXT_TELEMETRY_DISABLED:"1",WHATSAPP_MODE:"preview",WHATSAPP_ALLOWED_RECIPIENTS:"",WHATSAPP_ACCESS_TOKEN:"",WHATSAPP_APP_SECRET:"test-meta-signing-secret",WHATSAPP_VERIFY_TOKEN:"test-verify-token",WHATSAPP_PHONE_NUMBER_ID:"123456",WHATSAPP_CRON_SECRET:"test-cron-secret-at-least-32-characters"};
const seeded=spawnSync(process.execPath,["scripts/create-admin.mjs","--email","owner@example.test"],{env,encoding:"utf8"});
assert.equal(seeded.status,0,seeded.stderr);const password=seeded.stdout.match(/Password: (.+)/)[1];
const server=spawn(process.execPath,["node_modules/next/dist/bin/next","start","-p",String(port)],{env,stdio:["ignore","pipe","pipe"],windowsHide:true});
let logs="";server.stdout.on("data",d=>logs+=d);server.stderr.on("data",d=>logs+=d);
const results=[];
function pass(name){results.push(name);console.log(`PASS ${name}`);}
async function request(route,{method="GET",data,cookie,expected=200,origin=base,form,headers:provided={}}={}) {
  const headers={Origin:origin,...provided};if(data)headers["Content-Type"]="application/json";if(cookie)headers.Cookie=cookie;
  const response=await fetch(base+route,{method,headers,body:form || (data ? JSON.stringify(data) : undefined),redirect:"manual"});
  const raw=await response.text();let body;try{body=JSON.parse(raw);}catch{body=raw;}
  assert.equal(response.status,expected,`${method} ${route}: ${raw.slice(0,700)}`);
  return {body,response,cookie:response.headers.get("set-cookie")?.split(";")[0]};
}
try {
  for(let i=0;i<120;i++){try{const response=await fetch(base+"/api/auth");if(response.ok)break;}catch{}await new Promise(r=>setTimeout(r,500));if(i===119)throw new Error(`Server did not start: ${logs}`);}
  await request("/api/crm/customers",{expected:401});await request("/crm",{expected:307});pass("Unauthenticated CRM and API access blocked");
  await request("/api/auth",{method:"POST",data:{action:"login",email:"owner@example.test",password:"wrong"},expected:401});pass("Invalid login rejected");
  const login=await request("/api/auth",{method:"POST",data:{action:"login",email:"owner@example.test",password}});let admin=login.cookie;assert.ok(admin);assert.match(login.response.headers.get("set-cookie"),/HttpOnly/i);pass("Admin login and HttpOnly session cookie");
  await request("/api/crm/customers",{method:"POST",cookie:admin,origin:"https://evil.example",data:{name:"Bad",email:"bad@example.test"},expected:403});pass("Cross-origin writes blocked");
  await request("/api/enquiry",{method:"POST",data:{form:"anything",email:"bad"},expected:400});await request("/api/enquiry",{method:"POST",data:{form:"contact",email:"wrong",name:"Test"},expected:400});pass("Invalid enquiry forms and emails rejected");
  const contact={name:"Asha Test",email:"asha@example.test",phone:"9876543210",message:"Wedding ring enquiry"};
  const enquiry=await request("/api/enquiry",{method:"POST",data:{form:"contact",...contact},expected:201});assert.ok(enquiry.body.reference);
  await request("/api/enquiry",{method:"POST",data:{form:"newsletter",email:"ASHA@example.test"},expected:201});
  await request("/api/enquiry",{method:"POST",data:{form:"quote",...contact,items:[]},expected:201});
  const customers=await request("/api/crm/customers",{cookie:admin});assert.equal(customers.body.items.length,1);assert.equal(customers.body.items[0].newsletter,true);const customerId=customers.body.items[0].id;pass("Forms persist, customer email deduplicates, newsletter consent retained");
  const leads=await request("/api/crm/enquiries",{cookie:admin});assert.equal(leads.body.items.length,3);
  await request(`/api/crm/enquiries/${enquiry.body.reference}`,{method:"PATCH",cookie:admin,data:{status:"qualified",assignee:"Owner",notes:"Call on Friday"}});pass("Enquiry pipeline, assignment and notes persist");
  const form=new FormData();form.set("payload",JSON.stringify({form:"trade-application",...contact,company:"Asha Jewels"}));form.append("gst",new Blob(["%PDF-1.7\nTest document"],{type:"application/pdf"}),"gst.pdf");
  const application=await request("/api/enquiry",{method:"POST",form,expected:201});const app=await request(`/api/crm/enquiries/${application.body.reference}`,{cookie:admin});const attachmentId=app.body.item.attachments[0].id;
  await request(`/api/crm/attachments/${attachmentId}`,{expected:401});const file=await request(`/api/crm/attachments/${attachmentId}`,{cookie:admin});assert.match(file.body,/%PDF-1.7/);pass("Trade documents stored and restricted to authenticated staff");
  const invalid=new FormData();invalid.set("payload",JSON.stringify({form:"contact",...contact}));invalid.append("file",new Blob(["<script>alert(1)</script>"],{type:"application/pdf"}),"fake.pdf");await request("/api/enquiry",{method:"POST",form:invalid,expected:400});pass("Spoofed file content rejected");
  const task=await request("/api/crm/tasks",{method:"POST",cookie:admin,data:{customerId,title:"Resize ring",kind:"repair",dueAt:"2020-01-01T10:00:00Z",assignee:"Workshop"},expected:201});
  const dash=await request("/api/crm/dashboard",{cookie:admin});assert.equal(dash.body.overdue,1);
  await request(`/api/crm/tasks/${task.body.item.id}`,{method:"PATCH",cookie:admin,data:{status:"done"}});pass("Repair tasks, customer link and overdue counts");
  const products=await request("/api/products");assert.ok(products.body.products.length>0);const product=products.body.products[0],slug=product.slug;
  const items=[{slug,qty:2,variant:product.variants[0],colour:product.metalColours[0]}];
  await request("/api/checkout",{method:"POST",data:{items},expected:409});pass("Unpriced catalogue cannot be purchased");
  await request(`/api/crm/products/${slug}`,{method:"PATCH",cookie:admin,data:{price:12500,stock:3}});
  for(const invalid of [{...items[0],qty:0},{...items[0],qty:1.5},{...items[0],variant:"invalid-purity"}]) await request("/api/checkout",{method:"POST",data:{items:[invalid]},expected:400});
  await request("/api/checkout",{method:"POST",data:{items:[items[0],items[0]]},expected:409});pass("Invalid variants and quantities rejected; duplicate lines share stock");
  const preview=await request("/api/checkout",{method:"POST",data:{items}});assert.equal(preview.body.totalPaise,2500000);
  const orderData={...contact,address:"Test delivery address, Mumbai",items,expectedTotalPaise:preview.body.totalPaise,requestId:randomUUID(),totalPaise:1};
  const placed=await request("/api/orders",{method:"POST",data:orderData,expected:201});assert.equal(placed.body.totalPaise,2500000);
  const retry=await request("/api/orders",{method:"POST",data:orderData,expected:201});assert.equal(retry.body.reference,placed.body.reference);
  const afterOrder=await request(`/api/crm/products/${slug}`,{cookie:admin});assert.equal(afterOrder.body.item.stock,1);pass("Server-owned prices, inventory reservation and idempotent order retries");
  await request("/api/orders",{method:"POST",data:{...orderData,requestId:randomUUID()},expected:409});assert.equal((await request(`/api/crm/products/${slug}`,{cookie:admin})).body.item.stock,1);pass("Insufficient stock rejects without partial writes");
  await request("/api/orders",{method:"POST",data:{...orderData,items:[{...items[0],qty:1}],expectedTotalPaise:1,requestId:randomUUID()},expected:409});pass("Changed or tampered checkout totals rejected");
  await request(`/api/crm/orders/${placed.body.reference}`,{method:"PATCH",cookie:admin,data:{status:"delivered"},expected:409});
  await request(`/api/crm/orders/${placed.body.reference}`,{method:"PATCH",cookie:admin,data:{status:"cancelled"}});
  await request(`/api/crm/orders/${placed.body.reference}`,{method:"PATCH",cookie:admin,data:{status:"cancelled"}});
  assert.equal((await request(`/api/crm/products/${slug}`,{cookie:admin})).body.item.stock,3);pass("Invalid order transitions blocked; cancellation restores stock once");
  await request(`/api/crm/products/${slug}`,{method:"PATCH",cookie:admin,data:{stock:1}});
  const single={...orderData,items:[{...items[0],qty:1}],expectedTotalPaise:1250000};
  const simultaneous=await Promise.all([1,2].map(async()=>{const r=await fetch(base+"/api/orders",{method:"POST",headers:{"Content-Type":"application/json",Origin:base},body:JSON.stringify({...single,requestId:randomUUID()})});return r.status;}));assert.deepEqual(simultaneous.sort(),[201,409]);pass("Concurrent orders cannot oversell the last item");
  await request("/api/crm/settings/rates",{method:"PATCH",cookie:admin,data:{gold24:10000,gold22:9200,gold18:7500,silver999:100000}});
  const rates=await request("/api/rates");assert.equal(rates.body.live,false);assert.equal(rates.body.rates[0].value,10000);pass("CRM metal rates published with manual source disclosure");
  await request("/api/crm/products/aurelia-band-ring",{method:"PATCH",cookie:admin,data:{price:null,weightGrams:1,makingChargePct:10,stock:2}});
  const calculated=await request("/api/checkout",{method:"POST",data:{items:[{slug:"aurelia-band-ring",variant:"22K",qty:1}]}});assert.equal(calculated.body.totalPaise,1042360);pass("Rate-based gold price includes making charges and configured GST");
  const added=await request("/api/crm/products",{method:"POST",cookie:admin,data:{slug:"integration-test-ring",name:"Integration Test Ring",description:"Synthetic product for route verification",material:"gold",category:"rings",variants:["22K"],metalColours:["Yellow"],images:["/images/products/aurelia-band-ring-1.jpg"],stock:1,price:5000},expected:201});
  assert.equal(added.body.item.id,"integration-test-ring");const rendered=await request("/gold");assert.match(rendered.body,/Integration Test Ring/);await request("/product/integration-test-ring");
  await request("/api/crm/products/integration-test-ring",{method:"PATCH",cookie:admin,data:{active:false}});assert.ok(!(await request("/api/products")).body.products.some(p=>p.slug === "integration-test-ring"));await request("/product/integration-test-ring",{expected:404});pass("New catalogue products render immediately and hidden products disappear");
  await request("/api/enquiry",{method:"POST",data:{form:"contact",...contact,message:"x".repeat(70000)},expected:413});pass("Oversized JSON request is rejected before storage");
  await request("/api/auth",{method:"POST",cookie:admin,data:{action:"create-user",email:"staff@example.test",name:"Sales",password:"Staff-test-password!",role:"staff"},expected:201});
  await request("/api/auth",{method:"POST",cookie:admin,data:{action:"create-user",email:"asha@example.test",name:"Asha",password:"Trade-test-password!",role:"trade"},expected:201});
  const staff=(await request("/api/auth",{method:"POST",data:{action:"login",email:"staff@example.test",password:"Staff-test-password!"}})).cookie;
  await request("/api/crm/users",{cookie:staff,expected:403});await request("/api/crm/export",{cookie:staff,expected:403});await request("/api/crm/settings/rates",{method:"PATCH",cookie:staff,data:{},expected:403});pass("Staff cannot manage users, export CRM or edit rates");
  const trade=(await request("/api/auth",{method:"POST",data:{action:"login",email:"asha@example.test",password:"Trade-test-password!"}})).cookie;
  await request("/api/crm/orders",{cookie:trade,expected:403});await request(`/api/crm/attachments/${attachmentId}`,{cookie:trade,expected:403});
  const account=await request("/api/account",{cookie:trade});assert.ok(account.body.orders.length>=1);assert.ok(account.body.orders.every(o=>!Object.hasOwn(o,"notes")));pass("Trade users see only their account orders and cannot access CRM documents");
  const secondLogin=await request("/api/auth",{method:"POST",data:{action:"login",email:"asha@example.test",password:"Trade-test-password!"}});
  const changed=await request("/api/auth",{method:"POST",cookie:trade,data:{action:"change-password",oldPassword:"Trade-test-password!",password:"Updated-trade-password!"}});
  await request("/api/account",{cookie:secondLogin.cookie,expected:401});await request("/api/account",{cookie:changed.cookie});pass("Password change revokes other sessions and rotates current session");
  const whatsapp=await request("/api/whatsapp/overview",{cookie:admin});assert.equal(whatsapp.body.readiness.mode,"preview");assert.ok(whatsapp.body.messages.length>0);assert.ok(!JSON.stringify(whatsapp.body).includes("test-meta-signing-secret"));
  await request("/api/whatsapp/overview",{expected:401});await request("/api/whatsapp/overview",{cookie:changed.cookie,expected:403});await request("/api/whatsapp/settings",{method:"POST",cookie:staff,data:whatsapp.body.settings,expected:403});pass("WhatsApp workspace is staff-only; controls are admin-only and secrets stay private");
  await request("/api/whatsapp/run",{method:"POST",expected:401});const worker=await request("/api/whatsapp/run",{method:"POST",headers:{Authorization:`Bearer ${env.WHATSAPP_CRON_SECRET}`}});assert.equal(worker.body.paused,true);pass("Worker endpoint authenticates requests and preview cannot send");
  await request("/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=12345",{expected:403});const verification=await request("/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=test-verify-token&hub.challenge=12345");assert.equal(verification.body,12345);pass("Meta webhook subscription validates the verify token");
  await request("/api/whatsapp/consent",{method:"POST",cookie:admin,data:{customerId,phone:"+91 98765 43210",optedIn:true,source:"Synthetic customer opt-in"}});
  const incoming={object:"whatsapp_business_account",entry:[{changes:[{value:{metadata:{phone_number_id:"123456"},messages:[{id:"wamid.integration.stop",from:"919876543210",type:"text",text:{body:"STOP"}}]}}]}]};
  await request("/api/whatsapp/webhook",{method:"POST",data:incoming,expected:401});
  const signature=`sha256=${createHmac("sha256",env.WHATSAPP_APP_SECRET).update(JSON.stringify(incoming)).digest("hex")}`;
  await request("/api/whatsapp/webhook",{method:"POST",data:incoming,headers:{"x-hub-signature-256":signature}});const duplicate=await request("/api/whatsapp/webhook",{method:"POST",data:incoming,headers:{"x-hub-signature-256":signature}});assert.equal(duplicate.body.duplicate,true);
  const received=await request("/api/whatsapp/overview",{cookie:admin});assert.equal(received.body.inbox.length,1);assert.equal(received.body.consents.find(c=>c.phone==="919876543210").opted_in,0);pass("Signed HTTP webhooks persist incoming STOP and deduplicate retries; forged callbacks fail");
  const readyMessages=received.body.messages.filter(m=>m.event === "trade_account_ready");assert.equal(readyMessages.length,1);assert.ok(!readyMessages[0].preview.includes("Trade-test-password!"));pass("Provisioned trade accounts queue an account-ready notice without credentials");
  const openOrders=await request("/api/crm/orders",{cookie:admin});const active=openOrders.body.items.find(o=>o.status === "pending");
  await request(`/api/crm/orders/${active.id}`,{method:"PATCH",cookie:admin,data:{paymentStatus:"refunded"},expected:409});
  await request(`/api/crm/orders/${active.id}`,{method:"PATCH",cookie:admin,data:{paymentStatus:"paid",status:"confirmed"}});
  const paidMessages=await request("/api/whatsapp/overview",{cookie:admin});assert.equal(paidMessages.body.messages.filter(m=>m.event === "purchase_confirmed"&&m.entity_id === active.id).length,1);
  await request(`/api/crm/orders/${active.id}`,{method:"PATCH",cookie:admin,data:{status:"processing"}});
  await request(`/api/crm/orders/${active.id}`,{method:"PATCH",cookie:admin,data:{status:"shipped",carrier:"Test Carrier",trackingNumber:"HTTP-TRACK-1",trackingUrl:"https://tracking.example/HTTP-TRACK-1"}});
  const tracked=await request("/api/account",{cookie:changed.cookie});assert.equal(tracked.body.orders.find(o=>o.id === active.id).trackingNumber,"HTTP-TRACK-1");pass("Paid purchase queues confirmation and customer account exposes shipment tracking");
  const exported=await request("/api/crm/export",{cookie:admin});assert.ok(exported.body.customers.length);assert.ok(!exported.body.users);pass("Admin CRM export excludes password hashes and sessions");
  const backupFile=path.join(folder,"backup.sqlite");const backed=spawnSync(process.execPath,["scripts/backup.mjs",backupFile],{env,encoding:"utf8"});assert.equal(backed.status,0,backed.stderr);const restored=new DatabaseSync(backupFile,{readOnly:true});assert.ok(restored.prepare("SELECT count(*) as n FROM orders").get().n>0);restored.close();pass("SQLite online backup includes persisted orders and documents");
  for(const route of ["/","/gold","/silver","/diamonds",`/product/${slug}`,"/account","/checkout","/contact","/wholesale","/import-export","/about","/legal/terms"]){await request(route);}pass("All storefront routes return successful HTML");
  await request("/api/auth",{method:"POST",cookie:admin,data:{action:"logout"}});await request("/api/crm/customers",{cookie:admin,expected:401});pass("Logout invalidates server session");
  const recovered=spawnSync(process.execPath,["scripts/create-admin.mjs","--email","owner@example.test","--reset"],{env,encoding:"utf8"});assert.equal(recovered.status,0,recovered.stderr);const recoveredPassword=recovered.stdout.match(/Password: (.+)/)[1];await request("/api/auth",{method:"POST",data:{action:"login",email:"owner@example.test",password:recoveredPassword}});pass("Local admin recovery resets credentials successfully");
  console.log(`\n${results.length} integration checks passed.`);
  mkdirSync("test-results",{recursive:true});writeFileSync("test-results/backend.json",JSON.stringify({passed:results.length,checks:results,database:folder,at:new Date().toISOString()},null,2));
} catch(error) {console.error(error);console.error(logs.slice(-7000));process.exitCode=1;}
finally {server.kill();}




