// Self-check for map.ts. Run from frontend/: node --experimental-strip-types src/telemetry-v2/lib/map.check.ts
import assert from "node:assert/strict";
import { fitTrack, type Pt } from "./map.ts";

// 100 m east then 100 m north at 60°N (where a degree of longitude is half as long) must draw as equal lengths
const lat = 60;
const dLon = 100 / (111320 * Math.cos((lat * Math.PI) / 180));
const dLat = 100 / 110540;
const ll: Pt[] = [[lat, 0], [lat, dLon], [lat + dLat, dLon]];
const { px, pxPerM, toPx } = fitTrack(ll, 400, 200);
const east = px[1][0] - px[0][0];
const north = px[1][1] - px[2][1];
assert.ok(Math.abs(east - north) < 0.01, `equal aspect: east ${east}px vs north ${north}px`);
// limited by the 200px height: the track spans exactly 80% of it (10% padding each side) and sits inside the box
assert.ok(Math.abs(north - 160) < 0.01, `fit: ${north}px of 160px`);
assert.ok(px.every(([x, y]) => x >= 0 && x <= 400 && y >= 20 - 1e-9 && y <= 180 + 1e-9), "inside padded box");
assert.ok(Math.abs(pxPerM - 1.6) < 1e-6);

// a parked car: one repeated point, no NaN, centred
const still = fitTrack([[32, -116], [32, -116]], 300, 300);
assert.deepEqual(still.px[0], [150, 150]);

// toPx projects other points exactly like the fitted ones
assert.deepEqual(toPx(ll[2]), px[2]);

console.log("map.check ok");
