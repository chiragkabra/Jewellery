import { NextResponse } from "next/server";

/**
 * Receives every form on the site (trade enquiry, quote request, trade
 * application, contact). Currently it only validates and logs.
 * Connect email / CRM delivery here.
 */
export async function POST(req: Request) {
  let data: Record<string, unknown>;
  try {
    data = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }
  if (typeof data.form !== "string") {
    return NextResponse.json({ ok: false, error: "Missing form type" }, { status: 400 });
  }
  console.info("[enquiry]", data.form, JSON.stringify(data).slice(0, 2000));
  return NextResponse.json({ ok: true, reference: `ENQ-${Date.now().toString(36).toUpperCase()}` });
}
