import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, Gift, Store, Tag, Truck } from "lucide-react";
import { audiences, included, pricingTable, wholesaleSteps } from "@/data/trade";
import { Media } from "@/components/ui/Media";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { StepTimeline } from "@/components/trade/StepTimeline";
import { TradeApplicationForm } from "@/components/forms/TradeApplicationForm";

export const metadata: Metadata = {
  title: "Wholesale & Private Label",
  description: "Wholesale and private-label gold, sterling silver and diamond jewellery for retailers, distributors, corporate gifting and brands.",
};

const icons = { store: Store, truck: Truck, gift: Gift, tag: Tag };

export default function WholesalePage() {
  return (
    <>
      <section className="overflow-hidden">
        <div className="container-site grid items-center gap-12 py-14 lg:grid-cols-12 lg:py-20">
          <Reveal className="lg:col-span-6">
            <p className="eyebrow mb-6">Wholesale · Private label</p>
            <h1 className="display-1">Stock that sells. Made to your brief.</h1>
            <p className="lede mt-8 max-w-[52ch]">
              For retailers, distributors, corporate gifting and private-label brands. Metal-linked pricing, samples
              before production, and hallmarked, certified delivery.
            </p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <a href="#apply" className="btn-primary">Open a trade account <ArrowRight size={16} strokeWidth={1.5} /></a>
              <a href="#pricing" className="btn-secondary">See MOQ & pricing</a>
            </div>
          </Reveal>
          <Reveal delay={0.1} className="lg:col-span-6">
            <Media src="/images/wholesale-hero.jpg" alt="Rows of gold and silver rings on display" priority sizes="(min-width: 1024px) 50vw, 100vw" className="aspect-[4/5] lg:aspect-[5/5]" />
          </Reveal>
        </div>
      </section>

      <section className="section bg-sand">
        <div className="container-site">
          <SectionHeading eyebrow="Who we serve" title="Built for businesses of every size." />
          <ul className="grid gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
            {audiences.map((a, i) => {
              const Icon = icons[a.icon];
              return (
                <Reveal as="li" key={a.title} delay={i * 0.06} className="bg-ivory p-8">
                    <Icon size={28} strokeWidth={1.5} className="text-accent" />
                    <h3 className="mt-8 font-display text-[26px]">{a.title}</h3>
                    <p className="mt-3 text-[15px] leading-relaxed text-muted">{a.body}</p>
                </Reveal>
              );
            })}
          </ul>
        </div>
      </section>

      <section id="how-it-works" className="section">
        <div className="container-site">
          <SectionHeading eyebrow="How it works" title="Four steps from enquiry to delivery." />
          <StepTimeline steps={wholesaleSteps} />
        </div>
      </section>

      <section id="pricing" className="section bg-ink text-ivory">
        <div className="container-site">
          <SectionHeading
            dark
            eyebrow="MOQ & pricing"
            title="Transparent, metal-linked terms."
            lede="Indicative terms per material. Your trade account shows live pricing against today’s rate."
          />
          <Reveal className="-mx-6 overflow-x-auto px-6">
            <table className="w-full min-w-[640px] border-collapse text-left text-[15px]">
              <caption className="sr-only">Minimum order and pricing by material</caption>
              <thead>
                <tr className="border-b border-ivory/20">
                  <th scope="col" className="py-4 pr-6 text-[12px] font-semibold uppercase tracking-[0.16em] text-ivory/60">Term</th>
                  {pricingTable.columns.map((c, i) => (
                    <th
                      key={c}
                      scope="col"
                      data-material={["gold", "silver", "diamond"][i]}
                      className="py-4 pr-6 font-display text-[22px] font-normal text-accent-light"
                    >
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pricingTable.rows.map((r) => (
                  <tr key={r.label} className="border-b border-ivory/10">
                    <th scope="row" className="py-4 pr-6 font-normal text-ivory/60">{r.label}</th>
                    {r.values.map((v, i) => (
                      <td key={i} className="py-4 pr-6">{v}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </Reveal>
        </div>
      </section>

      <section className="section">
        <div className="container-site">
          <SectionHeading eyebrow="What’s included" title="More than a price list." />
          <ul className="grid gap-x-10 gap-y-10 sm:grid-cols-2">
            {included.map((x, i) => (
              <Reveal as="li" key={x.title} delay={i * 0.06} className="flex gap-5 border-t border-line pt-6">
                  <Check size={22} strokeWidth={1.5} className="mt-1 shrink-0 text-accent" />
                  <div>
                    <h3 className="font-display text-[26px]">{x.title}</h3>
                    <p className="mt-2 text-[15px] leading-relaxed text-muted">{x.body}</p>
                  </div>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      <section id="apply" className="section bg-sand">
        <div className="container-site grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <p className="eyebrow mb-4">Trade account</p>
            <h2 className="display-2">Apply for trade access.</h2>
            <p className="lede mt-6">
              Approved accounts get trade pricing, line sheets, sample requests and the full catalogue.
            </p>
            <p className="mt-6 text-[14px] text-muted">
              Prefer to talk first? <Link href="/contact" className="underline underline-offset-4">Contact our trade desk</Link>.
            </p>
          </div>
          <div className="lg:col-span-8">
            <TradeApplicationForm />
          </div>
        </div>
      </section>
    </>
  );
}
