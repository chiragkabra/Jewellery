/**
 * Site configuration — rename the brand, change contact details and
 * business identifiers here. Everything in [BRACKETS] must be confirmed.
 */
export const site = {
  name: "LUMERA",
  /** Used in <title> templates and metadata. */
  legalName: "[LUMERA Jewels Pvt. Ltd.]",
  tagline: "Gold, sterling silver and diamond jewellery — made in our own workshop.",
  description:
    "Manufacturer of gold, sterling silver and diamond jewellery. Shop retail, buy wholesale or private label, and source for import and export.",
  url: "https://example.com",
  yearsInBusiness: "[XX]",
  channels: ["Retail", "Wholesale", "Import & Export"],

  contact: {
    phone: "[PHONE]",
    tradePhone: "[TRADE PHONE]",
    email: "[EMAIL]",
    tradeEmail: "[TRADE EMAIL]",
    /** Digits only, with country code, e.g. 919800000000. Empty = placeholder. */
    whatsapp: "",
    whatsappMessage: "Hello, I'd like to enquire about your jewellery.",
    address: "[ADDRESS LINE], [CITY], [STATE] [PIN], India",
    hours: "[Mon–Sat, 10:00–19:00 IST]",
  },

  /** Origin point for the world-map arcs. Placeholder coordinates — confirm. */
  hq: { label: "[CITY], India", lat: 19.07, lng: 72.87 },

  identifiers: {
    gstin: "[GSTIN]",
    iec: "[IEC]",
    cin: "[CIN]",
  },

  certifications: [
    "[BIS Hallmark — HUID]",
    "[IGI]",
    "[GIA]",
    "[Kimberley Process / SoW]",
    "[RJC]",
    "[GJEPC Member]",
  ],

  social: {
    instagram: "#",
    linkedin: "#",
    pinterest: "#",
  },

  currency: { code: "INR", symbol: "₹", locale: "en-IN" },
  /** GST rate used in price breakdowns. Confirm current rate. */
  gstPct: 3,
} as const;

export type Site = typeof site;
