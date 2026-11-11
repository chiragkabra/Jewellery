import "server-only";
import DottedMap from "dotted-map";
import { markets } from "@/data/markets";
import { site } from "@/data/site";

export interface MapData {
  width: number;
  height: number;
  points: { x: number; y: number }[];
  origin: { x: number; y: number };
  destinations: { x: number; y: number; label: string }[];
}

let cache: MapData | null = null;

/** Computed on the server at build time — the browser only receives coordinates. */
export function getWorldMapData(): MapData {
  if (cache) return cache;
  const map = new DottedMap({ height: 56, grid: "diagonal" });
  const points = map.getPoints().map(({ x, y }) => ({ x, y }));
  const pin = (lat: number, lng: number) => {
    const p = map.getPin({ lat, lng });
    return p ? { x: p.x, y: p.y } : { x: 0, y: 0 };
  };
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  cache = {
    width: Math.ceil(Math.max(...xs)) + 1,
    height: Math.ceil(Math.max(...ys)) + 1,
    points,
    origin: pin(site.hq.lat, site.hq.lng),
    destinations: markets.map((m) => ({ ...pin(m.lat, m.lng), label: m.region })),
  };
  return cache;
}
