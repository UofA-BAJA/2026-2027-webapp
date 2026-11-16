// GPS geometry for the map: lat/lon <-> local metres, fitting a view into a box, and how far and fast the car went.
// Self-check: geo.check.ts.
import type { LatLon, Stream } from "./stream.ts";

export type M = [number, number]; // metres east (x) and south (y) of an origin, so y grows down like the screen

const M_PER_DEG_LAT = 110540;
const mPerDegLon = (lat: number) => 111320 * Math.cos((lat * Math.PI) / 180);

/** Metres east/south of `origin` and back. Flat-earth: fine for a site a few km across. */
export function projection(origin: LatLon) {
  const kx = mPerDegLon(origin[0]);
  return {
    toM: ([la, lo]: LatLon): M => [(lo - origin[1]) * kx, (origin[0] - la) * M_PER_DEG_LAT],
    toLL: ([x, y]: M): LatLon => [origin[0] - y / M_PER_DEG_LAT, origin[1] + x / kx],
  };
}

export const distM = (a: LatLon, b: LatLon) => Math.hypot((b[0] - a[0]) * M_PER_DEG_LAT, (b[1] - a[1]) * mPerDegLon(a[0]));

/** screen px = (metres - origin) * k */
export type View = { k: number; x0: number; y0: number };

/** The view that fits `pts` (metres) into a w × h box with `pad` of it spare on each side, at least `minSpan` m across. */
export function fitView(pts: M[], w: number, h: number, pad = 0.1, minSpan = 100): View {
  let [minX, maxX, minY, maxY] = [Infinity, -Infinity, Infinity, -Infinity];
  for (const [x, y] of pts) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  const k = Math.min((w * (1 - 2 * pad)) / Math.max(maxX - minX, minSpan), (h * (1 - 2 * pad)) / Math.max(maxY - minY, minSpan));
  return { k, x0: (minX + maxX) / 2 - w / 2 / k, y0: (minY + maxY) / 2 - h / 2 / k };
}

export const MIN_STEP_M = 3; // GPS wanders a metre or two while parked; moves shorter than this don't add distance

// Distance this run, fed only the fixes it hasn't seen (one per stream), so it stays cheap at 10 Hz.
const runs = new WeakMap<Stream, { n: number; anchor?: LatLon; m: number }>();

/** How far the car has gone this run (m) and its speed over the last second (m/s), from GPS alone. */
export function runStats(s: Stream) {
  const lat = s.history.gps_latitude ?? [];
  const lon = s.history.gps_longitude ?? [];
  const n = Math.min(lat.length, lon.length);
  let r = runs.get(s);
  if (!r) runs.set(s, (r = { n: 0, m: 0 }));
  for (; r.n < n; r.n++) {
    const p: LatLon = [lat[r.n][1], lon[r.n][1]];
    if (!r.anchor) r.anchor = p;
    const d = distM(r.anchor, p);
    if (d >= MIN_STEP_M) (r.m += d), (r.anchor = p);
  }
  // speed: from the fix a second or more back to the latest
  let i = n - 1;
  while (i > 0 && lat[n - 1][0] - lat[i][0] < 1) i--;
  const dt = n ? lat[n - 1][0] - lat[i][0] : 0;
  const speed = dt > 0 ? distM([lat[i][1], lon[i][1]], [lat[n - 1][1], lon[n - 1][1]]) / dt : 0;
  return { metres: r.m, speed };
}
