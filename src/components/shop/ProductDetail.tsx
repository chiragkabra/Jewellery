"use client";

import { useState } from "react";
import { Download, FileCheck2, Minus, Plus, ShieldCheck, Truck } from "lucide-react";
import { materialByKey } from "@/data/materials";
import { categoryName } from "@/data/categories";
import { useCart } from "@/context/CartContext";
import { useMode } from "@/context/ModeContext";
import { useRatesData } from "@/context/RatesContext";
import { formatPct, formatPrice, formatRate, formatWeight } from "@/lib/format";
import { priceBreakdown, rateKeyFor } from "@/lib/pricing";
import type { Product } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Selector } from "./QuickView";

export function ProductDetail({ product }: { product: Product }) {
  const m = materialByKey(product.material);
  const { isTrade, setMode } = useMode();
  const { addToBag, addToQuote } = useCart();
  const rates = useRatesData();
  const [variant, setVariant] = useState(product.variants[0]);
  const [colour, setColour] = useState(product.metalColours[0]);
  const [size, setSize] = useState(product.sizes?.[0]);
  const [qty, setQty] = useState(10);

  const { lines, total } = priceBreakdown(product, variant, rates?.rates ?? []);
  const rate = rates?.rates.find((r) => r.key === rateKeyFor(product, variant));
  const item = { slug: product.slug, name: product.name, image: product.images[0], material: product.material, variant, colour, size };

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="eyebrow mb-4">
          {m.name} · {categoryName(product.category)}
        </p>
        <h1 className="display-2">{product.name}</h1>
        <p className="mt-5 font-display text-[28px] tabular-nums">{formatPrice(total)}</p>
        <p className="mt-1 text-[13px] text-muted">Inclusive of GST · priced at today’s metal rate</p>
        <p className="lede mt-6">{product.description}</p>
      </div>

      <div className="space-y-6 border-t border-line pt-6">
        <Selector label={m.variantLabel} options={product.variants} value={variant} onChange={setVariant} />
        <Selector label="Metal colour" options={product.metalColours} value={colour} onChange={setColour} />
        {product.sizes && size && <Selector label="Size" options={product.sizes} value={size} onChange={setSize} />}
      </div>

      {!isTrade && (
        <div className="flex flex-col gap-3 sm:flex-row">
          <button onClick={() => addToBag(item)} className="btn-primary flex-1">
            Add to bag
          </button>
          <button onClick={() => addToQuote(item, 1)} className="btn-secondary flex-1">
            Enquire
          </button>
        </div>
      )}

      {/* Price breakdown */}
      <details className="group border border-line" open>
        <summary className="flex min-h-[52px] cursor-pointer list-none items-center justify-between px-5 text-[12px] font-semibold uppercase tracking-[0.16em]">
          Price breakdown
          <Plus size={16} strokeWidth={1.5} className="transition-transform group-open:rotate-45" />
        </summary>
        <dl className="divide-y divide-line border-t border-line px-5 text-[14px]">
          <Row k="Weight" v={formatWeight(product.weightGrams)} />
          <Row k={`Rate (${rate?.label ?? variant})`} v={`${formatRate(rate?.value)}${rate?.unit ?? "/g"}`} />
          {lines.map((l) => (
            <Row key={l.label} k={l.label} v={l.value == null ? `[PRICE]${l.note ? ` · ${l.note}` : ""}` : formatPrice(l.value)} />
          ))}
          <Row k="Total" v={formatPrice(total)} strong />
        </dl>
      </details>

      {/* Certificate */}
      <div className="flex items-center justify-between gap-4 border border-line p-5">
        <div className="flex items-start gap-3">
          <FileCheck2 size={22} strokeWidth={1.5} className="mt-0.5 text-accent" />
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.16em]">Certificate</p>
            <p className="text-[14px] text-muted">
              {product.material === "diamond" ? "IGI / GIA" : "BIS Hallmark (HUID)"} · No. {product.certificateNo ?? "[CERT NO.]"}
            </p>
          </div>
        </div>
        {product.certificateUrl ? (
          <a href={product.certificateUrl} download className="btn-secondary !px-4">
            <Download size={16} strokeWidth={1.5} /> PDF
          </a>
        ) : (
          <button disabled className="btn-secondary !px-4" title="Certificate file not uploaded yet">
            <Download size={16} strokeWidth={1.5} /> [PDF]
          </button>
        )}
      </div>

      {/* Trade block */}
      <div className={cn("border p-6", isTrade ? "border-ink bg-sand" : "border-line")}>
        <div className="flex items-center justify-between">
          <p className="eyebrow">For trade buyers</p>
          {!isTrade && (
            <button onClick={() => setMode("trade")} className="text-[12px] font-semibold uppercase tracking-[0.14em] underline underline-offset-4">
              Switch to trade
            </button>
          )}
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-4 text-[14px] sm:grid-cols-4">
          <Stat k="MOQ" v={product.trade.moq} />
          <Stat k="Lead time" v={product.trade.leadTime} />
          <Stat k="Making" v={formatPct(product.makingChargePct)} />
          <Stat k="Rate" v={`${formatRate(rate?.value)}${rate?.unit ?? "/g"}`} />
        </dl>
        {isTrade && (
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <div className="flex items-center border border-ink/30 bg-ivory">
              <button aria-label="Decrease quantity" onClick={() => setQty((q) => Math.max(1, q - 10))} className="grid h-12 w-12 place-items-center">
                <Minus size={14} strokeWidth={1.5} />
              </button>
              <label className="sr-only" htmlFor="trade-qty">Quantity</label>
              <input
                id="trade-qty"
                type="number"
                min={1}
                value={qty}
                onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
                className="h-12 w-16 bg-transparent text-center tabular-nums focus:outline-none"
              />
              <button aria-label="Increase quantity" onClick={() => setQty((q) => q + 10)} className="grid h-12 w-12 place-items-center">
                <Plus size={14} strokeWidth={1.5} />
              </button>
            </div>
            <button onClick={() => addToQuote(item, qty)} className="btn-primary flex-1">
              Add to quote
            </button>
          </div>
        )}
      </div>

      <ul className="grid gap-3 text-[13px] text-muted sm:grid-cols-2">
        <li className="flex items-center gap-2"><ShieldCheck size={16} strokeWidth={1.5} className="text-accent" /> Hallmarked & certified</li>
        <li className="flex items-center gap-2"><Truck size={16} strokeWidth={1.5} className="text-accent" /> Insured shipping · [XX] day dispatch</li>
      </ul>
    </div>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className={cn("flex justify-between gap-4 py-3", strong && "font-semibold")}>
      <dt className={strong ? "" : "text-muted"}>{k}</dt>
      <dd className="text-right tabular-nums">{v}</dd>
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-[12px] uppercase tracking-[0.14em] text-muted">{k}</dt>
      <dd className="mt-1">{v}</dd>
    </div>
  );
}
