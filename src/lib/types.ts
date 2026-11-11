export type MaterialKey = "gold" | "silver" | "diamond";
export type Lens = "all" | MaterialKey;
export type Mode = "retail" | "trade";

/** URL slug for each material collection (/gold, /silver, /diamonds). */
export type MaterialSlug = "gold" | "silver" | "diamonds";

export type CategoryKey = "rings" | "necklaces" | "earrings" | "bangles-bracelets" | "pendants" | "chains";

export interface GuideItem {
  title: string;
  detail: string;
}

export interface Material {
  key: MaterialKey;
  slug: MaterialSlug;
  name: string; // "Gold"
  navLabel: string; // "Gold" / "Diamonds"
  tagline: string;
  description: string;
  heroImage: string;
  cardImage: string;
  megaImage: string;
  /** Chips shown on cards and in the mega-menu. */
  purities: string[];
  /** Label for the filter group that uses `purities` (Purity / Finish / Shape). */
  variantLabel: string;
  variantOptions: string[];
  guideTitle: string;
  guide: GuideItem[];
  /** Extra note under the guide (e.g. natural vs lab-grown). */
  guideNote?: GuideItem[];
  /** Gold & silver show a live rate card; diamonds show grading labs. */
  rateKeys?: RateKey[];
  gradingLabs?: string[];
}

export interface Category {
  key: CategoryKey;
  name: string;
  image: string;
}

export interface Product {
  slug: string;
  name: string;
  material: MaterialKey;
  category: CategoryKey;
  /** Purity / finish / shape — matches Material.variantOptions. */
  variants: string[];
  metalColours: string[];
  sizes?: string[];
  images: string[]; // [primary, hover, ...gallery]
  description: string;
  /** Leave null until confirmed; the UI shows [PRICE] / [XX] g. */
  price: number | null;
  weightGrams: number | null;
  makingChargePct: number | null;
  stoneValue: number | null;
  certificateNo: string | null;
  certificateUrl: string | null;
  trade: { moq: string; leadTime: string };
  featured?: boolean;
  isNew?: boolean;
}

export type RateKey = "gold24" | "gold22" | "gold18" | "silver999";

export interface Rate {
  key: RateKey;
  label: string;
  unit: string;
  /** null until a live feed is connected. */
  value: number | null;
  change: number | null;
}

export interface RatesResponse {
  rates: Rate[];
  updatedAt: string;
  source: string;
  live: boolean;
}

export interface Market {
  name: string;
  region: string;
  lat: number;
  lng: number;
}

export interface Testimonial {
  quote: string;
  name: string;
  role: string;
  type: "retail" | "trade";
}

export interface Stat {
  /** null shows [XX] until confirmed. */
  value: number | null;
  suffix?: string;
  label: string;
}
