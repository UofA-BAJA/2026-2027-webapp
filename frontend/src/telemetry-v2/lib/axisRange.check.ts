// Self-check for axisRange.ts. Run from frontend/: node --experimental-strip-types src/telemetry-v2/lib/axisRange.check.ts
import assert from "node:assert/strict";
import { niceScale, stickyRange } from "./axisRange.ts";

const ticks = (s: { min: number; max: number; step: number }) => Math.round((s.max - s.min) / s.step) + 1;

// the temporary fixed ranges: no stretching, round steps
assert.deepEqual(niceScale(0, 150, 5), { min: 0, max: 150, step: 50 });
assert.deepEqual(niceScale(0, 60, 5), { min: 0, max: 60, step: 20 });
assert.deepEqual(niceScale(0, 4000, 5), { min: 0, max: 4000, step: 1000 });
assert.deepEqual(niceScale(0, 4000, 3), { min: 0, max: 4000, step: 2000 });
assert.deepEqual(niceScale(0, 60, 3), { min: 0, max: 60, step: 20 });
// awkward data lands on round ticks, within one of the requested count
for (const [lo, hi, n] of [[23.4, 61.2, 5], [-0.37, 0.52, 5], [79.6, 80.6, 3], [0.001, 0.0042, 7], [1234, 98765, 5], [-5, -1, 5]]) {
  const s = niceScale(lo, hi, n);
  assert.ok(s.min <= lo && s.max >= hi, `covers ${lo}..${hi}`);
  assert.ok(Math.abs(ticks(s) - n) <= 1, `about ${n} ticks for ${lo}..${hi}: got ${ticks(s)}`);
  const m = s.step / 10 ** Math.floor(Math.log10(s.step));
  assert.ok([1, 2, 2.5, 5].some((x) => Math.abs(x - m) < 1e-9), `round step ${s.step}`);
}
assert.ok(niceScale(5, 5, 5).max > 5, "a flat line still gets a range");

// sticky: grow at once, shrink only after holding
let st = stickyRange(undefined, 10, 50, 5, 0, 3000);
assert.deepEqual(st.scale, { min: 10, max: 50, step: 10 });
st = stickyRange(st, 10, 80, 5, 100, 3000);
assert.ok(st.scale.max >= 80, "grows right away");
const grown = st.scale;
st = stickyRange(st, 10, 50, 5, 200, 3000);
assert.deepEqual(st.scale, grown, "no shrink yet");
st = stickyRange(st, 10, 50, 5, 2000, 3000);
assert.deepEqual(st.scale, grown, "still holding");
st = stickyRange(st, 10, 50, 5, 3300, 3000);
assert.deepEqual(st.scale, { min: 10, max: 50, step: 10 }, "shrinks after 3 s");
// a fixed axis is the smallest range shown, and still grows if the data goes past it
const floor = { min: 0, max: 60 };
assert.deepEqual(stickyRange(undefined, 20, 30, 5, 0, 3000, floor).scale, { min: 0, max: 60, step: 20 });
assert.ok(stickyRange(undefined, 20, 62.6, 5, 0, 3000, floor).scale.max >= 62.6, "data past a fixed max stays visible");
console.log("axisRange ok");
