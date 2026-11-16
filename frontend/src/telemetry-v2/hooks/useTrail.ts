import type { Stream } from "../lib/stream";
import { persisted } from "./persisted";

// How much trail the GPS map draws behind the car (GPS settings → TRAIL), and "clear trail".
export const TRAILS = [
  { id: "2m", label: "last 2 min", seconds: 120 },
  { id: "10m", label: "last 10 min", seconds: 600 },
  { id: "run", label: "whole run", seconds: Infinity },
] as const;
export type TrailId = (typeof TRAILS)[number]["id"];
export const [useTrail, setTrail] = persisted<TrailId>("tv2-gps-trail-v1", "10m");

// clear trail: the trail starts again from now (this run only; the run's data is untouched)
const clearedAt = new WeakMap<Stream, number>();
export const clearTrail = (s: Stream) => clearedAt.set(s, s.lastTs ?? 0);
export const trailStart = (s: Stream, seconds: number) => Math.max((s.lastTs ?? 0) - seconds, clearedAt.get(s) ?? -Infinity);
