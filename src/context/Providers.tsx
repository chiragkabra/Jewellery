"use client";

import type { ReactNode } from "react";
import { MotionConfig } from "framer-motion";
import { LensProvider } from "./LensContext";
import { ModeProvider } from "./ModeContext";
import { CartProvider } from "./CartContext";
import { RatesProvider } from "./RatesContext";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <LensProvider>
        <ModeProvider>
          <CartProvider>
            <RatesProvider>{children}</RatesProvider>
          </CartProvider>
        </ModeProvider>
      </LensProvider>
    </MotionConfig>
  );
}
