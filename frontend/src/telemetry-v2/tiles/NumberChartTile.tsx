import TimeSeriesChart from "../charts/TimeSeriesChart";
import Reading from "./parts/Reading";
import type { TileBodyProps } from "./types";

// medium (2×1): the number bottom-left, a compact chart filling the right (3 y ticks, start / middle / now, horizontal gridlines)
export default function NumberChartTile({ tile, s, range, a, ch, r, stale, lim }: TileBodyProps) {
  return (
    <div className="tv2-medium">
      <Reading ch={ch} r={r} stale={stale} />
      <TimeSeriesChart tile={tile} s={s} range={range} mode="medium" tooltip={!a.customizing} alarm={lim?.state === "over"} />
    </div>
  );
}
