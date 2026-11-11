import "server-only";
import { cookies } from "next/headers";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { db } from "./db";
import { check } from "./http";
export type User = { id: string; email: string; name: string; role: "admin" | "staff" | "trade" };
const cookieName = "lumera_session";
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}
export function verifyPassword(password: string, stored: string) {
  const [salt, expected] = stored.split(":");
  const actual = scryptSync(password, salt, 64);
  const expectedBuffer = Buffer.from(expected, "hex");
  return actual.length === expectedBuffer.length && timingSafeEqual(actual, expectedBuffer);
}
export async function user(): Promise<User | null> {
  const token = (await cookies()).get(cookieName)?.value;
  if (!token) return null;
  return (db().prepare("SELECT u.id,u.email,u.name,u.role FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token=? AND s.expires_at>?").get(digest(token), Date.now()) as User | undefined) || null;
}
export async function requireUser(staff = false) {
  const current = await user(); check(current, "Please sign in", 401);
  if (staff) check(current.role !== "trade", "Staff access required", 403);
  return current;
}
export async function createSession(id: string) {
  const token = randomBytes(32).toString("hex");
  db().prepare("DELETE FROM sessions WHERE expires_at < ?").run(Date.now());
  db().prepare("INSERT INTO sessions VALUES(?,?,?)").run(digest(token), id, Date.now() + 8 * 3600000);
  (await cookies()).set(cookieName, token, { httpOnly: true, secure: process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE !== "false", sameSite: "lax", path: "/", maxAge: 8 * 3600 });
}
export async function logout() {
  const jar = await cookies(); const token = jar.get(cookieName)?.value;
  if (token) db().prepare("DELETE FROM sessions WHERE token=?").run(digest(token));
  jar.delete(cookieName);
}
