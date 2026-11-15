import { useSyncExternalStore } from "react";
import { TRACK } from "../config/track";
import { VENUE } from "../config/venues";
import { gateAcross, routeLength, type Course } from "../lib/course";
import { load, save } from "../lib/storage";
import { gpsTrace, type Stream } from "../lib/stream";

// The course every GPS tile and the lap timer use, shared, and saved per venue in localStorage so reloading the page
// mid-race keeps it. Until a track is picked or recorded it's the defaults in config/track.ts.

const KEY = "tv2-course-v1"; // { [venue id]: Course }
const DEFAULT: Course = { startFinish: TRACK.startFinish, splits: TRACK.splits };

let current: Course = load<Record<string, Course>>(KEY, {})[VENUE.id] ?? DEFAULT;
const listeners = new Set<() => void>();

/** Replace the course (undefined = back to the defaults) and save it. */
export function setCourse(c: Course | undefined) {
  current = c ?? DEFAULT;
  const all = load<Record<string, Course>>(KEY, {});
  if (c) all[VENUE.id] = c;
  else delete all[VENUE.id];
  save(KEY, all);
  listeners.forEach((l) => l());
}

const HEADING_FIXES = 5; // the car's direction is taken over this many fixes (0.5 s at 10 Hz)
const MIN_MOVE_M = 2; // closer than this over HEADING_FIXES = parked: no direction to put the line across

/**
 * Not wired to any button yet ("record new" and "use car's position now" are disabled in GPS settings).
 * Start/finish through the car's position now, square to the way it's heading; the next full lap becomes the route.
 * Clears the recorded route and splits. Returns an error message when the car isn't moving.
 */
export function markStartFinish(s: Stream): string | undefined {
  const n = Math.min(s.history.gps_latitude?.length ?? 0, s.history.gps_longitude?.length ?? 0);
  const from = gpsTrace(s, n - HEADING_FIXES, n - HEADING_FIXES + 1)[0];
  const at = gpsTrace(s, n - 1, n)[0];
  if (!from || !at || routeLength([from, at]) < MIN_MOVE_M) return "the car has to be moving to put the line across its path";
  setCourse({ startFinish: gateAcross(at, [2 * at[0] - from[0], 2 * at[1] - from[1]]), splits: [], recording: true });
}

export function useCourse(): Course {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => current,
  );
}
