// Self-check for course.ts. Run from frontend/: node --experimental-strip-types src/telemetry-v2/lib/course.check.ts
import assert from "node:assert/strict";
import type { LatLon } from "../config/track.ts";
import { autoSplits, gateAcross, GATE_WIDTH, routeLength } from "./course.ts";

const near = (a: number, b: number, tol: number, what: string) => assert.ok(Math.abs(a - b) < tol, `${what}: ${a} vs ${b}`);
const M_LAT = 110540;
const mLon = (lat: number) => 111320 * Math.cos((lat * Math.PI) / 180);

// heading due east: the gate runs north-south, GATE_WIDTH long, centred on the point
const at: LatLon = [32.47, -111.3];
const g = gateAcross(at, [32.47, -111.299]);
near(g.a[1], at[1], 1e-7, "gate east-west offset");
near((g.a[0] - g.b[0]) * M_LAT, GATE_WIDTH, 0.03, "gate length (7-decimal rounding is ~1 cm)");
near((g.a[0] + g.b[0]) / 2, at[0], 1e-7, "gate centred");
// heading north: the gate runs east-west, and its metre length holds at this latitude
const gn = gateAcross(at, [32.471, -111.3]);
near(Math.abs(gn.a[1] - gn.b[1]) * mLon(at[0]), GATE_WIDTH, 0.03, "east-west gate length");

// a 400 m square loop (100 m sides) starting at the south-west corner, going east first: splits at 100, 200, 300 m
const side = (m: number) => m / M_LAT;
const sideLon = (m: number) => m / mLon(32.47);
const corners: LatLon[] = [[32.47, -111.3], [32.47, -111.3 + sideLon(100)], [32.47 + side(100), -111.3 + sideLon(100)], [32.47 + side(100), -111.3], [32.47, -111.3]];
const sq: LatLon[] = [];
for (let i = 0; i < 4; i++) for (let t = 0; t < 10; t++) {
  const [a, b] = [corners[i], corners[i + 1]];
  sq.push([a[0] + ((b[0] - a[0]) * t) / 10, a[1] + ((b[1] - a[1]) * t) / 10]);
}
sq.push(corners[4]);
near(routeLength(sq), 400, 0.5, "square length");
const sp = autoSplits(sq);
assert.equal(sp.length, 3);
// the first split sits at the south-east corner, the second at the north-east, the third at the north-west
const mid = (gt: { a: LatLon; b: LatLon }): LatLon => [(gt.a[0] + gt.b[0]) / 2, (gt.a[1] + gt.b[1]) / 2];
[corners[1], corners[2], corners[3]].forEach((c, k) => {
  const m = mid(sp[k]);
  near(Math.hypot((m[0] - c[0]) * M_LAT, (m[1] - c[1]) * mLon(32.47)), 0, 10.5, `split ${k + 1} position`);
});

// a route too short to split has no splits
assert.deepEqual(autoSplits(sq.slice(0, 2)), []);

console.log("course.check ok");
