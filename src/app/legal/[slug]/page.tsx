import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { site } from "@/data/site";

const pages: Record<string, string> = {
  privacy: "Privacy policy",
  terms: "Terms & conditions",
  shipping: "Shipping & returns",
};

type Params = { slug: string };

export function generateStaticParams() {
  return Object.keys(pages).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  return { title: pages[(await params).slug] ?? "Legal" };
}

export default async function LegalPage({ params }: { params: Promise<Params> }) {
  const title = pages[(await params).slug];
  if (!title) notFound();
  return (
    <section className="section">
      <div className="container-site max-w-3xl">
        <p className="eyebrow mb-6">Legal</p>
        <h1 className="display-2">{title}</h1>
        <p className="lede mt-8">
          [{title} for {site.legalName} — to be drafted and reviewed by your legal advisor before launch.]
        </p>
      </div>
    </section>
  );
}
