"use client";

import { FileText, MessageCircle } from "lucide-react";
import { site } from "@/data/site";
import { useCart } from "@/context/CartContext";

/** Bottom-right: WhatsApp enquiry + "Request a quote" drawer trigger. */
export function FloatingActions() {
  const { openDrawer, quote } = useCart();
  const number = site.contact.whatsapp.replace(/\D/g, "");
  const href = number
    ? `https://wa.me/${number}?text=${encodeURIComponent(site.contact.whatsappMessage)}`
    : "/contact"; // falls back until a WhatsApp number is set in src/data/site.ts

  return (
    <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
      <button
        onClick={() => openDrawer("quote")}
        className="flex h-12 items-center gap-2 bg-ink px-4 ring-1 ring-ivory/25 text-[11px] font-semibold uppercase tracking-[0.16em] text-ivory shadow-[0_12px_32px_-12px_rgba(23,22,26,0.5)] transition-colors hover:bg-accent"
      >
        <FileText size={16} strokeWidth={1.5} />
        <span className="hidden sm:inline">Request a quote</span>
        <span className="sm:hidden">Quote</span>
        {quote.length > 0 && <span className="ml-1 text-accent-light">({quote.length})</span>}
      </button>
      <a
        href={href}
        target={number ? "_blank" : undefined}
        rel="noopener noreferrer"
        aria-label="Enquire on WhatsApp"
        className="grid h-14 w-14 place-items-center rounded-full bg-[#1F7A4D] text-white shadow-[0_12px_32px_-12px_rgba(23,22,26,0.5)] transition-transform hover:scale-105"
      >
        <MessageCircle size={24} strokeWidth={1.5} />
      </a>
    </div>
  );
}
