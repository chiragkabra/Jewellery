"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export interface LineItem {
  slug: string;
  name: string;
  image: string;
  material: string;
  variant?: string;
  colour?: string;
  size?: string;
  qty: number;
}

type DrawerView = "bag" | "quote" | null;

interface CartCtx {
  bag: LineItem[];
  quote: LineItem[];
  drawer: DrawerView;
  openDrawer: (v: Exclude<DrawerView, null>) => void;
  closeDrawer: () => void;
  addToBag: (item: Omit<LineItem, "qty">, qty?: number) => void;
  addToQuote: (item: Omit<LineItem, "qty">, qty?: number) => void;
  updateQty: (list: "bag" | "quote", index: number, qty: number) => void;
  remove: (list: "bag" | "quote", index: number) => void;
  clearQuote: () => void;
  clearBag: () => void;
}

const Ctx = createContext<CartCtx | null>(null);
const KEY = "lumera:cart";

const sameLine = (a: Omit<LineItem, "qty">, b: Omit<LineItem, "qty">) =>
  a.slug === b.slug && a.variant === b.variant && a.colour === b.colour && a.size === b.size;

function addTo(list: LineItem[], item: Omit<LineItem, "qty">, qty: number) {
  const i = list.findIndex((x) => sameLine(x, item));
  if (i === -1) return [...list, { ...item, qty }];
  return list.map((x, j) => (j === i ? { ...x, qty: x.qty + qty } : x));
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [bag, setBag] = useState<LineItem[]>([]);
  const [quote, setQuote] = useState<LineItem[]>([]);
  const [drawer, setDrawer] = useState<DrawerView>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || "{}");
      if (Array.isArray(saved.bag)) setBag(saved.bag);
      if (Array.isArray(saved.quote)) setQuote(saved.quote);
    } catch {}
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(KEY, JSON.stringify({ bag, quote }));
    } catch {}
  }, [bag, quote, ready]);

  const addToBag = useCallback((item: Omit<LineItem, "qty">, qty = 1) => {
    setBag((l) => addTo(l, item, qty));
    setDrawer("bag");
  }, []);
  const addToQuote = useCallback((item: Omit<LineItem, "qty">, qty = 1) => {
    setQuote((l) => addTo(l, item, qty));
    setDrawer("quote");
  }, []);
  const updateQty = useCallback((list: "bag" | "quote", index: number, qty: number) => {
    const set = list === "bag" ? setBag : setQuote;
    set((l) => l.map((x, i) => (i === index ? { ...x, qty: Math.max(1, qty) } : x)));
  }, []);
  const remove = useCallback((list: "bag" | "quote", index: number) => {
    const set = list === "bag" ? setBag : setQuote;
    set((l) => l.filter((_, i) => i !== index));
  }, []);

  const value = useMemo(
    () => ({
      bag,
      quote,
      drawer,
      openDrawer: (v: "bag" | "quote") => setDrawer(v),
      closeDrawer: () => setDrawer(null),
      addToBag,
      addToQuote,
      updateQty,
      remove,
      clearQuote: () => setQuote([]),
      clearBag: () => setBag([]),
    }),
    [bag, quote, drawer, addToBag, addToQuote, updateQty, remove]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}

