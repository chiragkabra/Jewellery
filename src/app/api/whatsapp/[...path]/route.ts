import { requireUser } from "@/lib/server/auth";
import { audit,transaction } from "@/lib/server/db";
import { body,check,handle,json,sameOrigin,text } from "@/lib/server/http";
import { dispatchWhatsApp,manageWhatsAppMessage,saveWhatsAppSettings,setWhatsAppConsent,whatsappOverview } from "@/lib/server/whatsapp";
export const runtime="nodejs";
export const dynamic="force-dynamic";
type Context={params:Promise<{path:string[]}>};
export const GET=(req:Request,context:Context)=>handle(async()=>{await requireUser(true);const [resource]=(await context.params).path;check(resource === "overview","Not found",404);return json(whatsappOverview());});
export const POST=(req:Request,context:Context)=>handle(async()=>{
  sameOrigin(req);const actor=await requireUser(true);const [resource,id]=(await context.params).path;const data=await body(req);
  if(resource === "settings") {check(actor.role === "admin","Admin access required",403);return json({item:transaction(()=>saveWhatsAppSettings(data,actor.id))});}
  if(resource === "consent") {check(typeof data.optedIn === "boolean","Choose consent status");transaction(()=>{setWhatsAppConsent(text(data.customerId,"customer",100),text(data.phone,"phone",40),data.optedIn as boolean,text(data.source,"consent source",500));audit(actor.id,data.optedIn?"whatsapp.consent.recorded":"whatsapp.consent.withdrawn",String(data.customerId));});return json({ok:true});}
  if(resource === "messages") {check(id,"Message ID required");if(data.action === "release")check(actor.role === "admin","Admin access required",403);return json({item:manageWhatsAppMessage(id,text(data.action,"action",30),actor.id,data.confirmUncertain === true)});}
  if(resource === "dispatch") {check(actor.role === "admin","Admin access required",403);return json(await dispatchWhatsApp());}
  return json({error:"Not found"},404);
});
