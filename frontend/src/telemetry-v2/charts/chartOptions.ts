// ECharts options for every time chart. Colors, sizes and tick counts come from config/theme.ts;
// units, decimals, limits and y ranges from config/channels.ts.
import { CHANNELS, type Channel } from "../config/channels";
import { CHART } from "../config/theme";
import type { Scale } from "../lib/axisRange";

export type AxisScale = Scale & { note?: string }; // note: "above range" / "below range" when grown past the configured axis
import { tsClock, tsClockShort } from "../lib/format";
import type { Tile } from "../lib/layout";
import { seriesLabel, windowed, type Point, type Stream } from "../lib/stream";

export type ChartMode = "medium" | "large" | "full"; // medium = 2×1, large = 2×2, full = fullscreen

// The tile's lines in the current window, grouped by channel (one y axis per channel, at most two).
export function chartData(tile: Tile, s: Stream, from: number) {
  return tile.channels.slice(0, 2).map((id) => {
    const ch: Channel = CHANNELS[id];
    return { ch, lines: ch.keys.map((k) => ({ key: k, data: windowed(s.history[k], from, ch.scale) })) };
  });
}
export type ChartData = ReturnType<typeof chartData>;

// lowest and highest value across a channel's lines, or undefined with no data yet
export function extent(lines: { data: Point[] }[]): [number, number] | undefined {
  let lo = Infinity, hi = -Infinity;
  for (const l of lines) for (const [, v] of l.data) { if (v < lo) lo = v; if (v > hi) hi = v; }
  return lo <= hi ? [lo, hi] : undefined;
}

const evenly = (from: number, to: number, n: number) => Array.from({ length: n }, (_, i) => from + ((to - from) * i) / (n - 1));
const num = (v: number) => String(+v.toPrecision(12)); // tick labels without float noise

// the dashed limit line for a channel with a redline or a governor, labeled at the right end.
// On a red OVER LIMIT tile it turns white, or it would vanish into the tile.
function limitLine(ch: Channel, alarm: boolean) {
  const v = ch.redline ?? ch.governor;
  if (v === undefined) return undefined;
  return {
    silent: true,
    symbol: "none",
    animation: false,
    lineStyle: { color: alarm ? CHART.limitOnAlarm : CHART.limit, type: "dashed", width: 1 },
    label: {
      position: "insideEndTop",
      formatter: `${ch.redline !== undefined ? "limit" : "governor"} ${v}`,
      color: alarm ? CHART.limitOnAlarm : CHART.limit,
      fontSize: CHART.fontSize,
    },
    data: [{ yAxis: v }],
  };
}

type Opts = {
  mode: ChartMode;
  tooltip: boolean; // off while customizing: dragging tiles under the pointer leaves tooltips stuck
  scales: (AxisScale | undefined)[]; // y range per channel (undefined = no data yet, let ECharts fit)
  alarm: boolean; // the tile is OVER LIMIT (red)
  tileColor: string; // the hover dot's ring
  hoverT?: number; // time under the mouse: each line gets a dot at its nearest point
};

// the data point closest to time t (points are in time order)
function nearest(data: Point[], t: number): Point | undefined {
  if (!data.length) return undefined;
  let lo = 0, hi = data.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (data[mid][0] < t) lo = mid + 1;
    else hi = mid;
  }
  return lo > 0 && t - data[lo - 1][0] < data[lo][0] - t ? data[lo - 1] : data[lo];
}

export function chartOption(data: ChartData, s: Stream, [from, to]: [number, number], { mode, tooltip, scales, tileColor, hoverT, alarm }: Opts) {
  const big = mode !== "medium";
  const dual = data.length > 1;
  const counts = CHART.ticks[mode];
  const meta: { unit: string; decimals: number }[] = []; // per series, for the tooltip
  const series = data.flatMap(({ ch, lines }, ci) =>
    lines.map((l, li) => {
      const color = CHART.lines[meta.length % CHART.lines.length];
      meta.push({ unit: ch.unit, decimals: Math.max(2, ch.decimals) }); // at least 2 decimals, so lat/lon changes show
      const dot = hoverT === undefined ? undefined : nearest(l.data, hoverT);
      return {
        name: dual ? ch.label : seriesLabel(l.key),
        yAxisIndex: ci,
        type: "line",
        showSymbol: false,
        // ECharts' own hover dot is dropped by every 10 Hz redraw, so the dot is drawn here instead, as part of the option
        emphasis: { disabled: true },
        // always present (empty when not hovered): the chart merges options, so a missing markPoint would keep the old dot
        markPoint: {
          silent: true,
          animation: false,
          symbol: "circle",
          symbolSize: CHART.hoverDot,
          itemStyle: { color, borderColor: tileColor, borderWidth: 2 },
          label: { show: false },
          data: dot ? [{ coord: dot }] : [],
        },
        sampling: "lttb",
        data: l.data,
        ...(li === 0 && { markLine: limitLine(ch, alarm) }),
      };
    }),
  );
  const legend = series.length > 1 && big;
  const times = to > from ? evenly(from, to, counts.x) : [];
  // minor time ticks every 10 s; long windows space them out so there are at most minorTimeMax
  const minorStep = Math.max(CHART.minorTimeStep, Math.ceil((to - from) / CHART.minorTimeMax / CHART.minorTimeStep) * CHART.minorTimeStep);
  const minorTimes: number[] = [];
  if (big && to > from) for (let t = Math.ceil(from / minorStep) * minorStep; t <= to; t += minorStep) minorTimes.push(t);

  const tick = (length: number, color: string, customValues?: number[]) => ({ show: true, inside: false, length, lineStyle: { color }, ...(customValues && { customValues }) });
  const label = { color: CHART.axisLabel, fontSize: CHART.fontSize, margin: CHART.labelMargin };
  return {
    animation: false,
    color: CHART.lines,
    textStyle: { fontFamily: "inherit" },
    grid: { left: 0, right: dual ? 0 : 8, top: legend ? 44 : 20, bottom: 0, containLabel: true }, // top: room for the unit above the axis
    legend: legend
      ? { left: 0, top: 0, icon: "rect", itemWidth: 10, itemHeight: 2, textStyle: { color: CHART.axisLabel, fontSize: CHART.fontSize } }
      : undefined,
    tooltip: {
      show: tooltip,
      // linked charts get the cursor line too; styles/tiles.css shows the box only on the chart under the mouse (:hover)
      showContent: true,
      trigger: "axis",
      confine: true,
      axisPointer: { type: "line", lineStyle: { color: CHART.hoverLine, width: 1, type: "solid" }, label: { show: false } },
      transitionDuration: 0,
      hideDelay: 0, // no fade, so nothing lingers after hover
      className: "tv2-tooltip",
      backgroundColor: CHART.tooltipBg,
      borderColor: CHART.tooltipBorder,
      textStyle: { color: CHART.tooltipText, fontSize: CHART.tooltipFontSize },
      formatter: (params: { axisValue: number; marker: string; seriesName: string; seriesIndex: number; value: Point }[]) =>
        `${tsClock(s, params[0]?.axisValue ?? to)}<br>` +
        params
          .map((p) => {
            const m = meta[p.seriesIndex];
            return `${p.marker}${series.length > 1 ? `${p.seriesName} ` : ""}<b>${+p.value[1].toFixed(m.decimals)} ${m.unit}</b>`;
          })
          .join("<br>"),
    },
    xAxis: [
      // every chart gets the exact page window, so the x axes (and linked cursors) line up
      {
        type: "value",
        min: from,
        max: to,
        axisLine: { show: true, lineStyle: { color: CHART.axisLine, width: 1 } },
        axisTick: tick(CHART.tickLength, CHART.tick, times),
        axisLabel: {
          ...label,
          customValues: times,
          // 12-hour clock; only the first label has am/pm, the last is "now"
          formatter: (v: number) => (v === times[times.length - 1] ? "now" : v === times[0] ? tsClock(s, v) : tsClockShort(s, v)),
          alignMinLabel: "left",
          alignMaxLabel: "right",
        },
        splitLine: { show: big, lineStyle: { color: CHART.gridV } },
      },
      // minor time ticks only (large charts): ECharts minor ticks can't sit at fixed 10 s, so a bare second axis draws them
      {
        type: "value",
        min: from,
        max: to,
        show: big,
        axisLine: { show: false },
        axisTick: tick(CHART.minorTickLength, CHART.minorTick, minorTimes),
        axisLabel: { show: false },
        splitLine: { show: false },
        axisPointer: { show: false },
      },
    ],
    yAxis: data.map(({ ch }, i) => {
      const sc = scales[i];
      return {
        type: "value",
        position: i ? "right" : "left",
        ...(sc ? { min: sc.min, max: sc.max, interval: sc.step } : { scale: true }),
        // the unit above the top tick, plus "above range" when the data pushed the axis past its configured range
        name: sc?.note ? (i ? `{u|${ch.unit}} {n|${sc.note}}` : `{n|${sc.note}} {u|${ch.unit}}`) : `{u|${ch.unit}}`,
        nameLocation: "end",
        nameGap: 8,
        nameTextStyle: {
          fontSize: CHART.fontSize,
          align: i ? "left" : "right",
          rich: { u: { color: CHART.unit, fontSize: CHART.fontSize }, n: { color: CHART.rangeNote, fontSize: CHART.fontSize } },
        },
        axisLine: { show: true, lineStyle: { color: CHART.axisLine, width: 1 } },
        axisTick: tick(CHART.tickLength, CHART.tick),
        axisLabel: { ...label, formatter: num },
        splitLine: { show: i === 0, lineStyle: { color: CHART.gridH } }, // one set of horizontal gridlines, from the first axis
        ...(big && { minorTick: { show: true, splitNumber: 2, length: CHART.minorTickLength, lineStyle: { color: CHART.minorTick } } }),
      };
    }),
    series,
  };
}
