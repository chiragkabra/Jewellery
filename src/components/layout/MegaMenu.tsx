"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { categories } from "@/data/categories";
import { materialByKey } from "@/data/materials";
import { Media } from "@/components/ui/Media";
import type { MaterialKey } from "@/lib/types";

interface Props {
  material: MaterialKey;
  onNavigate: () => void;
}

export function MegaMenu({ material, onNavigate }: Props) {
  const m = materialByKey(material);
  const base = `/${m.slug}`;

  return (
    <motion.div
      data-material={material}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="absolute inset-x-0 top-full border-b border-t border-line bg-ivory shadow-[0_24px_48px_-24px_rgba(23,22,26,0.18)]"
    >
      <div className="container-site grid grid-cols-12 gap-10 py-10">
        <div className="col-span-3">
          <p className="eyebrow mb-3">{m.name}</p>
          <p className="font-display text-[26px] leading-tight">{m.tagline}</p>
          <div className="mt-6 flex flex-col gap-3">
            <Link href={base} onClick={onNavigate} className="link-underline w-fit">
              Shop retail <ArrowRight size={14} strokeWidth={1.5} />
            </Link>
            <Link href="/wholesale" onClick={onNavigate} className="link-underline w-fit">
              Buy wholesale <ArrowRight size={14} strokeWidth={1.5} />
            </Link>
          </div>
        </div>

        <div className="col-span-3">
          <p className="mb-4 text-[12px] font-semibold uppercase tracking-[0.16em] text-muted">Categories</p>
          <ul className="space-y-2.5">
            {categories.map((c) => (
              <li key={c.key}>
                <Link
                  href={`${base}?category=${c.key}`}
                  onClick={onNavigate}
                  className="text-[15px] transition-colors hover:text-accent"
                >
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="col-span-2">
          <p className="mb-4 text-[12px] font-semibold uppercase tracking-[0.16em] text-muted">{m.variantLabel}</p>
          <ul className="space-y-2.5">
            {m.variantOptions.map((v) => (
              <li key={v}>
                <Link
                  href={`${base}?variant=${encodeURIComponent(v)}`}
                  onClick={onNavigate}
                  className="text-[15px] transition-colors hover:text-accent"
                >
                  {v}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <Link href={base} onClick={onNavigate} className="group col-span-4 block">
          <Media
            src={m.megaImage}
            alt={`${m.name} — featured`}
            sizes="400px"
            className="aspect-[4/3]"
            imgClassName="transition-transform duration-[1.2s] ease-lux group-hover:scale-[1.04]"
          />
          <p className="mt-3 flex items-center justify-between text-[13px] font-semibold uppercase tracking-[0.14em]">
            Featured in {m.navLabel}
            <ArrowRight size={14} strokeWidth={1.5} className="transition-transform group-hover:translate-x-1" />
          </p>
        </Link>
      </div>
    </motion.div>
  );
}
