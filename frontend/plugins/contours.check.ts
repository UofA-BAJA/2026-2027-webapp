// Self-check for the contour tracing. Run from frontend/: node --experimental-strip-types plugins/contours.check.ts
import assert from "node:assert/strict";
import { traceContours } from "./contours.ts";

// A cone 100 m tall and 1 km in radius on a 2 x 2 km grid of 10 m cells: height = 100 - r/10 (m) at r metres out.
// Contour z must be a circle of radius (100 - z) * 10 m around the centre.
const W = 200;
const CELL = 10; // m
const lat0 = 32.47;
const kx = 111320 * Math.cos((lat0 * Math.PI) / 180);
const values = new Float64Array(W * W);
for (let j = 0; j < W; j++) for (let i = 0; i < W; i++) {
  const r = Math.hypot((i + 0.5 - W / 2) * CELL, (j + 0.5 - W / 2) * CELL);
  values[j * W + i] = Math.max(0, 100 - r / 10);
}
// d3-contour corner coords → lon/lat, the centre of the grid at (lat0, -111.3); rows run south
const toLonLat = (x: number, y: number): [number, number] => [-111.3 + ((x - W / 2) * CELL) / kx, lat0 - ((y - W / 2) * CELL) / 110540];
const { step, features, lo, hi } = traceContours(values, W, W, toLonLat, CELL);

assert.equal(step, 5, "0–100 m: 5 m steps (at most 25 levels)");
assert.ok(lo === 0 && Math.abs(hi - 99.3) < 1, `range ${lo}–${hi}`);
const at = (z: number) => features.find((f) => f.properties.elevation_m === z);
for (const z of [50, 75, 90]) {
  const f = at(z);
  assert.ok(f, `a ${z} m contour`);
  assert.equal(f.properties.major, z % 25 === 0, `${z} m major = every 5th (25 m) level`);
  const want = (100 - z) * 10;
  const rs = f.geometry.coordinates.flat().map(([lo, la]) => Math.hypot((lo + 111.3) * kx, (la - lat0) * 110540));
  const worst = Math.max(...rs.map((r) => Math.abs(r - want)));
  // smoothing rounds the cone's tip a little, so allow a couple of cells off on the inner rings
  assert.ok(worst < 2.5 * CELL, `${z} m contour is a circle of ${want} m: worst ${worst.toFixed(1)} m off`);
  assert.equal(f.geometry.coordinates.length, 1, `${z} m is one closed line`);
}
// the grid's outer edge isn't a contour: nothing runs along it
const edge = features.flatMap((f) => f.geometry.coordinates.flat()).filter(([lo, la]) => {
  const [x, y] = [(lo + 111.3) * kx, (la - lat0) * 110540];
  return Math.abs(Math.abs(x) - (W / 2) * CELL) < 1 || Math.abs(Math.abs(y) - (W / 2) * CELL) < 1;
});
assert.equal(edge.length, 0, "no line runs along the grid's edge");

// no-data cells (USGS fills them with -999999) don't drag the range down or draw lines around themselves
const holes = Float64Array.from(values);
for (let i = 0; i < 400; i++) holes[i] = -999999;
const h = traceContours(holes, W, W, toLonLat, CELL);
assert.ok(h.lo >= 0, `no data ignored in the range: ${h.lo}`);

console.log("contours.check ok");
