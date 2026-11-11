"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, X } from "lucide-react";
import { materialByKey } from "@/data/materials";
import { categoryName } from "@/data/categories";
import { useCart } from "@/context/CartContext";
import { useMode } from "@/context/ModeContext";
import { useModal } from "@/lib/hooks";
import { Media } from "@/components/ui/Media";
import type { Product } from "@/lib/types";
import { cn } from "@/lib/utils";
import { PriceTag } from "./PriceTag";

export function QuickView({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const close = useCallback(() => onClose(), [onClose]);
  useModal(product !== null, close);

  return (
    <AnimatePresence>
      {product && (
        <motion.div
          className="fixed inset-0 z-[90] grid place-items-center bg-ink/50 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={close}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={`Quick view: ${product.name}`}
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="relative grid max-h-[90vh] w-full max-w-4xl overflow-y-auto bg-ivory md:grid-cols-2"
            data-material={product.material}
            data-lenis-prevent
          >
            <button
              onClick={close}
              aria-label="Close quick view"
              className="absolute right-2 top-2 z-10 grid h-11 w-11 place-items-center bg-ivory"
            >
              <X size={20} strokeWidth={1.5} />
            </button>
            <Body product={product} onDone={close} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Body({ product, onDone }: { product: Product; onDone: () => void }) {
  const { isTrade } = useMode();
  const { addToBag, addToQuote } = useCart();
  const [variant, setVariant] = useState(product.variants[0]);
  const [colour, setColour] = useState(product.metalColours[0]);
  const [img, setImg] = useState(0);
  useEffect(() => {
    setVariant(product.variants[0]);
    setColour(product.metalColours[0]);
    setImg(0);
  }, [product]);
  const m = materialByKey(product.material);

  const add = () => {
    const item = { slug: product.slug, name: product.name, image: product.images[0], material: product.material, variant, colour };
    onDone();
    if (isTrade) addToQuote(item, 10);
    else addToBag(item);
  };

  return (
    <>
      <div>
        <Media src={product.images[img]} alt={product.name} sizes="450px" className="aspect-[4/5]" />
        <div className="grid grid-cols-4 gap-1 p-1">
          {product.images.map((src, i) => (
            <button
              key={src}
              onClick={() => setImg(i)}
              aria-label={`View image ${i + 1}`}
              className={cn("border", i === img ? "border-ink" : "border-transparent")}
            >
              <Media src={src} alt="" sizes="100px" className="aspect-square" />
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-5 p-6 md:p-8">
        <p className="eyebrow">
          {m.name} · {categoryName(product.category)}
        </p>
        <h2 className="display-3">{product.name}</h2>
        <p className="text-muted">{product.description}</p>
        <PriceTag product={product} variant={variant} />

        <Selector label={m.variantLabel} options={product.variants} value={variant} onChange={setVariant} />
        <Selector label="Metal colour" options={product.metalColours} value={colour} onChange={setColour} />

        <div className="mt-auto flex flex-col gap-3 pt-2">
          <button onClick={add} className="btn-primary w-full">
            {isTrade ? "Add to quote" : "Add to bag"}
          </button>
          <Link href={`/product/${product.slug}`} onClick={onDone} className="link-underline w-fit">
            View full details <ArrowRight size={14} strokeWidth={1.5} />
          </Link>
        </div>
      </div>
    </>
  );
}

export function Selector({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <fieldset>
      <legend className="field-label">
        {label}: <span className="normal-case tracking-normal text-ink">{value}</span>
      </legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            aria-pressed={o === value}
            onClick={() => onChange(o)}
            className={cn(
              "min-h-[44px] min-w-[52px] border px-3 text-[13px] transition-colors",
              o === value ? "border-ink bg-ink text-ivory" : "border-line hover:border-ink"
            )}
          >
            {o}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
