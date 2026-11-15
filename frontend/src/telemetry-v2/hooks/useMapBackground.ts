import type { MapBackground } from "../config/map";
import { persisted } from "./persisted";

// The GPS map's background (GPS settings → BACKGROUND), saved in this browser.
export const [useMapBackground, setMapBackground] = persisted<MapBackground>("tv2-map-bg-v1", "satellite");
