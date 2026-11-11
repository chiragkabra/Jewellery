"use client";

import { motion } from "framer-motion";
import type { MapData } from "./worldMapData";
import { cn } from "@/lib/utils";

/** Dotted world map with animated arcs from HQ to each market. */
export function WorldMap({ data, dark, className }: { data: MapData; dark?: boolean; className?: string }) {
  const { width, height, points, origin, destinations } = data;

  const arc = (to: { x: number; y: number }) => {
    const mx = (origin.x + to.x) / 2;
    const dist = Math.hypot(to.x - origin.x, to.y - origin.y);
    const my = Math.min(origin.y, to.y) - dist * 0.35;
    return `M${origin.x},${origin.y} Q${mx},${my} ${to.x},${to.y}`;
  };

  return (
    <svg
      viewBox={`-1 -6 ${width + 2} ${height + 8}`}
      className={cn("h-auto w-full", className)}
      role="img"
      aria-label={`World map showing shipping routes from our workshop to ${destinations.length} markets`}
    >
      <g className={dark ? "fill-ivory/25" : "fill-ink/20"}>
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={0.24} />
        ))}
      </g>
      <g fill="none" className="stroke-accent" strokeWidth={0.16} strokeLinecap="round">
        {destinations.map((d, i) => (
          <motion.path
            key={i}
            d={arc(d)}
            className={dark ? "stroke-accent-light" : "stroke-accent"}
            initial={{ pathLength: 0, opacity: 0 }}
            whileInView={{ pathLength: 1, opacity: 1 }}
            viewport={{ once: true, margin: "-10% 0px" }}
            transition={{ duration: 1.8, delay: 0.2 + i * 0.15, ease: [0.22, 1, 0.36, 1] }}
          />
        ))}
      </g>
      {destinations.map((d, i) => (
        <motion.circle
          key={i}
          cx={d.x}
          cy={d.y}
          r={0.6}
          className={dark ? "fill-accent-light" : "fill-accent"}
          initial={{ scale: 0 }}
          whileInView={{ scale: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 1.4 + i * 0.15, type: "spring", stiffness: 300 }}
          style={{ transformOrigin: `${d.x}px ${d.y}px` }}
        />
      ))}
      <circle cx={origin.x} cy={origin.y} r={1.6} className={dark ? "fill-accent-light/25" : "fill-accent/20"}>
        <animate attributeName="r" values="0.8;2.4;0.8" dur="2.6s" repeatCount="indefinite" />
      </circle>
      <circle cx={origin.x} cy={origin.y} r={0.8} className={dark ? "fill-accent-light" : "fill-accent"} />
    </svg>
  );
}
