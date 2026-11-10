import { useState } from "react";
import type { Preset } from "../config/presets";
import { presetTiles, validTiles, type PlacedTile } from "../lib/layout";
import { load, save } from "../lib/storage";

const KEY = "tv2-layouts-v4";

// Edited tile orders per preset (per viewer, browser only); config/presets.ts holds the defaults.
// v3 stored x/y per tile; its row-by-row order becomes the v4 order. An invalid preset layout falls back to the default.
function loadLayouts(): Record<string, PlacedTile[]> {
  const saved =
    load<Record<string, PlacedTile[]> | null>(KEY, null) ??
    Object.fromEntries(
      Object.entries(load<Record<string, (PlacedTile & { x?: number; y?: number })[]>>("tv2-layouts-v3", {})).map(([k, ts]) => [
        k,
        Array.isArray(ts) ? [...ts].sort((a, b) => (a.y ?? 0) - (b.y ?? 0) || (a.x ?? 0) - (b.x ?? 0)).map(({ x: _x, y: _y, ...t }) => t) : ts,
      ]),
    );
  return Object.fromEntries(Object.entries(saved && typeof saved === "object" ? saved : {}).filter(([, ts]) => validTiles(ts)));
}

// The current preset's tiles (saved edit, else the default) and a setter that saves.
export function useLayouts(preset: Preset) {
  const [layouts, setLayouts] = useState(loadLayouts);
  const tiles = layouts[preset.name] ?? presetTiles(preset);
  const setTiles = (next: PlacedTile[]) => {
    const all = { ...layouts, [preset.name]: next };
    setLayouts(all);
    save(KEY, all);
  };
  return { tiles, setTiles };
}
