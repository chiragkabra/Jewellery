import type { Lens, Stat } from "@/lib/types";

export interface HeroCopy {
  eyebrow: string;
  headline: string;
  lede: string;
  image: string;
  imageLabel: string;
}

/** Hero copy per material lens. */
export const heroByLens: Record<Lens, HeroCopy> = {
  all: {
    eyebrow: "Gold · Sterling Silver · Diamonds",
    headline: "Jewellery, made in our own workshop.",
    lede: "We design and manufacture gold, sterling silver and diamond jewellery — for you to wear, for your store to sell, and for markets around the world.",
    image: "/images/hero-all.jpg",
    imageLabel: "Model wearing a layered gold choker",
  },
  gold: {
    eyebrow: "Hallmarked gold · 24K to 14K",
    headline: "Gold, cast and finished by hand.",
    lede: "BIS-hallmarked gold jewellery priced against the day's metal rate — for retail clients, trade buyers and export partners.",
    image: "/images/hero-gold.jpg",
    imageLabel: "Bride wearing traditional gold jewellery",
  },
  silver: {
    eyebrow: "925 Sterling Silver",
    headline: "Sterling silver, at any scale.",
    lede: "Polished, rhodium, vermeil and oxidised finishes — from a single piece to full private-label ranges.",
    image: "/images/hero-silver.jpg",
    imageLabel: "Sterling silver pendant necklace",
  },
  diamond: {
    eyebrow: "Certified natural & lab-grown",
    headline: "Diamonds, graded and set with care.",
    lede: "Every stone comes with an independent grading report. Natural and lab-grown, always clearly disclosed.",
    image: "/images/hero-diamond.jpg",
    imageLabel: "Diamond ring held in hand",
  },
};

export type HomeSectionKey =
  | "materials"
  | "channels"
  | "featured"
  | "categories"
  | "craft"
  | "stats"
  | "presence"
  | "testimonials"
  | "enquiry";

/**
 * Homepage section order per lens (the hero always comes first).
 * Diamonds lead with craft & certification; silver with channels (volume buyers).
 */
export const sectionOrder: Record<Lens, HomeSectionKey[]> = {
  all: ["materials", "channels", "featured", "categories", "craft", "stats", "presence", "testimonials", "enquiry"],
  gold: ["featured", "materials", "categories", "channels", "craft", "stats", "presence", "testimonials", "enquiry"],
  silver: ["featured", "channels", "materials", "categories", "presence", "craft", "stats", "testimonials", "enquiry"],
  diamond: ["featured", "craft", "materials", "categories", "channels", "stats", "presence", "testimonials", "enquiry"],
};

export const trustRow = ["BIS hallmarked", "IGI / GIA certified", "Insured shipping"];

export const channels = [
  {
    title: "Retail",
    body: "Shop finished pieces online or by appointment. Transparent pricing — metal value, making charge and GST shown separately.",
    href: "/gold",
    cta: "Shop the collection",
  },
  {
    title: "Wholesale & Private label",
    body: "Metal-linked trade pricing, line sheets and samples for retailers, distributors and brands. Your designs, your packaging.",
    href: "/wholesale",
    cta: "Buy wholesale",
  },
  {
    title: "Import & Export",
    body: "Finished jewellery for overseas buyers, sourcing of loose diamonds and components, and contract manufacturing.",
    href: "/import-export",
    cta: "Explore export",
  },
];

export const craftSteps = [
  {
    title: "Design",
    body: "Sketches become CAD models and resin prototypes, approved by you before a gram of metal is used.",
    image: "/images/craft-design.jpg",
  },
  {
    title: "Casting",
    body: "Metal is alloyed to purity and lost-wax cast, then checked for weight and porosity.",
    image: "/images/craft-casting.jpg",
  },
  {
    title: "Setting",
    body: "Stones are matched and set by hand — claw, bezel, pavé or channel — under magnification.",
    image: "/images/craft-setting.jpg",
  },
  {
    title: "Polishing",
    body: "Each surface is pre-polished, finished and, where specified, plated or oxidised.",
    image: "/images/craft-polishing.jpg",
  },
  {
    title: "Certification",
    body: "Hallmarking, assay and independent diamond grading before anything leaves the workshop.",
    image: "/images/craft-certification.jpg",
  },
];

/** Leave value null to show [XX] until confirmed. Do not publish unverified numbers. */
export const stats: Stat[] = [
  { value: null, suffix: "+", label: "Years in manufacturing" },
  { value: null, suffix: "+", label: "Designs in our library" },
  { value: null, suffix: "+", label: "Trade partners" },
  { value: null, label: "Countries shipped to" },
];
