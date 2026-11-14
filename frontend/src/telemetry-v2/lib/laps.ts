// Lap and split timing from the GPS trace. A lap ends when the car crosses the start/finish line; a split is
// recorded when it crosses the next split line (in order; a missed one is skipped). Lines and settings are in config/track.ts.
import { TRACK, type Gate, type LatLon } from "../config/track.ts";
import type { Stream } from "./stream.ts";

export type Lap = {
  start: number; // stream ts (s) it crossed start/finish, interpolated between fixes
  startIdx: number; // GPS history index of the first fix of the lap
  splits: (number | undefined)[]; // ts at each split line; shorter than the split count while the lap runs, a hole where one was missed
  splitIdx: (number | undefined)[];
  end?: number; // set when the lap is complete
  endIdx?: number;
};

// The whole run so far. Before the first start/finish crossing there is no lap (the out lap isn't timed).
export type Laps = {
  laps: Lap[]; // completed laps, then the current one last
  next: number; // the split line the current lap crosses next
  dir?: number; // which way the car crossed start/finish the first time; the other way doesn't count
  prev?: { ts: number; ll: LatLon };
  n: number; // fixes read so far
};

export const newLaps = (): Laps => ({ laps: [], next: 0, n: 0 });

// Where the step p → q crosses gate g: u = how far along the step (0..1], side = which way it crossed.
// Plain lat/lon works: crossing points and sides don't change under the cos(latitude) stretch of longitude.
function cross(g: Gate, p: LatLon, q: LatLon) {
  const r = [q[0] - p[0], q[1] - p[1]];
  const s = [g.b[0] - g.a[0], g.b[1] - g.a[1]];
  const den = r[0] * s[1] - r[1] * s[0];
  if (den === 0) return undefined;
  const w = [g.a[0] - p[0], g.a[1] - p[1]];
  const u = (w[0] * s[1] - w[1] * s[0]) / den;
  const v = (w[0] * r[1] - w[1] * r[0]) / den;
  // (0, 1]: a fix exactly on the line counts for the step that arrives there, not again for the step leaving it
  return u > 0 && u <= 1 && v >= 0 && v <= 1 ? { u, side: Math.sign(den) } : undefined;
}

/** Feed one GPS fix (in order). Updates `st` in place. */
export function addFix(st: Laps, ts: number, ll: LatLon, track = TRACK) {
  const p = st.prev;
  const i = st.n++;
  st.prev = { ts, ll };
  if (!p) return;
  const at = (u: number) => p.ts + u * (ts - p.ts);
  const cur = st.laps.find((l) => l.end === undefined);
  // the next split line, or a later one if the car missed some (left the course, GPS dropout): those stay unknown
  for (let k = st.next; cur && k < track.splits.length; k++) {
    const sc = cross(track.splits[k], p.ll, ll);
    if (!sc) continue;
    cur.splits[k] = at(sc.u);
    cur.splitIdx[k] = i;
    st.next = k + 1;
    break;
  }
  const c = cross(track.startFinish, p.ll, ll);
  if (!c || (st.dir !== undefined && c.side !== st.dir)) return;
  const t = at(c.u);
  if (cur && t - cur.start < track.minLapSeconds) return;
  if (cur) Object.assign(cur, { end: t, endIdx: i });
  st.laps.push({ start: t, startIdx: i, splits: [], splitIdx: [] });
  st.next = 0;
  st.dir ??= c.side;
}

// One tracker per stream, fed only the fixes it hasn't seen, so every GPS tile shares it and it stays cheap.
const runs = new WeakMap<Stream, Laps>();
export function lapsFor(s: Stream): Laps {
  let st = runs.get(s);
  if (!st) runs.set(s, (st = newLaps()));
  const lat = s.history.gps_latitude ?? [];
  const lon = s.history.gps_longitude ?? [];
  const n = Math.min(lat.length, lon.length); // both come from the same frame, so index i pairs them
  for (let i = st.n; i < n; i++) addFix(st, lat[i][0], [lat[i][1], lon[i][1]]);
  return st;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : undefined);

/** Segment times of a lap (S1 = start → first split, last = last split → finish); undefined where a line was missed. */
export function segments(l: Lap, nSeg: number) {
  const b = [l.start, ...Array.from({ length: nSeg - 1 }, (_, k) => l.splits[k]), l.end];
  return b.slice(0, -1).map((t, k) => (t !== undefined && b[k + 1] !== undefined ? b[k + 1]! - t : undefined));
}

/** Everything the GPS tiles show, at stream time `now`. Averages are over completed laps. */
export function lapSummary(st: Laps, now: number, nSeg = TRACK.splits.length + 1) {
  const done = st.laps.filter((l) => l.end !== undefined);
  const cur = st.laps.find((l) => l.end === undefined);
  const lapSegs = done.map((l) => segments(l, nSeg));
  const times = done.map((l) => l.end! - l.start);
  const avgSegs = Array.from({ length: nSeg }, (_, k) => mean(lapSegs.map((s) => s[k]).filter((t) => t !== undefined)));
  // the current lap: segments before st.next are behind the car, then the running one, timed from the split just crossed
  const curSegs = cur ? segments(cur, nSeg) : [];
  if (cur && st.next < nSeg) curSegs[st.next] = now - (st.next ? cur.splits[st.next - 1]! : cur.start);
  const segDelta = curSegs.map((t, k) => (k < st.next && t !== undefined && avgSegs[k] !== undefined ? t - avgSegs[k]! : undefined));
  // live delta: this lap's finished segments against their averages; nothing to compare until a split is done
  const finished = segDelta.slice(0, st.next);
  const delta = cur && st.next && finished.every((d) => d !== undefined) ? finished.reduce((a, b) => a! + b!, 0) : undefined;
  return {
    nSeg,
    done,
    lapSegs,
    times,
    cur,
    curTime: cur && now - cur.start,
    curSegs,
    curDone: cur ? st.next : 0, // segments finished this lap
    segDelta,
    delta,
    avgSegs,
    avgLap: mean(times),
    bestLap: times.length ? Math.min(...times) : undefined,
    lastLap: times.at(-1),
  };
}
export type LapSummary = ReturnType<typeof lapSummary>;

/** The one rule for coloring a time: "ahead" of the average (green), "behind" (red), or "" (white: nothing to compare). */
export const timeTone = (delta: number | undefined) => (delta === undefined || delta === 0 ? "" : delta < 0 ? "ahead" : "behind");
