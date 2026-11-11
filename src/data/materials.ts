import type { Material, MaterialKey, MaterialSlug } from "@/lib/types";

export const materials: Material[] = [
  {
    key: "gold",
    slug: "gold",
    name: "Gold",
    navLabel: "Gold",
    tagline: "Hallmarked gold, cast and finished in-house.",
    description:
      "Everyday and occasion pieces in 24K, 22K, 18K and 14K gold. Every piece carries a BIS hallmark and is priced against the day's metal rate.",
    heroImage: "/images/hero-gold.jpg",
    cardImage: "/images/material-gold.jpg",
    megaImage: "/images/mega-gold.jpg",
    purities: ["24K", "22K", "18K", "14K"],
    variantLabel: "Purity",
    variantOptions: ["24K", "22K", "18K", "14K"],
    guideTitle: "Understanding gold purity",
    guide: [
      { title: "24K", detail: "99.9% pure. Soft and rich in colour — best for coins, bars and investment pieces." },
      { title: "22K", detail: "91.6% pure. The classic choice for traditional jewellery and bridal sets." },
      { title: "18K", detail: "75% pure. Strong enough to hold diamonds and gemstones securely." },
      { title: "14K", detail: "58.5% pure. Durable and lighter on the pocket — suited to daily wear." },
    ],
    rateKeys: ["gold24", "gold22", "gold18"],
  },
  {
    key: "silver",
    slug: "silver",
    name: "Sterling Silver",
    navLabel: "Silver",
    tagline: "925 sterling silver with a finish for every brief.",
    description:
      "Sterling silver jewellery in polished, rhodium-plated, gold vermeil and oxidised finishes — produced at retail quality and wholesale volume.",
    heroImage: "/images/hero-silver.jpg",
    cardImage: "/images/material-silver.jpg",
    megaImage: "/images/mega-silver.jpg",
    purities: ["925", "Rhodium", "Vermeil", "Oxidised"],
    variantLabel: "Finish",
    variantOptions: ["925", "Rhodium", "Vermeil", "Oxidised"],
    guideTitle: "Silver finishes explained",
    guide: [
      { title: "925 Sterling", detail: "92.5% silver alloyed for strength. Stamped and assayed." },
      { title: "Rhodium-plated", detail: "A bright, white, tarnish-resistant coat over sterling silver." },
      { title: "Gold vermeil", detail: "A thick layer of gold over sterling silver — the look of gold at a lighter price." },
      { title: "Oxidised", detail: "Deliberately darkened recesses that bring out texture and detail." },
    ],
    rateKeys: ["silver999"],
  },
  {
    key: "diamond",
    slug: "diamonds",
    name: "Diamonds",
    navLabel: "Diamonds",
    tagline: "Certified natural and lab-grown diamonds, set by hand.",
    description:
      "Solitaires, bands and fine jewellery set with certified natural and lab-grown diamonds. Grading reports from independent laboratories.",
    heroImage: "/images/hero-diamond.jpg",
    cardImage: "/images/material-diamond.jpg",
    megaImage: "/images/mega-diamond.jpg",
    purities: ["Natural", "Lab-grown", "IGI", "GIA"],
    variantLabel: "Shape",
    variantOptions: ["Round", "Oval", "Pear", "Emerald", "Princess", "Cushion"],
    guideTitle: "The four Cs",
    guide: [
      { title: "Cut", detail: "How well the stone returns light. The biggest single factor in sparkle." },
      { title: "Colour", detail: "Graded D (colourless) to Z. Near-colourless grades look white once set." },
      { title: "Clarity", detail: "The presence of tiny inclusions, graded FL to I under 10× magnification." },
      { title: "Carat", detail: "A measure of weight, not size. One carat equals 0.2 grams." },
    ],
    guideNote: [
      { title: "Natural", detail: "Formed in the earth over billions of years. Sourced in line with the Kimberley Process." },
      { title: "Lab-grown", detail: "Chemically and optically identical, grown in a controlled lab. Always disclosed and certified." },
    ],
    gradingLabs: ["IGI", "GIA"],
  },
];

export const materialByKey = (key: MaterialKey) => materials.find((m) => m.key === key)!;
export const materialBySlug = (slug: string) => materials.find((m) => m.slug === slug as MaterialSlug);
