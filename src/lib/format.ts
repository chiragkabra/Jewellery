import { site } from "@/data/site";

const money = new Intl.NumberFormat(site.currency.locale, {
  style: "currency",
  currency: site.currency.code,
  maximumFractionDigits: 0,
});

/** Formats a price, or returns the placeholder when the value isn't confirmed yet. */
export const formatPrice = (value: number | null | undefined, placeholder = "[PRICE]") =>
  value == null ? placeholder : money.format(value);

export const formatRate = (value: number | null | undefined) =>
  value == null ? "[RATE]" : money.format(value);

export const formatWeight = (g: number | null | undefined) => (g == null ? "[XX] g" : `${g.toFixed(2)} g`);

export const formatPct = (v: number | null | undefined) => (v == null ? "[XX]%" : `${v}%`);
