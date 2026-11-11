import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { materials, materialBySlug } from "@/data/materials";
import { products } from "@/data/products";
import { Media } from "@/components/ui/Media";
import { Reveal } from "@/components/ui/Reveal";
import { RateCard } from "@/components/shop/RateCard";
import { CollectionView } from "@/components/shop/CollectionView";

type Params = { material: string };

export function generateStaticParams() {
  return materials.map((m) => ({ material: m.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const m = materialBySlug((await params).material);
  if (!m) return {};
  return { title: `${m.name} Jewellery`, description: m.description, alternates: { canonical: `/${m.slug}` } };
}

export default async function CollectionPage({ params }: { params: Promise<Params> }) {
  const m = materialBySlug((await params).material);
  if (!m) notFound();
  const list = products.filter((p) => p.material === m.key);

  return (
    // Scoped tint: this page always wears its own material's accent.
    <div data-material={m.key}>
      {/* Hero */}
      <section className="relative overflow-hidden bg-accent/[0.07]">
        <div className="container-site grid items-center gap-12 py-14 lg:grid-cols-12 lg:py-20">
          <Reveal className="lg:col-span-5">
            <nav aria-label="Breadcrumb" className="mb-8 text-[12px] uppercase tracking-[0.16em] text-muted">
              <Link href="/" className="hover:text-ink">Home</Link> <span aria-hidden>/</span> {m.name}
            </nav>
            <p className="eyebrow mb-5">{m.purities.join(" · ")}</p>
            <h1 className="display-1">{m.name}</h1>
            <p className="lede mt-6 max-w-[48ch]">{m.description}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a href="#collection" className="btn-primary">Shop retail <ArrowRight size={16} strokeWidth={1.5} /></a>
              <Link href="/wholesale" className="btn-secondary">Buy wholesale</Link>
            </div>
          </Reveal>
          <Reveal delay={0.1} className="lg:col-span-4">
            <Media src={m.heroImage} alt={`${m.name} collection`} priority sizes="(min-width: 1024px) 33vw, 100vw" className="aspect-[4/5]" />
          </Reveal>
          <Reveal delay={0.2} className="lg:col-span-3">
            <RateCard material={m} />
          </Reveal>
        </div>
      </section>

      {/* Material guide */}
      <section className="border-b border-line">
        <div className="container-site py-12">
          <p className="eyebrow mb-6">{m.guideTitle}</p>
          <ul className="grid gap-px overflow-hidden border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
            {m.guide.map((g) => (
              <li key={g.title} className="bg-ivory p-6">
                <p className="font-display text-[28px] leading-none text-accent">{g.title}</p>
                <p className="mt-3 text-[14px] leading-relaxed text-muted">{g.detail}</p>
              </li>
            ))}
          </ul>
          {m.guideNote && (
            <ul className="mt-4 grid gap-4 sm:grid-cols-2">
              {m.guideNote.map((g) => (
                <li key={g.title} className="flex gap-4 border border-line bg-sand p-6">
                  <p className="w-28 shrink-0 font-display text-[22px] leading-tight">{g.title}</p>
                  <p className="text-[14px] leading-relaxed text-muted">{g.detail}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <Suspense>
        <CollectionView material={m} products={list} />
      </Suspense>
    </div>
  );
}
