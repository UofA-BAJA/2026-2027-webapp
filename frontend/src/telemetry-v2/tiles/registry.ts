// Tile types: which component draws each size. A tile's `kind` (saved in layouts) picks the type.
// Add a tile type here (see ../README.md); the size switcher shows only for types with more than one size.
import type { ComponentType } from "react";
import ChartTile from "./ChartTile";
import { GpsLarge, GpsMedium, GpsSmall } from "./GpsTile";
import { GpsSettings } from "./parts/GpsSettings";
import NumberChartTile from "./NumberChartTile";
import NumberTile from "./NumberTile";
import type { SettingsProps, TileBodyProps } from "./types";

type Size = "small" | "medium" | "large";
// settings: types that have them get a gear button, which opens this panel over the tile
type TileType = { sizes: Size[]; views: Partial<Record<Size, ComponentType<TileBodyProps>>>; settings?: ComponentType<SettingsProps> };

export const TILE_TYPES: Record<"channel" | "xy", TileType> = {
  // one channel (or two on one chart): number, number + chart, chart
  channel: { sizes: ["small", "medium", "large"], views: { small: NumberTile, medium: NumberChartTile, large: ChartTile } },
  // the GPS track map with lap timing: map + lap time, + splits, + every lap
  xy: { sizes: ["small", "medium", "large"], views: { small: GpsSmall, medium: GpsMedium, large: GpsLarge }, settings: GpsSettings },
};
