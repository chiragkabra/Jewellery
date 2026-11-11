"use client";

import { useEffect, useRef, useState } from "react";
import { animate, useInView } from "framer-motion";
import { stats } from "@/data/home";
import type { Stat } from "@/lib/types";

function Counter({ stat }: { stat: Stat }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-15% 0px" });
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (!inView || stat.value == null) return;
    const controls = animate(0, stat.value, {
      duration: 1.8,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setShown(Math.round(v)),
    });
    return () => controls.stop();
  }, [inView, stat.value]);

  return (
    <span ref={ref} className="tabular-nums">
      {stat.value == null ? "[XX]" : shown.toLocaleString("en-IN")}
      {stat.suffix}
    </span>
  );
}

/** Counters count up when scrolled into view. Values live in src/data/home.ts. */
export function Stats() {
  return (
    <section className="section border-y border-line">
      <div className="container-site">
        <dl className="grid grid-cols-2 gap-y-12 md:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="flex flex-col-reverse border-l border-line pl-6">
              <dt className="mt-4 text-[13px] font-medium uppercase tracking-[0.14em] text-muted">{s.label}</dt>
              <dd className="font-display text-[48px] leading-none text-accent sm:text-[64px]">
                <Counter stat={s} />
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
