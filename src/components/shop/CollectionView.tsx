"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, LayoutGroup, motion, useDragControls } from "framer-motion";
import { ChevronDown, SlidersHorizontal, X } from "lucide-react";
import { categories } from "@/data/categories";
import { useMode } from "@/context/ModeContext";
import { useModal } from "@/lib/hooks";
import type { CategoryKey, Material, Product } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ProductCard } from "./ProductCard";
import { QuickView } from "./QuickView";

type Sort = "featured" | "new" | "price-asc" | "price-desc" | "weight";

interface Filters {
  categories: CategoryKey[];
  variants: string[];
  colours: string[];
  maxPrice: number | null;
  maxWeight: number | null;
}

const empty: Filters = { categories: [], variants: [], colours: [], maxPrice: null, maxWeight: null };

export function CollectionView({ material, products }: { material: Material; products: Product[] }) {
  const params = useSearchParams();
  const [filters, setFilters] = useState<Filters>(empty);
  const [sort, setSort] = useState<Sort>("featured");
  const [sheet, setSheet] = useState(false);
  const [quick, setQuick] = useState<Product | null>(null);

  // Deep links from the mega-menu: ?category=rings&variant=22K&sort=new
  useEffect(() => {
    const cat = params.get("category") as CategoryKey | null;
    const variant = params.get("variant");
    const s = params.get("sort") as Sort | null;
    setFilters({
      ...empty,
      categories: cat && categories.some((c) => c.key === cat) ? [cat] : [],
      variants: variant ? [variant] : [],
    });
    if (s) setSort(s);
  }, [params]);

  const priceMax = useMemo(() => Math.max(0, ...products.map((p) => p.price ?? 0)), [products]);
  const weightMax = useMemo(() => Math.max(0, ...products.map((p) => p.weightGrams ?? 0)), [products]);
  const colours = useMemo(() => [...new Set(products.flatMap((p) => p.metalColours))], [products]);

  const list = useMemo(() => {
    const out = products.filter(
      (p) =>
        (!filters.categories.length || filters.categories.includes(p.category)) &&
        (!filters.variants.length || p.variants.some((v) => filters.variants.includes(v))) &&
        (!filters.colours.length || p.metalColours.some((c) => filters.colours.includes(c))) &&
        (filters.maxPrice == null || (p.price != null && p.price <= filters.maxPrice)) &&
        (filters.maxWeight == null || (p.weightGrams != null && p.weightGrams <= filters.maxWeight))
    );
    const n = (v: number | null, fallback: number) => v ?? fallback;
    switch (sort) {
      case "new":
        return out.sort((a, b) => Number(!!b.isNew) - Number(!!a.isNew));
      case "price-asc":
        return out.sort((a, b) => n(a.price, Infinity) - n(b.price, Infinity));
      case "price-desc":
        return out.sort((a, b) => n(b.price, -1) - n(a.price, -1));
      case "weight":
        return out.sort((a, b) => n(a.weightGrams, Infinity) - n(b.weightGrams, Infinity));
      default:
        return out.sort((a, b) => Number(!!b.featured) - Number(!!a.featured));
    }
  }, [products, filters, sort]);

  const activeCount =
    filters.categories.length +
    filters.variants.length +
    filters.colours.length +
    (filters.maxPrice != null ? 1 : 0) +
    (filters.maxWeight != null ? 1 : 0);

  const panel = (
    <FilterPanel
      material={material}
      filters={filters}
      setFilters={setFilters}
      colours={colours}
      priceMax={priceMax}
      weightMax={weightMax}
    />
  );

  return (
    <section className="section !pt-12" id="collection">
      <div className="container-site">
        <div className="mb-8 flex items-center justify-between gap-4 border-b border-line pb-5">
          <p className="text-[14px] text-muted" aria-live="polite">
            {list.length} {list.length === 1 ? "piece" : "pieces"}
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSheet(true)}
              className="flex min-h-[44px] items-center gap-2 border border-line px-4 text-[12px] font-semibold uppercase tracking-[0.14em] lg:hidden"
            >
              <SlidersHorizontal size={16} strokeWidth={1.5} /> Filter {activeCount > 0 && `(${activeCount})`}
            </button>
            <label className="relative flex items-center">
              <span className="sr-only">Sort by</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as Sort)}
                className="min-h-[44px] w-[150px] appearance-none truncate border border-line bg-ivory pl-4 pr-10 text-[13px] focus:border-ink focus:outline-none sm:w-auto"
              >
                <option value="featured">Sort: Featured</option>
                <option value="new">Newest</option>
                <option value="price-asc" disabled={!priceMax}>
                  Price: low to high{!priceMax && " [add prices]"}
                </option>
                <option value="price-desc" disabled={!priceMax}>
                  Price: high to low{!priceMax && " [add prices]"}
                </option>
                <option value="weight" disabled={!weightMax}>
                  Weight{!weightMax && " [add weights]"}
                </option>
              </select>
              <ChevronDown size={16} strokeWidth={1.5} className="pointer-events-none absolute right-3" />
            </label>
          </div>
        </div>

        <div className="grid gap-10 lg:grid-cols-[260px_1fr]">
          <aside className="hidden lg:block" aria-label="Filters">
            <div className="sticky top-24">{panel}</div>
          </aside>

          <div>
            {list.length === 0 ? (
              <div className="py-24 text-center">
                <p className="font-display text-[28px]">No pieces match these filters.</p>
                <button onClick={() => setFilters(empty)} className="btn-secondary mt-6">
                  Clear filters
                </button>
              </div>
            ) : (
              <LayoutGroup>
                <motion.ul layout className="grid grid-cols-2 gap-x-4 gap-y-10 md:gap-x-6 xl:grid-cols-3">
                  <AnimatePresence mode="popLayout">
                    {list.map((p) => (
                      <motion.li
                        key={p.slug}
                        layout
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.97 }}
                        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                      >
                        <ProductCard product={p} onQuickView={setQuick} sizes="(min-width: 1280px) 30vw, 50vw" />
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </motion.ul>
              </LayoutGroup>
            )}
          </div>
        </div>
      </div>

      <BottomSheet open={sheet} onClose={() => setSheet(false)} count={list.length} onClear={() => setFilters(empty)}>
        {panel}
      </BottomSheet>
      <QuickView product={quick} onClose={() => setQuick(null)} />
    </section>
  );
}

function FilterPanel({
  material,
  filters,
  setFilters,
  colours,
  priceMax,
  weightMax,
}: {
  material: Material;
  filters: Filters;
  setFilters: React.Dispatch<React.SetStateAction<Filters>>;
  colours: string[];
  priceMax: number;
  weightMax: number;
}) {
  const { mode, setMode } = useMode();
  const toggle = <K extends "categories" | "variants" | "colours">(key: K, value: Filters[K][number]) =>
    setFilters((f) => {
      const arr = f[key] as string[];
      return { ...f, [key]: arr.includes(value) ? arr.filter((x) => x !== value) : [...arr, value] };
    });

  return (
    <div className="divide-y divide-line">
      <Group title="Buying as">
        <div className="grid grid-cols-2 gap-2">
          {(["retail", "trade"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={cn(
                "min-h-[44px] border text-[12px] font-semibold uppercase tracking-[0.14em]",
                mode === m ? "border-ink bg-ink text-ivory" : "border-line hover:border-ink"
              )}
            >
              {m}
            </button>
          ))}
        </div>
      </Group>
      <Group title="Category">
        {categories.map((c) => (
          <Check key={c.key} label={c.name} checked={filters.categories.includes(c.key)} onChange={() => toggle("categories", c.key)} />
        ))}
      </Group>
      <Group title={material.variantLabel}>
        {material.variantOptions.map((v) => (
          <Check key={v} label={v} checked={filters.variants.includes(v)} onChange={() => toggle("variants", v)} />
        ))}
      </Group>
      <Group title="Metal colour">
        {colours.map((c) => (
          <Check key={c} label={c} checked={filters.colours.includes(c)} onChange={() => toggle("colours", c)} />
        ))}
      </Group>
      <Range
        title="Price"
        max={priceMax}
        value={filters.maxPrice}
        onChange={(v) => setFilters((f) => ({ ...f, maxPrice: v }))}
        format={(v) => `Up to ₹${v.toLocaleString("en-IN")}`}
        emptyNote="Add prices in src/data/products.ts to enable."
      />
      <Range
        title="Weight"
        max={weightMax}
        value={filters.maxWeight}
        onChange={(v) => setFilters((f) => ({ ...f, maxWeight: v }))}
        format={(v) => `Up to ${v} g`}
        emptyNote="Add weights in src/data/products.ts to enable."
      />
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="py-5 first:pt-0">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex min-h-[32px] w-full items-center justify-between text-[12px] font-semibold uppercase tracking-[0.16em]"
      >
        {title}
        <ChevronDown size={16} strokeWidth={1.5} className={cn("transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="mt-3 space-y-1">{children}</div>}
    </div>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label className="flex min-h-[36px] cursor-pointer items-center gap-3 text-[14px]">
      <input type="checkbox" checked={checked} onChange={onChange} className="peer sr-only" />
      <span
        className={cn(
          "grid h-4 w-4 place-items-center border transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-accent",
          checked ? "border-ink bg-ink" : "border-ink/30"
        )}
        aria-hidden
      >
        {checked && <span className="h-1.5 w-1.5 bg-ivory" />}
      </span>
      {label}
    </label>
  );
}

function Range({
  title,
  max,
  value,
  onChange,
  format,
  emptyNote,
}: {
  title: string;
  max: number;
  value: number | null;
  onChange: (v: number | null) => void;
  format: (v: number) => string;
  emptyNote: string;
}) {
  return (
    <Group title={title}>
      {max > 0 ? (
        <div>
          <input
            type="range"
            min={0}
            max={max}
            value={value ?? max}
            onChange={(e) => onChange(Number(e.target.value) >= max ? null : Number(e.target.value))}
            className="w-full accent-[var(--accent)]"
            aria-label={`Maximum ${title.toLowerCase()}`}
          />
          <p className="text-[13px] text-muted">{value == null ? "Any" : format(value)}</p>
        </div>
      ) : (
        <p className="text-[13px] text-muted">{emptyNote}</p>
      )}
    </Group>
  );
}

function BottomSheet({
  open,
  onClose,
  count,
  onClear,
  children,
}: {
  open: boolean;
  onClose: () => void;
  count: number;
  onClear: () => void;
  children: React.ReactNode;
}) {
  const close = useCallback(() => onClose(), [onClose]);
  const drag = useDragControls();
  useModal(open, close);
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-[90] bg-ink/40 lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Filters"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            drag="y"
            dragControls={drag}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => info.offset.y > 120 && close()}
            className="fixed inset-x-0 bottom-0 z-[91] flex max-h-[85vh] flex-col bg-ivory lg:hidden"
          >
            {/* Swipe down on the handle to close */}
            <div
              className="flex cursor-grab touch-none justify-center pb-1 pt-3"
              onPointerDown={(e) => drag.start(e)}
              aria-hidden
            >
              <span className="h-1 w-10 rounded-full bg-line" />
            </div>
            <div className="flex items-center justify-between px-6 py-3">
              <p className="text-[12px] font-semibold uppercase tracking-[0.16em]">Filters</p>
              <button onClick={close} aria-label="Close filters" className="grid h-11 w-11 place-items-center">
                <X size={20} strokeWidth={1.5} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 pb-4" data-lenis-prevent>
              {children}
            </div>
            <div className="grid grid-cols-2 gap-3 border-t border-line p-4">
              <button onClick={onClear} className="btn-secondary">
                Clear
              </button>
              <button onClick={close} className="btn-primary">
                Show {count}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
