// The lap box: a north-up rectangle across the start/finish. Driving into it starts a new lap.
// Until the car can take the box (SET_LAP_BOX) and report laps itself, the web app detects them here as a preview:
// detectLap() is the one function to swap for the car's laps. Laps go into the run data as the "lap" series
// ([ts, lap number]), so the CSV export (runCsv in stream.ts) and every tile read them from there. Self-check: lapBox.check.ts.
import { LAPS } from "../config/laps.ts";
import { M_PER_DEG_LAT, mPerDegLon } from "./geo.ts";
import type { LatLon, Stream } from "./stream.ts";

export type Box = { minLat: number; maxLat: number; minLon: number; maxLon: number };

/** A box `w` × `h` metres centered on `at`. */
export function boxAround([lat, lon]: LatLon, w: number, h: number): Box {
  const dLat = h / 2 / M_PER_DEG_LAT;
  const dLon = w / 2 / mPerDegLon(lat);
  return { minLat: lat - dLat, maxLat: lat + dLat, minLon: lon - dLon, maxLon: lon + dLon };
}

/** The box's size in metres, east-west × north-south. */
export const boxSizeM = (b: Box): [number, number] => [(b.maxLon - b.minLon) * mPerDegLon((b.minLat + b.maxLat) / 2), (b.maxLat - b.minLat) * M_PER_DEG_LAT];

/** The same box with min ≤ max (after dragging a corner past the opposite one). */
export const normalized = (b: Box): Box => ({
  minLat: Math.min(b.minLat, b.maxLat), maxLat: Math.max(b.minLat, b.maxLat),
  minLon: Math.min(b.minLon, b.maxLon), maxLon: Math.max(b.minLon, b.maxLon),
});

const inside = (b: Box, [la, lo]: LatLon) => la >= b.minLat && la <= b.maxLat && lo >= b.minLon && lo <= b.maxLon;

// How far along p → q (0..1) the step enters the box, or undefined if it doesn't (Liang–Barsky clipping), so the lap
// starts between fixes, where the car actually crossed the edge.
function entersAt(b: Box, p: LatLon, q: LatLon) {
  let [t0, t1] = [0, 1];
  const d = [q[0] - p[0], q[1] - p[1]];
  for (const [delta, lo, hi, v] of [[d[0], b.minLat, b.maxLat, p[0]], [d[1], b.minLon, b.maxLon, p[1]]]) {
    if (delta === 0) {
      if (v < lo || v > hi) return undefined;
      continue;
    }
    const [a, c] = [(lo - v) / delta, (hi - v) / delta];
    t0 = Math.max(t0, Math.min(a, c));
    t1 = Math.min(t1, Math.max(a, c));
  }
  return t0 <= t1 ? t0 : undefined;
}

const runs = new WeakMap<Stream, { box?: Box; prev?: { ts: number; ll: LatLon } }>();

/**
 * Feed every GPS fix, in order. Entering `box` (from outside) starts a new lap, pushed onto s.history.lap as
 * [ts it entered, lap number]; entering again within `reentrySeconds` of the last lap start is ignored.
 * A new or moved box starts fresh: a car already inside it has to leave and come back.
 */
export function detectLap(s: Stream, ts: number, ll: LatLon, box: Box | undefined, reentrySeconds = LAPS.reentrySeconds) {
  let r = runs.get(s);
  if (!r || r.box !== box) runs.set(s, (r = { box }));
  const p = r.prev;
  r.prev = { ts, ll };
  if (!box || !p || inside(box, p.ll)) return;
  const t = entersAt(box, p.ll, ll);
  if (t === undefined) return;
  const at = p.ts + t * (ts - p.ts);
  const laps = (s.history.lap ??= []);
  if (laps.length && at - laps[laps.length - 1][0] < reentrySeconds) return;
  laps.push([at, laps.length + 1]);
  s.latest.lap = laps.length;
}

/** Lap number, current lap time, and last/best of the completed ones, at stream time `now`. */
export function lapStats(s: Stream, now = s.lastTs ?? 0) {
  const starts = (s.history.lap ?? []).map((p) => p[0]);
  const times = starts.slice(1).map((t, i) => t - starts[i]);
  return {
    lap: starts.length, // 0 = no lap yet
    current: starts.length ? now - starts[starts.length - 1] : undefined,
    last: times.at(-1),
    best: times.length ? Math.min(...times) : undefined,
  };
}
