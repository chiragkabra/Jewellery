import type { MaterialKey } from "@/lib/types";

export interface NavItem {
  label: string;
  href: string;
  /** Material nav items open a mega-menu. */
  material?: MaterialKey;
}

export const mainNav: NavItem[] = [
  { label: "Gold", href: "/gold", material: "gold" },
  { label: "Silver", href: "/silver", material: "silver" },
  { label: "Diamonds", href: "/diamonds", material: "diamond" },
  { label: "Wholesale", href: "/wholesale" },
  { label: "Import & Export", href: "/import-export" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
];

export const footerNav = [
  {
    title: "Shop",
    links: [
      { label: "Gold", href: "/gold" },
      { label: "Sterling Silver", href: "/silver" },
      { label: "Diamonds", href: "/diamonds" },
      { label: "New arrivals", href: "/gold?sort=new" },
    ],
  },
  {
    title: "Trade",
    links: [
      { label: "Wholesale", href: "/wholesale" },
      { label: "Private label", href: "/wholesale#how-it-works" },
      { label: "Import & Export", href: "/import-export" },
      { label: "Open a trade account", href: "/wholesale#apply" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Craftsmanship", href: "/about#craft" },
      { label: "Certifications", href: "/about#certifications" },
      { label: "Contact", href: "/contact" },
    ],
  },
];

export const legalNav = [
  { label: "Privacy", href: "/legal/privacy" },
  { label: "Terms", href: "/legal/terms" },
  { label: "Shipping & returns", href: "/legal/shipping" },
];
