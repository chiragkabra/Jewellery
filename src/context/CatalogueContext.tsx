"use client";
import { createContext,useContext,useEffect,useState,type ReactNode } from "react";
import type { Product } from "@/lib/types";
const Catalogue = createContext<Product[]>([]);
export function CatalogueProvider({children}:{children:ReactNode}) {
  const [products,setProducts]=useState<Product[]>([]);
  useEffect(()=>{let live=true;const load=()=>fetch("/api/products").then(r=>{if(!r.ok)throw new Error();return r.json();}).then(data=>{if(live)setProducts(data.products);}).catch(()=>{});void load();window.addEventListener("focus",load);return()=>{live=false;window.removeEventListener("focus",load);};},[]);
  return <Catalogue.Provider value={products}>{children}</Catalogue.Provider>;
}
export const useCatalogue = () => useContext(Catalogue);
