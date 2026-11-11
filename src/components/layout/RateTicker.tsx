"use client";

import { useRatesData } from "@/context/RatesContext";
import { formatRate } from "@/lib/format";

const FALLBACK = [
  { key: "gold24", label: "Gold 24K", unit: "/g" },
  { key: "gold22", label: "Gold 22K", unit: "/g" },
  { key: "gold18", label: "Gold 18K", unit: "/g" },
  { key: "silver999", label: "Silver 999", unit: "/kg" },
];

/** Marquee of today's metal rates — refreshes from /api/rates every 60s. */
export function RateTicker() {
  const data = useRatesData();
  const rates = data?.rates ?? FALLBACK.map((r) => ({ ...r, value: null, change: null }));
  const time = data
    ? new Date(data.updatedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
    : "--:--";

  const items = (
    <>
      {rates.map((r) => (
        <span key={r.key} className="inline-flex items-center gap-2 px-6">
          <span className="text-muted">{r.label}</span>
          <span className="font-semibold tabular-nums text-ink">
            {formatRate(r.value)}
            <span className="font-normal text-muted">{r.unit}</span>
          </span>
          {r.change != null && (
            <span className={r.change >= 0 ? "text-[#2F6B3F]" : "text-[#9A3B2E]"}>
              {r.change >= 0 ? "+" : ""}
              {r.change.toFixed(2)}%
            </span>
          )}
          <span aria-hidden className="pl-6 text-line">
            |
          </span>
        </span>
      ))}
      <span className="inline-flex items-center gap-2 px-6 text-muted">
        {data?.live ? "Live" : "Indicative"} · updated {time} IST
        <span aria-hidden className="pl-6 text-line">
          |
        </span>
      </span>
    </>
  );

  return (
    <div className="group relative overflow-hidden border-b border-line bg-sand" aria-label="Today's metal rates">
      <div className="flex w-max animate-marquee whitespace-nowrap py-2 text-[12px] tracking-[0.04em] group-hover:[animation-play-state:paused]">
        <div className="flex">{items}</div>
        <div className="flex" aria-hidden>
          {items}
        </div>
      </div>
    </div>
  );
}
