import type { Category } from "@/lib/types";

export const categories: Category[] = [
  { key: "rings", name: "Rings", image: "/images/cat-rings.jpg" },
  { key: "necklaces", name: "Necklaces", image: "/images/cat-necklaces.jpg" },
  { key: "earrings", name: "Earrings", image: "/images/cat-earrings.jpg" },
  { key: "bangles-bracelets", name: "Bangles & Bracelets", image: "/images/cat-bangles.jpg" },
  { key: "pendants", name: "Pendants", image: "/images/cat-pendants.jpg" },
  { key: "chains", name: "Chains", image: "/images/cat-chains.jpg" },
];

export const categoryName = (key: string) => categories.find((c) => c.key === key)?.name ?? key;
