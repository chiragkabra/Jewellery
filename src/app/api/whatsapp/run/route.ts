import { timingSafeEqual } from "node:crypto";
import { check,handle,json } from "@/lib/server/http";
import { dispatchWhatsApp } from "@/lib/server/whatsapp";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const POST=(req:Request)=>handle(async()=>{
  const secret=process.env.WHATSAPP_CRON_SECRET;check(secret && secret.length>=32,"Worker secret not configured",503);
  const actual=req.headers.get("authorization")||"",expected=`Bearer ${secret}`;
  const left=Buffer.from(actual),right=Buffer.from(expected);
  check(left.length===right.length && timingSafeEqual(left,right),"Worker authentication required",401);
  return json(await dispatchWhatsApp());
});

