// Builds docs/telemetry-v2-overview.pptx: the same overview as the PDF, as an editable deck.
// Run from this folder after `npm install` (once) and `node capture.mjs` (for fresh screenshots): node pptx.mjs
// Every title, caption, code snippet, recipe and table is editable text or a native table; only screenshots are images.
// Colors and fonts are the deck theme (Design → Variants in PowerPoint), and each slide sits on one of two layouts.
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import pptxgen from "pptxgenjs";
import { DATE, ROOT, biggest, files, folders, groups, inline, noEndpoint, open, recipes, snipChannel, snipColors, snipPreset, tokenize } from "./data.mjs";

const HERE = new URL(".", import.meta.url).pathname;
const OUT = join(ROOT, "docs/telemetry-v2-overview.pptx");

// The app's palette as the deck theme. It's a dark deck, so "dark 1" (text) is white and "light 1" (background) is black.
const THEME = {
  name: "Telemetry v2",
  headFontFace: "Inter",
  bodyFontFace: "Inter",
  colors: {
    dk1: "FFFFFF", // text: titles and strong text
    lt1: "000000", // background
    dk2: "9A9A9A", // muted text: captions, kicker, notes
    lt2: "141414", // card fill
    accent1: "AB0520", // Arizona Red: the car has a problem
    accent2: "0C234B", // Arizona Blue: the data has a problem
    accent3: "81CEEB", // chart light blue: code, links
    accent4: "E8A33D", // orange: strings, "to confirm"
    accent5: "222222", // tile gray
    accent6: "3A3A3A", // lines and borders
    hlink: "81CEEB",
    folHlink: "9A9A9A",
  },
};
const HEX = THEME.colors; // for the few options that take hex only (table borders)
const MONO = "Courier New";

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.333 × 7.5 in
pres.title = "Baja Wildcat Racing · Telemetry v2";
pres.author = "June";
pres.subject = "Telemetry v2 redesign overview";
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
const C = pres.SchemeColor;

// ---- layouts ----
const X = 0.6, W = 12.13; // content margins
pres.defineSlideMaster({
  title: "Cover",
  background: { color: C.background1 },
  objects: [
    { image: { path: join(HERE, "shots/header-1440.png"), x: 0, y: 0, w: 13.333, h: 13.333 * (184 / 2880), altText: "The Telemetry v2 header: Baja Wildcat Racing wordmark, preset pivot and ridges" } },
    { placeholder: { options: { name: "title", type: "title", x: 0.9, y: 2.35, w: 11.6, h: 1.1, fontSize: 48, color: C.text1, margin: 0, valign: "bottom" }, text: "" } },
    { placeholder: { options: { name: "subtitle", type: "body", x: 0.9, y: 3.6, w: 11.6, h: 0.6, fontSize: 20, color: C.text2, margin: 0 }, text: "" } },
    { placeholder: { options: { name: "meta", type: "body", x: 0.9, y: 4.6, w: 11.6, h: 0.4, fontSize: 14, color: C.text2, margin: 0 }, text: "" } },
    { placeholder: { options: { name: "note", type: "body", x: 0.9, y: 6.55, w: 11.6, h: 0.5, fontSize: 10, color: C.text2, margin: 0 }, text: "" } },
  ],
});
pres.defineSlideMaster({
  title: "Content",
  background: { color: C.background1 },
  objects: [
    { placeholder: { options: { name: "kicker", type: "body", x: X, y: 0.38, w: W, h: 0.3, fontSize: 11, color: C.accent1, bold: true, charSpacing: 2, margin: 0 }, text: "" } },
    { placeholder: { options: { name: "title", type: "title", x: X, y: 0.7, w: W, h: 0.7, fontSize: 32, color: C.text1, margin: 0, valign: "top" }, text: "" } },
  ],
  slideNumber: { x: 12.33, y: 7.02, w: 0.4, h: 0.3, fontSize: 10, color: C.text2, align: "right" },
});

// ---- helpers ----
const pngSize = (f) => {
  const b = readFileSync(join(HERE, "shots", f + ".png"));
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
};
// place a screenshot inside a box, keeping its shape; returns where it landed
function shot(slide, f, box, { alt = f, align = "left", valign = "top" } = {}) {
  const { w: pw, h: ph } = pngSize(f);
  const k = Math.min(box.w / pw, box.h / ph);
  const w = pw * k, h = ph * k;
  const x = box.x + (align === "center" ? (box.w - w) / 2 : align === "right" ? box.w - w : 0);
  const y = box.y + (valign === "middle" ? (box.h - h) / 2 : valign === "bottom" ? box.h - h : 0);
  slide.addImage({ path: join(HERE, "shots", f + ".png"), x, y, w, h, altText: alt, objectName: f });
  slide.addShape(pres.ShapeType.rect, { x, y, w, h, fill: { type: "none" }, line: { color: C.accent6, width: 0.75 }, objectName: f + " frame" });
  return { x, y, w, h };
}
// "**Label** · text" caption under a box
const caption = (slide, label, text, box, size = 11) =>
  slide.addText(
    [
      { text: label, options: { bold: true, color: C.text1 } },
      { text: text ? " · " + text : "", options: { color: C.text2 } },
    ],
    { x: box.x, y: box.y, w: box.w, h: box.h ?? 0.5, fontSize: size, margin: 0, valign: "top", isTextBox: true, objectName: "caption " + label },
  );
// inline segments → text runs
const runs = (segs, base = {}) =>
  segs.map((g) => ({ text: g.text, options: { ...base, ...(g.code ? { fontFace: MONO, color: C.accent3 } : g.bold ? { bold: true, color: C.text1 } : {}) } }));
// a code snippet as colored, editable monospace text
function codeBox(slide, title, code, box, size = 10) {
  slide.addShape(pres.ShapeType.rect, { x: box.x, y: box.y, w: box.w, h: box.h, fill: { color: C.background2 }, line: { color: C.accent6, width: 0.75 }, objectName: title + " box" });
  slide.addText(title.toUpperCase(), { x: box.x + 0.12, y: box.y + 0.06, w: box.w - 0.24, h: 0.22, fontSize: 10, color: C.text2, charSpacing: 1, margin: 0, isTextBox: true, objectName: title + " title" });
  const color = { c: C.text2, s: C.accent4, n: C.accent3, h: C.accent3, t: C.text1 };
  const lines = [[]];
  for (const tk of tokenize(code))
    tk.text.split("\n").forEach((part, i) => {
      if (i) lines.push([]);
      if (part) lines.at(-1).push({ text: part, options: { color: color[tk.kind] } });
    });
  const out = lines.flatMap((l, i) => {
    const r = l.length ? l : [{ text: " ", options: {} }];
    r.at(-1).options = { ...r.at(-1).options, breakLine: i < lines.length - 1 };
    return r;
  });
  slide.addText(out, { x: box.x + 0.12, y: box.y + 0.32, w: box.w - 0.24, h: box.h - 0.38, fontFace: MONO, fontSize: size, lineSpacingMultiple: 1.0, margin: 0, valign: "top", isTextBox: true, objectName: title + " code" });
}
const content = (section, kicker, title) => {
  const s = pres.addSlide({ masterName: "Content", sectionTitle: section });
  s.addText("TELEMETRY V2  ·  " + kicker.toUpperCase(), { placeholder: "kicker" });
  s.addText(title, { placeholder: "title" });
  return s;
};
const TOP = 1.6; // content starts here on every content slide

// ---- 1. cover ----
pres.addSection({ title: "Overview" });
{
  const s = pres.addSlide({ masterName: "Cover", sectionTitle: "Overview" });
  s.addText([{ text: "Baja Wildcat Racing " }, { text: "·", options: { color: C.accent1 } }, { text: " Telemetry v2" }], { placeholder: "title" });
  s.addText("The live dashboard, redesigned: what changed, and how to change it.", { placeholder: "subtitle" });
  s.addText(`${DATE}  ·  Design: June`, { placeholder: "meta" });
  s.addText("All screenshots are the running app on the team's mock data server, captured with headless Chrome at 1440px. Where a state needed a specific value, the capture script holds that one value (cvt temp, speed).", { placeholder: "note" });
}

// ---- 2. before / after ----
{
  const s = content("Overview", "Before / after", "From a page of plots to a live dashboard");
  const half = (W - 0.4) / 2;
  const a = shot(s, "before-old-ui", { x: X, y: TOP, w: half, h: 4.4 }, { alt: "The original /telemetry page" });
  const b = shot(s, "after-overview", { x: X + half + 0.4, y: TOP, w: half, h: 4.4 }, { alt: "The /telemetry-v2 overview at 1440px" });
  caption(s, "Before", "the original /telemetry page (unchanged since main): one plot per sensor axis", { x: a.x, y: a.y + a.h + 0.15, w: a.w, h: 0.6 }, 12);
  caption(s, "After", "/telemetry-v2 overview at 1440px: every system on one screen, numbers and charts together", { x: b.x, y: b.y + b.h + 0.15, w: b.w, h: 0.6 }, 12);
}

// ---- 3. goals ----
{
  const s = content("Overview", "Goals", "Four goals, in this order");
  const goals = [
    ["Information density", "The overview fits 9 channels on one 1440px screen. A tile grows from a number to a number + chart to a full chart."],
    ["Simplicity", "One tile component in three sizes, and two alarm colors with one meaning each: red for the car, blue for the data."],
    ["Lightweight", `No new dependencies (React, ECharts and react-grid-layout were already in the project). The largest file is ${biggest.lines} lines.`],
    ["Easy handoff", "Limits, ranges, presets and colors live in config/ and tokens.css, with README recipes and self-checks."],
  ];
  const cw = (W - 3 * 0.3) / 4;
  goals.forEach(([t, d], i) => {
    const x = X + i * (cw + 0.3);
    s.addShape(pres.ShapeType.rect, { x, y: TOP, w: cw, h: 2.1, fill: { color: C.background2 }, line: { color: C.accent6, width: 0.75 }, objectName: "goal " + (i + 1) });
    s.addText(String(i + 1), { x: x + 0.2, y: TOP + 0.15, w: 0.6, h: 0.45, fontSize: 24, color: i === 3 ? C.accent3 : C.accent1, bold: true, margin: 0, isTextBox: true });
    s.addText(t, { x: x + 0.2, y: TOP + 0.62, w: cw - 0.4, h: 0.35, fontSize: 16, bold: true, color: C.text1, margin: 0, isTextBox: true });
    s.addText(d, { x: x + 0.2, y: TOP + 0.98, w: cw - 0.4, h: 1.05, fontSize: 12, color: C.text2, margin: 0, valign: "top", isTextBox: true });
  });
  shot(s, "after-overview", { x: X, y: TOP + 2.35, w: W, h: 3.0 }, { alt: "The overview" });
}

// ---- 4. tile system ----
pres.addSection({ title: "The design" });
{
  const s = content("The design", "The tile system", "One tile, three sizes");
  s.addText("Shapes never change with window width; the grid packs them in order at 6, 4 or 2 columns.", { x: X, y: 1.38, w: W, h: 0.3, fontSize: 14, color: C.text2, margin: 0, isTextBox: true });
  const base = 6.1; // bottoms line up here
  const items = [
    ["tile-small", 1.95, "Small · 1×1", "the number, the limit bar and the label"],
    ["tile-medium", 3.95, "Medium · 2×1", "the number and a compact chart"],
    ["tile-large", 3.95, "Large · 2×2", "the chart only, with axes"],
  ];
  let x = X + 0.2;
  for (const [f, w, l, t] of items) {
    const { h: ph, w: pw } = pngSize(f);
    const h = (w * ph) / pw;
    const r = shot(s, f, { x, y: base - h, w, h }, { alt: l });
    caption(s, l, t, { x: r.x, y: base + 0.12, w: r.w, h: 0.6 }, 12);
    x += w + 0.55;
  }
}

// ---- 5. states ----
{
  const s = content("The design", "States", "A tile tells you when something is wrong");
  const states = [
    ["state-normal", "Normal", "92 °C, gray bar"],
    ["state-warming", "Warming", "103 °C, the red outline starts"],
    ["state-near", "Near limit", "112 °C, 60% of warn → limit"],
    ["state-over", "Over limit", "125 °C, the whole tile turns red"],
    ["state-nodata", "No data", "nothing for 3 s+, blue edge"],
  ];
  const w = (W - 4 * 0.2) / 5;
  states.forEach(([f, l, t], i) => {
    const r = shot(s, f, { x: X + i * (w + 0.2), y: TOP + 0.2, w, h: 3 }, { alt: l });
    caption(s, l, t, { x: r.x, y: r.y + r.h + 0.12, w: r.w, h: 0.7 }, 12);
  });
  const legend = [
    [C.accent1, "Arizona Red #AB0520", "means the car has a problem."],
    [C.accent2, "Arizona Blue #0C234B", "means the data has a problem."],
  ];
  legend.forEach(([c, l, t], i) => {
    const x = X + i * 6.1;
    s.addShape(pres.ShapeType.rect, { x, y: 5.95, w: 0.32, h: 0.32, fill: { color: c }, line: { color: C.accent6, width: 0.75 }, objectName: l + " swatch" });
    s.addText([{ text: l, options: { bold: true, color: C.text1 } }, { text: " " + t, options: { color: C.text2 } }], { x: x + 0.48, y: 5.92, w: 5.4, h: 0.4, fontSize: 16, margin: 0, valign: "middle", isTextBox: true });
  });
}

// ---- 6. charts ----
{
  const s = content("The design", "Charts", "Charts you can actually read");
  const items = [
    ["chart-hover", "cvt temp, large, hovered", "y range from the channel (0–150 °C), round ticks, 12-hour times ending in “now”, dashed “limit 120”, and a tooltip on this chart only"],
    ["chart-above-range", "speed, large", "configured 0–60 mph; the data is at 63.5 mph, so the axis grows to 75 and says “above range” instead of clipping"],
  ];
  items.forEach(([f, l, t], i) => {
    const x = X + i * 6.15;
    const r = shot(s, f, { x, y: TOP, w: 4.3, h: 4.3 }, { alt: l });
    caption(s, l, t, { x: r.x, y: r.y + r.h + 0.12, w: 5.6, h: 0.85 }, 12);
  });
}

// ---- 7. presets and the pivot ----
{
  const s = content("The design", "Presets and the pivot", "The header adapts to the window");
  const rows = [
    ["header-1440", W, "1440px", "wordmark, three preset names centered, all controls"],
    ["header-960", (W * 960) / 1440, "960px (half of a 1920 screen)", "cactus mark, only the active preset name"],
    ["header-700", (W * 700) / 1440, "700px", "the same, still with every control"],
  ];
  let y = TOP;
  for (const [f, w, l, t] of rows) {
    const r = shot(s, f, { x: X, y, w, h: 2 }, { alt: l });
    caption(s, l, t, { x: X, y: r.y + r.h + 0.1, w: W, h: 0.35 }, 12);
    y = r.y + r.h + 0.6;
  }
  s.addText("Swipe or the arrow keys move between presets: overview, drivetrain, suspension, brakes, imu, gps, custom.", { x: X, y: y + 0.1, w: W, h: 0.4, fontSize: 14, color: C.text2, margin: 0, isTextBox: true });
}

// ---- 8. customize ----
{
  const s = content("The design", "Customize mode", "Rearrange, resize, focus");
  const w = (W - 2 * 0.3) / 3;
  const top = [
    ["customize-mode", "Customize", "tiles step back; each shows only ×; “+ add tile” at the end"],
    ["customize-drag", "Drag", "a tile mid-drag; dropping changes only its place in the order"],
    ["fullscreen", "Fullscreen", "any tile as a large chart over the grid; Esc to exit"],
  ];
  top.forEach(([f, l, t], i) => {
    const r = shot(s, f, { x: X + i * (w + 0.3), y: TOP, w, h: 2.6 }, { alt: l });
    caption(s, l, t, { x: r.x, y: r.y + r.h + 0.1, w: r.w, h: 0.55 }, 11);
  });
  // resize: three shots side by side at one height
  const fsz = ["resize-small", "resize-medium", "resize-large"].map((f) => ({ f, ...pngSize(f) }));
  const gap = 0.3, avail = W - 2 * gap;
  const h = Math.min(1.5, avail / fsz.reduce((a, z) => a + z.w / z.h, 0));
  let x = X;
  for (const z of fsz) {
    const r = shot(s, z.f, { x, y: 4.9, w: (h * z.w) / z.h, h }, { alt: z.f.replace("-", " ") });
    x += r.w + gap;
  }
  caption(s, "Resize", "the size button cycles small → medium → large; the tiles after it reflow", { x: X, y: 4.9 + h + 0.1, w: W, h: 0.4 }, 11);
}

// ---- 9. radio ----
{
  const s = content("The design", "Radio panel", "Talking to the car");
  const r = shot(s, "radio-panel", { x: X, y: TOP, w: 3, h: 5.3 }, { alt: "The radio panel open from the header" });
  const t = shot(s, "radio-trigger", { x: r.x + r.w + 0.7, y: TOP, w: 2.4, h: 0.7 }, { alt: "The radio button in the header" });
  const facts = [
    ["Frequency", "0.1 MHz steps, kept inside 902–928 MHz"],
    ["Data from car", "the 10 firmware data types, “9 of 10 · all except gps”"],
    ["Commands", "IDs copied from the firmware’s Commands.h; end log asks first; emergency stop is hold-for-2 s"],
    ["Not connected to car", "every send POSTs to /api/radio/command and says so when nothing answers. No button silently does nothing."],
  ];
  s.addText(
    facts.flatMap(([l, d], i) => [
      { text: l, options: { bold: true, color: C.text1, bullet: { indent: 18 }, paraSpaceAfter: 12 } },
      { text: " · " + d, options: { color: C.text2, breakLine: i < facts.length - 1 } },
    ]),
    { x: t.x, y: t.y + t.h + 0.45, w: X + W - t.x, h: 3.6, fontSize: 16, margin: 0, valign: "top", isTextBox: true, objectName: "radio facts" },
  );
}

// ---- 10. how customizable it is ----
pres.addSection({ title: "Handoff" });
{
  const s = content("Handoff", "How customizable it is", "Change the data, not the code");
  const cx = X, cw = 7.55, sx = X + cw + 0.35, sw = W - cw - 0.35;
  const rows = [
    ["config/channels.ts · one channel", snipChannel, 1.72],
    ["config/presets.ts · one preset", snipPreset, 2.1],
    ["styles/tokens.css · color roles", snipColors, 1.3],
  ];
  let y = 1.5;
  const ys = [];
  for (const [title, code, h] of rows) {
    codeBox(s, title, code, { x: cx, y, w: cw, h }, 10);
    ys.push([y, h]);
    y += h + 0.15;
  }
  // what each one controls
  let r = shot(s, "state-warming", { x: sx, y: ys[0][0], w: sw, h: ys[0][1] - 0.45 }, { alt: "A warming cvt temp tile" });
  s.addText(runs(inline("`warnAt` and `redline` drive the bar, the outline, the status and the chart’s limit line")), { x: sx, y: r.y + r.h + 0.06, w: sw, h: 0.38, fontSize: 10, color: C.text2, margin: 0, isTextBox: true });
  r = shot(s, "after-overview", { x: sx, y: ys[1][0], w: sw, h: ys[1][1] - 0.4 }, { alt: "The overview grid" });
  s.addText("This list is the overview grid, in order", { x: sx, y: r.y + r.h + 0.06, w: sw, h: 0.3, fontSize: 10, color: C.text2, margin: 0, isTextBox: true });
  const pw = (sw - 0.15) / 2;
  const a = shot(s, "state-over", { x: sx, y: ys[2][0], w: pw, h: ys[2][1] - 0.4 }, { alt: "An over-limit tile" });
  shot(s, "state-nodata", { x: sx + pw + 0.15, y: ys[2][0], w: pw, h: ys[2][1] - 0.4 }, { alt: "A no-data tile" });
  s.addText(runs(inline("`--alarm` and `--data-problem` on the tiles")), { x: sx, y: a.y + a.h + 0.06, w: sw, h: 0.3, fontSize: 10, color: C.text2, margin: 0, isTextBox: true });
}

// ---- 11–12. recipes, three per slide ----
for (const [k, part] of [recipes.slice(0, 3), recipes.slice(3)].entries()) {
  const s = content("Handoff", `Recipes ${k + 1} of 2`, "Recipes from the README");
  const cw = (W - 2 * 0.35) / 3;
  part.forEach((rcp, i) => {
    const x = X + i * (cw + 0.35);
    s.addShape(pres.ShapeType.rect, { x, y: TOP, w: cw, h: 5.35, fill: { color: C.background2 }, line: { color: C.accent6, width: 0.75 }, objectName: "recipe " + rcp.title });
    s.addText(rcp.title, { x: x + 0.22, y: TOP + 0.18, w: cw - 0.44, h: 0.62, fontSize: 18, bold: true, color: C.text1, margin: 0, valign: "top", isTextBox: true });
    let n = 0;
    const body = rcp.blocks.flatMap((b, j) => {
      const last = j === rcp.blocks.length - 1;
      const para = b.type === "p" ? {} : { bullet: b.type === "ol" ? { type: "number", numberStartAt: ++n } : { indent: 14 }, indentLevel: b.sub ? 1 : 0 };
      if (b.type !== "ol") n = 0;
      const rr = runs(b.segs, { color: C.text2 });
      rr[0].options = { ...rr[0].options, ...para, paraSpaceAfter: 6 };
      rr.at(-1).options = { ...rr.at(-1).options, breakLine: !last };
      return rr;
    });
    s.addText(body, { x: x + 0.22, y: TOP + 0.85, w: cw - 0.44, h: 4.35, fontSize: 14, margin: 0, valign: "top", isTextBox: true, objectName: "recipe text " + rcp.title });
  });
}

// ---- 13. code structure ----
{
  const s = content("Handoff", "Code structure", `${files.length} files, none over 250 lines`);
  // folders spread over four columns, each a native table: folder row, what it's for, then its files and line counts
  const entries = Object.entries(groups);
  const cols = [[], [], [], []];
  const weight = (fs) => fs.length + 2;
  const total = entries.reduce((a, [, fs]) => a + weight(fs), 0);
  let acc = 0;
  for (const e of entries) {
    cols[Math.min(3, Math.floor((acc / total) * 4))].push(e);
    acc += weight(e[1]);
  }
  const cw = (W - 3 * 0.3) / 4;
  const border = { type: "none" };
  cols.forEach((col, i) => {
    const rows = [];
    for (const [g, fs] of col) {
      rows.push([{ text: g === "." ? "telemetry-v2/" : g + "/", options: { colspan: 2, bold: true, color: C.accent3, fontFace: MONO, fontSize: 11 } }]);
      if (folders[g]) rows.push([{ text: runs(inline(folders[g]), { color: C.text2 }), options: { colspan: 2, fontSize: 9 } }]);
      for (const f of fs) rows.push([{ text: f.path.split("/").pop(), options: { fontFace: MONO, color: C.text1 } }, { text: String(f.lines), options: { align: "right", color: C.text2 } }]);
    }
    s.addTable(rows, { x: X + i * (cw + 0.3), y: TOP, w: cw, colW: [cw - 0.55, 0.55], fontSize: 10, margin: [1, 3, 1, 3], border, rowH: 0.19, objectName: "file tree " + (i + 1) });
  });
}

// ---- 14. still open ----
{
  const s = content("Handoff", "Still open", "For the team to fill in");
  const head = ["Channel", "Value", "Now in config", "Status", "Team value"].map((t) => ({ text: t.toUpperCase(), options: { bold: true, color: C.text2, fontSize: 10, border: [null, null, { type: "solid", pt: 1, color: HEX.accent6 }, null] } }));
  const line = { type: "solid", pt: 0.5, color: "262626" };
  const rows = open.map((o) => [
    { text: o.ch, options: { color: C.text1 } },
    { text: o.field, options: { fontFace: MONO, color: C.accent3 } },
    { text: [{ text: o.value, options: { fontFace: MONO, color: C.text1 } }, ...(o.note ? [{ text: "   " + o.note, options: { color: C.text2, fontSize: 10 } }] : [])] },
    { text: o.status, options: { color: o.status === "confirmed" ? C.text2 : C.accent4 } },
    { text: "", options: { border: [null, null, { type: "solid", pt: 1, color: HEX.accent6 }, null] } },
  ]);
  s.addTable([head, ...rows], { x: X, y: TOP - 0.1, w: W, colW: [1.7, 1.25, 4.6, 1.5, W - 9.05], fontSize: 12, margin: [2, 6, 2, 6], rowH: 0.27, border: [null, null, line, null], objectName: "open values" });
  const items = [
    [C.accent1, "Pit → car commands.", ` Every command POSTs to /api/radio/command. From sendCommand.ts: “${noEndpoint}” The panel says “not connected to car”.`],
    [C.accent2, "Error codes.", " The radio sends error_code as a bare uint32 (tools/radio_to_json.py); nothing defines what each code means."],
  ];
  items.forEach(([c, l, t], i) => {
    const x = X + i * 6.15;
    s.addShape(pres.ShapeType.rect, { x, y: 6.05, w: 0.14, h: 0.14, fill: { color: c }, line: { color: C.accent6, width: 0.5 }, objectName: l });
    s.addText([{ text: l, options: { bold: true, color: C.text1 } }, { text: t, options: { color: C.text2 } }], { x: x + 0.3, y: 5.98, w: 5.75, h: 0.95, fontSize: 11, margin: 0, valign: "top", isTextBox: true });
  });
}

await pres.writeFile({ fileName: OUT });

// ---- theme: pptxgenjs can't write theme colors, so put the palette into ppt/theme/theme1.xml ----
const JSZip = createRequire(import.meta.url)("jszip");
const zip = await JSZip.loadAsync(readFileSync(OUT));
const part = "ppt/theme/theme1.xml";
const slots = ["dk1", "lt1", "dk2", "lt2", "accent1", "accent2", "accent3", "accent4", "accent5", "accent6", "hlink", "folHlink"];
const scheme = `<a:clrScheme name="${THEME.name}">` + slots.map((k) => `<a:${k}><a:srgbClr val="${THEME.colors[k]}"/></a:${k}>`).join("") + "</a:clrScheme>";
const xml = (await zip.file(part).async("string")).replace(/<a:clrScheme\b[\s\S]*?<\/a:clrScheme>/, scheme).replace(/(<a:(?:theme|fontScheme)\b[^>]*?\bname=")[^"]*"/g, `$1${THEME.name}"`);
if (!xml.includes(scheme)) throw new Error("no color scheme in " + part);
zip.file(part, xml);
for (const name of Object.keys(zip.files)) {
  if (zip.files[name].dir) { delete zip.files[name]; continue; } // folder entries aren't parts
  if (!name.endsWith(".xml")) continue;
  const bad = (await zip.file(name).async("string")).match(/<a:srgbClr val="((?![0-9A-Fa-f]{6}")[^"]*)"/);
  if (bad) throw new Error(`${name}: a scheme color was given to a hex-only option (${bad[1]})`);
}
writeFileSync(OUT, await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
console.log(`pptx: ${OUT.replace(ROOT, "")} (${pres.slides.length} slides)`);
