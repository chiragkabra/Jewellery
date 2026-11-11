import { NextResponse } from "next/server";
import type { Rate, RatesResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * MOCK metal-rate endpoint.
 * Values are null (shown as [RATE]) until a live feed is connected.
 * To go live, fetch from your rate provider here and set `live: true`.
 */
export async function GET() {
  const rates: Rate[] = [
    { key: "gold24", label: "Gold 24K", unit: "/g", value: null, change: null },
    { key: "gold22", label: "Gold 22K", unit: "/g", value: null, change: null },
    { key: "gold18", label: "Gold 18K", unit: "/g", value: null, change: null },
    { key: "silver999", label: "Silver 999", unit: "/kg", value: null, change: null },
  ];

  const body: RatesResponse = {
    rates,
    updatedAt: new Date().toISOString(),
    source: "[RATE SOURCE]",
    live: false,
  };
  return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
}
