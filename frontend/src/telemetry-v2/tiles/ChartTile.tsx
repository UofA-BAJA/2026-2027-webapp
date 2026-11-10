import { chartOption } from "../charts/chartOptions";
import TimeSeriesChart from "../charts/TimeSeriesChart";
import type { TileBodyProps } from "./types";

// large (2×2) and fullscreen: the full chart with axes. A multi-key channel (wheel rpm) or a two-channel tile
// (speed + motor rpm) draws one line per key with a legend; two channels get a y axis each.
export default function ChartTile({ tile, s, range, a }: TileBodyProps) {
  return <TimeSeriesChart option={chartOption(tile, s, range, !a.customizing)} />;
}
