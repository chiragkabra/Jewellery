import { createHmac,timingSafeEqual } from "node:crypto";
import { check,handle,json } from "@/lib/server/http";
import { receiveWhatsAppWebhook } from "@/lib/server/whatsapp";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const matches=(a:string,b:string)=>{const left=Buffer.from(a),right=Buffer.from(b);return left.length === right.length && timingSafeEqual(left,right);};
export const GET=(req:Request)=>handle(()=>{
  const url=new URL(req.url),token=process.env.WHATSAPP_VERIFY_TOKEN;
  check(token,"Webhook verification not configured",503);
  check(url.searchParams.get("hub.mode") === "subscribe" && matches(url.searchParams.get("hub.verify_token")||"",token),"Verification rejected",403);
  const challenge=url.searchParams.get("hub.challenge");check(challenge && /^\d{1,100}$/.test(challenge),"Invalid challenge");
  return new Response(challenge,{headers:{"Content-Type":"text/plain","Cache-Control":"no-store"}});
});
export const POST=(req:Request)=>handle(async()=>{
  const secret=process.env.WHATSAPP_APP_SECRET;check(secret,"Webhook signing secret not configured",503);
  check(req.headers.get("content-type")?.includes("application/json"),"JSON required",415);
  const reader=req.body?.getReader();check(reader,"Request body required");const chunks:Uint8Array[]=[];let size=0;
  for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>256*1024){await reader.cancel();return json({error:"Webhook too large"},413);}chunks.push(value);}
  const raw=Buffer.concat(chunks),signature=req.headers.get("x-hub-signature-256")||"";
  const expected=`sha256=${createHmac("sha256",secret).update(raw).digest("hex")}`;
  check(matches(signature,expected),"Invalid webhook signature",401);
  let payload;try{payload=JSON.parse(raw.toString());}catch{return json({error:"Invalid JSON"},400);}
  check(payload && typeof payload === "object" && !Array.isArray(payload),"Invalid payload");
  return json({ok:true,...receiveWhatsAppWebhook(payload)});
});

