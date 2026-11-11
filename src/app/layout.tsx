import type { Metadata, Viewport } from "next";
import { Bodoni_Moda, Manrope } from "next/font/google";
import "./globals.css";
import { site } from "@/data/site";
import { Providers } from "@/context/Providers";
import { lensBootScript } from "@/context/LensContext";
import { SiteChrome } from "@/components/layout/SiteChrome";

const display = Bodoni_Moda({
  subsets: ["latin"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});
const sans = Manrope({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: `${site.name} — Gold, Silver & Diamond Jewellery`, template: `%s | ${site.name}` },
  description: site.description,
  openGraph: { siteName: site.name, type: "website", images: ["/images/og.jpg"] },
};

export const viewport: Viewport = { themeColor: "#FBFAF7" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-material="all" className={`${display.variable} ${sans.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: lensBootScript }} />
      </head>
      <body>
        <Providers>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:bg-ink focus:px-4 focus:py-3 focus:text-ivory"
          >
            Skip to content
          </a>
          <SiteChrome>{children}</SiteChrome>
        </Providers>
      </body>
    </html>
  );
}

