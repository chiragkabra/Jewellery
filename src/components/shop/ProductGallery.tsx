"use client";

import { useState } from "react";
import Image from "next/image";
import { Rotate3D, ZoomIn } from "lucide-react";
import { isSvg, cn } from "@/lib/utils";

/** Thumbnails + main image with hover zoom, plus a reserved 360° slot. */
export function ProductGallery({ images, name }: { images: string[]; name: string }) {
  const [active, setActive] = useState<number | "360">(0);
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setZoom({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
  };

  return (
    <div className="flex flex-col-reverse gap-3 md:flex-row">
      <ul className="no-scrollbar flex gap-2 overflow-x-auto md:w-20 md:flex-col" aria-label="Product images">
        {images.map((src, i) => (
          <li key={src} className="w-16 shrink-0 md:w-full">
            <button
              onClick={() => setActive(i)}
              aria-label={`Image ${i + 1}`}
              aria-current={active === i}
              className={cn("relative block aspect-[4/5] w-full border bg-sand", active === i ? "border-ink" : "border-transparent")}
            >
              <Image src={src} alt="" fill sizes="80px" unoptimized={isSvg(src)} className="object-cover" />
            </button>
          </li>
        ))}
        <li className="w-16 shrink-0 md:w-full">
          <button
            onClick={() => setActive("360")}
            aria-label="360° view"
            aria-current={active === "360"}
            className={cn(
              "grid aspect-[4/5] w-full place-items-center border bg-sand text-[11px] font-semibold tracking-[0.1em]",
              active === "360" ? "border-ink" : "border-transparent"
            )}
          >
            <span className="flex flex-col items-center gap-1">
              <Rotate3D size={18} strokeWidth={1.5} /> 360°
            </span>
          </button>
        </li>
      </ul>

      <div className="relative flex-1">
        {active === "360" ? (
          <div className="grid aspect-[4/5] place-items-center border border-dashed border-ink/20 bg-sand text-center">
            <div>
              <Rotate3D size={40} strokeWidth={1.2} className="mx-auto text-accent" />
              <p className="mt-4 font-display text-[24px]">360° view</p>
              <p className="mt-2 text-[13px] text-muted">Reserved slot — embed spin photography or a 3D model here.</p>
            </div>
          </div>
        ) : (
          <div
            className="relative aspect-[4/5] cursor-zoom-in overflow-hidden bg-sand"
            onMouseMove={onMove}
            onMouseLeave={() => setZoom(null)}
          >
            <Image
              src={images[active]}
              alt={`${name} — image ${active + 1}`}
              fill
              priority
              sizes="(min-width: 1024px) 50vw, 100vw"
              unoptimized={isSvg(images[active])}
              className="object-cover transition-transform duration-300 ease-out"
              style={zoom ? { transform: "scale(2)", transformOrigin: `${zoom.x}% ${zoom.y}%` } : undefined}
            />
            <span className="pointer-events-none absolute bottom-4 right-4 flex items-center gap-2 bg-ivory/90 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] max-md:hidden">
              <ZoomIn size={14} strokeWidth={1.5} /> Hover to zoom
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
