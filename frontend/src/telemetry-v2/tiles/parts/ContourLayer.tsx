import { useEffect, useState } from "react";
import { Pane, Polyline } from "react-leaflet";
import type { LatLon } from "../../lib/stream";

// The "contours" map background: elevation lines on black, from src/telemetry-v2/contours/*.geojson (generated from
// USGS elevation files by plugins/contours.ts). Loaded only when this background is picked; works offline.
// Drawn in their own pane under the track, as two paths (minor and major lines), so they skip the track's casing.

const FILES = import.meta.glob<string>("../../contours/*.geojson", { query: "?raw", import: "default" });
type Lines = { minor: LatLon[][]; major: LatLon[][] };
let cache: Promise<Lines> | undefined; // parsed once per page

function loadAll(): Promise<Lines> {
  cache ??= Promise.all(Object.values(FILES).map((f) => f())).then((texts) => {
    const out: Lines = { minor: [], major: [] };
    for (const text of texts) {
      for (const f of JSON.parse(text).features ?? []) {
        const lines = (f.geometry?.coordinates ?? []) as number[][][];
        (f.properties?.major ? out.major : out.minor).push(...lines.map((l) => l.map(([lo, la]) => [la, lo] as LatLon)));
      }
    }
    return out;
  });
  return cache;
}

export const hasContours = Object.keys(FILES).length > 0;

export function ContourLayer() {
  const [lines, setLines] = useState<Lines>();
  useEffect(() => void loadAll().then(setLines), []);
  if (!lines) return null;
  return (
    <Pane name="contours" style={{ zIndex: 350 }}>
      <Polyline positions={lines.minor} pathOptions={{ className: "tv2-map-contour" }} interactive={false} />
      <Polyline positions={lines.major} pathOptions={{ className: "tv2-map-contour major" }} interactive={false} />
    </Pane>
  );
}
