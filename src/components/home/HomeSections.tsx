"use client";

import { useEffect, type ReactNode } from "react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { sectionOrder, type HomeSectionKey } from "@/data/home";
import { useLens } from "@/context/LensContext";

/**
 * Renders homepage sections in the order set for the active lens
 * (see sectionOrder in src/data/home.ts).
 */
export function HomeSections({ sections }: { sections: Record<HomeSectionKey, ReactNode> }) {
  const { lens } = useLens();

  // Pinned sections need their trigger positions recalculated after a reorder.
  useEffect(() => {
    const id = requestAnimationFrame(() => ScrollTrigger.refresh());
    return () => cancelAnimationFrame(id);
  }, [lens]);

  return (
    <>
      {sectionOrder[lens].map((key) => (
        // Stable wrapper per section so React moves it whole (keeps GSAP pin-spacers intact).
        <div key={key} data-section={key}>
          {sections[key]}
        </div>
      ))}
    </>
  );
}
