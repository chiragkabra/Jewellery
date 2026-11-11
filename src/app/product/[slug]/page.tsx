import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { catalogue } from "@/lib/server/business";
export const dynamic = "force-dynamic";
const productBySlug = (slug: string) => catalogue().find(p => p.slug === slug);
import { materialByKey } from "@/data/materials";
import { ProductGallery } from "@/components/shop/ProductGallery";
import { ProductDetail } from "@/components/shop/ProductDetail";
import { RelatedProducts } from "@/components/shop/RelatedProducts";

type Params = { slug: string };


export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const p = productBySlug((await params).slug);
  if (!p) return {};
  return { title: p.name, description: p.description };
}

export default async function ProductPage({ params }: { params: Promise<Params> }) {
  const product = productBySlug((await params).slug);
  if (!product) notFound();
  const m = materialByKey(product.material);

  return (
    <div data-material={product.material}>
      <div className="container-site pt-8">
        <nav aria-label="Breadcrumb" className="text-[12px] uppercase tracking-[0.16em] text-muted">
          <Link href="/" className="hover:text-ink">Home</Link> <span aria-hidden>/</span>{" "}
          <Link href={`/${m.slug}`} className="hover:text-ink">{m.name}</Link> <span aria-hidden>/</span>{" "}
          <span className="text-ink">{product.name}</span>
        </nav>
      </div>
      <section className="container-site grid gap-12 py-10 lg:grid-cols-12 lg:gap-16 lg:py-14">
        <div className="lg:col-span-7">
          <div className="lg:sticky lg:top-24">
            <ProductGallery images={product.images} name={product.name} />
          </div>
        </div>
        <div className="lg:col-span-5">
          <ProductDetail product={product} />
        </div>
      </section>
      <RelatedProducts products={catalogue().filter(p => p.slug !== product.slug && (p.material === product.material || p.category === product.category)).slice(0,4)} />
    </div>
  );
}

