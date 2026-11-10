// Builds docs/telemetry-v2-overview.html from the repo and the screenshots in shots/, then prints it to
// docs/telemetry-v2-overview.pdf with headless Chrome on :9333 (see cdp.mjs).
// Run from this folder: node build.mjs        (node capture.mjs first to refresh the screenshots)
// Code snippets, README recipes, the file tree and the TODO table are read from the repo every time, so they stay real.
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { connect, sleep } from "./cdp.mjs";
import { DATE, ROOT, biggest, files, folders, groups, inline, noEndpoint, open, recipes, snipChannel, snipColors, snipPreset, tokenize } from "./data.mjs";

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// code tokens → highlighted HTML
const hl = (code) =>
  tokenize(code)
    .map(({ kind, text }) => (kind === "t" ? esc(text) : kind === "h" ? `<i class="h" style="--sw:${text}">${text}</i>` : `<i class="${kind}">${esc(text)}</i>`))
    .join("");
// inline segments → HTML
const segs = (ss) => ss.map((g) => (g.code ? `<code>${esc(g.text)}</code>` : g.bold ? `<b>${esc(g.text)}</b>` : esc(g.text))).join("");
const inlineHtml = (s) => segs(inline(s));
// recipe blocks → HTML lists and paragraphs
const recipeHtml = (blocks) => {
  let html = "", list = "";
  for (const b of blocks) {
    if (b.type === "p") {
      if (list) { html += `</${list}>`; list = ""; }
      html += `<p>${segs(b.segs)}</p>`;
    } else {
      if (list !== b.type) { html += list ? `</${list}>` : ""; html += `<${b.type}>`; list = b.type; }
      html += `<li${b.sub ? ' class="sub"' : ""}>${segs(b.segs)}</li>`;
    }
  }
  return html + (list ? `</${list}>` : "");
};

// ---- page shell ----
let n = 0;
const page = (section, body, cls = "") => `
<section class="page ${cls}">
  ${section ? `<div class="kicker"><span>Telemetry v2</span>${section}</div>` : ""}
  ${body}
  <div class="folio">${++n}</div>
</section>`;
const img = (f, alt, cls = "") => `<img class="shot ${cls}" src="telemetry-v2-overview/shots/${f}.png" alt="${esc(alt)}">`;
const fig = (f, cap, cls = "") => `<figure class="${cls}">${img(f, cap)}<figcaption>${cap}</figcaption></figure>`;
const code = (title, src) => `<div class="code"><div class="code-title">${title}</div><pre>${hl(src)}</pre></div>`;

const pages = [
  page("", `
    <div class="cover">
      ${img("header-1440", "The telemetry v2 header with the Baja Wildcat Racing wordmark and ridges", "cover-header")}
      <div class="cover-text">
        <h1>Baja Wildcat Racing <span>·</span> Telemetry v2</h1>
        <p class="lede">The live dashboard, redesigned: what changed, and how to change it.</p>
        <p class="meta">${DATE} &nbsp;·&nbsp; Design: June</p>
      </div>
      <p class="note">All screenshots are the running app on the team's mock data server, captured with headless Chrome at 1440px. Where a state needed a specific value, the capture script holds that one value (cvt temp, speed).</p>
    </div>`, "cover-page"),

  page("Before / after", `
    <h2>From a page of plots to a live dashboard</h2>
    <div class="two">
      ${fig("before-old-ui", "<b>Before</b> · the original /telemetry page (unchanged since main): one plot per sensor axis")}
      ${fig("after-overview", "<b>After</b> · /telemetry-v2 overview at 1440px: every system on one screen, numbers and charts together")}
    </div>`),

  page("Goals", `
    <h2>Four goals, in this order</h2>
    <div class="goals">
      <div class="goal"><div class="num">1</div><h3>Information density</h3><p>The overview fits 9 channels on one 1440px screen. A tile grows from a number to a number + chart to a full chart.</p></div>
      <div class="goal"><div class="num">2</div><h3>Simplicity</h3><p>One tile component in three sizes, and two alarm colors with one meaning each: red for the car, blue for the data.</p></div>
      <div class="goal"><div class="num">3</div><h3>Lightweight</h3><p>No new dependencies (React, ECharts and react-grid-layout were already in the project). The largest file is ${biggest.lines} lines.</p></div>
      <div class="goal"><div class="num">4</div><h3>Easy handoff</h3><p>Limits, ranges, presets and colors live in <code>config/</code> and <code>tokens.css</code>, with README recipes and self-checks.</p></div>
    </div>
    ${img("after-overview", "The overview", "goals-shot")}`),

  page("The tile system", `
    <h2>One tile, three sizes</h2>
    <p class="sub">Shapes never change with window width; the grid packs them in order at 6, 4 or 2 columns.</p>
    <div class="tiles">
      ${fig("tile-small", "<b>Small · 1×1</b><br>the number, the limit bar and the label", "t-s")}
      ${fig("tile-medium", "<b>Medium · 2×1</b><br>the number and a compact chart", "t-m")}
      ${fig("tile-large", "<b>Large · 2×2</b><br>the chart only, with axes", "t-l")}
    </div>`),

  page("States", `
    <h2>A tile tells you when something is wrong</h2>
    <div class="states">
      ${fig("state-normal", "<b>Normal</b> · 92 °C, gray bar")}
      ${fig("state-warming", "<b>Warming</b> · 103 °C, the red outline starts")}
      ${fig("state-near", "<b>Near limit</b> · 112 °C, 60% of warn → limit")}
      ${fig("state-over", "<b>Over limit</b> · 125 °C, the whole tile turns red")}
      ${fig("state-nodata", "<b>No data</b> · nothing for 3 s+, blue edge")}
    </div>
    <div class="legend">
      <div><i class="sw red"></i><b>Arizona Red #AB0520</b> means the <b>car</b> has a problem.</div>
      <div><i class="sw blue"></i><b>Arizona Blue #0C234B</b> means the <b>data</b> has a problem.</div>
    </div>`),

  page("Charts", `
    <h2>Charts you can actually read</h2>
    <div class="charts">
      ${fig("chart-hover", "<b>cvt temp, large, hovered</b> · y range from the channel (0–150 °C), round ticks, 12-hour times ending in “now”, dashed “limit 120”, and a tooltip on this chart only")}
      ${fig("chart-above-range", "<b>speed, large</b> · configured 0–60 mph; the data is at 63.5 mph, so the axis grows to 75 and says “above range” instead of clipping")}
    </div>`),

  page("Presets and the pivot", `
    <h2>The header adapts to the window</h2>
    <div class="headers">
      ${fig("header-1440", "<b>1440px</b> · wordmark, three preset names centered, all controls")}
      ${fig("header-960", "<b>960px (half of a 1920 screen)</b> · cactus mark, only the active preset name")}
      ${fig("header-700", "<b>700px</b> · the same, still with every control")}
    </div>
    <p class="sub">Swipe or the arrow keys move between presets: overview, drivetrain, suspension, brakes, imu, gps, custom.</p>`),

  page("Customize mode", `
    <h2>Rearrange, resize, focus</h2>
    <div class="custom">
      ${fig("customize-mode", "<b>Customize</b> · tiles step back; each shows only ×; “+ add tile” at the end", "c-a")}
      ${fig("customize-drag", "<b>Drag</b> · a tile mid-drag; dropping changes only its place in the order", "c-b")}
      ${fig("fullscreen", "<b>Fullscreen</b> · any tile as a large chart over the grid; Esc to exit", "c-c")}
      <figure class="c-d"><div class="strip">${img("resize-small", "small")}${img("resize-medium", "medium")}${img("resize-large", "large")}</div><figcaption><b>Resize</b> · the size button cycles small → medium → large; the tiles after it reflow</figcaption></figure>
    </div>`),

  page("Radio panel", `
    <h2>Talking to the car</h2>
    <div class="radio">
      ${fig("radio-panel", "The panel open from the header", "r-a")}
      <div class="r-b">
        ${img("radio-trigger", "The radio button in the header", "trigger")}
        <ul class="facts">
          <li><b>Frequency</b> · 0.1 MHz steps, kept inside 902–928 MHz</li>
          <li><b>Data from car</b> · the 10 firmware data types, “9 of 10 · all except gps”</li>
          <li><b>Commands</b> · IDs copied from the firmware’s Commands.h; end log asks first; emergency stop is hold-for-2 s</li>
          <li><b>Not connected to car</b> · every send POSTs to /api/radio/command and says so when nothing answers. No button silently does nothing.</li>
        </ul>
      </div>
    </div>`),

  page("How customizable it is", `
    <h2>Change the data, not the code</h2>
    <div class="cfg">
      ${code("config/channels.ts · one channel", snipChannel)}
      ${fig("state-warming", "<code>warnAt</code> and <code>redline</code> drive the bar, the outline, the status and the chart’s limit line", "cfg-shot")}
      ${code("config/presets.ts · one preset", snipPreset)}
      ${fig("after-overview", "This list is the overview grid, in order", "cfg-shot")}
      ${code("styles/tokens.css · color roles", snipColors)}
      <figure class="cfg-shot pair">${img("state-over", "over")}${img("state-nodata", "no data")}<figcaption><code>--alarm</code> and <code>--data-problem</code> on the tiles</figcaption></figure>
    </div>`, "dense"),

  page("Recipes", `
    <h2>Recipes from the README</h2>
    <div class="recipes">${recipes.map((r) => `<div class="recipe"><h3>${esc(r.title)}</h3>${recipeHtml(r.blocks)}</div>`).join("")}</div>`, "dense"),

  page("Code structure", `
    <h2>${files.length} files, none over 250 lines</h2>
    <div class="tree">${Object.entries(groups)
      .map(([g, fs]) => `<div class="folder"><h3>${g === "." ? "telemetry-v2/" : g + "/"}</h3>${folders[g] ? `<p>${inlineHtml(folders[g])}</p>` : ""}<ul>${fs
        .map((f) => `<li><span>${esc(f.path.split("/").pop())}</span><span class="ln">${f.lines}</span></li>`)
        .join("")}</ul></div>`)
      .join("")}</div>`, "dense"),

  page("Still open", `
    <h2>For the team to fill in</h2>
    <table class="todo">
      <thead><tr><th>Channel</th><th>Value</th><th>Now in config</th><th>Status</th><th>Team value</th></tr></thead>
      <tbody>${open.map((o) => `<tr class="${o.status === "confirmed" ? "ok" : ""}"><td>${esc(o.ch)}</td><td><code>${esc(o.field)}</code></td><td><code>${esc(o.value)}</code>${o.note ? `<span class="nt">${esc(o.note)}</span>` : ""}</td><td>${o.status}</td><td class="blank"></td></tr>`).join("")}</tbody>
    </table>
    <div class="open-items">
      <div><b>Pit → car commands.</b> Every command POSTs to <code>/api/radio/command</code>. From sendCommand.ts: “${esc(noEndpoint)}” The panel says “not connected to car”.</div>
      <div><b>Error codes.</b> The radio sends <code>error_code</code> as a bare uint32 (tools/radio_to_json.py); nothing defines what each code means.</div>
    </div>`, "dense"),
];

// ---- styles: the app's own look ----
const css = `
@page { size: 1280px 720px; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; background: #000; }
body { font-family: Inter, "Inter Variable", system-ui, sans-serif; color: #e6e6e6; -webkit-print-color-adjust: exact; print-color-adjust: exact; font-feature-settings: "tnum"; }
code, pre { font-family: "JetBrains Mono", "DejaVu Sans Mono", ui-monospace, monospace; }
.page { position: relative; width: 1280px; height: 720px; padding: 44px 56px 40px; overflow: hidden; page-break-after: always; break-after: page; background: #000; display: flex; flex-direction: column; }
.page::before { content: ""; position: absolute; left: 0; top: 0; width: 6px; height: 100%; background: linear-gradient(#AB0520 0 50%, #0C234B 50% 100%); }
.kicker { font-size: 12px; letter-spacing: .12em; text-transform: uppercase; color: #8a8a8a; margin-bottom: 10px; }
.kicker span { color: #AB0520; font-weight: 700; margin-right: 10px; }
.folio { position: absolute; right: 56px; bottom: 22px; font-size: 12px; color: #6e6e6e; }
h1, h2, h3 { margin: 0; font-weight: 300; }
h2 { font-size: 38px; letter-spacing: -.01em; margin-bottom: 18px; color: #fff; }
h3 { font-size: 16px; font-weight: 600; color: #fff; }
p { margin: 0; }
.sub { color: #8a8a8a; font-size: 15px; margin: -6px 0 18px; }
code { font-size: .9em; color: #81CEEB; }
b { color: #fff; font-weight: 600; }
figure { margin: 0; display: flex; flex-direction: column; min-width: 0; min-height: 0; }
figcaption { font-size: 13px; color: #9a9a9a; margin-top: 8px; line-height: 1.4; }
.shot { display: block; width: 100%; height: auto; border: 1px solid #262626; }
/* cover */
.cover-page { padding: 0; }
.cover-page::before { display: none; }
.cover-header { border: 0; }
.cover-text { padding: 120px 72px 0; }
.cover h1 { font-size: 58px; color: #fff; letter-spacing: -.02em; }
.cover h1 span { color: #AB0520; }
.lede { font-size: 22px; color: #bdbdbd; margin-top: 16px; font-weight: 300; }
.meta { margin-top: 40px; font-size: 15px; color: #8a8a8a; letter-spacing: .04em; }
.cover .note { position: absolute; left: 72px; right: 72px; bottom: 34px; font-size: 12px; color: #6e6e6e; border-top: 1px solid #262626; padding-top: 12px; }
.cover-page .folio { display: none; }
/* layouts */
.two { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
.goals { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 22px; }
.goal { border-top: 2px solid #AB0520; padding-top: 14px; }
.goal:nth-child(4) { border-top-color: #81CEEB; }
.goal .num { font-size: 13px; color: #8a8a8a; margin-bottom: 6px; }
.goal p { font-size: 14px; line-height: 1.5; color: #bdbdbd; margin-top: 8px; }
.goals-shot { width: auto; height: 300px; margin-top: auto; align-self: flex-start; }
.tiles { display: grid; grid-template-columns: 1fr 2fr 2fr; gap: 20px; align-items: end; }
.tiles .t-s { align-self: end; }
.states { display: grid; grid-template-columns: repeat(5, 1fr); gap: 14px; }
.legend { margin-top: auto; display: flex; gap: 48px; font-size: 16px; color: #bdbdbd; }
.sw { display: inline-block; width: 14px; height: 14px; vertical-align: -2px; margin-right: 10px; }
.sw.red { background: #AB0520; } .sw.blue { background: #0C234B; outline: 1px solid #3a5a8c; }
.charts { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; }
.charts .shot { width: 86%; }
.headers { display: flex; flex-direction: column; gap: 16px; }
.headers figure:nth-child(2) .shot { width: 66.7%; } .headers figure:nth-child(3) .shot { width: 48.6%; }
.custom { display: grid; grid-template-columns: 1fr 1fr 1fr; grid-template-rows: auto auto; gap: 16px 20px; }
.custom .c-d { grid-column: 1 / 4; }
.strip { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; align-items: start; }
.radio { display: grid; grid-template-columns: 300px 1fr; gap: 40px; min-height: 0; flex: 1; }
.radio .r-a .shot { width: 100%; max-height: 540px; object-fit: contain; object-position: top; border: 0; }
.trigger { width: 220px; margin-bottom: 26px; }
.facts { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 18px; font-size: 16px; line-height: 1.5; color: #bdbdbd; }
.facts li { border-left: 2px solid #0C234B; padding-left: 14px; }
.facts li:last-child { border-left-color: #AB0520; }
/* config page */
.dense h2 { font-size: 30px; margin-bottom: 12px; }
.cfg { display: grid; grid-template-columns: 1.25fr 1fr; gap: 8px 22px; align-items: start; }
.code { background: #0a0a0a; border: 1px solid #262626; border-left: 2px solid #AB0520; }
.code-title { font-size: 10.5px; letter-spacing: .08em; text-transform: uppercase; color: #8a8a8a; padding: 4px 10px; border-bottom: 1px solid #1a1a1a; }
pre { margin: 0; padding: 6px 10px; font-size: 10px; line-height: 1.38; color: #e6e6e6; white-space: pre; overflow: hidden; }
pre i { font-style: normal; } pre .c { color: #6e6e6e; } pre .s { color: #e8a33d; } pre .n { color: #81CEEB; }
pre .h::before { content: ""; display: inline-block; width: 9px; height: 9px; margin-right: 4px; background: var(--sw); vertical-align: -1px; outline: 1px solid #3a3a3a; }
.cfg-shot .shot { max-height: 150px; width: auto; max-width: 100%; }
.cfg-shot figcaption { font-size: 12px; margin-top: 5px; }
.pair { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; } .pair figcaption { grid-column: 1 / 3; }
.pair .shot { max-height: 110px; }
/* recipes */
.recipes { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px 22px; }
.recipe { border-top: 2px solid #0C234B; padding-top: 10px; font-size: 12.5px; line-height: 1.45; color: #bdbdbd; }
.recipe:nth-child(1) { border-top-color: #AB0520; }
.recipe h3 { font-size: 15px; margin-bottom: 6px; }
.recipe p { margin: 4px 0; } .recipe ol, .recipe ul { margin: 4px 0; padding-left: 18px; } .recipe li { margin: 2px 0; } .recipe li.sub { margin-left: 14px; list-style: circle; }
/* tree */
.tree { columns: 4; column-gap: 26px; font-size: 12px; }
.folder { break-inside: avoid; margin-bottom: 12px; }
.folder h3 { font-size: 13px; color: #81CEEB; font-weight: 600; font-family: "DejaVu Sans Mono", monospace; }
.folder p { color: #8a8a8a; font-size: 11px; margin: 2px 0 4px; line-height: 1.35; }
.folder ul { list-style: none; margin: 0; padding: 0; }
.folder li { display: flex; justify-content: space-between; border-bottom: 1px solid #141414; padding: 1px 0; font-family: "DejaVu Sans Mono", monospace; font-size: 11px; color: #bdbdbd; }
.ln { color: #6e6e6e; }
/* todo */
.todo { width: 100%; border-collapse: collapse; font-size: 12px; }
.todo th { text-align: left; font-weight: 600; color: #8a8a8a; font-size: 11px; letter-spacing: .06em; text-transform: uppercase; border-bottom: 1px solid #3a3a3a; padding: 6px 8px; }
.todo td { padding: 3px 8px; border-bottom: 1px solid #1a1a1a; vertical-align: top; line-height: 1.3; }
.todo td:nth-child(4) { color: #e8a33d; } .todo tr.ok td:nth-child(4) { color: #6e6e6e; }
.todo .nt { color: #6e6e6e; font-size: 11px; margin-left: 10px; }
.todo .blank { width: 190px; border-bottom: 1px solid #3a3a3a; }
.open-items { margin-top: 12px; display: grid; grid-template-columns: 1fr 1fr; gap: 20px; font-size: 13px; line-height: 1.5; color: #bdbdbd; }
.open-items div { border-left: 2px solid #AB0520; padding-left: 12px; }
.open-items div:last-child { border-left-color: #0C234B; }
`;

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Telemetry v2 overview</title>
<!-- Generated by telemetry-v2-overview/build.mjs from the repo and shots/. Edit build.mjs, not this file. -->
<style>${css}</style></head><body>${pages.join("\n")}</body></html>`;
writeFileSync(join(ROOT, "docs/telemetry-v2-overview.html"), html);
console.log(`html: ${pages.length} pages, ${open.length} open values, ${files.length} files, ${recipes.length} recipes`);

// ---- print: serve docs/ over http (the browser may be sandboxed away from the disk) ----
const server = spawn("python3", ["-m", "http.server", "8099", "--bind", "127.0.0.1", "--directory", join(ROOT, "docs")], { stdio: "ignore" });
try {
  await sleep(800);
  const c = await connect();
  const p = await c.page({ width: 1280, height: 720, scale: 2 });
  await p.goto("http://127.0.0.1:8099/telemetry-v2-overview.html", 1500);
  await p.evaluate(`Promise.all([document.fonts.ready, ...[...document.images].map(i => i.decode().catch(() => {}))]).then(() => true)`);
  const check = await p.evaluate(`JSON.stringify({ inter: document.fonts.check("16px Inter"), images: document.images.length, broken: [...document.images].filter(i => !i.naturalWidth).map(i => i.src),
    overflow: [...document.querySelectorAll(".page")].map((s, i) => [i + 1, s.scrollHeight > s.clientHeight + 1 || s.scrollWidth > s.clientWidth + 1]).filter(x => x[1]).map(x => x[0]) })`);
  console.log("check:", check);
  await p.pdf(join(ROOT, "docs/telemetry-v2-overview.pdf"));
  await p.close();
  c.close();
  console.log("pdf: docs/telemetry-v2-overview.pdf");
} finally {
  server.kill();
}
