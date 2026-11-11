import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { site } from "@/data/site";
import { footerNav, legalNav } from "@/data/navigation";
import { NewsletterForm } from "@/components/forms/NewsletterForm";

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-ivory/10 bg-ink text-ivory">
      <div className="container-site grid gap-12 pb-12 pt-20 md:grid-cols-12">
        <div className="md:col-span-4">
          <Link href="/" className="font-display text-[30px] tracking-[0.18em]">
            {site.name}
          </Link>
          <p className="mt-5 max-w-sm text-[15px] leading-relaxed text-ivory/70">{site.tagline}</p>
          <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-ivory/70">
            Retail, wholesale & private label, and import & export — from one workshop for {site.yearsInBusiness}{" "}
            years.
          </p>
        </div>

        {footerNav.map((col) => (
          <div key={col.title} className="md:col-span-2">
            <p className="mb-5 text-[12px] font-semibold uppercase tracking-[0.2em] text-accent-light">{col.title}</p>
            <ul className="space-y-3">
              {col.links.map((l) => (
                <li key={l.href + l.label}>
                  <Link href={l.href} className="text-[15px] text-ivory/80 transition-colors hover:text-ivory">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div className="md:col-span-2">
          <p className="mb-5 text-[12px] font-semibold uppercase tracking-[0.2em] text-accent-light">Contact</p>
          <ul className="space-y-3 text-[15px] text-ivory/80">
            <li>{site.contact.phone}</li>
            <li>{site.contact.email}</li>
            <li>{site.contact.address}</li>
            <li>{site.contact.hours}</li>
          </ul>
        </div>
      </div>

      <div className="container-site">
        <div className="grid gap-10 border-t border-ivory/15 py-12 md:grid-cols-12">
        <div className="md:col-span-7">
          <p className="mb-5 text-[12px] font-semibold uppercase tracking-[0.2em] text-ivory/60">Certifications</p>
          <ul className="flex flex-wrap gap-3">
            {site.certifications.map((c) => (
              <li
                key={c}
                className="inline-flex min-h-[40px] items-center gap-2 border border-ivory/20 px-4 text-[13px] text-ivory/80"
              >
                <ShieldCheck size={15} strokeWidth={1.5} className="text-accent-light" />
                {c}
              </li>
            ))}
          </ul>
        </div>
        <div className="md:col-span-5">
          <p className="mb-5 text-[12px] font-semibold uppercase tracking-[0.2em] text-ivory/60">
            New collections & rate alerts
          </p>
          <NewsletterForm />
        </div>
        </div>
      </div>

      <div className="container-site">
        <div className="flex flex-col gap-4 border-t border-ivory/15 pb-24 pt-8 text-[13px] text-ivory/60 md:flex-row md:items-center md:justify-between md:pb-8">
        <p>
          © {year} {site.legalName}. GSTIN {site.identifiers.gstin} · IEC {site.identifiers.iec}
        </p>
        <ul className="flex flex-wrap gap-6">
          {legalNav.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="hover:text-ivory">
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
        </div>
      </div>
    </footer>
  );
}
