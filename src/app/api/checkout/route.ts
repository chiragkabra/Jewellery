import { previewOrder } from "@/lib/server/business";
import { body,handle,json,limit,sameOrigin } from "@/lib/server/http";
export const runtime="nodejs";
export const POST=(req:Request)=>handle(async()=>{sameOrigin(req);limit(req,"preview",100);const data=await body(req);return json(previewOrder(data.items));});
