"use client";

import { useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Search, X } from "lucide-react";
import { products } from "@/data/products";
import { materials, materialByKey } from "@/data/materials";
import { categoryName } from "@/data/categories";
import { useModal } from "@/lib/hooks";
import { Media } from "@/components/ui/Media";

export function SearchOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState("");
  const close = useCallback(() => {
    setQ("");
    onClose();
  }, [onClose]);
  useModal(open, close);

  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return products.filter((p) => p.featured).slice(0, 4);
    return products
      .filter((p) =>
        [p.name, p.material, materialByKey(p.material).name, categoryName(p.category), ...p.variants]
          .join(" ")
          .toLowerCase()
          .includes(t)
      )
      .slice(0, 8);
  }, [q]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="Search"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] bg-ivory"
          data-lenis-prevent
        >
          <div className="container-site flex h-full flex-col overflow-y-auto pb-16">
            <div className="flex items-center justify-end pt-6">
              <button onClick={close} aria-label="Close search" className="grid h-11 w-11 place-items-center">
                <X size={22} strokeWidth={1.5} />
              </button>
            </div>
            <label className="mt-6 flex items-center gap-4 border-b border-ink pb-4">
              <Search size={26} strokeWidth={1.5} className="shrink-0 text-muted" />
              <span className="sr-only">Search the collection</span>
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search rings, 22K, oval, vermeil…"
                className="w-full bg-transparent font-display text-[28px] placeholder:text-muted/50 focus:outline-none sm:text-[44px]"
              />
            </label>

            <div className="mt-6 flex flex-wrap gap-2">
              {materials.map((m) => (
                <Link key={m.key} href={`/${m.slug}`} onClick={close} className="chip hover:border-ink hover:text-ink">
                  {m.name}
                </Link>
              ))}
            </div>

            <p className="eyebrow mb-6 mt-12">{q ? `${results.length} results` : "Popular pieces"}</p>
            <ul className="grid grid-cols-2 gap-6 md:grid-cols-4">
              {results.map((p) => (
                <li key={p.slug} data-material={p.material}>
                  <Link href={`/product/${p.slug}`} onClick={close} className="group block">
                    <Media src={p.images[0]} alt={p.name} sizes="300px" className="aspect-[4/5]" />
                    <p className="mt-3 text-[15px] group-hover:text-accent">{p.name}</p>
                    <p className="text-[13px] text-muted">
                      {materialByKey(p.material).name} · {categoryName(p.category)}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
            {q && results.length === 0 && <p className="text-muted">No pieces match “{q}”.</p>}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
