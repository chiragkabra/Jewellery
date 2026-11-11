import "server-only";
import { captureWhatsAppConsent, queueOrderMessages, queueWhatsApp } from "./whatsapp";
import { createHash, randomUUID } from "node:crypto";
import { audit, db, record, records, save, transaction, type RecordData } from "./db";
import { check, choice, email, number, text } from "./http";
import { priceBreakdown } from "@/lib/pricing";
import type { Product, RatesResponse } from "@/lib/types";
export function catalogue() { return records("products").filter(p => p.active === true) as unknown as Product[]; }
export function metalRates(): RatesResponse {
  const stored = record("settings", "rates");
  return { rates: [["gold24", "Gold 24K", "/g"], ["gold22", "Gold 22K", "/g"], ["gold18", "Gold 18K", "/g"], ["silver999", "Silver 999", "/kg"]].map(([key, label, unit]) => ({ key, label, unit, value: typeof stored?.[key] === "number" ? stored[key] as number : null, change: null })) as RatesResponse["rates"], updatedAt: String(stored?.updatedAt || new Date().toISOString()), source: stored ? "Store-managed rates" : "Rates not configured", live: false };
}
export function customer(data: RecordData) {
  const address = email(data.email);
  const row = db().prepare("SELECT id FROM customers WHERE email=?").get(address);
  if (row) return record("customers", String(row.id))!;
  return save("customers", randomUUID(), { name: text(data.name || data.contact || address.split("@")[0], "name", 150), email: address, phone: text(data.phone, "phone", 40, false), company: text(data.company, "company", 200, false), country: text(data.country, "country", 100, false), segment: data.form === "trade-application" || data.form === "trade-enquiry" ? "trade" : "retail", notes: "", newsletter: data.form === "newsletter" });
}
export type Upload = { name: string; mime: string; content: Buffer };
export function enquiry(data: RecordData, uploads: Upload[] = []) {
  choice(data.form, ["contact", "newsletter", "trade-enquiry", "trade-application", "quote"], "form");
  if (data.form !== "newsletter") text(data.name || data.contact, "name", 150);
  email(data.email);
  if (data.form === "trade-application" || data.form === "trade-enquiry") text(data.company, "company", 200);
  text(data.message, "message", 5000, false);
  if (data.items && !(Array.isArray(data.items) && data.items.length === 0 && data.form === "quote")) validateItems(data.items, false);
  return transaction(() => {
    const contact = customer(data);
    captureWhatsAppConsent(String(contact.id),data);
    if (data.form === "newsletter") save("customers", String(contact.id), { ...contact, newsletter: true });
    const id = `ENQ-${randomUUID().slice(0, 12).toUpperCase()}`;
    const files = uploads.map(file => ({ ...file, id: randomUUID() }));
    save("enquiries", id, { form: data.form, payload: data, status: "new", assignee: "", notes: "", attachments: files.map(({ id, name }) => ({ id, name })) }, String(contact.id));
    for (const file of files) db().prepare("INSERT INTO attachments VALUES(?,?,?,?,?)").run(file.id, id, file.name, file.mime, file.content);
    if(data.form !== "newsletter") queueWhatsApp("enquiry_received",id,String(contact.id),[String(contact.name),id]);
    audit("website", "enquiry.created", id); return id;
  });
}
function validateItems(value: unknown, priced: boolean) {
  check(Array.isArray(value) && value.length > 0 && value.length <= 50, "Add between 1 and 50 items");
  const products = records("products");
  return value.map(item => {
    check(item && typeof item === "object", "Invalid item");
    const product = products.find(p => p.id === item.slug && p.active === true); check(product, "Product unavailable");
    const qty = number(item.qty, "quantity", 1000); check(Number.isInteger(qty) && qty > 0, "Invalid quantity");
    const variants = product.variants as string[]; const colours = product.metalColours as string[]; const sizes = product.sizes as string[] | undefined;
    const variant = choice(item.variant || variants[0], variants, "variant");
    const colour = choice(item.colour || colours[0], colours, "colour");
    const size = sizes?.length ? choice(item.size || sizes[0], sizes, "size") : "";
    const total = priceBreakdown(product as unknown as Product, variant, metalRates().rates).total;
    if (priced) check(total != null && total > 0, `${product.name}: price not set. Please request a quote.`, 409);
    const unitPaise = total == null ? null : Math.round(total * 100);
    if(priced) check(unitPaise !== null && Number.isSafeInteger(unitPaise) && unitPaise > 0,"Product price is outside supported limits",409);
    return { slug: String(product.id), name: String(product.name), qty, variant, colour, size, unitPaise };
  });
}
export function previewOrder(items: unknown) {
  const lines = validateItems(items,true);
  const totals = new Map<string,number>();
  for(const line of lines) totals.set(line.slug,(totals.get(line.slug) || 0) + line.qty);
  for(const [slug,qty] of totals) { const p=record("products",slug)!;check(Number(p.stock)>=qty,`${p.name}: insufficient stock`,409); }
  const totalPaise=lines.reduce((sum,item)=>sum+item.unitPaise!*item.qty,0);
  check(Number.isSafeInteger(totalPaise) && totalPaise > 0,"Order total is outside supported limits",409);
  return {items:lines,totalPaise};
}
export function order(data: RecordData, actor: string) {
  text(data.name, "name", 150); email(data.email); text(data.phone, "phone", 40); const address = text(data.address, "delivery address", 2000);
  return transaction(() => {
    const requestId = data.requestId ? text(data.requestId,"request ID",100) : null;
    const requestHash = createHash("sha256").update(JSON.stringify(data)).digest("hex");
    if(requestId) { const previous=db().prepare("SELECT * FROM order_requests WHERE id=?").get(requestId); if(previous) { check(previous.request_hash === requestHash,"This request ID was already used for a different order",409); return record("orders",String(previous.order_id))!; } }
    const preview=previewOrder(data.items);
    if(data.expectedTotalPaise !== undefined) check(data.expectedTotalPaise === preview.totalPaise,"Price changed. Refresh checkout before placing your order.",409);
    const items = preview.items; const quantities = new Map<string, number>();
    for (const item of items) quantities.set(item.slug, (quantities.get(item.slug) || 0) + item.qty);
    for (const [slug, qty] of quantities) {
      const product = record("products", slug)!; check(Number(product.stock) >= qty, `${product.name}: insufficient stock`, 409);
      save("products", slug, { ...product, stock: Number(product.stock) - qty });
    }
    const contact = customer(data);
    captureWhatsAppConsent(String(contact.id),data); const id = `ORD-${randomUUID().slice(0, 12).toUpperCase()}`;
    const result = save("orders", id, { items, totalPaise: items.reduce((sum, i) => sum + i.unitPaise! * i.qty, 0), currency: "INR", address, phone: data.phone, name: data.name, email: email(data.email), status: "pending", paymentStatus: "unpaid", paymentMethod: "manual", notes: "", shippingPaise: 0, pricingNote: "Product total includes configured GST. Delivery is included. Payment is confirmed separately by staff." }, String(contact.id));
    queueOrderMessages(result);
    if(requestId) db().prepare("INSERT INTO order_requests VALUES(?,?,?)").run(requestId,requestHash,id);
    audit(actor, "order.created", id); return result;
  });
}
export function updateOrder(id: string, data: RecordData, actor: string) {
  return transaction(() => {
    const existing = record("orders", id); check(existing, "Order not found", 404);
    const status = choice(data.status ?? existing.status, ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"], "status");
    const allowed: Record<string, string[]> = { pending: ["confirmed", "cancelled"], confirmed: ["processing", "cancelled"], processing: ["shipped", "cancelled"], shipped: ["delivered"], delivered: [], cancelled: [] };
    check(status === existing.status || allowed[String(existing.status)].includes(status), "Order status transition not allowed", 409);
    if (status === "cancelled" && existing.status !== "cancelled") for (const item of existing.items as { slug: string; qty: number }[]) { const p = record("products", item.slug)!; save("products", item.slug, { ...p, stock: Number(p.stock) + item.qty }); }
    const paymentStatus = choice(data.paymentStatus ?? existing.paymentStatus, ["unpaid", "paid", "refunded"], "payment status");
    check(!(paymentStatus === "refunded" && existing.paymentStatus === "unpaid"),"An unpaid order cannot be marked refunded",409);
    check(!(paymentStatus === "paid" && existing.paymentStatus !== "paid" && status === "cancelled"),"A cancelled order cannot receive a new payment",409);
    const carrier=text(data.carrier ?? existing.carrier,"carrier",100,false);
    const trackingNumber=text(data.trackingNumber ?? existing.trackingNumber,"tracking number",150,false);
    const trackingUrl=text(data.trackingUrl ?? existing.trackingUrl,"tracking URL",2000,false);
    if(trackingUrl){let parsed;try{parsed=new URL(trackingUrl);}catch{check(false,"Invalid tracking URL");}check(parsed!.protocol === "https:" && !parsed!.username && !parsed!.password,"Use an HTTPS tracking URL without credentials");}
    const paidAt=paymentStatus === "paid" && existing.paymentStatus !== "paid" ? new Date().toISOString() : existing.paidAt;
    const result = save("orders", id, { ...existing, status, paymentStatus, paidAt,carrier,trackingNumber,trackingUrl, notes: text(data.notes ?? existing.notes, "notes", 5000, false) }, String(existing.customerId));
    queueOrderMessages(result,existing);
    audit(actor, "order.updated", id); return result;
  });
}







