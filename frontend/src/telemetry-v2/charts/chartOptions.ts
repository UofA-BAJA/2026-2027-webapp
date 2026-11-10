// ECharts options for every time chart. Colors and sizes come from config/theme.ts; y axis ranges from config/channels.ts.
import { CHANNELS, type Channel } from "../config/channels";
import { CHART } from "../config/theme";
import { tsClock } from "../lib/format";
import type { Tile } from "../lib/layout";
import { seriesLabel, windowed, type Stream } from "../lib/stream";

const AXIS = {
  axisLabel: { color: CHART.axisLabel, fontSize: CHART.fontSize, margin: CHART.labelMargin }, // clears the outside ticks
  axisLine: { show: true, lineStyle: { color: CHART.axisLine, width: 1 } },
  axisTick: { show: true, inside: false, length: CHART.tickLength, lineStyle: { color: CHART.tick } },
  splitLine: { show: false },
  scale: true,
};

// minor ticks for large charts only; splitNumber = segments per major interval
const minor = (splitNumber: number) => ({
  minorTick: { show: true, length: CHART.minorTickLength, splitNumber, lineStyle: { color: CHART.minorTick } },
});

// a channel's y axis range: fit the data, or the fixed min/max from channels.ts
const yRange = (ch: Channel) => ("auto" in ch.axis ? {} : { min: ch.axis.min, max: ch.axis.max });

// compact = the small chart inside a medium tile: lines, axis lines and major ticks; no legend or labels
export function chartOption(tile: Tile, s: Stream, [from, to]: [number, number], tooltip: boolean, compact = false) {
  const chs: Channel[] = tile.channels.map((c) => CHANNELS[c]);
  const dual = chs.length > 1;
  const series = chs.flatMap((ch, ci) =>
    ch.keys.map((k) => ({
      name: dual ? ch.label : seriesLabel(k),
      // at least the channel's own decimals, so lat/lon changes show in the tooltip
      tooltip: { valueFormatter: (v: unknown) => (typeof v === "number" ? String(+v.toFixed(Math.max(2, ch.decimals))) : String(v)) },
      yAxisIndex: ci,
      type: "line",
      showSymbol: false,
      sampling: "lttb",
      data: windowed(s.history[k], from, ch.scale),
    })),
  );
  const legend = series.length > 1 && !compact;
  return {
    animation: false,
    color: CHART.lines,
    textStyle: { fontFamily: "inherit" },
    grid: compact
      ? { left: 6, right: dual ? 6 : 0, top: 4, bottom: 6 } // room for the outside ticks
      : { left: 0, right: 0, top: legend ? 30 : 8, bottom: 0, containLabel: true },
    legend: legend
      ? { left: 0, top: 0, icon: "rect", itemWidth: 10, itemHeight: 2, textStyle: { color: CHART.axisLabel, fontSize: CHART.fontSize } }
      : undefined,
    // no fade and no hide delay, so nothing lingers after hover
    tooltip: {
      show: tooltip, // off while customizing: dragging tiles under the pointer leaves tooltips stuck
      showContent: !compact, // medium tiles show only the linked cursor line; a box would cover their number
      trigger: "axis",
      valueFormatter: (v: unknown) => (typeof v === "number" ? String(+v.toFixed(2)) : String(v)),
      className: "tv2-tooltip",
      transitionDuration: 0,
      hideDelay: 0,
      backgroundColor: CHART.tooltipBg,
      borderColor: CHART.tooltipBorder,
      textStyle: { color: CHART.tooltipText, fontSize: CHART.fontSize },
    },
    // every chart gets the exact page window so the x axes (and linked cursors) line up
    xAxis: {
      type: "value",
      ...AXIS,
      axisLabel: { ...AXIS.axisLabel, show: false },
      ...(compact ? {} : minor(CHART.minorSplitTime)),
      axisPointer: { label: { formatter: ({ value }: { value: number }) => tsClock(s, value) } }, // tooltip header
      scale: true,
      min: from,
      max: to,
    },
    yAxis: chs.slice(0, 2).map((ch, i) => ({
      type: "value",
      ...AXIS,
      ...yRange(ch),
      position: i ? "right" : "left",
      ...(compact ? { axisLabel: { show: false } } : minor(CHART.minorSplitValue)),
    })),
    series,
  };
}
