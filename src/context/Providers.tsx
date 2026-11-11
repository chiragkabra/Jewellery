"use client";

import type { ReactNode } from "react";
import { MotionConfig } from "framer-motion";
import { LensProvider } from "./LensContext";
import { ModeProvider } from "./ModeContext";
import { CartProvider } from "./CartContext";
import { RatesProvider } from "./RatesContext";
import { CatalogueProvider } from "./CatalogueContext";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <LensProvider>
        <ModeProvider>
          <CartProvider>
            <RatesProvider><CatalogueProvider>{children}</CatalogueProvider></RatesProvider>
          </CartProvider>
        </ModeProvider>
      </LensProvider>
    </MotionConfig>
  );
}

