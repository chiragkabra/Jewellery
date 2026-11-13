import "server-only";
import { cookies } from "next/headers";
import type { Product } from "@/lib/types";

const backend = () => process.env.PYTHON_BACKEND_URL || "http://127.0.0.1:8000";
export async function catalogue(): Promise<Product[]> {
  const response = await fetch(`${backend()}/api/products`, { cache: "no-store", signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error("Python catalogue unavailable");
  return (await response.json()).products;
}
export async function user(): Promise<{ id:string;name:string;email:string;role:"admin"|"staff"|"trade" }|null> {
  const token = (await cookies()).get("lumera_session");
  if (!token) return null;
  const response = await fetch(`${backend()}/api/auth`, { headers:{ Cookie:`lumera_session=${encodeURIComponent(token.value)}` }, cache:"no-store", signal:AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error("Python authentication unavailable");
  return (await response.json()).user;
}
