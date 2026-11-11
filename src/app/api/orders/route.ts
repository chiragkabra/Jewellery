import { order } from "@/lib/server/business";
import { body, check, handle, json, limit, sameOrigin } from "@/lib/server/http";
export const runtime = "nodejs";
export const POST = (req: Request) => handle(async () => {
  sameOrigin(req); limit(req, "checkout", 10); const data=await body(req); check(typeof data.requestId === "string" && data.requestId.length >= 16,"Request ID required");check(typeof data.expectedTotalPaise === "number","Price confirmation required");const result = order(data, "website");
  return json({ ok: true, reference: result.id, totalPaise: result.totalPaise }, 201);
});

