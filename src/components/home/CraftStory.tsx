"use client";

import { useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { craftSteps } from "@/data/home";
import { Media } from "@/components/ui/Media";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

gsap.registerPlugin(ScrollTrigger);

/**
 * Pinned scroll story (desktop): the section holds while each step reveals.
 * Mobile / reduced motion: a plain stacked list.
 */
export function CraftStory() {
  const wrap = useRef<HTMLDivElement>(null);
  const pin = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLSpanElement>(null);
  const [active, setActive] = useState(0);
  const n = craftSteps.length;

  useLayoutEffect(() => {
    const mm = gsap.matchMedia();
    mm.add("(min-width: 1024px) and (prefers-reduced-motion: no-preference)", () => {
      const st = ScrollTrigger.create({
        trigger: pin.current,
        start: "top top",
        end: () => `+=${window.innerHeight * (n - 1) * 0.8}`,
        pin: true,
        scrub: true,
        onUpdate: (self) => {
          setActive(Math.min(n - 1, Math.floor(self.progress * n * 0.999)));
          if (bar.current) bar.current.style.transform = `scaleY(${self.progress})`;
        },
      });
      return () => st.kill();
    }, wrap);
    return () => mm.revert();
  }, [n]);

  return (
    <div ref={wrap}>
      {/* Desktop pinned version */}
      <div ref={pin} className="hidden h-screen overflow-hidden bg-ink text-ivory motion-safe:lg:block">
        <div className="container-site grid h-full grid-cols-12 items-center gap-12">
          <div className="col-span-5">
            <p className="eyebrow mb-4 text-accent-light">Craftsmanship</p>
            <h2 className="display-2">From sketch to certificate.</h2>
            <div className="relative mt-12 pl-8">
              <span className="absolute left-0 top-0 h-full w-px bg-ivory/15" aria-hidden />
              <span
                ref={bar}
                className="absolute left-0 top-0 h-full w-px origin-top scale-y-0 bg-accent-light"
                aria-hidden
              />
              <ol className="space-y-1">
              {craftSteps.map((s, i) => (
                <li key={s.title} className="py-3">
                  <div className={cn("flex items-baseline gap-4 transition-colors duration-500", i === active ? "text-ivory" : "text-ivory/35")}>
                    <span className="w-6 text-[12px] tabular-nums tracking-[0.2em]">0{i + 1}</span>
                    <span className="font-display text-[30px] leading-none">{s.title}</span>
                  </div>
                  <div
                    className={cn(
                      "grid transition-[grid-template-rows,opacity] duration-700 ease-lux",
                      i === active ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                    )}
                  >
                    <p className="overflow-hidden pl-10 pt-3 text-[15px] leading-relaxed text-ivory/70">{s.body}</p>
                  </div>
                </li>
              ))}
              </ol>
            </div>
          </div>
          <div className="relative col-span-7 aspect-[4/3]">
            {craftSteps.map((s, i) => (
              <div
                key={s.title}
                className={cn(
                  "absolute inset-0 transition-[opacity,clip-path] duration-1000 ease-lux",
                  i <= active ? "opacity-100 [clip-path:inset(0_0_0_0)]" : "opacity-0 [clip-path:inset(100%_0_0_0)]"
                )}
                style={{ zIndex: i }}
              >
                <Media src={s.image} alt={`${s.title} — workshop`} sizes="60vw" className="h-full w-full" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile / reduced-motion version */}
      <section className="section bg-ink text-ivory motion-safe:lg:hidden">
        <div className="container-site">
          <p className="eyebrow mb-4 text-accent-light">Craftsmanship</p>
          <h2 className="display-2">From sketch to certificate.</h2>
          <ol className="mt-12 space-y-14">
            {craftSteps.map((s, i) => (
              <motion.li
                key={s.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-10% 0px" }}
                transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                className="grid gap-6 md:grid-cols-2 md:items-center"
              >
                  <Media src={s.image} alt={`${s.title} — workshop`} sizes="(min-width: 768px) 50vw, 100vw" className="aspect-[4/3]" />
                  <div>
                    <span className="text-[12px] tracking-[0.2em] text-accent-light">0{i + 1}</span>
                    <h3 className="mt-2 font-display text-[30px]">{s.title}</h3>
                    <p className="mt-3 text-[15px] leading-relaxed text-ivory/70">{s.body}</p>
                  </div>
              </motion.li>
            ))}
          </ol>
        </div>
      </section>
    </div>
  );
}
