"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { categories } from "@/data/categories";
import { useLens } from "@/context/LensContext";
import { Media } from "@/components/ui/Media";
import { SectionHeading } from "@/components/ui/SectionHeading";

export function ShopByCategory() {
  const { lens } = useLens();
  const base = lens === "all" || lens === "gold" ? "/gold" : lens === "silver" ? "/silver" : "/diamonds";

  return (
    <section className="section">
      <div className="container-site">
        <SectionHeading eyebrow="Shop by category" title="Find the piece." align="center" />
        <ul className="grid grid-cols-3 gap-x-4 gap-y-10 md:grid-cols-6 md:gap-x-6">
          {categories.map((c, i) => (
            <motion.li
              key={c.key}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
            >
              <Link href={`${base}?category=${c.key}`} className="group flex flex-col items-center text-center">
                <span className="block w-full overflow-hidden rounded-full ring-1 ring-line transition-[box-shadow] duration-500 group-hover:ring-accent">
                  <Media
                    src={c.image}
                    alt={c.name}
                    sizes="(min-width: 768px) 16vw, 33vw"
                    className="aspect-square rounded-full"
                    imgClassName="transition-transform duration-[1.2s] ease-lux group-hover:scale-[1.08]"
                  />
                </span>
                <span className="mt-4 text-[14px] font-medium tracking-[0.02em] transition-colors group-hover:text-accent">
                  {c.name}
                </span>
              </Link>
            </motion.li>
          ))}
        </ul>
      </div>
    </section>
  );
}
