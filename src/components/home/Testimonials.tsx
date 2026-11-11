"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { testimonials } from "@/data/testimonials";
import { cn } from "@/lib/utils";

export function Testimonials() {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const n = testimonials.length;
  const go = useCallback((d: number) => setI((x) => (x + d + n) % n), [n]);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => go(1), 7000);
    return () => clearInterval(id);
  }, [paused, go]);

  const t = testimonials[i];

  return (
    <section
      className="section bg-sand"
      aria-roledescription="carousel"
      aria-label="Client testimonials"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="container-site">
        <div className="mx-auto max-w-4xl text-center">
          <p className="eyebrow mb-10">What clients say</p>
          <div className="relative min-h-[300px] sm:min-h-[260px]" aria-live="polite">
            <AnimatePresence mode="wait">
              <motion.figure
                key={i}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              >
                <blockquote className="font-display text-[26px] leading-[1.25] sm:text-[36px]">“{t.quote}”</blockquote>
                <figcaption className="mt-8 text-[14px]">
                  <span className="font-semibold">{t.name}</span>
                  <span className="text-muted"> — {t.role}</span>
                  <span className="ml-3 inline-block border border-accent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
                    {t.type === "trade" ? "Trade partner" : "Retail client"}
                  </span>
                </figcaption>
              </motion.figure>
            </AnimatePresence>
          </div>
          <div className="mt-10 flex items-center justify-center gap-6">
            <button onClick={() => go(-1)} aria-label="Previous testimonial" className="grid h-11 w-11 place-items-center border border-ink/20 hover:border-ink">
              <ChevronLeft size={18} strokeWidth={1.5} />
            </button>
            <div className="flex gap-2">
              {testimonials.map((_, j) => (
                <button key={j} onClick={() => setI(j)} aria-label={`Testimonial ${j + 1}`} className="grid h-11 w-6 place-items-center">
                  <span className={cn("h-px transition-all duration-500", j === i ? "w-6 bg-ink" : "w-3 bg-ink/30")} />
                </button>
              ))}
            </div>
            <button onClick={() => go(1)} aria-label="Next testimonial" className="grid h-11 w-11 place-items-center border border-ink/20 hover:border-ink">
              <ChevronRight size={18} strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
