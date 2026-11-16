// Tile types: which component draws each size. A tile's `kind` (saved in layouts) picks the type.
// Add a tile type here (see ../README.md); the size switcher shows only for types with more than one size.
import type { ComponentType } from "react";
import ChartTile from "./ChartTile";
import type { Stream } from "../lib/stream";
import { GpsFull, gpsLabel, GpsMedium, GpsSmall } from "./GpsTile";
import { GpsSettings } from "./parts/GpsSettings";
import NumberChartTile from "./NumberChartTile";
import NumberTile from "./NumberTile";
import type { SettingsProps, TileBodyProps } from "./types";

export type Size = "small" | "medium" | "large";
type TileType = {
  sizes: Size[];
  views: Partial<Record<Size, ComponentType<TileBodyProps>>>;
  settings?: ComponentType<SettingsProps>; // types that have them get a gear button, which opens this panel over the tile
  full?: ComponentType<TileBodyProps>; // its own fullscreen view (no label foot), instead of the largest size
  label?: (s: Stream, size: Size) => string; // added after the channel label: " · 8.4 mi"
};

export const TILE_TYPES: Record<"channel" | "xy", TileType> = {
  // one channel (or two on one chart): number, number + chart, chart
  channel: { sizes: ["small", "medium", "large"], views: { small: NumberTile, medium: NumberChartTile, large: ChartTile } },
  // the GPS map: map + trail; medium adds the lap time once there's a lap box; fullscreen places the box
  xy: { sizes: ["small", "medium"], views: { small: GpsSmall, medium: GpsMedium }, settings: GpsSettings, full: GpsFull, label: gpsLabel },
};
