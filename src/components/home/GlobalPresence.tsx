import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { site } from "@/data/site";
import { markets } from "@/data/markets";
import { getWorldMapData } from "@/components/shared/worldMapData";
import { WorldMap } from "@/components/shared/WorldMap";
import { SectionHeading } from "@/components/ui/SectionHeading";

export function GlobalPresence() {
  const data = getWorldMapData();
  return (
    <section className="section">
      <div className="container-site">
        <SectionHeading
          eyebrow="Global presence"
          title="Made in India. Shipped to the world."
          lede={`From our workshop in ${site.hq.label}, we export finished jewellery and import diamonds and components — insured, documented and tracked.`}
          action={
            <Link href="/import-export" className="link-underline">
              Import & export <ArrowRight size={14} strokeWidth={1.5} />
            </Link>
          }
        />
        <WorldMap data={data} />
        <ul className="mt-10 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-line pt-8 sm:grid-cols-4">
          {markets.map((m, i) => (
            <li key={i} className="flex items-center gap-3 text-[14px]">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
              <span>{m.region}</span>
              <span className="text-[12px] text-muted">[confirm]</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
