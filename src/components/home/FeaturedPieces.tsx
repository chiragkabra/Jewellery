"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useCatalogue } from "@/context/CatalogueContext";
import { useLens } from "@/context/LensContext";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { ProductCard } from "@/components/shop/ProductCard";
import { QuickView } from "@/components/shop/QuickView";
import type { Lens, Product } from "@/lib/types";
import { cn } from "@/lib/utils";

const tabs: { value: Lens; label: string }[] = [
  { value: "all", label: "All" },
  { value: "gold", label: "Gold" },
  { value: "silver", label: "Silver" },
  { value: "diamond", label: "Diamonds" },
];

export function FeaturedPieces() {
  const products = useCatalogue();
  const { lens } = useLens();
  const [tab, setTab] = useState<Lens>(lens);
  const [quick, setQuick] = useState<Product | null>(null);
  useEffect(() => setTab(lens), [lens]);

  const list = products.filter((p) => (tab === "all" ? p.featured : p.material === tab)).slice(0, 8);

  return (
    <section className="section bg-sand">
      <div className="container-site">
        <SectionHeading
          eyebrow="Featured pieces"
          title="From the workshop this season."
          action={
            <div role="tablist" aria-label="Filter featured pieces" className="flex flex-wrap gap-1">
              {tabs.map((t) => (
                <button
                  key={t.value}
                  role="tab"
                  aria-selected={tab === t.value}
                  onClick={() => setTab(t.value)}
                  className={cn(
                    "relative min-h-[44px] px-4 text-[12px] font-semibold uppercase tracking-[0.16em] transition-colors",
                    tab === t.value ? "text-ivory" : "text-ink hover:text-accent"
                  )}
                >
                  {tab === t.value && <motion.span layoutId="featured-tab" className="absolute inset-0 -z-0 bg-ink" />}
                  <span className="relative">{t.label}</span>
                </button>
              ))}
            </div>
          }
        />

        <LayoutGroup>
          <motion.ul layout className="grid grid-cols-2 gap-x-4 gap-y-10 md:gap-x-6 lg:grid-cols-4">
            <AnimatePresence mode="popLayout">
              {list.map((p) => (
                <motion.li
                  key={p.slug}
                  layout
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                >
                  <ProductCard product={p} onQuickView={setQuick} />
                </motion.li>
              ))}
            </AnimatePresence>
          </motion.ul>
        </LayoutGroup>

        <div className="mt-14 text-center">
          <Link
            href={tab === "all" ? "/gold" : `/${tab === "diamond" ? "diamonds" : tab}`}
            className="btn-secondary"
          >
            View all {tab === "all" ? "pieces" : tabs.find((t) => t.value === tab)?.label.toLowerCase()}
            <ArrowRight size={16} strokeWidth={1.5} />
          </Link>
        </div>
      </div>
      <QuickView product={quick} onClose={() => setQuick(null)} />
    </section>
  );
}

