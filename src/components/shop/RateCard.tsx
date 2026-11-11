"use client";

import { BadgeCheck } from "lucide-react";
import { useRatesData } from "@/context/RatesContext";
import { formatRate } from "@/lib/format";
import type { Material } from "@/lib/types";

/** Gold & silver: today's rates. Diamonds: grading laboratories. */
export function RateCard({ material }: { material: Material }) {
  const data = useRatesData();

  if (material.gradingLabs) {
    return (
      <div className="border border-line bg-ivory p-6 sm:p-8">
        <p className="eyebrow mb-5">Independent grading</p>
        <ul className="space-y-4">
          {material.gradingLabs.map((lab) => (
            <li key={lab} className="flex items-start gap-3">
              <BadgeCheck size={20} strokeWidth={1.5} className="mt-0.5 shrink-0 text-accent" />
              <div>
                <p className="font-display text-[22px] leading-tight">{lab}</p>
                <p className="text-[13px] text-muted">Report number on every certified stone · [confirm labs used]</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-6 border-t border-line pt-4 text-[13px] text-muted">
          Natural and lab-grown diamonds are always disclosed and graded separately.
        </p>
      </div>
    );
  }

  const keys = material.rateKeys ?? [];
  const rates = keys.map(
    (k) => data?.rates.find((r) => r.key === k) ?? { key: k, label: k, unit: "/g", value: null, change: null }
  );
  const time = data ? new Date(data.updatedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" }) : "--:--";

  return (
    <div className="border border-line bg-ivory p-6 sm:p-8">
      <div className="mb-5 flex items-center justify-between">
        <p className="eyebrow">Today’s rate</p>
        <span className="flex items-center gap-2 text-[12px] text-muted">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-40" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
          </span>
          {data?.live ? "Live" : "Indicative"} · {time}
        </span>
      </div>
      <dl className="divide-y divide-line">
        {rates.map((r) => (
          <div key={r.key} className="flex items-baseline justify-between py-3">
            <dt className="text-[14px] text-muted">{r.label}</dt>
            <dd className="font-display text-[26px] tabular-nums">
              {formatRate(r.value)}
              <span className="ml-1 font-sans text-[13px] text-muted">{r.unit}</span>
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-[12px] text-muted">
        Prices track this rate. Source: {data?.source ?? "[RATE SOURCE]"}. Refreshes every 60 seconds.
      </p>
    </div>
  );
}

