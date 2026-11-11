"use client";

import { useRef } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { AnimatePresence, motion, useScroll, useTransform } from "framer-motion";
import { ArrowRight, Award, ShieldCheck, Truck } from "lucide-react";
import { heroByLens, trustRow } from "@/data/home";
import { useLens } from "@/context/LensContext";
import { useMediaQuery } from "@/lib/hooks";
import { Media } from "@/components/ui/Media";

// Lazy: three.js only loads on desktop with motion allowed.
const DiamondCanvas = dynamic(() => import("./DiamondCanvas"), { ssr: false });

// Edge colour for the 3D diamond (it sits on ivory, so the darker accent).
const GEM_EDGE: Record<string, string> = {
  all: "#6E5E4A",
  gold: "#8A6528",
  silver: "#4F5862",
  diamond: "#2D5873",
};

const trustIcons = [Award, ShieldCheck, Truck];
const ease = [0.22, 1, 0.36, 1] as const;

export function Hero() {
  const { lens } = useLens();
  const copy = heroByLens[lens];
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], ["0%", "14%"]);
  const show3d = useMediaQuery("(min-width: 1024px) and (prefers-reduced-motion: no-preference)");

  return (
    <section ref={ref} className="relative overflow-hidden">
      <div className="container-site grid items-center gap-12 pb-16 pt-10 md:pt-16 lg:grid-cols-12 lg:gap-16 lg:pb-24">
        <div className="lg:col-span-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={lens}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.6, ease }}
            >
              <p className="eyebrow mb-6">{copy.eyebrow}</p>
              <h1 className="display-1 max-w-[15ch]">{copy.headline}</h1>
              <p className="lede mt-8 max-w-[52ch]">{copy.lede}</p>
            </motion.div>
          </AnimatePresence>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Link href={lens === "all" ? "/gold" : `/${lens === "diamond" ? "diamonds" : lens}`} className="btn-primary">
              Shop the collection <ArrowRight size={16} strokeWidth={1.5} />
            </Link>
            <Link href="/wholesale#apply" className="btn-secondary">
              Open a trade account
            </Link>
          </div>

          <ul className="mt-12 flex flex-wrap gap-x-8 gap-y-4 border-t border-line pt-6">
            {trustRow.map((t, i) => {
              const Icon = trustIcons[i];
              return (
                <li key={t} className="flex items-center gap-2.5 text-[13px] font-medium tracking-[0.04em] text-muted">
                  <Icon size={17} strokeWidth={1.5} className="text-accent" />
                  {t}
                </li>
              );
            })}
          </ul>
        </div>

        <div className="relative lg:col-span-6">
          <div className="relative aspect-[4/5] overflow-hidden lg:aspect-[4/5.2]">
            <motion.div style={{ y }} className="absolute inset-[-8%_0]">
              <AnimatePresence initial={false}>
                <motion.div
                  key={copy.image}
                  className="absolute inset-0"
                  initial={{ opacity: 0, scale: 1.04 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1, ease }}
                >
                  <Media src={copy.image} alt={copy.imageLabel} priority sizes="(min-width: 1024px) 50vw, 100vw" className="h-full w-full" />
                </motion.div>
              </AnimatePresence>
            </motion.div>
          </div>
          {show3d && (
            <div className="pointer-events-none absolute -left-20 top-[8%] h-52 w-52 xl:-left-28 xl:h-60 xl:w-60">
              <DiamondCanvas color={GEM_EDGE[lens]} />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
