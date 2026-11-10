import type { Channel } from "../config/channels.ts";

// min = where the bar starts (default 0), max = the limit, warn = where the red outline meter starts.
export type Limit = { min?: number; warn?: number; max: number };

// A channel's limits from channels.ts: warnAt/redline (cvt temp), or idle → governor (motor rpm, no warn).
export function channelLimit(ch: Channel): Limit | undefined {
  if (ch.redline !== undefined) return { warn: ch.warnAt, max: ch.redline };
  if (ch.governor !== undefined) return { min: ch.idle, max: ch.governor };
  return undefined;
}

// Where a value sits against its limit: bar fill (0..1), outline meter (0..100 of the perimeter) and status.
export function limitState(v: number | undefined, l: Limit) {
  if (v === undefined) return { state: "ok" as const, fill: 0, meter: 0 };
  const min = l.min ?? 0;
  const fill = Math.min(1, Math.max(0, (v - min) / (l.max - min)));
  // a plain range (no warn, e.g. the governor) is fine AT max; only going over it is a problem
  if (l.warn === undefined ? v > l.max : v >= l.max) return { state: "over" as const, fill: 1, meter: 100 };
  if (l.warn !== undefined && v >= l.warn) return { state: "warn" as const, fill, meter: ((v - l.warn) / (l.max - l.warn)) * 100 };
  return { state: "ok" as const, fill, meter: 0 };
}

export type LimitState = ReturnType<typeof limitState>;
