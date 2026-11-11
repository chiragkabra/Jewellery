"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Mode } from "@/lib/types";

const STORAGE_KEY = "lumera:mode";

interface ModeCtx {
  mode: Mode;
  isTrade: boolean;
  setMode: (m: Mode) => void;
  toggle: () => void;
}

const Ctx = createContext<ModeCtx | null>(null);

export function ModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<Mode>("retail");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "trade" || saved === "retail") setModeState(saved);
    } catch {}
  }, []);

  const setMode = useCallback((m: Mode) => {
    setModeState(m);
    try {
      localStorage.setItem(STORAGE_KEY, m);
    } catch {}
  }, []);

  const toggle = useCallback(() => setMode(mode === "retail" ? "trade" : "retail"), [mode, setMode]);

  return <Ctx.Provider value={{ mode, isTrade: mode === "trade", setMode, toggle }}>{children}</Ctx.Provider>;
}

export function useMode() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useMode must be used inside ModeProvider");
  return ctx;
}
