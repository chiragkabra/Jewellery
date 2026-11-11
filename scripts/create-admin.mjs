import { DatabaseSync } from "node:sqlite";
import { randomBytes,randomUUID,scryptSync } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
const args=process.argv.slice(2);const value=flag=>args[args.indexOf(flag)+1];
const email=args.includes("--email") ? value("--email").trim().toLowerCase() : "";
if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { console.error("Usage: npm run admin:create -- --email owner@example.com --name Owner");process.exit(1); }
const filename=path.resolve(process.env.DATABASE_PATH || "data/lumera.sqlite");mkdirSync(path.dirname(filename),{recursive:true});
const db=new DatabaseSync(filename,{timeout:5000});
db.exec("CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL, password TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('admin','staff','trade')), created_at TEXT NOT NULL)");
const existing=db.prepare("SELECT id,role FROM users WHERE email=?").get(email);
if(existing && !args.includes("--reset")) {console.error("Account already exists. No changes made. Use --reset to recover an admin account.");db.close();process.exit(1);}
if(args.includes("--reset") && (!existing || existing.role !== "admin")) {console.error("Reset requires an existing admin account.");db.close();process.exit(1);}
const password=randomBytes(18).toString("base64url");const salt=randomBytes(16).toString("hex");const hash=`${salt}:${scryptSync(password,salt,64).toString("hex")}`;
if(existing) {
  db.exec("BEGIN IMMEDIATE");
  try {db.prepare("UPDATE users SET password=? WHERE id=?").run(hash,existing.id);if(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sessions'").get())db.prepare("DELETE FROM sessions WHERE user_id=?").run(existing.id);db.exec("COMMIT");}catch(error){db.exec("ROLLBACK");throw error;}
} else db.prepare("INSERT INTO users VALUES(?,?,?,?,?,?)").run(randomUUID(),email,args.includes("--name") ? value("--name") : "Owner",hash,"admin",new Date().toISOString());
db.close();
console.log(`Admin credentials ready. Save them securely.\nEmail: ${email}\nPassword: ${password}\nLogin: /account\nCRM: /crm`);

