"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Minus, Plus, Trash2, X } from "lucide-react";
import { useCart, type LineItem } from "@/context/CartContext";
import { useModal } from "@/lib/hooks";
import { submitForm } from "@/lib/submit";
import { Media } from "@/components/ui/Media";
import { cn } from "@/lib/utils";

/** One drawer, two views: retail bag and trade quote request. Reachable from every page. */
export function CartDrawer() {
  const { drawer, closeDrawer, openDrawer } = useCart();
  const close = useCallback(() => closeDrawer(), [closeDrawer]);
  useModal(drawer !== null, close);

  return (
    <AnimatePresence>
      {drawer && (
        <>
          <motion.div
            key="scrim"
            className="fixed inset-0 z-[90] bg-ink/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
          />
          <motion.aside
            key="panel"
            role="dialog"
            aria-modal="true"
            aria-label={drawer === "bag" ? "Your bag" : "Request a quote"}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-y-0 right-0 z-[91] flex w-full max-w-[480px] flex-col bg-ivory"
          >
            <div className="flex items-center justify-between border-b border-line px-6 py-4">
              <div className="flex gap-1" role="tablist">
                {(["bag", "quote"] as const).map((v) => (
                  <button
                    key={v}
                    role="tab"
                    aria-selected={drawer === v}
                    onClick={() => openDrawer(v)}
                    className={cn(
                      "min-h-[44px] px-3 text-[12px] font-semibold uppercase tracking-[0.16em]",
                      drawer === v ? "text-ink underline underline-offset-8" : "text-muted hover:text-ink"
                    )}
                  >
                    {v === "bag" ? "Bag" : "Quote request"}
                  </button>
                ))}
              </div>
              <button onClick={close} aria-label="Close" className="grid h-11 w-11 place-items-center">
                <X size={22} strokeWidth={1.5} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto" data-lenis-prevent>
              {drawer === "bag" ? <BagView /> : <QuoteView />}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function Lines({ list, items }: { list: "bag" | "quote"; items: LineItem[] }) {
  const { updateQty, remove, closeDrawer } = useCart();
  return (
    <ul className="divide-y divide-line">
      {items.map((it, i) => (
        <li key={`${it.slug}-${i}`} className="flex gap-4 px-6 py-5" data-material={it.material}>
          <Link href={`/product/${it.slug}`} onClick={closeDrawer} className="w-20 shrink-0">
            <Media src={it.image} alt={it.name} sizes="80px" className="aspect-[4/5]" />
          </Link>
          <div className="flex flex-1 flex-col">
            <p className="text-[15px]">{it.name}</p>
            <p className="text-[13px] text-muted">
              {[it.variant, it.colour, it.size && `Size ${it.size}`].filter(Boolean).join(" · ")}
            </p>
            <div className="mt-auto flex items-center justify-between pt-3">
              <div className="flex items-center border border-line">
                <button
                  aria-label="Decrease quantity"
                  onClick={() => updateQty(list, i, it.qty - 1)}
                  className="grid h-11 w-11 place-items-center"
                >
                  <Minus size={14} strokeWidth={1.5} />
                </button>
                <span className="w-10 text-center text-[14px] tabular-nums">{it.qty}</span>
                <button
                  aria-label="Increase quantity"
                  onClick={() => updateQty(list, i, it.qty + (list === "quote" ? 10 : 1))}
                  className="grid h-11 w-11 place-items-center"
                >
                  <Plus size={14} strokeWidth={1.5} />
                </button>
              </div>
              <button
                aria-label={`Remove ${it.name}`}
                onClick={() => remove(list, i)}
                className="grid h-11 w-11 place-items-center text-muted hover:text-ink"
              >
                <Trash2 size={16} strokeWidth={1.5} />
              </button>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function Empty({ text }: { text: string }) {
  const { closeDrawer } = useCart();
  return (
    <div className="px-6 py-16 text-center">
      <p className="font-display text-[26px]">{text}</p>
      <Link href="/gold" onClick={closeDrawer} className="btn-secondary mt-8">
        Browse the collection
      </Link>
    </div>
  );
}

function BagView() {
  const { bag } = useCart();
  if (!bag.length) return <Empty text="Your bag is empty." />;
  return (
    <div>
      <Lines list="bag" items={bag} />
      <div className="space-y-4 border-t border-line px-6 py-6">
        <div className="flex justify-between text-[15px]">
          <span className="text-muted">Subtotal</span>
          <span>[PRICE]</span>
        </div>
        <p className="text-[13px] text-muted">
          Final price is calculated at the metal rate on the day of purchase. GST and insured shipping shown at checkout.
        </p>
        <button className="btn-primary w-full" disabled title="Checkout is not connected yet">
          Checkout [coming soon]
        </button>
      </div>
    </div>
  );
}

function QuoteView() {
  const { quote, clearQuote } = useCart();
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [ref, setRef] = useState("");

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget).entries());
    setState("sending");
    try {
      const r = await submitForm("quote", { ...data, items: quote });
      setRef(r);
      setState("done");
      clearQuote();
    } catch {
      setState("error");
    }
  };

  if (state === "done")
    return (
      <div className="px-6 py-16 text-center">
        <Check className="mx-auto text-accent" size={32} strokeWidth={1.5} />
        <p className="mt-4 font-display text-[28px]">Quote request received.</p>
        <p className="mt-3 text-muted">Reference {ref}. Our trade desk will reply within [XX] working hours.</p>
      </div>
    );

  return (
    <div>
      {quote.length ? (
        <Lines list="quote" items={quote} />
      ) : (
        <p className="px-6 pt-6 text-[15px] text-muted">
          No pieces added yet — you can still send a general request, or switch to Trade mode and use “Add to quote”
          on any piece.
        </p>
      )}
      <form onSubmit={onSubmit} className="grid gap-4 border-t border-line px-6 py-6">
        <p className="eyebrow">Your details</p>
        <input name="name" required placeholder="Full name" className="field" aria-label="Full name" />
        <input name="company" placeholder="Company" className="field" aria-label="Company" />
        <div className="grid grid-cols-2 gap-3">
          <input name="email" type="email" required placeholder="Email" className="field" aria-label="Email" />
          <input name="phone" type="tel" placeholder="Phone / WhatsApp" className="field" aria-label="Phone" />
        </div>
        <input name="country" placeholder="Country" className="field" aria-label="Country" />
        <textarea
          name="message"
          rows={3}
          placeholder="Quantities, purities, deadlines, branding…"
          className="field py-3"
          aria-label="Message"
        />
        <button type="submit" className="btn-primary w-full" disabled={state === "sending"}>
          {state === "sending" ? "Sending…" : "Send quote request"}
        </button>
        {state === "error" && (
          <p role="alert" className="text-[13px] text-[#9A3B2E]">
            Something went wrong. Please try again.
          </p>
        )}
      </form>
    </div>
  );
}
