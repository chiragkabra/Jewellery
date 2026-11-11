"use client";

import { motion } from "framer-motion";
import { useLens } from "@/context/LensContext";
import { cn } from "@/lib/utils";
import type { Lens } from "@/lib/types";

const options: { value: Lens; label: string; swatch: string }[] = [
  { value: "all", label: "All", swatch: "#6E5E4A" },
  { value: "gold", label: "Gold", swatch: "#D9B36C" },
  { value: "silver", label: "Silver", swatch: "#C9CED4" },
  { value: "diamond", label: "Diamonds", swatch: "#9CC3DD" },
];

/** Floating material lens. Re-themes the site and is mirrored to ?material= for sharing. */
export function LensSwitcher() {
  const { lens, setLens } = useLens();
  return (
    <div
      role="radiogroup"
      aria-label="Material lens"
      className="fixed bottom-4 left-4 z-40 flex items-center gap-0.5 border border-ink/10 bg-ivory/90 p-1 shadow-[0_12px_32px_-12px_rgba(23,22,26,0.35)] backdrop-blur-md sm:bottom-6 sm:left-6"
    >
      <span className="hidden px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted md:inline">Lens</span>
      {options.map((o) => {
        const active = lens === o.value;
        return (
          <button
            key={o.value}
            role="radio"
            aria-checked={active}
            onClick={() => setLens(o.value)}
            className={cn(
              "relative flex h-11 items-center gap-2 px-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors sm:px-3.5",
              active ? "text-ivory" : "text-ink hover:text-accent"
            )}
          >
            {active && (
              <motion.span
                layoutId="lens-pill"
                className="absolute inset-0 -z-10 bg-ink"
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
              />
            )}
            <span className="relative h-2.5 w-2.5 rounded-full" style={{ background: o.swatch }} aria-hidden />
            <span className={cn("relative", !active && "sr-only sm:not-sr-only")}>{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
