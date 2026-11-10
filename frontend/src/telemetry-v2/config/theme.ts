// Look-and-feel values that code needs (ECharts is drawn on a canvas, so CSS can't style it). Data only.
// Every other color, font size and spacing lives in ../styles/tokens.css. Each value is defined in one place only:
// the few that both code and CSS need are defined here and handed to CSS as variables (CSS_VARS, set on the page root).

export const CHART = {
  lines: ["#81CEEB", "#e8a33d", "#e6e6e6", "#c06ce0"], // series colors in order; the first (Arizona light blue) is every chart's main line
  axisLabel: "#8a8a8a", // tick numbers, time labels and legend text
  unit: "#6e6e6e", // the unit above the top y tick
  axisLine: "#3a3a3a", // the axis lines themselves
  gridH: "#2e2e2e", // horizontal gridlines (large and medium)
  gridV: "#262626", // vertical gridlines (large only)
  tick: "#6e6e6e", // major ticks, at every label
  minorTick: "#454545", // minor ticks (large charts only)
  limit: "#AB0520", // dashed redline / governor line (Arizona Red: a car problem)
  limitOnAlarm: "rgba(255,255,255,0.7)", // the same line on a red OVER LIMIT tile, where red would vanish
  rangeNote: "#8a8a8a", // "above range" next to the unit when the data pushed the axis past its configured range
  hoverLine: "rgba(255,255,255,0.4)", // vertical cursor line
  tooltipBg: "#000000", // hover box
  tooltipBorder: "#3a3a3a",
  tooltipText: "#e6e6e6",
  fontSize: 11, // px, tick labels, unit and legend
  tooltipFontSize: 12, // px
  tickLength: 5, // px, major ticks, outside the axis line
  minorTickLength: 3, // px
  labelMargin: 11, // px between the axis and its labels
  minorTimeStep: 10, // s between minor ticks on the time axis
  minorTimeMax: 60, // most minor time ticks on one chart (long windows space them out instead)
  hoverDot: 8, // px, the dot on the hovered point; its 2px ring is the tile's own color
  autoShrinkMs: 3000, // an auto y range grows at once but waits this long before shrinking
  // tick counts per chart size: y = value ticks, x = time labels (first with am/pm, last "now")
  ticks: {
    medium: { y: 3, x: 3 },
    large: { y: 5, x: 5 },
    full: { y: 7, x: 7 }, // fullscreen: the large rules with more ticks
  },
};

// Grid sizing used by the tile packer; `pad` is also the page gutter in CSS (--page-pad).
export const GRID = {
  gap: 8, // px between tiles
  pad: 16, // px around the grid
  // columns by the grid's own width (not the window's), widest first
  columns: [
    { minWidth: 1200, cols: 6 },
    { minWidth: 800, cols: 4 },
    { minWidth: 0, cols: 2 },
  ],
};

export const RADIO_PANEL_WIDTH = 420; // px, the radio panel (most of a narrow window gets less)
export const UNIT_FONT = 18; // px, the unit after the big number; the number shrinks to leave room for it
export const LOGO_SWAP_BELOW = 1100; // px window width: the wordmark becomes the cactus mark below this
export const EASTER_EGG_HOLD_MS = 800; // hold the logo this long to play the video
export const SWIPE_MIN = 20; // px of horizontal wheel/trackpad movement that counts as a preset swipe
export const SWIPE_COOLDOWN_MS = 600; // one preset change per swipe

// The values above that CSS also uses, as CSS variables (set on the page root by TelemetryV2.tsx).
export const CSS_VARS = {
  "--page-pad": `${GRID.pad}px`,
  "--panel-width": `${RADIO_PANEL_WIDTH}px`,
  "--fs-unit": `${UNIT_FONT}px`,
};
