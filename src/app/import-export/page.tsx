import type { Metadata } from "next";
import { ArrowRight, Factory, FileText, Gem, Ship } from "lucide-react";
import { complianceDocs, exportServices, exportSteps, incoterms, shippingPartners } from "@/data/trade";
import { markets } from "@/data/markets";
import { getWorldMapData } from "@/components/shared/worldMapData";
import { WorldMap } from "@/components/shared/WorldMap";
import { Media } from "@/components/ui/Media";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { StepTimeline } from "@/components/trade/StepTimeline";
import { TradeEnquiryForm } from "@/components/forms/TradeEnquiryForm";

export const metadata: Metadata = {
  title: "Import & Export",
  description: "Export of finished gold, silver and diamond jewellery, sourcing and import of loose diamonds and components, and contract manufacturing.",
};

const icons = { ship: Ship, gem: Gem, factory: Factory };

export default function ImportExportPage() {
  const map = getWorldMapData();
  return (
    <>
      <section className="overflow-hidden">
        <div className="container-site grid items-center gap-12 py-14 lg:grid-cols-12 lg:py-20">
          <Reveal className="lg:col-span-6">
            <p className="eyebrow mb-6">Import · Export · Contract manufacturing</p>
            <h1 className="display-1">From our bench to your market.</h1>
            <p className="lede mt-8 max-w-[52ch]">
              Finished jewellery for overseas buyers, sourcing of loose diamonds and components, and manufacturing
              capacity for your own designs — documented, certified and insured end to end.
            </p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <a href="#rfq" className="btn-primary">Send an RFQ <ArrowRight size={16} strokeWidth={1.5} /></a>
              <a href="#compliance" className="btn-secondary">Documents & compliance</a>
            </div>
          </Reveal>
          <Reveal delay={0.1} className="lg:col-span-6">
            <Media src="/images/export-hero.jpg" alt="Container port seen from above" priority sizes="(min-width: 1024px) 50vw, 100vw" className="aspect-[4/5] lg:aspect-square" />
          </Reveal>
        </div>
      </section>

      <section className="section bg-sand">
        <div className="container-site">
          <SectionHeading eyebrow="Services" title="Three ways we work across borders." />
          <ul className="grid gap-6 md:grid-cols-3">
            {exportServices.map((s, i) => {
              const Icon = icons[s.icon];
              return (
                <Reveal as="li" key={s.title} delay={i * 0.08} className="flex flex-col border border-line bg-ivory p-8">
                  <Icon size={30} strokeWidth={1.5} className="text-accent" />
                  <h3 className="mt-10 font-display text-[28px] leading-tight">{s.title}</h3>
                  <p className="mt-4 text-[15px] leading-relaxed text-muted">{s.body}</p>
                </Reveal>
              );
            })}
          </ul>
        </div>
      </section>

      <section className="section">
        <div className="container-site">
          <SectionHeading eyebrow="Markets" title="Where we ship." lede="Markets below are placeholders — replace with confirmed destinations in src/data/markets.ts." />
          <WorldMap data={map} />
          <ul className="mt-12 grid grid-cols-2 gap-px border border-line bg-line md:grid-cols-4">
            {markets.map((m, i) => (
              <li key={i} className="bg-ivory p-6">
                <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-accent">{m.region}</p>
                <p className="mt-2 font-display text-[20px]">{m.name}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section bg-ink text-ivory">
        <div className="container-site">
          <SectionHeading dark eyebrow="Process" title="Five steps, fully documented." />
          <StepTimeline steps={exportSteps} dark />
        </div>
      </section>

      <section id="compliance" className="section">
        <div className="container-site grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <SectionHeading
              className="!mb-0"
              eyebrow="Compliance & documents"
              title="Paperwork that clears customs."
              lede="Every shipment travels with the documents your market requires. Exact documents depend on destination and product."
            />
          </div>
          <div className="lg:col-span-7">
            <ul className="divide-y divide-line border-y border-line">
              {complianceDocs.map((d) => (
                <li key={d} className="flex min-h-[64px] items-center justify-between gap-4 py-3">
                  <span className="flex items-center gap-4 text-[16px]">
                    <FileText size={20} strokeWidth={1.5} className="shrink-0 text-accent" /> {d}
                  </span>
                  <span className="shrink-0 text-[12px] text-muted">[confirm with client]</span>
                </li>
              ))}
            </ul>
            <div className="mt-10 grid gap-8 sm:grid-cols-2">
              <div>
                <p className="field-label">Incoterms offered</p>
                <ul className="flex flex-wrap gap-2">
                  {incoterms.map((t) => (
                    <li key={t} className="chip !text-ink">{t}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="field-label">Shipping partners</p>
                <ul className="flex flex-wrap gap-2">
                  {shippingPartners.map((t) => (
                    <li key={t} className="chip">{t}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="rfq" className="section bg-sand">
        <div className="container-site grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <p className="eyebrow mb-4">Request for quotation</p>
            <h2 className="display-2">Start an export or sourcing enquiry.</h2>
            <p className="lede mt-6">Share specifications, quantities and your destination market. We reply with a formal quotation.</p>
          </div>
          <div className="lg:col-span-7">
            <TradeEnquiryForm />
          </div>
        </div>
      </section>
    </>
  );
}
