"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { materials } from "@/data/materials";
import { useLens } from "@/context/LensContext";
import { Media } from "@/components/ui/Media";
import { SectionHeading } from "@/components/ui/SectionHeading";

export function ShopByMaterial() {
  const { lens } = useLens();
  // Active lens material moves to the front.
  const ordered = [...materials].sort((a, b) => Number(b.key === lens) - Number(a.key === lens));

  return (
    <section className="section">
      <div className="container-site">
        <SectionHeading
          eyebrow="Shop by material"
          title="Three materials, one standard."
          lede="Every piece is made in our workshop and sold retail, wholesale or for export. Choose where to begin."
        />
        <div className="grid gap-6 md:grid-cols-3">
          {ordered.map((m, i) => (
            <motion.article
              layout
              key={m.key}
              data-material={m.key}
              initial={{ opacity: 0, y: 32 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-10% 0px" }}
              transition={{ duration: 0.9, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
              className="group flex flex-col"
            >
              <Link href={`/${m.slug}`} className="block overflow-hidden">
                <Media
                  src={m.cardImage}
                  alt={m.name}
                  sizes="(min-width: 768px) 33vw, 100vw"
                  className="aspect-[4/5]"
                  imgClassName="transition-transform duration-[1.4s] ease-lux group-hover:scale-[1.04]"
                />
              </Link>
              <div className="flex flex-1 flex-col border-b border-line pb-6 pt-6">
                <p className="eyebrow mb-3">{m.name}</p>
                <h3 className="display-3">{m.tagline}</h3>
                <ul className="mt-5 flex flex-wrap gap-2">
                  {m.purities.map((p) => (
                    <li key={p} className="chip">
                      {p}
                    </li>
                  ))}
                </ul>
                <div className="mt-6 flex flex-wrap gap-x-8 gap-y-3">
                  <Link href={`/${m.slug}`} className="link-underline text-ink">
                    Shop retail <ArrowRight size={14} strokeWidth={1.5} />
                  </Link>
                  <Link href="/wholesale" className="link-underline text-accent">
                    Buy wholesale <ArrowRight size={14} strokeWidth={1.5} />
                  </Link>
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
