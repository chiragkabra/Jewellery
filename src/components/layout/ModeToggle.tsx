"use client";

import { motion } from "framer-motion";
import { useMode } from "@/context/ModeContext";
import { cn } from "@/lib/utils";
import type { Mode } from "@/lib/types";

const options: { value: Mode; label: string }[] = [
  { value: "retail", label: "Retail" },
  { value: "trade", label: "Trade" },
];

/** RETAIL / TRADE pill. Trade swaps prices for rate, making %, MOQ and lead time. */
export function ModeToggle({ className, layoutId = "mode-pill" }: { className?: string; layoutId?: string }) {
  const { mode, setMode } = useMode();
  return (
    <div
      role="radiogroup"
      aria-label="Buying as"
      className={cn("relative inline-flex h-9 items-center border border-ink/80 p-[3px]", className)}
    >
      {options.map((o) => {
        const active = mode === o.value;
        return (
          <button
            key={o.value}
            role="radio"
            aria-checked={active}
            onClick={() => setMode(o.value)}
            className={cn(
              "relative z-10 h-full min-w-[64px] px-3 text-[11px] font-semibold uppercase tracking-[0.16em] transition-colors duration-300",
              active ? "text-ivory" : "text-ink hover:text-accent"
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 -z-10 bg-ink"
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
              />
            )}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
