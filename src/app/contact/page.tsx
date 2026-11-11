import type { Metadata } from "next";
import { Clock, Mail, MapPin, Phone } from "lucide-react";
import { site } from "@/data/site";
import { Reveal } from "@/components/ui/Reveal";
import { ContactForm } from "@/components/forms/ContactForm";

export const metadata: Metadata = { title: "Contact", description: `Contact ${site.name} — retail, trade and export enquiries.` };

const desks = [
  { title: "Retail & appointments", phone: site.contact.phone, email: site.contact.email },
  { title: "Trade desk — wholesale, import & export", phone: site.contact.tradePhone, email: site.contact.tradeEmail },
];

export default function ContactPage() {
  return (
    <section className="section">
      <div className="container-site grid gap-16 lg:grid-cols-12">
        <Reveal className="lg:col-span-5">
          <p className="eyebrow mb-6">Contact</p>
          <h1 className="display-1">Let’s talk.</h1>
          <p className="lede mt-6">Book a showroom appointment, ask about a piece, or speak to our trade desk.</p>
          <div className="mt-12 space-y-10">
            {desks.map((d) => (
              <div key={d.title} className="border-t border-line pt-6">
                <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-accent">{d.title}</p>
                <p className="mt-4 flex items-center gap-3"><Phone size={16} strokeWidth={1.5} className="text-muted" /> {d.phone}</p>
                <p className="mt-2 flex items-center gap-3"><Mail size={16} strokeWidth={1.5} className="text-muted" /> {d.email}</p>
              </div>
            ))}
            <div className="border-t border-line pt-6">
              <p className="flex items-start gap-3"><MapPin size={16} strokeWidth={1.5} className="mt-1.5 text-muted" /> {site.contact.address}</p>
              <p className="mt-2 flex items-center gap-3"><Clock size={16} strokeWidth={1.5} className="text-muted" /> {site.contact.hours}</p>
            </div>
          </div>
        </Reveal>
        <Reveal delay={0.1} className="lg:col-span-7">
          <div className="border border-line bg-sand p-6 sm:p-10">
            <ContactForm />
          </div>
          <div className="mt-6 grid aspect-[16/7] place-items-center border border-dashed border-ink/20 bg-sand text-[13px] text-muted">
            [Map embed — add a Google Maps iframe for the showroom]
          </div>
        </Reveal>
      </div>
    </section>
  );
}
