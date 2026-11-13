// Frontend transport only. Authentication, validation, persistence and all
// business actions are handled by the independent Python FastAPI service.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function forward(request:Request) {
  const base = process.env.PYTHON_BACKEND_URL || "http://127.0.0.1:8000";
  const url = new URL(request.url);
  const headers = new Headers();
  for(const name of ["content-type","cookie","authorization","origin","sec-fetch-site","x-hub-signature-256","x-forwarded-for"]) {
    const value=request.headers.get(name);if(value)headers.set(name,value);
  }
  try {
    const init:RequestInit = {method:request.method,headers,redirect:"manual",cache:"no-store",signal:AbortSignal.timeout(90000)};
    if(!["GET","HEAD"].includes(request.method)){
      // Bound and preserve exact bytes before forwarding. A streaming upload can
      // be aborted when Python rejects it early, hiding its 401/413 as a 503.
      const reader=request.body?.getReader(),chunks:Uint8Array[]=[];let size=0;
      if(reader)for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>21*1024*1024){await reader.cancel();return Response.json({ok:false,error:"Request too large"},{status:413});}chunks.push(value);}
      const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}init.body=bytes;
    }
    const response=await fetch(`${base}${url.pathname}${url.search}`,init);
    const outgoing=new Headers(response.headers);
    for(const name of ["content-length","content-encoding","transfer-encoding","connection"])outgoing.delete(name);
    return new Response(response.body,{status:response.status,headers:outgoing});
  } catch (error) {
    // Record only the transport error class/code, never headers, body or tokens.
    const cause=error instanceof Error?error.cause:undefined;
    console.error("Python transport failed",error instanceof Error?error.name:"unknown",cause && typeof cause === "object" && "code" in cause?String(cause.code):"");
    return Response.json({ok:false,error:"Python backend unavailable"},{status:503,headers:{"Cache-Control":"no-store"}});
  }
}
export {forward as GET,forward as POST,forward as PATCH,forward as PUT,forward as DELETE,forward as OPTIONS,forward as HEAD};
