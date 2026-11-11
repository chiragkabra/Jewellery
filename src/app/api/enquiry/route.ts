import { enquiry, type Upload } from "@/lib/server/business";
import { ApiError, body, check, handle, json, limit, sameOrigin } from "@/lib/server/http";
export const runtime = "nodejs";
export const POST = (req: Request) => handle(async () => {
  sameOrigin(req); limit(req, "enquiry", 30);
  let data: Record<string, unknown>; const uploads: Upload[] = [];
  if (req.headers.get("content-type")?.includes("multipart/form-data")) {
    const reader = req.body?.getReader(); check(reader, "Request body required");
    const chunks: Uint8Array[] = []; let size = 0;
    for (;;) { const { value, done } = await reader.read(); if(done) break; size += value.length; if(size > 21 * 1024 * 1024) { await reader.cancel(); return json({ error: "Files exceed request limit" }, 413); } chunks.push(value); }
    let form: FormData;
    try { form = await new Response(Buffer.concat(chunks), { headers: { "Content-Type": req.headers.get("content-type")! } }).formData(); }
    catch { throw new ApiError(400,"Invalid multipart form"); }
    const raw = form.get("payload"); check(typeof raw === "string" && raw.length < 65536, "Invalid payload");
    try { data = JSON.parse(raw); } catch { return json({ error: "Invalid payload" }, 400); }
    check(data && typeof data === "object" && !Array.isArray(data), "Invalid payload");
    for (const [key, file] of form.entries()) {
      if (key === "payload") continue;
      check(file instanceof File && file.size > 0 && file.size <= 5 * 1024 * 1024 && uploads.length < 4, "Upload up to four files, 5 MB each");
      const content = Buffer.from(await file.arrayBuffer());
      const mime = content.subarray(0,5).toString() === "%PDF-" ? "application/pdf" : content.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? "image/png" : content[0] === 255 && content[1] === 216 && content[2] === 255 ? "image/jpeg" : null;
      check(mime, "Only PDF, PNG and JPEG files are accepted");
      uploads.push({ name: file.name.replace(/[^a-zA-Z0-9._ -]/g, "_").slice(0,150), mime, content });
    }
  } else data = await body(req);
  return json({ ok: true, reference: enquiry(data, uploads) }, 201);
});

