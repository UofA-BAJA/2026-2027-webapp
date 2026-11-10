// Tile types: which component draws each size. A tile's `kind` (saved in layouts) picks the type.
// Add a tile type here (see ../README.md); the size switcher shows only for types with more than one size.
import type { ComponentType } from "react";
import ChartTile from "./ChartTile";
import GpsTile from "./GpsTile";
import NumberChartTile from "./NumberChartTile";
import NumberTile from "./NumberTile";
import type { TileBodyProps } from "./types";

type Size = "small" | "medium" | "large";
type TileType = { sizes: Size[]; views: Partial<Record<Size, ComponentType<TileBodyProps>>> };

export const TILE_TYPES: Record<"channel" | "xy", TileType> = {
  // one channel (or two on one chart): number, number + chart, chart
  channel: { sizes: ["small", "medium", "large"], views: { small: NumberTile, medium: NumberChartTile, large: ChartTile } },
  // the GPS track map, large only
  xy: { sizes: ["large"], views: { large: GpsTile } },
};
