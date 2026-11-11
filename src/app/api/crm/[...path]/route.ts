import { queueTaskMessages } from "@/lib/server/whatsapp";
import { randomUUID } from "node:crypto";
import { requireUser } from "@/lib/server/auth";
import { audit, db, record, records, save, transaction, type Entity } from "@/lib/server/db";
import { order, updateOrder } from "@/lib/server/business";
import { body, check, choice, email, handle, json, number, sameOrigin, text } from "@/lib/server/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ path: string[] }> };
const entities = ["customers", "enquiries", "tasks", "orders", "products", "settings"];
export const GET = (req: Request, context: Context) => handle(async () => {
  const actor = await requireUser(true); const [resource, id] = (await context.params).path;
  if (resource === "dashboard") {
    const enquiries = records("enquiries"), orders = records("orders"), tasks = records("tasks"), products = records("products");
    return json({ customers: records("customers").length, openEnquiries: enquiries.filter(e => !["won", "lost"].includes(String(e.status))).length, openOrders: orders.filter(o => !["cancelled", "delivered"].includes(String(o.status))).length, paidPaise: orders.filter(o => o.paymentStatus === "paid" && o.status !== "cancelled").reduce((s,o) => s + Number(o.totalPaise), 0), overdue: tasks.filter(t => t.status !== "done" && String(t.dueAt) < new Date().toISOString()).length, lowStock: products.filter(p => Number(p.stock) <= 2).length });
  }
  if (resource === "audit") return json({ items: db().prepare("SELECT * FROM audit ORDER BY created_at DESC LIMIT 200").all() });
  if (resource === "users") {
    check(actor.role === "admin", "Admin access required", 403);
    return json({ items: db().prepare("SELECT id,email,name,role,created_at FROM users ORDER BY created_at DESC").all() });
  }
  if (resource === "export") {
    check(actor.role === "admin", "Admin access required", 403); audit(actor.id, "crm.exported", "all");
    return new Response(JSON.stringify(Object.fromEntries(entities.map(e => [e, records(e as Entity)])), null, 2), { headers: { "Content-Type": "application/json", "Content-Disposition": 'attachment; filename="lumera-crm-export.json"', "Cache-Control": "no-store" } });
  }
  if (resource === "attachments") {
    const file = db().prepare("SELECT * FROM attachments WHERE id=?").get(id || ""); check(file, "File not found", 404);
    return new Response(file.content as Uint8Array<ArrayBuffer>, { headers: { "Content-Type": String(file.mime), "Content-Disposition": `attachment; filename="${String(file.name).replace(/[^a-zA-Z0-9._ -]/g,"_")}"`, "X-Content-Type-Options": "nosniff", "Cache-Control": "no-store" } });
  }
  check(entities.includes(resource), "Unknown resource", 404);
  if(id) { const item = record(resource as Entity,id); check(item,"Not found",404); return json({ item }); }
  return json({ items: records(resource as Entity) });
});
async function mutate(req: Request, context: Context, creating: boolean) {
  return handle(async () => {
    sameOrigin(req); const actor = await requireUser(true); const [resource, rawId] = (await context.params).path;
    check(entities.includes(resource), "Unknown resource", 404);
    check(creating ? !rawId : !!rawId, "Invalid resource path");
    const data = await body(req); const id = creating ? randomUUID() : rawId;
    const existing = creating ? undefined : record(resource as Entity, id); if(!creating && !(resource === "settings" && id === "rates")) check(existing, "Not found",404);
    if(resource === "orders") return json({ item: creating ? order(data,actor.id) : updateOrder(id,data,actor.id) }, creating ? 201 : 200);
    return transaction(() => {
      let value: Record<string,unknown> = {}; let customerId: string | undefined;
      if(resource === "customers") {
        const address = email(data.email ?? existing?.email);
        check(!db().prepare("SELECT id FROM customers WHERE email=? AND id<>?").get(address,id),"Email already exists",409);
        value = { ...existing, name: text(data.name ?? existing?.name,"name",150), email: address, phone: text(data.phone ?? existing?.phone,"phone",40,false), company: text(data.company ?? existing?.company,"company",200,false), country: text(data.country ?? existing?.country,"country",100,false), segment: choice(data.segment ?? existing?.segment ?? "retail",["retail","trade","vip"],"segment"), notes: text(data.notes ?? existing?.notes,"notes",5000,false), newsletter: data.newsletter === undefined ? existing?.newsletter === true : data.newsletter === true };
      } else if(resource === "enquiries") {
        check(!creating,"Enquiries are created through website forms");
        value = { ...existing, status: choice(data.status ?? existing?.status,["new","contacted","qualified","quoted","won","lost"],"status"), assignee: text(data.assignee ?? existing?.assignee,"assignee",150,false), notes: text(data.notes ?? existing?.notes,"notes",5000,false) }; customerId = String(existing?.customerId);
      } else if(resource === "tasks") {
        customerId = String(existing?.customerId || text(data.customerId,"customer",100)); check(record("customers",customerId),"Customer not found");
        const dueAt = text(data.dueAt ?? existing?.dueAt,"due date",50); check(Number.isFinite(Date.parse(dueAt)),"Invalid due date");
        value = { ...existing, title: text(data.title ?? existing?.title,"title",200), kind: choice(data.kind ?? existing?.kind ?? "follow-up",["follow-up","repair","custom-order","appointment"],"type"), status: choice(data.status ?? existing?.status ?? "open",["open","in-progress","ready","done"],"status"), dueAt: new Date(dueAt).toISOString(), assignee: text(data.assignee ?? existing?.assignee,"assignee",150,false), notes: text(data.notes ?? existing?.notes,"notes",5000,false) };
      } else if(resource === "products") {
        const slug = creating ? text(data.slug,"slug",100) : id; check(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug),"Invalid slug");
        if(creating) check(!record("products",slug),"Product already exists",409);
        value = { ...existing, slug, name: text(data.name ?? existing?.name,"name",200), description: text(data.description ?? existing?.description,"description",5000), material: choice(data.material ?? existing?.material,["gold","silver","diamond"],"material"), category: choice(data.category ?? existing?.category,["rings","necklaces","earrings","bangles-bracelets","pendants","chains"],"category"), trade: existing?.trade || { moq: "On request", leadTime: "On request" }, active: data.active === undefined ? existing?.active !== false : data.active === true, stock: number(data.stock ?? existing?.stock ?? 0,"stock",1000000) };
        check(Number.isInteger(value.stock),"Stock must be a whole number");
        for(const field of ["price","weightGrams","makingChargePct","stoneValue"]) { const v = data[field] === undefined ? existing?.[field] ?? null : data[field]; value[field] = v === null ? null : number(v,field); }
        for(const field of ["variants","metalColours","images"]) { const v = data[field] ?? existing?.[field]; check(Array.isArray(v) && v.length > 0 && v.length <= 20 && v.every(s => typeof s === "string" && s.length > 0 && s.length < 500),`Invalid ${field}`); value[field] = v; }
        check((value.images as string[]).every(v => v.startsWith("/images/") && !v.includes("..")),"Use local /images/ product photos");
        value.certificateNo = data.certificateNo == null ? existing?.certificateNo ?? null : text(data.certificateNo,"certificate",100,false);
        value.certificateUrl = existing?.certificateUrl ?? null;
        value.sizes = existing?.sizes || [];
        const result = save("products",slug,value); audit(actor.id,creating ? "product.created" : "product.updated",slug); return json({ item: result },creating ? 201 : 200);
      } else {
        check(actor.role === "admin","Admin access required",403); check(!creating && id === "rates","Use PATCH settings/rates");
        value = { updatedAt: new Date().toISOString() };
        for(const key of ["gold24","gold22","gold18","silver999"]) value[key] = data[key] === null ? null : number(data[key],key);
      }
      const result = save(resource as Entity,id,value,customerId); if(resource === "tasks") queueTaskMessages(result,existing); audit(actor.id,`${resource}.${creating ? "created" : "updated"}`,id); return json({ item: result },creating ? 201 : 200);
    });
  });
}
export const POST = (req: Request, context: Context) => mutate(req,context,true);
export const PATCH = (req: Request, context: Context) => mutate(req,context,false);


