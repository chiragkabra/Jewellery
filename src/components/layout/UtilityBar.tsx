import Link from "next/link";
import { Mail, Phone } from "lucide-react";
import { site } from "@/data/site";

export function UtilityBar() {
  return (
    <div className="bg-ink text-ivory">
      <div className="container-site flex min-h-[40px] items-center justify-between gap-4 text-[12px] tracking-[0.08em]">
        <p className="truncate text-[10.5px] uppercase tracking-[0.14em] text-ivory/80 sm:text-[12px] sm:tracking-[0.18em]">
          {site.channels.join(" · ")}
        </p>
        <div className="flex shrink-0 items-center gap-5">
          <span className="hidden items-center gap-2 text-ivory/80 md:inline-flex">
            <span className="uppercase tracking-[0.18em] text-ivory/50">Trade desk</span>
            <Phone size={13} strokeWidth={1.5} /> {site.contact.tradePhone}
          </span>
          <span className="hidden items-center gap-2 text-ivory/80 lg:inline-flex">
            <Mail size={13} strokeWidth={1.5} /> {site.contact.tradeEmail}
          </span>
          <Link
            href="/account"
            className="inline-flex min-h-[40px] items-center whitespace-nowrap text-[10.5px] font-semibold uppercase tracking-[0.14em] text-accent-light hover:text-ivory sm:text-[12px] sm:tracking-[0.18em]"
          >
            Trade login
          </Link>
        </div>
      </div>
    </div>
  );
}
