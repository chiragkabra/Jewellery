import { site } from "@/data/site";
import type { Product, Rate, RateKey } from "@/lib/types";

export interface BreakdownLine {
  label: string;
  value: number | null;
  note?: string;
}

/** Which rate applies for a given gold purity / silver finish. */
export function rateKeyFor(product: Product, variant: string): RateKey | null {
  if (product.material === "silver") return "silver999";
  if (product.material === "gold") {
    if (variant === "24K") return "gold24";
    if (variant === "22K") return "gold22";
    return "gold18";
  }
  return "gold18"; // diamond jewellery is set in 18K by default
}

const PURITY_FACTOR: Record<string, number> = { "14K": 14 / 18 };

/**
 * Price breakdown: metal value + making charge + stone value + GST.
 * Any unknown input keeps that line (and the total) as a placeholder.
 */
export function priceBreakdown(product: Product, variant: string, rates: Rate[]) {
  const key = rateKeyFor(product, variant);
  const raw = rates.find((r) => r.key === key)?.value ?? null;
  // Silver is quoted per kg; everything else per gram.
  const rate = raw != null && key === "silver999" ? raw / 1000 : raw;
  const factor = PURITY_FACTOR[variant] ?? 1;
  const silverFactor = product.material === "silver" ? 0.925 : 1;

  const metal =
    rate != null && product.weightGrams != null ? rate * product.weightGrams * factor * silverFactor : null;
  const making = metal != null && product.makingChargePct != null ? (metal * product.makingChargePct) / 100 : null;
  const stone = product.material === "diamond" ? product.stoneValue : 0;
  const subtotal = metal != null && making != null && stone != null ? metal + making + stone : null;
  const gst = subtotal != null ? (subtotal * site.gstPct) / 100 : null;
  const total = product.price ?? (subtotal != null && gst != null ? subtotal + gst : null);

  const lines: BreakdownLine[] = [
    { label: "Metal value", value: metal, note: product.weightGrams == null ? "[XX] g × [RATE]" : undefined },
    { label: "Making charge", value: making, note: product.makingChargePct == null ? "[XX]%" : `${product.makingChargePct}%` },
  ];
  if (product.material === "diamond") lines.push({ label: "Stone value", value: stone });
  lines.push({ label: `GST (${site.gstPct}%)`, value: gst });

  return { lines, total };
}
