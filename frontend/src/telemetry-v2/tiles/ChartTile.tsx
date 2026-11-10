import TimeSeriesChart from "../charts/TimeSeriesChart";
import type { TileBodyProps } from "./types";

// large (2×2) and fullscreen: the full chart with axes. A multi-key channel (wheel rpm) or a two-channel tile
// (speed + motor rpm) draws one line per key with a legend; two channels get a y axis each. Fullscreen gets more ticks.
export default function ChartTile({ tile, s, range, a, lim }: TileBodyProps) {
  return <TimeSeriesChart tile={tile} s={s} range={range} mode={a.full ? "full" : "large"} tooltip={!a.customizing} alarm={lim?.state === "over"} />;
}
