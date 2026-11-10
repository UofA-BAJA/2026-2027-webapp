// Tile layout logic: sizes, the packer, saved-layout validation and drag-to-reorder.
import { CHANNELS, type ChannelId } from "../config/channels.ts";
import type { Preset } from "../config/presets.ts";
import { GRID } from "../config/theme.ts";

// Size is detail: small 1x1 = number, medium 2x1 = number + small chart, large 2x2 = chart.
export const SIZES = [
  { name: "small", w: 1, h: 1 },
  { name: "medium", w: 2, h: 1 },
  { name: "large", w: 2, h: 2 },
] as const;
export const sizeIndex = (t: { w: number; h: number }) => (t.w === 1 ? 0 : t.h === 1 ? 1 : 2);

// A tile as stored in a saved layout (localStorage), so this shape must not change.
export type Tile = {
  kind: "channel" | "xy"; // xy plots keys[0] against keys[1] (the GPS track) and is large only
  channels: ChannelId[]; // empty = just added, waiting for the user to pick; 2 channels = 2 y axes
  w: number;
  h: number;
  pick?: string; // overrides the channel's default number
};
export type PlacedTile = Tile & { id: string }; // stored: order and size only; pack() places them per column count

// A preset from config/presets.ts as tiles. Ids are stable per preset position.
export function presetTiles(p: Preset): PlacedTile[] {
  return p.tiles.map((t, i) => {
    const channels = Array.isArray(t.channel) ? t.channel : [t.channel];
    const size = SIZES.find((s) => s.name === t.size)!;
    return {
      kind: channels[0] === "track" ? "xy" : "channel",
      channels,
      w: size.w,
      h: size.h,
      ...(t.pick !== undefined && { pick: t.pick }),
      id: `${p.name}-${i}`,
    };
  });
}

// Grid columns by the grid's own width (not the window's), so split views work too.
export const colsFor = (width: number) => GRID.columns.find((c) => width >= c.minWidth)!.cols;

// Dense packing: each tile, in order, takes the first free cell scanning rows top to bottom.
// Only the order and sizes are stored; positions are recomputed for every column count.
export function pack<T extends { w: number; h: number }>(tiles: T[], cols: number): (T & { x: number; y: number })[] {
  const taken = new Set<string>();
  const fits = (x: number, y: number, w: number, h: number) => {
    for (let i = x; i < x + w; i++) for (let j = y; j < y + h; j++) if (taken.has(`${i},${j}`)) return false;
    return true;
  };
  return tiles.map((t) => {
    const w = Math.min(t.w, cols); // never refuse a size: a tile wider than the grid is clamped to it
    for (let y = 0; ; y++)
      for (let x = 0; x + w <= cols; x++)
        if (fits(x, y, w, t.h)) {
          for (let i = x; i < x + w; i++) for (let j = y; j < y + t.h; j++) taken.add(`${i},${j}`);
          return { ...t, w, x, y };
        }
  });
}

// A saved layout (from localStorage, so untrusted) is usable only if every tile is a known shape and channel.
// Anything else makes that preset fall back to its default.
export function validTiles(ts: unknown): boolean {
  if (!Array.isArray(ts)) return false;
  const ids = new Set<string>();
  return ts.every((t) => {
    if (!t || typeof t.id !== "string" || ids.has(t.id)) return false;
    ids.add(t.id);
    const shape = SIZES.some((s) => s.w === t.w && s.h === t.h);
    const chans = Array.isArray(t.channels) && t.channels.every((c: unknown) => typeof c === "string" && Object.hasOwn(CHANNELS, c));
    return shape && chans && (t.kind === "channel" || (t.kind === "xy" && t.w === 2 && t.h === 2)); // the GPS map is large-only
  });
}

// Drag-and-drop changes only the order, then pack() reflows. The dragged tile goes where pack() puts it exactly
// on the drop cell; if no order can (dense packing backfills a hole), it goes before the tile it was dropped on.
export function dropOrder<T extends PlacedTile>(tiles: T[], moved: T, drop: { x: number; y: number }, cols: number, before: Map<string, { x: number; y: number }>): T[] {
  const rest = tiles.filter((t) => t !== moved);
  const insert = (k: number) => [...rest.slice(0, k), moved, ...rest.slice(k)];
  const exact = rest.concat(moved).map((_, k) => insert(k)).find((o) => {
    const p = pack(o, cols).find((t) => t.id === moved.id)!;
    return p.x === drop.x && p.y === drop.y;
  });
  const k = rest.findIndex((t) => { const p = before.get(t.id)!; return p.y > drop.y || (p.y === drop.y && p.x >= drop.x); });
  return exact ?? insert(k < 0 ? rest.length : k);
}
