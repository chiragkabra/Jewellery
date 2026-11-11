import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { audit, db, record, records, save, transaction, type RecordData } from "./db";
import { check, text } from "./http";
import { renderWhatsApp, whatsappEvents, type WhatsAppEvent, type WhatsAppRule, type WhatsAppTemplate } from "@/lib/whatsapp";

type Settings = { enabled: boolean; quietStart: number; quietEnd: number; perMinute: number; rules: Record<WhatsAppEvent, WhatsAppRule>; templates: Record<WhatsAppEvent, WhatsAppTemplate> };
export type Outbox = { id:string;event_key:string;customer_id:string;event:WhatsAppEvent;entity_id:string;phone:string;parameters:string;context:string;preview:string;mode:string;status:string;not_before:number;attempts:number;provider_id:string|null;error:string|null;lease_until:number|null;created_at:number;updated_at:number };
const events = Object.keys(whatsappEvents) as WhatsAppEvent[];
const now = () => Date.now();
export function normalisePhone(value: unknown): string | null {
  if(typeof value !== "string" || !/^[+\d\s().-]+$/.test(value)) return null;
  const phone = value.replace(/[\s().-]/g, "").replace(/^00/, "+");
  // Website/CRM input must include an explicit country code; do not guess from local numbers.
  return /^\+[1-9]\d{7,14}$/.test(phone) ? phone.slice(1) : null;
}
export function whatsappSettings(): Settings {
  const stored = record("settings", "whatsapp") || {};
  const rules = {} as Settings["rules"], templates = {} as Settings["templates"];
  for(const event of events) {
    rules[event] = ((stored.rules as Settings["rules"] | undefined)?.[event]) || { enabled:event !== "payment_received", delayMinutes:whatsappEvents[event].delayMinutes };
    templates[event] = ((stored.templates as Settings["templates"] | undefined)?.[event]) || { name:whatsappEvents[event].template, language:"en", approved:false };
  }
  return {enabled:stored.enabled === true,quietStart:Number(stored.quietStart ?? 9),quietEnd:Number(stored.quietEnd ?? 20),perMinute:Number(stored.perMinute ?? 10),rules,templates};
}
export function readiness() {
  const configured = { accessToken:!!process.env.WHATSAPP_ACCESS_TOKEN, phoneNumberId:/^\d+$/.test(process.env.WHATSAPP_PHONE_NUMBER_ID || ""), graphVersion:/^v\d+\.\d+$/.test(process.env.WHATSAPP_GRAPH_VERSION || ""), appSecret:!!process.env.WHATSAPP_APP_SECRET, verifyToken:!!process.env.WHATSAPP_VERIFY_TOKEN, worker:!!process.env.WHATSAPP_CRON_SECRET, publicOrigin:/^https:\/\//.test(process.env.APP_URL || "") && !/^https:\/\/(localhost|127\.|\[::1\])/.test(process.env.APP_URL || "") };
  const settings=whatsappSettings();
  return { mode:process.env.WHATSAPP_MODE === "live" ? "live" : "preview", enabled:settings.enabled, configured, ready:process.env.WHATSAPP_MODE === "live" && settings.enabled && Object.values(configured).every(Boolean) };
}
export function saveWhatsAppSettings(input: RecordData, actor: string) {
  const current=whatsappSettings();
  check(typeof input.enabled === "boolean", "Choose whether live sending is enabled");
  for(const field of ["quietStart","quietEnd","perMinute"]) check(Number.isInteger(input[field]),`Invalid ${field}`);
  check(Number(input.quietStart)>=0 && Number(input.quietStart)<=23 && Number(input.quietEnd)>Number(input.quietStart) && Number(input.quietEnd)<=24,"Sending hours must be a same-day range from 0 to 24 (IST)");
  check(Number(input.perMinute)>=1 && Number(input.perMinute)<=60,"Use 1–60 messages per minute");
  const rules={} as Settings["rules"],templates={} as Settings["templates"];
  for(const event of events) {
    const rule=(input.rules as Settings["rules"] | undefined)?.[event] || current.rules[event];
    check(typeof rule.enabled === "boolean" && Number.isInteger(rule.delayMinutes) && rule.delayMinutes>=0 && rule.delayMinutes<=43200,"Invalid automation delay");
    rules[event]={enabled:rule.enabled,delayMinutes:rule.delayMinutes};
    const template=(input.templates as Settings["templates"] | undefined)?.[event] || current.templates[event];
    check(/^[a-z][a-z0-9_]{0,127}$/.test(template.name) && /^[a-z]{2,3}(?:_[A-Z]{2})?$/.test(template.language) && typeof template.approved === "boolean","Invalid template mapping");
    templates[event]={name:template.name,language:template.language,approved:template.approved};
  }
  const result=save("settings","whatsapp",{enabled:input.enabled,quietStart:input.quietStart,quietEnd:input.quietEnd,perMinute:input.perMinute,rules,templates});
  audit(actor,"whatsapp.settings.updated","whatsapp");return result;
}
export function setWhatsAppConsent(customerId: string, phone: string, optedIn: boolean, source: string) {
  check(record("customers",customerId),"Customer not found",404);
  const normalised=normalisePhone(phone);check(normalised,"Enter a WhatsApp number with +country code");
  check(typeof optedIn === "boolean","Consent must be true or false");text(source,"consent evidence / source",500);
  db().prepare("INSERT INTO wa_consents VALUES(?,?,?,?,?) ON CONFLICT(phone) DO UPDATE SET customer_id=excluded.customer_id,opted_in=excluded.opted_in,source=excluded.source,updated_at=excluded.updated_at").run(normalised,customerId,optedIn?1:0,source,now());
  const contact=record("customers",customerId)!;save("customers",customerId,{...contact,phone});
  if(!optedIn) db().prepare("UPDATE wa_outbox SET status='blocked',error='Customer opted out',updated_at=? WHERE phone=? AND status IN ('queued','blocked')").run(now(),normalised);
}
export function captureWhatsAppConsent(customerId: string, data: RecordData) {
  const optedIn=data.whatsappConsent === true || data.whatsappConsent === "yes";
  if(!optedIn) return;
  setWhatsAppConsent(customerId,String(data.phone || ""),true,`Website explicit opt-in: ${String(data.form || "checkout")}`);
}
function consented(phone: string, customerId: string) {
  const consent=db().prepare("SELECT * FROM wa_consents WHERE phone=?").get(phone);
  return !!consent && consent.opted_in === 1 && consent.customer_id === customerId;
}
export function queueWhatsApp(event: WhatsAppEvent, entityId: string, customerId: string, parameters: string[], version = "", dueAt?: number, context: RecordData = {}) {
  const contact=record("customers",customerId);check(contact,"Customer not found");
  const settings=whatsappSettings(),rule=settings.rules[event];
  const phone=normalisePhone(contact.phone) || "";
  const eligible=phone && consented(phone,customerId);
  const timestamp=now();const id=randomUUID();
  const mode=readiness().ready && settings.templates[event].approved ? "live" : "preview";
  const status=!rule.enabled ? "cancelled" : eligible ? "queued" : "blocked";
  const error=!rule.enabled ? "Automation rule disabled" : !phone ? "Country-coded WhatsApp number required" : !eligible ? "WhatsApp consent required" : null;
  db().prepare("INSERT OR IGNORE INTO wa_outbox(id,event_key,customer_id,event,entity_id,phone,parameters,context,preview,mode,status,not_before,created_at,updated_at,error) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run(id,`${event}:${entityId}:${version}`,customerId,event,entityId,phone,JSON.stringify(parameters),JSON.stringify(context),renderWhatsApp(event,parameters),mode,status,(dueAt ?? timestamp)+rule.delayMinutes*60000,timestamp,timestamp,error);
  return db().prepare("SELECT * FROM wa_outbox WHERE event_key=?").get(`${event}:${entityId}:${version}`) as Outbox;
}
const amount=(paise:unknown)=>`INR ${(Number(paise)/100).toFixed(2)}`;
export function queueOrderMessages(order: RecordData, previous?: RecordData) {
  const contact=record("customers",String(order.customerId))!;const id=String(order.id),customerId=String(contact.id),name=String(order.name || contact.name);
  if(!previous) {
    queueWhatsApp("order_received",id,customerId,[name,id,amount(order.totalPaise)]);
    queueWhatsApp("payment_reminder",id,customerId,[name,id,amount(order.totalPaise)]);
  } else {
    if(order.status !== previous.status) {
      if(order.status === "shipped") queueWhatsApp("order_shipped",id,customerId,[name,id,String(order.carrier || "Our delivery partner"),String(order.trackingNumber || "Contact our team")],`${String(order.carrier || "")}:${String(order.trackingNumber || "")}`);
      else queueWhatsApp("order_status",id,customerId,[name,id,String(order.status)],String(order.status));
    } else if(order.status === "shipped" && (order.trackingNumber !== previous.trackingNumber || order.carrier !== previous.carrier)) {
      queueWhatsApp("order_shipped",id,customerId,[name,id,String(order.carrier || "Our delivery partner"),String(order.trackingNumber || "Contact our team")],`${String(order.carrier || "")}:${String(order.trackingNumber || "")}`);
    }
    if(order.paymentStatus === "paid" && previous.paymentStatus !== "paid" && order.status !== "cancelled") queueWhatsApp("purchase_confirmed",id,customerId,[name,id,new Date(String(order.paidAt || new Date().toISOString())).toLocaleDateString("en-US",{timeZone:"Asia/Kolkata",month:"short",day:"numeric",year:"numeric"})]);
    if(order.paymentStatus === "refunded" && previous.paymentStatus !== "refunded") queueWhatsApp("refund_recorded",id,customerId,[name,id]);
    if(order.paymentStatus !== "unpaid" || order.status === "cancelled") db().prepare("UPDATE wa_outbox SET status='cancelled',error='Order no longer needs payment reminder',updated_at=? WHERE entity_id=? AND event='payment_reminder' AND status IN ('queued','blocked')").run(now(),id);
  }
}
export function queueTaskMessages(task: RecordData, previous?: RecordData) {
  const contact=record("customers",String(task.customerId))!;const id=String(task.id),customerId=String(contact.id),name=String(contact.name);
  if(["repair","custom-order"].includes(String(task.kind)) && task.status === "ready" && previous?.status !== "ready") queueWhatsApp("repair_ready",id,customerId,[name,String(task.title)]);
  if(task.kind === "appointment" && !["done","ready"].includes(String(task.status)) && (!previous || previous.dueAt !== task.dueAt)) queueWhatsApp("appointment_confirmed",id,customerId,[name,String(task.title),new Date(String(task.dueAt)).toLocaleString("en-IN",{timeZone:"Asia/Kolkata"})],String(task.dueAt),undefined,{dueAt:task.dueAt});
  if(["follow-up","appointment"].includes(String(task.kind)) && !["done","ready"].includes(String(task.status))) {
    const due=String(task.dueAt);
    queueWhatsApp("follow_up",id,customerId,[name,String(task.title),new Date(due).toLocaleString("en-IN",{timeZone:"Asia/Kolkata"})],due,Math.max(now(),Date.parse(due)-60*60000),{dueAt:due});
  }
  if(task.status === "done") db().prepare("UPDATE wa_outbox SET status='cancelled',error='Task completed',updated_at=? WHERE entity_id=? AND event IN ('follow_up','repair_ready','appointment_confirmed') AND status IN ('queued','blocked')").run(now(),id);
}
function relevance(message: Outbox, timestamp=now()): string | null {
  const contact=record("customers",message.customer_id);
  if(!contact || normalisePhone(contact.phone)!==message.phone) return "Customer phone changed; review recipient";
  if(!message.phone || !consented(message.phone,message.customer_id)) return "WhatsApp consent required or withdrawn";
  const allowed=(process.env.WHATSAPP_ALLOWED_RECIPIENTS || "").split(",").map(p=>p.replace(/\D/g,"")).filter(Boolean);
  if(allowed.length && !allowed.includes(message.phone))return "Recipient is not in the configured test-number allowlist";
  if(!whatsappSettings().rules[message.event].enabled) return "Automation rule disabled";
  if(timestamp > message.not_before+7*86400000) return "Message expired; create a fresh update";
  if(["order_received","order_status","order_shipped","payment_received","purchase_confirmed","refund_recorded","payment_reminder"].includes(message.event)) {
    const order=record("orders",message.entity_id);if(!order)return "Order no longer exists";
    if(message.event === "payment_reminder" && (order.status === "cancelled" || order.paymentStatus !== "unpaid")) return "Order no longer needs payment reminder";
    if(message.event === "order_received" && order.status === "cancelled") return "Order cancelled";
    if(["payment_received","purchase_confirmed"].includes(message.event) && (order.paymentStatus !== "paid" || order.status === "cancelled")) return "Payment status changed";
    if(message.event === "order_status" && String(order.status)!==JSON.parse(message.parameters)[2])return "Superseded order status";
    if(message.event === "refund_recorded" && order.paymentStatus !== "refunded")return "Refund status changed";
    if(message.event === "order_shipped" && (order.status !== "shipped" || (String(order.trackingNumber || "Contact our team")!==JSON.parse(message.parameters)[3] || String(order.carrier || "Our delivery partner")!==JSON.parse(message.parameters)[2])))return "Dispatch details superseded";
  }
  if(["follow_up","repair_ready","appointment_confirmed"].includes(message.event)) {
    const task=record("tasks",message.entity_id);if(!task || task.status === "done")return "Task completed or missing";
    if(message.event === "repair_ready" && task.status!=="ready")return "Service is no longer ready";
    if(["follow_up","appointment_confirmed"].includes(message.event) && task.dueAt!==JSON.parse(message.context).dueAt)return "Task was rescheduled";
    if(["follow_up","appointment_confirmed"].includes(message.event) && Date.parse(String(task.dueAt))<timestamp-86400000)return "Task reminder is too old";
  }
  return null;
}
export function manageWhatsAppMessage(id:string,action:string,actor:string,confirmUncertain=false) {
  return transaction(()=>{
    const message=db().prepare("SELECT * FROM wa_outbox WHERE id=?").get(id) as Outbox|undefined;check(message,"Message not found",404);
    if(action === "cancel") {check(["queued","blocked","failed","uncertain"].includes(message.status),"Message cannot be cancelled in this state",409);db().prepare("UPDATE wa_outbox SET status='cancelled',updated_at=? WHERE id=?").run(now(),id);}
    else {
      check(["release","retry"].includes(action),"Invalid message action");
      check(["queued","blocked","failed","uncertain"].includes(message.status),"Sent or cancelled messages cannot be retried",409);
      check(message.status!=="uncertain" || confirmUncertain,"Reconcile the provider first, then confirm duplicate-send risk",409);
      const contact=record("customers",message.customer_id)!;message.phone=normalisePhone(contact.phone)||"";
      const reason=relevance(message);check(!reason,reason || "Message not eligible",409);
      if(action === "release")check(readiness().ready && whatsappSettings().templates[message.event].approved,"Live credentials, enabled sending and approved template are required",409);
      const mode=action === "release" ? "live" : "preview";
      db().prepare("UPDATE wa_outbox SET phone=?,mode=?,status='queued',error=NULL,not_before=?,lease_until=NULL,updated_at=? WHERE id=?").run(message.phone,mode,Math.max(now(),message.not_before),now(),id);
    }
    audit(actor,`whatsapp.message.${action}`,id);return db().prepare("SELECT * FROM wa_outbox WHERE id=?").get(id);
  });
}
function applyProviderStatuses(providerId:string) {
  const row=db().prepare("SELECT * FROM wa_outbox WHERE provider_id=?").get(providerId) as Outbox|undefined;if(!row)return;
  const rank:Record<string,number>={processing:0,uncertain:0,failed:0,sent:1,delivered:2,read:3};
  for(const event of db().prepare("SELECT * FROM wa_status_events WHERE provider_id=? ORDER BY occurred_at").all(providerId)) {
    const next=String(event.status);if(!(next in rank))continue;
    if(next === "failed" ? (rank[row.status]||0)<2 : (rank[next]||0)>(rank[row.status]||0)) {row.status=next;db().prepare("UPDATE wa_outbox SET status=?,error=?,updated_at=? WHERE id=?").run(next,next==="failed" ? String(event.error || "Provider delivery failed") : null,now(),row.id);}
  }
}
export async function dispatchWhatsApp(fetcher:typeof fetch=fetch,timestamp=now()) {
  db().prepare("UPDATE wa_outbox SET status='uncertain',error='Worker lease expired; reconcile before retry',updated_at=? WHERE status='processing' AND lease_until<?").run(timestamp,timestamp);
  const settings=whatsappSettings();
  // Preview records are never released automatically when credentials are added later.
  const result={sent:0,blocked:0,failed:0,uncertain:0,preview:Number(db().prepare("SELECT count(*) AS n FROM wa_outbox WHERE mode='preview' AND status='queued'").get()!.n),paused:!readiness().ready};
  if(result.paused)return result;
  const hour=Number(new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Kolkata",hour:"2-digit",hourCycle:"h23"}).format(timestamp));
  if(hour<settings.quietStart || hour>=settings.quietEnd)return {...result,quietHours:true};
  for(let i=0;i<settings.perMinute;i++) {
    const candidate=db().prepare("SELECT * FROM wa_outbox WHERE mode='live' AND status='queued' AND not_before<=? ORDER BY not_before LIMIT 1").get(timestamp) as Outbox|undefined;if(!candidate)break;
    const claimed=transaction(()=>{
      const id=`whatsapp-send:${Math.floor(timestamp/60000)}`;
      const rate=db().prepare("SELECT count FROM rate_limits WHERE id=?").get(id);if(Number(rate?.count||0)>=settings.perMinute)return undefined;
      const row=db().prepare("UPDATE wa_outbox SET status='processing',attempts=attempts+1,lease_until=?,updated_at=? WHERE id=? AND status='queued' RETURNING *").get(timestamp+120000,timestamp,candidate.id) as Outbox|undefined;
      if(row)db().prepare("INSERT INTO rate_limits VALUES(?,1,?) ON CONFLICT(id) DO UPDATE SET count=count+1").run(id,timestamp+120000);
      return row;
    });
    if(!claimed)break;
    const reason=relevance(claimed,timestamp);const template=whatsappSettings().templates[claimed.event];
    if(reason || !template.approved || !readiness().ready) {db().prepare("UPDATE wa_outbox SET status='blocked',error=?,updated_at=? WHERE id=?").run(reason || "Approved template / live setup required",timestamp,claimed.id);result.blocked++;continue;}
    try {
      const response=await fetcher(`https://graph.facebook.com/${process.env.WHATSAPP_GRAPH_VERSION}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,{method:"POST",headers:{Authorization:`Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,"Content-Type":"application/json"},body:JSON.stringify({messaging_product:"whatsapp",recipient_type:"individual",to:claimed.phone,type:"template",template:{name:template.name,language:{code:template.language},components:[{type:"body",parameters:(JSON.parse(claimed.parameters) as string[]).map(value=>({type:"text",text:value}))}]},biz_opaque_callback_data:claimed.id}),signal:AbortSignal.timeout(15000)});
      const payload=await response.json().catch(()=>null);const providerId=payload?.messages?.[0]?.id;
      if(response.ok && typeof providerId === "string") {
        transaction(()=>{db().prepare("UPDATE wa_outbox SET status=CASE WHEN status IN ('delivered','read') THEN status ELSE 'sent' END,provider_id=?,error=NULL,lease_until=NULL,updated_at=? WHERE id=?").run(providerId,timestamp,claimed.id);applyProviderStatuses(providerId);});result.sent++;
      } else if(response.status === 429 && payload?.error && claimed.attempts<5) {
        db().prepare("UPDATE wa_outbox SET status='queued',error='Provider rate limit; retry scheduled',not_before=?,lease_until=NULL,updated_at=? WHERE id=?").run(timestamp+Math.min(3600000,60000*2**claimed.attempts),timestamp,claimed.id);
      } else {
        const uncertain=response.ok || response.status>=500;
        db().prepare("UPDATE wa_outbox SET status=?,error=?,lease_until=NULL,updated_at=? WHERE id=?").run(uncertain?"uncertain":"failed",`Provider HTTP ${response.status}${payload?.error?.code ? ` (code ${String(payload.error.code).slice(0,20)})` : ""}; ${uncertain ? "reconcile before retry" : "check template/account/recipient"}`,timestamp,claimed.id);
        if(uncertain)result.uncertain++;else result.failed++;
      }
    } catch {
      // A timeout may happen AFTER Meta accepted a message. Never retry it automatically.
      db().prepare("UPDATE wa_outbox SET status='uncertain',error='Network outcome unknown; reconcile before retry',lease_until=NULL,updated_at=? WHERE id=?").run(timestamp,claimed.id);result.uncertain++;
    }
  }
  return result;
}
export function receiveWhatsAppWebhook(payload: RecordData) {
  check(payload.object === "whatsapp_business_account","Unexpected webhook object");
  const digest=createHash("sha256").update(JSON.stringify(payload)).digest("hex");
  return transaction(()=>{
    if(db().prepare("SELECT id FROM wa_webhooks WHERE id=?").get(digest))return {duplicate:true};
    db().prepare("INSERT INTO wa_webhooks VALUES(?,?)").run(digest,now());
    const entries=Array.isArray(payload.entry)?payload.entry:[];
    for(const entry of entries)for(const change of Array.isArray(entry.changes)?entry.changes:[]) {
      const value=change.value;if(!value || value.metadata?.phone_number_id!==process.env.WHATSAPP_PHONE_NUMBER_ID)continue;
      for(const status of Array.isArray(value.statuses)?value.statuses:[]) {
        if(typeof status.id!=="string" || !["sent","delivered","read","failed"].includes(status.status))continue;
        const timestamp=Number(status.timestamp)*1000;if(!Number.isFinite(timestamp))continue;
        const key=createHash("sha256").update(`${status.id}:${status.status}:${timestamp}`).digest("hex");
        const error=status.errors?.[0]?.code ? `Provider delivery code ${String(status.errors[0].code).slice(0,20)}` : null;
        db().prepare("INSERT OR IGNORE INTO wa_status_events VALUES(?,?,?,?,?)").run(key,status.id,status.status,timestamp,error);
        if(typeof status.biz_opaque_callback_data === "string") {
          const pending=db().prepare("SELECT * FROM wa_outbox WHERE id=? AND provider_id IS NULL AND mode='live' AND status IN ('processing','uncertain')").get(status.biz_opaque_callback_data);
          if(pending && pending.phone===status.recipient_id)db().prepare("UPDATE wa_outbox SET provider_id=? WHERE id=?").run(status.id,pending.id as string);
        }
        applyProviderStatuses(status.id);
      }
      for(const message of Array.isArray(value.messages)?value.messages:[]) {
        if(typeof message.id!=="string" || typeof message.from!=="string")continue;
        const phone=normalisePhone(`+${message.from}`);if(!phone)continue;
        const content=String(message.text?.body || message.button?.text || message.interactive?.button_reply?.title || message.interactive?.list_reply?.title || `[${String(message.type || "message")}]`).slice(0,4000);
        const inserted=db().prepare("INSERT OR IGNORE INTO wa_inbox VALUES(?,?,?,?,?)").run(message.id,phone,content,String(message.type||"unknown").slice(0,40),now());if(!inserted.changes)continue;
        const command=content.trim().toUpperCase();
        if(["STOP","UNSUBSCRIBE","START","SUBSCRIBE"].includes(command)) {
          const previous=db().prepare("SELECT customer_id FROM wa_consents WHERE phone=?").get(phone);
          const contact=previous?.customer_id ? record("customers",String(previous.customer_id)) : records("customers").find(c=>normalisePhone(c.phone)===phone);
          const optedIn=command === "START" || command === "SUBSCRIBE";
          db().prepare("INSERT INTO wa_consents VALUES(?,?,?,?,?) ON CONFLICT(phone) DO UPDATE SET opted_in=excluded.opted_in,source=excluded.source,updated_at=excluded.updated_at").run(phone,contact?String(contact.id):null,optedIn?1:0,`WhatsApp inbound ${command}`,now());
          if(!optedIn)db().prepare("UPDATE wa_outbox SET status='blocked',error='Customer opted out via WhatsApp',updated_at=? WHERE phone=? AND status IN ('queued','blocked')").run(now(),phone);
        }
      }
    }
    return {duplicate:false};
  });
}
export function whatsappOverview() {
  return {settings:whatsappSettings(),readiness:readiness(),credentialImport:record("settings","whatsapp")?.importedTemplate || null,definitions:whatsappEvents,messages:db().prepare("SELECT * FROM wa_outbox ORDER BY created_at DESC LIMIT 500").all(),inbox:db().prepare("SELECT * FROM wa_inbox ORDER BY received_at DESC LIMIT 200").all(),consents:db().prepare("SELECT * FROM wa_consents ORDER BY updated_at DESC").all()};
}




