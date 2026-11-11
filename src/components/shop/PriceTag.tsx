"use client";

import { useMode } from "@/context/ModeContext";
import { useRatesData } from "@/context/RatesContext";
import { formatPct, formatPrice, formatRate } from "@/lib/format";
import { rateKeyFor } from "@/lib/pricing";
import type { Product } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Retail: the price. Trade: rate, making %, MOQ and lead time. */
export function PriceTag({ product, variant, compact }: { product: Product; variant?: string; compact?: boolean }) {
  const { isTrade } = useMode();
  const rates = useRatesData();

  if (!isTrade) return <p className="text-[15px] tabular-nums">{formatPrice(product.price)}</p>;

  const key = rateKeyFor(product, variant ?? product.variants[0]);
  const rate = rates?.rates.find((r) => r.key === key);
  const rows: [string, string][] = [
    [rate ? `${rate.label} rate` : "Rate", `${formatRate(rate?.value)}${rate?.unit ?? "/g"}`],
    ["Making", formatPct(product.makingChargePct)],
    ["MOQ", product.trade.moq],
    ["Lead time", product.trade.leadTime],
  ];

  return (
    <dl className={cn("grid grid-cols-2 gap-x-4 gap-y-1 text-[12.5px]", compact && "gap-y-0.5")}>
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted">{k}</dt>
          <dd className="text-right tabular-nums">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
