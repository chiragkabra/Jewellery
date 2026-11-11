"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Lens } from "@/lib/types";

const STORAGE_KEY = "lumera:lens";
const LENSES: Lens[] = ["all", "gold", "silver", "diamond"];

/** Accepts ?material=gold|silver|diamond|diamonds|all */
export function parseLens(value: string | null | undefined): Lens | null {
  if (!value) return null;
  const v = value.toLowerCase() === "diamonds" ? "diamond" : value.toLowerCase();
  return (LENSES as string[]).includes(v) ? (v as Lens) : null;
}

/** Runs before paint (see layout.tsx) so the accent is right on first render. */
export const lensBootScript = `(function(){try{var p=new URLSearchParams(location.search).get('material');var v=(p||localStorage.getItem('${STORAGE_KEY}')||'all').toLowerCase();if(v==='diamonds')v='diamond';if(['all','gold','silver','diamond'].indexOf(v)<0)v='all';document.documentElement.setAttribute('data-material',v);}catch(e){}})();`;

interface LensCtx {
  lens: Lens;
  setLens: (l: Lens) => void;
}

const Ctx = createContext<LensCtx | null>(null);

export function LensProvider({ children }: { children: ReactNode }) {
  const [lens, setLensState] = useState<Lens>("all");

  // Initial value: URL param wins over the saved preference.
  useEffect(() => {
    const fromUrl = parseLens(new URLSearchParams(window.location.search).get("material"));
    let saved: Lens | null = null;
    try {
      saved = parseLens(localStorage.getItem(STORAGE_KEY));
    } catch {}
    const initial = fromUrl ?? saved ?? "all";
    setLensState(initial);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-material", lens);
  }, [lens]);

  const setLens = useCallback((l: Lens) => {
    setLensState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {}
    // Keep the URL shareable: ?material=gold
    const url = new URL(window.location.href);
    if (l === "all") url.searchParams.delete("material");
    else url.searchParams.set("material", l);
    window.history.replaceState(window.history.state, "", url);
  }, []);

  return <Ctx.Provider value={{ lens, setLens }}>{children}</Ctx.Provider>;
}

export function useLens() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useLens must be used inside LensProvider");
  return ctx;
}
