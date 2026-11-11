import { requireUser } from "@/lib/server/auth";
import { db, records } from "@/lib/server/db";
import { handle, json } from "@/lib/server/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = () => handle(async () => {
  const current = await requireUser();
  const customer = db().prepare("SELECT id FROM customers WHERE email=?").get(current.email);
  const orders = customer ? records("orders").filter(o => o.customerId === customer.id).map(({ id,items,status,paymentStatus,totalPaise,createdAt,carrier,trackingNumber,trackingUrl }) => ({ id,items,status,paymentStatus,totalPaise,createdAt,carrier,trackingNumber,trackingUrl })) : [];
  return json({ user: current, orders });
});

