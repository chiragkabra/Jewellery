import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { channels } from "@/data/home";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";

export function ThreeWays() {
  return (
    <section className="section bg-ink text-ivory">
      <div className="container-site">
        <SectionHeading
          dark
          eyebrow="How to buy"
          title={
            <>
              One house, <em className="text-accent-light">three ways</em> to buy.
            </>
          }
        />
        <div className="grid md:grid-cols-3 md:divide-x md:divide-ivory/15">
          {channels.map((c, i) => (
            <Reveal key={c.title} delay={i * 0.1} className="flex flex-col md:px-8 md:first:pl-0 md:last:pr-0">
              <div className="flex h-full flex-col border-t border-ivory/15 pt-8 md:border-t-0 md:pt-0">
                <span className="font-display text-[64px] leading-none text-accent-light">0{i + 1}</span>
                <h3 className="mt-6 font-display text-[30px]">{c.title}</h3>
                <p className="mt-4 flex-1 text-[15px] leading-relaxed text-ivory/70">{c.body}</p>
                <Link href={c.href} className="link-underline mt-8 w-fit pb-8 text-ivory md:pb-0">
                  {c.cta} <ArrowRight size={14} strokeWidth={1.5} />
                </Link>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
