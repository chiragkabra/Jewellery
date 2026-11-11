"use client";

import { useState } from "react";
import type { Product } from "@/lib/types";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { ProductCard } from "./ProductCard";
import { QuickView } from "./QuickView";

export function RelatedProducts({ products }: { products: Product[] }) {
  const [quick, setQuick] = useState<Product | null>(null);
  if (!products.length) return null;
  return (
    <section className="section border-t border-line bg-sand">
      <div className="container-site">
        <SectionHeading eyebrow="You may also like" title="Related pieces." />
        <ul className="grid grid-cols-2 gap-x-4 gap-y-10 md:gap-x-6 lg:grid-cols-4">
          {products.map((p) => (
            <li key={p.slug}>
              <ProductCard product={p} onQuickView={setQuick} />
            </li>
          ))}
        </ul>
      </div>
      <QuickView product={quick} onClose={() => setQuick(null)} />
    </section>
  );
}
