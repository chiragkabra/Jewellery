"use client";

import Link from "next/link";
import { Eye } from "lucide-react";
import { materialByKey } from "@/data/materials";
import { useCart } from "@/context/CartContext";
import { useMode } from "@/context/ModeContext";
import { Media } from "@/components/ui/Media";
import type { Product } from "@/lib/types";
import { PriceTag } from "./PriceTag";

interface Props {
  product: Product;
  onQuickView?: (p: Product) => void;
  sizes?: string;
}

export function ProductCard({ product, onQuickView, sizes = "(min-width: 1024px) 25vw, 50vw" }: Props) {
  const { isTrade } = useMode();
  const { addToBag, addToQuote } = useCart();
  const m = materialByKey(product.material);

  const add = () => {
    const item = {
      slug: product.slug,
      name: product.name,
      image: product.images[0],
      material: product.material,
      variant: product.variants[0],
      colour: product.metalColours[0],
    };
    if (isTrade) addToQuote(item, 10);
    else addToBag(item);
  };

  return (
    <article className="group relative flex h-full flex-col" data-material={product.material}>
      <div className="relative overflow-hidden">
        <Link href={`/product/${product.slug}`} aria-label={product.name} className="block">
          <Media
            src={product.images[0]}
            alt={product.name}
            sizes={sizes}
            className="aspect-[4/5]"
            imgClassName="transition-transform duration-[1.2s] ease-lux group-hover:scale-[1.03]"
          />
          {/* Hover swap */}
          <Media
            src={product.images[1] ?? product.images[0]}
            alt=""
            aria-hidden
            sizes={sizes}
            className="!absolute inset-0 opacity-0 transition-opacity duration-700 ease-lux group-hover:opacity-100"
          />
        </Link>
        {product.isNew && (
          <span className="absolute left-3 top-3 bg-ivory px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]">
            New
          </span>
        )}
        <div className="absolute inset-x-3 bottom-3 flex translate-y-2 gap-2 opacity-0 transition-all duration-500 ease-lux group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:translate-y-0 group-hover:opacity-100 max-lg:translate-y-0 max-lg:opacity-100">
          {onQuickView && (
            <button
              onClick={() => onQuickView(product)}
              aria-label={`Quick view ${product.name}`}
              className="grid h-11 w-11 shrink-0 place-items-center bg-ivory text-ink transition-colors hover:bg-ink hover:text-ivory"
            >
              <Eye size={18} strokeWidth={1.5} />
            </button>
          )}
          <button
            onClick={add}
            className="hidden h-11 flex-1 bg-ink text-[11px] font-semibold uppercase tracking-[0.16em] text-ivory transition-colors hover:bg-accent lg:block"
          >
            {isTrade ? "Add to quote" : "Add to bag"}
          </button>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 pt-4">
        <p className="eyebrow !text-[11px]">
          {m.navLabel} · {product.variants.join(" / ")}
        </p>
        <h3 className="font-sans text-[16px] font-medium tracking-normal">
          <Link href={`/product/${product.slug}`} className="hover:text-accent">
            {product.name}
          </Link>
        </h3>
        <div className="mt-auto">
          <PriceTag product={product} compact />
        </div>
      </div>
    </article>
  );
}
