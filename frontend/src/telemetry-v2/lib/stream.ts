// The live data the page keeps in memory, and helpers that read it.
import type { Channel } from "../config/channels.ts";

export type Point = [number, number];
export type Stream = {
  latest: Record<string, number>;
  history: Record<string, Point[]>;
  at: Record<string, number>; // when each key last arrived (Date.now()), for "no data"
  rssi: number;
  lastAt: number;
  frames: number;
  startedAt: number;
  firstTs?: number;
  lastTs?: number;
};

// points at or after `from`, scaled for display
export function windowed(h: Point[] = [], from: number, scale = 1): Point[] {
  let i = h.length;
  while (i > 0 && h[i - 1][0] >= from) i--;
  return h.slice(i).map(([t, v]) => [t, v * scale]);
}

// the shared x range for the page window: [from, to] in stream seconds
export function timeRange(s: Stream, secs: number): [number, number] {
  const to = s.lastTs ?? 0;
  const first = s.firstTs ?? 0;
  return [Math.max(first, to - secs), to]; // never before the first point, so a fresh run fills the width
}

// legend labels for multi-key channels: raw key minus the shared prefix
export const seriesLabel = (key: string) =>
  key
    .replace(/^(wheel_rpm|brake_pressure|shock_displacement|imu_acceleration|imu_rotation)_/, "")
    .replace(/_/g, " ");

// The single number a tile shows: one key, or avg / max across a multi-key channel.
export function reading(ch: Channel, pick: string | undefined, s: Stream) {
  const multi = ch.keys.length > 1;
  const p = multi ? (pick ?? ch.pick ?? "avg") : ch.keys[0];
  const label = multi ? ` · ${p === "avg" || p === "max" ? p : seriesLabel(p)}` : "";
  const vals = (p === "avg" || p === "max" ? ch.keys : [p]).map((k) => s.latest[k]).filter((v) => v !== undefined);
  if (!vals.length) return { text: "--", label, v: undefined };
  const v = (p === "max" ? Math.max(...vals) : vals.reduce((a, b) => a + b, 0) / vals.length) * (ch.scale ?? 1);
  return { text: v.toFixed(ch.decimals), label, v };
}
export type Reading = ReturnType<typeof reading>;
