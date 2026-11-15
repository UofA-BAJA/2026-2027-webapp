import { persisted } from "./persisted";

// The GPS tile's mode (GPS settings → MODE), saved in this browser: free run (just the map, no lap timing) or
// endurance (laps on the course).
export type GpsMode = "free" | "endurance";
export const [useGpsMode, setGpsMode] = persisted<GpsMode>("tv2-gps-mode-v1", "endurance");
