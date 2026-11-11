"use client";

import { useEffect, useState } from "react";
import type { RatesResponse } from "@/lib/types";
import { lockScroll, unlockScroll } from "@/lib/scroll";

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const update = () => setMatches(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [query]);
  return matches;
}

export const usePrefersReducedMotion = () => useMediaQuery("(prefers-reduced-motion: reduce)");

/** Polls /api/rates every 60 seconds. */
export function useRates(intervalMs = 60_000) {
  const [data, setData] = useState<RatesResponse | null>(null);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/rates", { cache: "no-store" });
        if (res.ok && alive) setData(await res.json());
      } catch {
        /* keep last good value */
      }
    };
    load();
    const id = setInterval(load, intervalMs);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [intervalMs]);
  return data;
}

/** Locks page scroll (incl. Lenis) and closes on Escape while `open`. */
export function useModal(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    lockScroll();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      unlockScroll();
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);
}
