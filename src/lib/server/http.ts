import "server-only";
import { createHash } from "node:crypto";
import { db } from "./db";
export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function check(condition: unknown, message: string, status = 400): asserts condition {
  if (!condition) throw new ApiError(status, message);
}
export function text(value: unknown, label: string, max = 500, required = true) {
  check(value == null || typeof value === "string", `${label} must be text`);
  const result = (value as string || "").trim();
  check((!required || result.length > 0) && result.length <= max, `Invalid ${label}`);
  return result;
}
export function email(value: unknown) {
  const result = text(value, "email", 254).toLowerCase();
  check(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result), "Enter a valid email");
  return result;
}
export function number(value: unknown, label: string, max = 100000000) {
  check(typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= max, `Invalid ${label}`);
  return value;
}
export function choice(value: unknown, options: string[], label: string) {
  check(typeof value === "string" && options.includes(value), `Invalid ${label}`); return value;
}
export function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  const expected = process.env.APP_URL || new URL(req.url).origin;
  check(!origin || origin === new URL(expected).origin, "Cross-origin request rejected", 403);
  check(req.headers.get("sec-fetch-site") !== "cross-site", "Cross-site request rejected", 403);
}
export async function body(req: Request, max = 65536) {
  check(req.headers.get("content-type")?.includes("application/json"), "JSON required", 415);
  const reader = req.body?.getReader();
  check(reader, "Request body required");
  let size = 0; const chunks: Uint8Array[] = [];
  for (;;) { const { value, done } = await reader.read(); if (done) break; size += value.length; if(size > max) { await reader.cancel(); throw new ApiError(413, "Request too large"); } chunks.push(value); }
  let data; try { data = JSON.parse(Buffer.concat(chunks).toString()); } catch { throw new ApiError(400, "Invalid JSON"); }
  check(data && typeof data === "object" && !Array.isArray(data), "Object required");
  return data as Record<string, unknown>;
}
export function limit(req: Request, scope: string, max: number, windowMs = 600000, identity?: string) {
  // Configure a trusted reverse proxy before enabling TRUST_PROXY. Otherwise all clients share a bucket.
  const address = process.env.TRUST_PROXY === "true" ? req.headers.get("x-forwarded-for")?.split(",")[0] || "shared" : "shared";
  const id = createHash("sha256").update(`${scope}:${identity || address}`).digest("hex");
  const now = Date.now();
  db().prepare("DELETE FROM rate_limits WHERE resets_at < ?").run(now);
  const row = db().prepare("INSERT INTO rate_limits VALUES(?,1,?) ON CONFLICT(id) DO UPDATE SET count=count+1 RETURNING count").get(id, now + windowMs)!;
  check(Number(row.count) <= max, "Too many requests. Please try again later.", 429);
}
export async function handle(fn: () => Promise<Response> | Response) {
  try { return await fn(); } catch (error) {
    if (error instanceof ApiError) return Response.json({ ok: false, error: error.message }, { status: error.status });
    console.error("Backend error", error instanceof Error ? error.message : "Unknown error");
    return Response.json({ ok: false, error: "Unable to complete request" }, { status: 500 });
  }
}
export function json(data: unknown, status = 200) { return Response.json(data, { status, headers: { "Cache-Control": "no-store" } }); }
