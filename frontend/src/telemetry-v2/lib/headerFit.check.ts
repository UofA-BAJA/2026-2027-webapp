// Self-check for headerFit.ts. Run from frontend/: node --experimental-strip-types src/telemetry-v2/lib/headerFit.check.ts
import assert from "node:assert/strict";
import { HYSTERESIS, chooseFit, type Widths } from "./headerFit.ts";

// widths measured from the real header (drivetrain active, wordmark logo, "−69 dBm radio ▾" controls)
const at = (width: number, logo = 157): Widths => ({ inner: width - 32, logo, controls: 395, gap: 16, nameGap: 22, names: [74, 113, 174, 135, 67] });

assert.equal(chooseFit(at(1700)), "center5", "wide screen: all five names, centered");
assert.equal(chooseFit(at(1440)), "center3", "laptop: three names, centered");
assert.equal(chooseFit(at(1100)), "left3", "narrower: the pivot moves next to the logo");
assert.equal(chooseFit(at(1100), "left1"), "left1", "...but coming up from left1 at the very edge it waits for the extra room");
assert.equal(chooseFit(at(700, 36)), "left1", "half-screen: only the active name");
// never wider than the room: whatever it picks leaves at least `gap` on both sides
for (let w = 600; w <= 2000; w += 10) {
  const m = at(w, w < 1100 ? 36 : 157);
  const f = chooseFit(m);
  const [a, b, c, d, e] = m.names;
  const p = f === "center5" ? a + b + c + d + e + 88 : f === "left1" ? c : b + c + d + 44;
  if (f.startsWith("center")) assert.ok((m.inner - p) / 2 >= Math.max(m.logo, m.controls) + m.gap, `${w}px ${f} overlaps`);
  else if (f === "left3") assert.ok(m.logo + p + m.controls + 2 * m.gap <= m.inner, `${w}px ${f} overlaps`);
}
// hysteresis: at the edge, a richer layout needs the extra room, but the current one is kept while it still fits
const edge = at(1700);
const need = (edge.names.reduce((x, y) => x + y) + 88 + 2 * (395 + 16)) + 32; // window width where center5 just fits
assert.equal(chooseFit(at(need + 2), "center3"), "center3", "just past the edge: don't flip up yet");
assert.equal(chooseFit(at(need + 2 * HYSTERESIS + 2), "center3"), "center5", "with room to spare on both sides: flip up");
assert.equal(chooseFit(at(need + 2), "center5"), "center5", "already rich and still fits: stay");
assert.equal(chooseFit(at(need - 2), "center5"), "center3", "doesn't fit any more: drop at once");
console.log("headerFit ok");
