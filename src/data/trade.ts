/** Content for /wholesale and /import-export. Everything in [BRACKETS] needs confirming. */

export const audiences = [
  { title: "Retailers", body: "Ready-to-sell ranges with line sheets, tags and display-ready packaging.", icon: "store" },
  { title: "Distributors", body: "Volume pricing linked to the metal rate and dependable replenishment.", icon: "truck" },
  { title: "Corporate gifting", body: "Coins, pendants and keepsakes engraved and boxed in your branding.", icon: "gift" },
  { title: "Private-label brands", body: "Your designs developed, sampled and manufactured under your name.", icon: "tag" },
] as const;

export const wholesaleSteps = [
  { title: "Enquire", body: "Tell us the material, categories, volumes and target price points." },
  { title: "Line sheet & samples", body: "We share a line sheet and send samples or CADs for approval." },
  { title: "Production & QC", body: "Production runs are checked for weight, purity, finish and setting." },
  { title: "Delivery", body: "Hallmarked, certified and packed — shipped insured to your door." },
];

export const pricingTable = {
  columns: ["Gold", "Sterling Silver", "Diamonds"],
  rows: [
    { label: "Minimum order (MOQ)", values: ["[MOQ] g / [MOQ] pcs", "[MOQ] pcs", "[MOQ] pcs"] },
    { label: "Pricing basis", values: ["Metal rate + [XX]% making", "Metal rate + [XX]% making", "Metal + stone value + [XX]% making"] },
    { label: "Sample lead time", values: ["[XX] days", "[XX] days", "[XX] days"] },
    { label: "Production lead time", values: ["[XX]–[XX] days", "[XX]–[XX] days", "[XX]–[XX] days"] },
    { label: "Purity / quality", values: ["24K · 22K · 18K · 14K", "925 · rhodium · vermeil · oxidised", "IGI / GIA · natural & lab-grown"] },
    { label: "Payment terms", values: ["[TERMS]", "[TERMS]", "[TERMS]"] },
  ],
};

export const included = [
  { title: "Metal-linked pricing", body: "Quotes track the live metal rate, so you only pay for metal at the day's price." },
  { title: "Custom design", body: "CAD and prototype development for exclusive or private-label ranges." },
  { title: "Branded packaging", body: "Boxes, pouches, tags and certificates printed with your brand." },
  { title: "Catalogue access", body: "A trade login with the full catalogue, line sheets and trade pricing." },
];

export const exportServices = [
  {
    title: "Export of finished jewellery",
    body: "Gold, sterling silver and diamond jewellery manufactured to your specification and shipped with full documentation.",
    icon: "ship",
  },
  {
    title: "Sourcing & import",
    body: "Loose natural and lab-grown diamonds, findings and components sourced and imported on your behalf.",
    icon: "gem",
  },
  {
    title: "Contract manufacturing",
    body: "Our workshop as your production floor — your designs, our casting, setting and finishing capacity.",
    icon: "factory",
  },
] as const;

export const exportSteps = [
  { title: "Enquiry & RFQ", body: "Share specifications, quantities and target markets; we return a formal quotation." },
  { title: "Samples & approval", body: "Physical samples or CADs are approved before production begins." },
  { title: "Production & QC", body: "Manufactured in-house with checks at casting, setting and finishing." },
  { title: "Certification & documentation", body: "Hallmarking, assay, grading reports and export paperwork prepared." },
  { title: "Insured shipment", body: "Shipped insured through specialist carriers, tracked to delivery." },
];

export const complianceDocs = [
  "Commercial invoice",
  "Packing list",
  "Certificate of origin",
  "Hallmark / assay reports",
  "Diamond grading reports (IGI / GIA)",
  "Kimberley Process / System of Warranties statement",
];

export const incoterms = ["[FOB]", "[CIF]", "[DDP]"];
export const shippingPartners = ["[Shipping partner 1]", "[Shipping partner 2]", "[Shipping partner 3]", "[Shipping partner 4]"];
