import { metalRates } from "@/lib/server/business";
import { handle, json } from "@/lib/server/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = () => handle(() => json(metalRates()));
