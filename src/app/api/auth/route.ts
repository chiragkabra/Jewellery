import { queueWhatsApp } from "@/lib/server/whatsapp";
import { randomUUID } from "node:crypto";
import { createSession, hashPassword, logout, requireUser, user, verifyPassword } from "@/lib/server/auth";
import { audit, db, record, transaction } from "@/lib/server/db";
import { body, check, choice, email, handle, json, limit, sameOrigin, text } from "@/lib/server/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = () => handle(async () => json({ user: await user() }));
export const POST = (req: Request) => handle(async () => {
  sameOrigin(req); limit(req, "auth", 30); const data = await body(req);
  if (data.action === "logout") { await logout(); return json({ ok: true }); }
  if (data.action === "change-password") {
    const current = await requireUser();
    const oldPassword = text(data.oldPassword,"current password",128);
    const password = text(data.password,"new password",128);
    check(password.length >= 12,"Use at least 12 characters");
    const row = db().prepare("SELECT password FROM users WHERE id=?").get(current.id)!;
    check(verifyPassword(oldPassword,String(row.password)),"Current password is incorrect",401);
    db().prepare("UPDATE users SET password=? WHERE id=?").run(hashPassword(password),current.id);
    db().prepare("DELETE FROM sessions WHERE user_id=?").run(current.id);
    await createSession(current.id);audit(current.id,"password.changed",current.id);
    return json({ok:true});
  }
  if (data.action === "create-user") {
    const actor = await requireUser(true); check(actor.role === "admin", "Admin access required", 403);
    const address = email(data.email); const name = text(data.name, "name", 150); const password = text(data.password, "password", 128);
    check(password.length >= 12, "Use at least 12 characters"); const role = choice(data.role, ["admin", "staff", "trade"], "role");
    check(!db().prepare("SELECT id FROM users WHERE email=?").get(address), "User already exists", 409);
    const id=randomUUID();const passwordHash=hashPassword(password);
    transaction(()=>{
      db().prepare("INSERT INTO users VALUES(?,?,?,?,?,?)").run(id,address,name,passwordHash,role,new Date().toISOString());
      if(role === "trade") {
        const row=db().prepare("SELECT id FROM customers WHERE email=?").get(address);
        if(row){const contact=record("customers",String(row.id))!;queueWhatsApp("trade_account_ready",id,String(contact.id),[String(contact.name),new URL("/account",process.env.APP_URL || "http://localhost:3000").toString()]);}
      }
      audit(actor.id,"user.created",id);
    });
    return json({ok:true},201);
  }
  check(data.action === "login", "Invalid action"); const address = email(data.email); const password = text(data.password, "password", 128);
  limit(req, "login-email", 10, 600000, address);
  const row = db().prepare("SELECT * FROM users WHERE email=?").get(address);
  const valid = verifyPassword(password, row ? String(row.password) : "00000000000000000000000000000000:" + "00".repeat(64));
  check(row && valid, "Invalid email or password", 401);
  await createSession(String(row.id)); audit(String(row.id), "login", "session"); return json({ ok: true, role: row.role });
});


