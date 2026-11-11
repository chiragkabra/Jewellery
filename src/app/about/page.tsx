import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { site } from "@/data/site";
import { craftSteps } from "@/data/home";
import { Media } from "@/components/ui/Media";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Stats } from "@/components/home/Stats";

export const metadata: Metadata = { title: "About", description: `About ${site.name} — jewellery manufacturer.` };

export default function AboutPage() {
  return (
    <>
      <section className="container-site grid items-end gap-12 py-14 lg:grid-cols-12 lg:py-20">
        <Reveal className="lg:col-span-7">
          <p className="eyebrow mb-6">About {site.name}</p>
          <h1 className="display-1">A workshop first. A jewellery house second.</h1>
        </Reveal>
        <Reveal delay={0.1} className="lg:col-span-5">
          <p className="lede">
            [Founding story — who started the business, when and where, and what it set out to do. Keep it to two or
            three sentences.] For {site.yearsInBusiness} years we have designed and manufactured gold, sterling silver
            and diamond jewellery under one roof.
          </p>
        </Reveal>
      </section>

      <section className="container-site grid gap-6 pb-16 md:grid-cols-12">
        <Reveal className="md:col-span-7">
          <Media src="/images/about-workshop.jpg" alt="Our workshop" priority sizes="(min-width: 768px) 58vw, 100vw" className="aspect-[4/5]" />
        </Reveal>
        <Reveal delay={0.1} className="flex flex-col justify-end gap-6 md:col-span-5">
          <Media src="/images/about-team.jpg" alt="Our team" sizes="(min-width: 768px) 42vw, 100vw" className="aspect-[4/3]" />
          <p className="text-[15px] leading-relaxed text-muted">
            [Workshop details — location, team size, capabilities such as CAD, casting, setting, plating and in-house
            quality control. Confirm all figures before publishing.]
          </p>
        </Reveal>
      </section>

      <Stats />

      <section id="craft" className="section">
        <div className="container-site">
          <SectionHeading eyebrow="Craftsmanship" title="Every piece passes five benches." />
          <ol className="grid gap-px border border-line bg-line md:grid-cols-5">
            {craftSteps.map((s, i) => (
              <Reveal as="li" key={s.title} delay={i * 0.06} className="bg-ivory p-6">
                <span className="font-display text-[40px] leading-none text-accent">0{i + 1}</span>
                <h3 className="mt-6 font-display text-[24px]">{s.title}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-muted">{s.body}</p>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      <section id="certifications" className="section bg-ink text-ivory">
        <div className="container-site grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <p className="eyebrow mb-4 text-accent-light">Certifications</p>
            <h2 className="display-2">Assured, hallmarked, accountable.</h2>
            <p className="lede mt-6 text-ivory/70">
              [List only certifications and memberships you hold — each needs a current certificate number.]
            </p>
          </div>
          <ul className="grid gap-px self-start bg-ivory/15 sm:grid-cols-2 lg:col-span-7">
            {site.certifications.map((c) => (
              <li key={c} className="flex min-h-[88px] items-center gap-4 bg-ink p-6">
                <ShieldCheck size={22} strokeWidth={1.5} className="text-accent-light" />
                <span className="text-[16px]">{c}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section">
        <div className="container-site flex flex-col items-start justify-between gap-8 md:flex-row md:items-end">
          <h2 className="display-2 max-w-xl">Visit the workshop or talk to our trade desk.</h2>
          <Link href="/contact" className="btn-primary">Contact us <ArrowRight size={16} strokeWidth={1.5} /></Link>
        </div>
      </section>
    </>
  );
}
