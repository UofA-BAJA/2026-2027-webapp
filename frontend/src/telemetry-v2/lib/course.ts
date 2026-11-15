// The endurance course: start/finish, split lines and the route, and the geometry that makes them.
// Pure functions; the state lives in hooks/useCourse.ts, files are read in routeFiles.ts and tracks.ts.
// Self-check: course.check.ts.
import type { Gate, LatLon } from "../config/track.ts";

export type Course = {
  startFinish?: Gate; // undefined = no lap timing
  splits: Gate[];
  route?: LatLon[]; // in driving order
  recording?: boolean; // start/finish was just marked: the first complete lap becomes the route
  trackId?: string; // the saved track this came from (tracks/ or the browser); unset = recorded or loaded, not saved
};

export const GATE_WIDTH = 15; // m, start/finish and split lines: wider than the course so a wide line still crosses
const SPLITS = 3; // S1–S4

const M_PER_DEG_LAT = 110540;
const mPerDegLon = (lat: number) => 111320 * Math.cos((lat * Math.PI) / 180);
const dist = (a: LatLon, b: LatLon) => Math.hypot((b[0] - a[0]) * M_PER_DEG_LAT, (b[1] - a[1]) * mPerDegLon(a[0]));

/** A line `width` m long through `at`, square to the direction from `at` toward `toward`. */
export function gateAcross(at: LatLon, toward: LatLon, width = GATE_WIDTH): Gate {
  const kx = mPerDegLon(at[0]);
  const [dx, dy] = [(toward[1] - at[1]) * kx, (toward[0] - at[0]) * M_PER_DEG_LAT];
  const len = Math.hypot(dx, dy) || 1;
  // perpendicular unit vector (−dy, dx), half the width each side
  const [px, py] = [(-dy / len) * (width / 2), (dx / len) * (width / 2)];
  const round = (v: number) => Math.round(v * 1e7) / 1e7;
  return {
    a: [round(at[0] + py / M_PER_DEG_LAT), round(at[1] + px / kx)],
    b: [round(at[0] - py / M_PER_DEG_LAT), round(at[1] - px / kx)],
  };
}

/** Route length in metres. */
export const routeLength = (r: LatLon[]) => r.slice(1).reduce((m, p, i) => m + dist(r[i], p), 0);

/** n split lines at equal distances along the route (n = 3: a quarter, half and three quarters of the way). */
export function autoSplits(route: LatLon[], n = SPLITS): Gate[] {
  const total = routeLength(route);
  if (route.length < 3 || total === 0) return [];
  const out: Gate[] = [];
  let d = 0;
  for (let i = 1, k = 1; i < route.length && k <= n; i++) {
    const step = dist(route[i - 1], route[i]);
    while (k <= n && d + step >= (total * k) / (n + 1)) {
      out.push(gateAcross(route[i - 1], route[i]));
      k++;
    }
    d += step;
  }
  return out;
}
