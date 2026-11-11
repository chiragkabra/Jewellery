"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useRates } from "@/lib/hooks";
import type { RatesResponse } from "@/lib/types";

const Ctx = createContext<RatesResponse | null>(null);

/** Polls /api/rates once for the whole app (every 60s). */
export function RatesProvider({ children }: { children: ReactNode }) {
  const data = useRates();
  return <Ctx.Provider value={data}>{children}</Ctx.Provider>;
}

export const useRatesData = () => useContext(Ctx);
