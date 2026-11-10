import { chartOption } from "../charts/chartOptions";
import TimeSeriesChart from "../charts/TimeSeriesChart";
import Reading from "./parts/Reading";
import type { TileBodyProps } from "./types";

// medium (2×1): the number bottom-left, a compact chart (lines and ticks, no labels) filling the right
export default function NumberChartTile({ tile, s, range, a, ch, r, stale }: TileBodyProps) {
  return (
    <div className="tv2-medium">
      <Reading ch={ch} r={r} stale={stale} />
      <TimeSeriesChart option={chartOption(tile, s, range, !a.customizing, true)} />
    </div>
  );
}
