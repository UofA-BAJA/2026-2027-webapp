import * as echarts from "echarts";
import ReactECharts from "echarts-for-react";
import { useRef, useState } from "react";
import { CHART } from "../config/theme";
import { useResize } from "../hooks/useResize";
import { niceScale, stickyRange, type Sticky } from "../lib/axisRange";
import type { Tile } from "../lib/layout";
import type { Stream } from "../lib/stream";
import { chartData, chartOption, extent, type AxisScale, type ChartMode } from "./chartOptions";

// time charts share one echarts group: hovering one moves the cursor line on all of them
const CURSOR_GROUP = "tv2-time";
echarts.connect(CURSOR_GROUP);

type Props = { tile: Tile; s: Stream; range: [number, number]; mode: ChartMode; tooltip: boolean; alarm?: boolean };

// The only ECharts wrapper. A time chart filling its box: the canvas is absolutely positioned, so it can never push
// the box bigger or keep it small, and it is resized explicitly whenever the box changes.
// It keeps each y axis range between renders, so auto ranges grow at once and shrink only after a few seconds.
export default function TimeSeriesChart({ tile, s, range, mode, tooltip, alarm = false }: Props) {
  const chart = useRef<ReactECharts>(null);
  const sticky = useRef<(Sticky | undefined)[]>([]);
  // where the mouse is over this chart; state, not a ref, so the dot follows the mouse at once instead of at the next data tick
  const [p, setPointer] = useState<{ x: number; y: number }>();
  const box = useResize(() => chart.current?.getEchartsInstance().resize());

  const data = chartData(tile, s, range[0]);
  const now = Date.now();
  const ticks = CHART.ticks[mode].y;
  const scales = data.map(({ ch, lines }, i): AxisScale | undefined => {
    const e = extent(lines);
    const floor = "auto" in ch.axis ? undefined : ch.axis;
    if (!e && !floor) return undefined;
    const [lo, hi] = e ?? [floor!.min, floor!.max];
    sticky.current[i] = stickyRange(sticky.current[i], lo, hi, ticks, now, CHART.autoShrinkMs, floor);
    const sc = sticky.current[i]!.scale;
    if (!floor) return sc;
    // a fixed range never clips: it grows past the configured range, and says so
    const base = niceScale(floor.min, floor.max, ticks);
    return { ...sc, note: sc.max > base.max ? "above range" : sc.min < base.min ? "below range" : undefined };
  });
  // the hover dot's ring matches whatever the tile is showing (normal, red over the limit, dark with no data, light theme)
  const tileEl = box.current?.closest(".tv2-tile");
  const tileColor = tileEl ? getComputedStyle(tileEl).backgroundColor : "transparent";
  // the time under the mouse (the window keeps moving, so convert the pixel again on every render);
  // only inside the plot area, where the tooltip shows too (not over the axis labels)
  const inst = chart.current?.getEchartsInstance();
  const inPlot = p && inst?.containPixel({ gridIndex: 0 }, [p.x, p.y]);
  const hoverT = inPlot ? Number(inst!.convertFromPixel({ xAxisIndex: 0 }, p!.x)) : undefined;
  const option = chartOption(data, s, range, { mode, tooltip, scales, tileColor, alarm, hoverT: Number.isFinite(hoverT) ? hoverT : undefined });

  return (
    <div
      className="tv2-chart"
      ref={box}
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        setPointer({ x: e.clientX - r.left, y: e.clientY - r.top });
      }}
      onMouseLeave={() => {
        setPointer(undefined);
        chart.current?.getEchartsInstance().dispatchAction({ type: "hideTip" });
      }}
    >
      <ReactECharts ref={chart} option={option} style={{ position: "absolute", inset: 0, height: "auto" }} onChartReady={(c) => { c.group = CURSOR_GROUP; }} />
    </div>
  );
}
