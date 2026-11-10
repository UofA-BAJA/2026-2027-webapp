// Look-and-feel values that code needs (ECharts is drawn on a canvas, so CSS can't style it). Data only.
// Every other color, font size and spacing lives in ../styles/tokens.css. A value is defined in one place only;
// where both sides need the same number it says so.

export const CHART = {
  lines: ["#81CEEB", "#e8a33d", "#e6e6e6", "#c06ce0"], // series colors in order; the first (Arizona light blue) is every chart's main line
  axisLabel: "#9a9a9a", // y axis numbers and legend text
  axisLine: "#444444", // the axis lines themselves
  tick: "#6e6e6e", // major ticks
  minorTick: "#454545", // minor ticks (large charts only)
  tooltipBg: "#000000", // hover box
  tooltipBorder: "#3a3a3a",
  tooltipText: "#e6e6e6",
  fontSize: 12, // axis, legend and tooltip text (never below 12)
  tickLength: 5, // px, major ticks, outside the axis line
  minorTickLength: 3, // px
  labelMargin: 11, // px between the axis and its numbers (clears the ticks)
  minorSplitTime: 3, // minor ticks per major step on the time axis (10 s when the step is 30 s)
  minorSplitValue: 2, // minor ticks per major step on the y axis
};

// Grid sizing used by the tile packer. Must match the grid gaps in tokens.css (--grid-gap, --page-pad).
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

export const RADIO_PANEL_WIDTH = 420; // px; must match --panel-width in tokens.css
export const LOGO_SWAP_BELOW = 1100; // px window width: the wordmark becomes the cactus mark below this (header.css uses the same number)
export const EASTER_EGG_HOLD_MS = 800; // hold the logo this long to play the video
export const SWIPE_MIN = 20; // px of horizontal wheel/trackpad movement that counts as a preset swipe
export const SWIPE_COOLDOWN_MS = 600; // one preset change per swipe
