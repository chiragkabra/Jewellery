"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { setLenis, getLenis } from "@/lib/scroll";

gsap.registerPlugin(ScrollTrigger);

/** Lenis smooth scrolling, driven by GSAP's ticker so ScrollTrigger stays in sync. */
export function SmoothScroll() {
  const pathname = usePathname();

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const lenis = new Lenis({ duration: 1.1, smoothWheel: true });
    setLenis(lenis);
    lenis.on("scroll", ScrollTrigger.update);
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    return () => {
      gsap.ticker.remove(tick);
      lenis.destroy();
      setLenis(null);
    };
  }, []);

  // New page: jump to top (or hash) and recalculate pinned sections.
  useEffect(() => {
    const lenis = getLenis();
    const hash = window.location.hash;
    if (!hash) lenis?.scrollTo(0, { immediate: true });
    const id = setTimeout(() => {
      ScrollTrigger.refresh();
      if (hash) {
        const el = document.querySelector(hash);
        if (el) (lenis ? lenis.scrollTo(el as HTMLElement, { offset: -90 }) : el.scrollIntoView());
      }
    }, 120);
    return () => clearTimeout(id);
  }, [pathname]);

  return null;
}
