import "server-only";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { products } from "@/data/products";

const globalDb = globalThis as unknown as { lumeraDb?: DatabaseSync };
export function db() {
  if (globalDb.lumeraDb) return globalDb.lumeraDb;
  const filename = path.resolve(process.env.DATABASE_PATH || "data/lumera.sqlite");
  mkdirSync(path.dirname(filename), { recursive: true });
  const connection = new DatabaseSync(filename, { timeout: 5000 });
  connection.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL, password TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('admin','staff','trade')), created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS customers (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, data TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS enquiries (id TEXT PRIMARY KEY, customer_id TEXT NOT NULL REFERENCES customers(id), data TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY, customer_id TEXT NOT NULL REFERENCES customers(id), data TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, customer_id TEXT NOT NULL REFERENCES customers(id), data TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS order_requests (id TEXT PRIMARY KEY, request_hash TEXT NOT NULL, order_id TEXT NOT NULL REFERENCES orders(id));
    CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, data TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS settings (id TEXT PRIMARY KEY, data TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS attachments (id TEXT PRIMARY KEY, enquiry_id TEXT NOT NULL REFERENCES enquiries(id), name TEXT NOT NULL, mime TEXT NOT NULL, content BLOB NOT NULL);
    CREATE TABLE IF NOT EXISTS audit (id TEXT PRIMARY KEY, actor TEXT NOT NULL, action TEXT NOT NULL, entity TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS rate_limits (id TEXT PRIMARY KEY, count INTEGER NOT NULL, resets_at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS enquiry_customer ON enquiries(customer_id);
    CREATE INDEX IF NOT EXISTS order_customer ON orders(customer_id);
    CREATE INDEX IF NOT EXISTS task_customer ON tasks(customer_id);
    CREATE TABLE IF NOT EXISTS wa_consents (phone TEXT PRIMARY KEY, customer_id TEXT, opted_in INTEGER NOT NULL, source TEXT NOT NULL, updated_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS wa_outbox (id TEXT PRIMARY KEY, event_key TEXT UNIQUE NOT NULL, customer_id TEXT NOT NULL REFERENCES customers(id), event TEXT NOT NULL, entity_id TEXT NOT NULL, phone TEXT NOT NULL, parameters TEXT NOT NULL, context TEXT NOT NULL, preview TEXT NOT NULL, mode TEXT NOT NULL, status TEXT NOT NULL, not_before INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, provider_id TEXT UNIQUE, error TEXT, lease_until INTEGER, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS wa_due ON wa_outbox(status,mode,not_before);
    CREATE TABLE IF NOT EXISTS wa_inbox (id TEXT PRIMARY KEY, phone TEXT NOT NULL, body TEXT NOT NULL, type TEXT NOT NULL, received_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS wa_webhooks (id TEXT PRIMARY KEY, created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS wa_status_events (id TEXT PRIMARY KEY, provider_id TEXT NOT NULL, status TEXT NOT NULL, occurred_at INTEGER NOT NULL, error TEXT);
    CREATE INDEX IF NOT EXISTS wa_provider_status ON wa_status_events(provider_id);
    PRAGMA user_version=2;`);
  const seed = connection.prepare("INSERT OR IGNORE INTO products(id,data,created_at) VALUES(?,?,?)");
  for (const product of products) seed.run(product.slug, JSON.stringify({ ...product, stock: 0, active: true }), new Date().toISOString());
  globalDb.lumeraDb = connection;
  return connection;
}
export function transaction<T>(fn: () => T): T {
  db().exec("BEGIN IMMEDIATE");
  try { const value = fn(); db().exec("COMMIT"); return value; }
  catch (error) { db().exec("ROLLBACK"); throw error; }
}
export function audit(actor: string, action: string, entity: string) {
  db().prepare("INSERT INTO audit VALUES(?,?,?,?,?)").run(randomUUID(), actor, action, entity, new Date().toISOString());
}
export type Entity = "customers" | "enquiries" | "tasks" | "orders" | "products" | "settings";
export type RecordData = Record<string, unknown>;
export function records(table: Entity) {
  return db().prepare(`SELECT * FROM ${table} ORDER BY created_at DESC`).all().map(decode);
}
function decode(row: Record<string, unknown>) {
  return { ...JSON.parse(row.data as string), id: row.id, createdAt: row.created_at, customerId: row.customer_id } as RecordData;
}
export function record(table: Entity, id: string): RecordData | undefined {
  const row = db().prepare(`SELECT * FROM ${table} WHERE id=?`).get(id);
  return row ? decode(row) : undefined;
}
export function save(table: Entity, id: string, data: RecordData, customerId?: string) {
  const now = new Date().toISOString();
  if (table === "customers") {
    db().prepare("INSERT INTO customers VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET email=excluded.email,data=excluded.data").run(id, String(data.email), JSON.stringify(data), now);
  } else if (table === "orders" || table === "tasks" || table === "enquiries") {
    db().prepare(`INSERT INTO ${table} VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data`).run(id, customerId!, JSON.stringify(data), now);
  } else {
    db().prepare(`INSERT INTO ${table} VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data`).run(id, JSON.stringify(data), now);
  }
  return record(table, id)!;
}



