// Takes the real screenshots for the overview PDF from the running app.
// Needs: the UI on :5173 and the mock server on :8000 (./start.sh), and headless Chrome on :9333 (see cdp.mjs).
// Run from this folder: node capture.mjs   → shots/*.png
// Some scenes hold one or two stream values (cvt temp, speed) so a state is on screen; everything else is the live mock.
import { connect, sleep } from "./cdp.mjs";

const APP = "http://localhost:5173";
const c = await connect();
const p = await c.page({ width: 1440, height: 900, scale: 2 });

// Before the app loads: wrap EventSource so window.__OV can hold a stream key at a value (null = stop sending it).
await p.beforeLoad(`
  window.__OV = {};
  const O = window.EventSource;
  window.EventSource = class extends O {
    set onmessage(fn) {
      super.onmessage = (e) => {
        const d = JSON.parse(e.data);
        for (const [k, v] of Object.entries(window.__OV)) if (k in d) { if (v === null) delete d[k]; else d[k] = v; }
        fn({ data: JSON.stringify(d) });
      };
    }
  };`);

const T = (channel, w, h, extra = {}) => ({ kind: channel === "track" ? "xy" : "channel", channels: [].concat(channel), w, h, ...extra });
const layout = (tiles) => JSON.stringify({ custom: tiles.map((t, i) => ({ ...t, id: "doc" + i })) });

// load the app fresh with a saved "custom" layout (or none), then switch to a preset
async function open(preset = "overview", custom, ov = {}) {
  await p.goto("about:blank", 200);
  await p.goto(APP + "/telemetry-v2", 300);
  await p.evaluate(`localStorage.clear(); ${custom ? `localStorage.setItem("tv2-layouts-v4", ${JSON.stringify(custom)});` : ""} true`);
  await p.goto(APP + "/telemetry-v2", 3500);
  if (!(await p.evaluate(`!!document.querySelector(".tv2-tile")`))) throw new Error("the app didn't render (dev server reloading?)");
  await ov_(ov);
  for (let i = 0; i < 8; i++) {
    if ((await p.evaluate(`document.querySelector(".tv2-name.active").textContent`)) === preset) break;
    await p.key("ArrowRight");
    await sleep(500);
  }
  await sleep(2500); // let 30 s of window fill and charts settle
}
const ov_ = (o) => p.evaluate(`Object.assign(window.__OV, ${JSON.stringify(o)}); true`);
const settle = async (ms = 600) => {
  await sleep(ms);
  await p.evaluate(`document.getAnimations().forEach(a => { try { a.finish() } catch {} }); true`);
  await sleep(150);
};
// CSS-pixel rect of the nth element matching a selector, padded
const rect = async (sel, n = 0, pad = 0) => {
  const r = await p.evaluate(`(() => { const e = document.querySelectorAll(${JSON.stringify(sel)})[${n}]; if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.left, y: b.top, width: b.width, height: b.height }; })()`);
  if (!r) throw new Error(`no element ${sel} #${n}`);
  return { x: Math.max(0, r.x - pad), y: Math.max(0, r.y - pad), width: r.width + 2 * pad, height: r.height + 2 * pad };
};
const tile = (n) => rect(".react-grid-item .tv2-tile", n);
// the box around every tile on the grid, padded
const tilesBox = async (pad = 12) => {
  const r = await p.evaluate(`(() => { const bs = [...document.querySelectorAll(".react-grid-item .tv2-tile")].map(e => e.getBoundingClientRect());
    const x = Math.min(...bs.map(b => b.left)), y = Math.min(...bs.map(b => b.top)), r = Math.max(...bs.map(b => b.right)), btm = Math.max(...bs.map(b => b.bottom));
    return { x, y, width: r - x, height: btm - y }; })()`);
  return { x: r.x - pad, y: r.y - pad, width: r.width + 2 * pad, height: r.height + 2 * pad };
};
const click = async (sel, n = 0) => p.evaluate(`document.querySelectorAll(${JSON.stringify(sel)})[${n}].click(); true`);
const center = async (sel, n = 0, fx = 0.5, fy = 0.5) => {
  const r = await rect(sel, n);
  return [r.x + r.width * fx, r.y + r.height * fy];
};
const done = (name) => console.log("  " + name);

// ---- 1. before / after ----
await p.goto(APP + "/telemetry", 4500);
await p.shot("shots/before-old-ui.png");
done("before-old-ui");
await open("overview", undefined, { cvt_temperature: 92 });
await settle();
await p.shot("shots/after-overview.png");
done("after-overview");

// ---- 2. header at three widths (cover + pivot page) ----
await p.shot("shots/header-1440.png", await rect(".tv2-top"));
for (const w of [960, 700]) {
  await p.size(w, 900);
  await settle(900);
  await p.shot(`shots/header-${w}.png`, await rect(".tv2-top"));
}
await p.size(1440, 900);
done("headers");

// ---- 3. tile sizes: cvt temp small / medium / large ----
await open("custom", layout([T("cvt_temp", 1, 1), T("cvt_temp", 2, 1), T("cvt_temp", 2, 2)]), { cvt_temperature: 92 });
await sleep(30000); // a full 30 s window at the held value, so the charts don't show the step
await settle();
for (const [i, n] of ["small", "medium", "large"].entries()) await p.shot(`shots/tile-${n}.png`, await tile(i));
done("tile sizes");

// ---- 4. states: cvt temp medium tile ----
await open("custom", layout([T("cvt_temp", 2, 1), T("speed", 1, 1)]), { cvt_temperature: 92 });
for (const [name, v] of [["normal", 92], ["warming", 103], ["near", 112], ["over", 125]]) {
  await ov_({ cvt_temperature: v });
  await settle(1500);
  await p.shot(`shots/state-${name}.png`, await tile(0));
}
await ov_({ cvt_temperature: null });
await settle(4500);
await p.shot("shots/state-nodata.png", await tile(0));
done("states");

// ---- 5. charts: large cvt with hover tooltip, large speed above its configured range ----
await open("custom", layout([T("cvt_temp", 2, 2), T("speed", 2, 2)]), { cvt_temperature: 96, car_state_speed: 28.4 });
await sleep(30000); // the whole 30 s window holds the values, so the lines don't jump mid-chart
const [hx, hy] = await center(".react-grid-item .tv2-chart", 0, 0.62, 0.55);
await p.mouse("mouseMoved", hx - 40, hy);
await sleep(150);
await p.mouse("mouseMoved", hx, hy);
await settle(400);
await p.shot("shots/chart-hover.png", await tile(0));
await p.mouse("mouseMoved", 700, 880);
await settle(400);
await p.shot("shots/chart-above-range.png", await tile(1));
done("charts");

// ---- 6. customize: mode, drag, resize, fullscreen ----
await open("overview", undefined, { cvt_temperature: 92 });
await click(".tv2-text-btn", 0); // customize (the only text button in the header while not customizing)
await settle(1200);
await p.shot("shots/customize-mode.png");
const [sx, sy] = await center(".react-grid-item .tv2-tile", 7, 0.5, 0.75);
const [tx, ty] = await center(".react-grid-item .tv2-tile", 0, 0.5, 0.75);
await p.mouse("mousePressed", sx, sy, 1);
for (let k = 1; k <= 12; k++) {
  await p.mouse("mouseMoved", sx + ((tx - sx) * k) / 12, sy + ((ty - sy) * k) / 12, 1);
  await sleep(40);
}
await sleep(500);
await p.shot("shots/customize-drag.png");
await p.mouse("mouseReleased", tx, ty, 1);
await settle(800);
done("customize + drag");

await open("custom", layout([T("speed", 1, 1), T("motor_rpm", 1, 1), T("distance", 1, 1)]), { cvt_temperature: 92 });
await settle();
for (const n of ["small", "medium", "large"]) {
  await p.shot(`shots/resize-${n}.png`, await tilesBox());
  await click(".react-grid-item .tv2-tile button[aria-label^='Change size']", 0);
  await settle(1200);
}
done("resize");

await open("drivetrain", undefined, { cvt_temperature: 92 });
await click(".react-grid-item .tv2-large button[aria-label='Fullscreen']", 0);
await settle(1500);
if (!(await p.evaluate(`!!document.querySelector(".tv2-view .tv2-chart")`))) throw new Error("fullscreen overlay missing");
await p.shot("shots/fullscreen.png");
await p.key("Escape");
done("fullscreen");

// ---- 7. radio panel ----
await open("overview", undefined, { cvt_temperature: 92 });
await p.size(1440, 1200); // tall enough that the panel doesn't scroll
await click(".tv2-signal");
await settle(600);
await click(".tv2-rp-select");
await settle(400);
await p.evaluate(`[...document.querySelectorAll(".tv2-rp-cmd")].find(b => b.textContent.startsWith("start log")).click(); true`);
await settle(1200);
await p.shot("shots/radio-panel.png", await rect(".tv2-radio-panel", 0, 0));
await p.shot("shots/radio-trigger.png", await rect(".tv2-signal", 0, 10));
await p.size(1440, 900);
done("radio");

await p.close();
c.close();
console.log("done");
