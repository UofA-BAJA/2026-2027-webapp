// Self-check for lapBox.ts. Run from frontend/: node --experimental-strip-types src/telemetry-v2/lib/lapBox.check.ts
import assert from "node:assert/strict";
import { boxAround, detectLap, lapStats, normalized } from "./lapBox.ts";
import { runCsv, type LatLon, type Stream } from "./stream.ts";

const newStream = () => ({ latest: {}, history: {}, at: {} }) as unknown as Stream;
const near = (a: number | undefined, b: number, tol: number, msg: string) => assert.ok(a !== undefined && Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);

// a 100 m circle at 10 Hz; the 20 × 20 m box sits across it at angle 0 (the east side)
const R = 100;
const at = (th: number, r = R): LatLon => [32 + (r * Math.sin(th)) / 110540, -111 + (r * Math.cos(th)) / (111320 * Math.cos((32 * Math.PI) / 180))];
const box = boxAround(at(0));

// boxAround: 20 m each way
near((box.maxLat - box.minLat) * 110540, 20, 0.01, "box height");

// three passes = three laps, 60 s apart; the lap starts where the car crosses the box edge, between fixes
const s = newStream();
const lapSecs = 60;
let ts = 0.037; // fixes don't line up with the crossings
for (let th = -0.5; th < 3 * 2 * Math.PI - 0.5; th += ((2 * Math.PI) / lapSecs) * 0.1, ts += 0.1) detectLap(s, ts, at(th), box);
const laps = s.history.lap;
assert.equal(laps.length, 3, `3 passes = 3 laps, got ${laps.length}`);
assert.deepEqual(laps.map((l) => l[1]), [1, 2, 3]);
// the box edge is 10 m before angle 0 along the circle: θ = −asin(10/R); lap 1 enters there
near(laps[0][0], 0.037 + ((0.5 - Math.asin(10 / R)) / (2 * Math.PI)) * lapSecs, 0.02, "lap 1 starts at the box edge");
near(laps[1][0] - laps[0][0], lapSecs, 0.02, "lap time");
const st = lapStats(s, laps[2][0] + 5);
assert.equal(st.lap, 3);
near(st.current, 5, 1e-9, "current lap time");
near(st.last, 60, 0.02, "last lap");
near(st.best, 60, 0.02, "best lap");

// jitter at the box edge (parked on it, GPS wandering in and out every fix for a minute): one lap, not 600
const j = newStream();
const edge: LatLon = [box.minLat, (box.minLon + box.maxLon) / 2];
for (let i = 0; i < 600; i++) detectLap(j, i * 0.1, [edge[0] + (i % 2 ? 2 : -2) / 110540, edge[1]], box);
assert.equal(j.history.lap.length, 3, `edge jitter: one lap per 20 s at most, got ${j.history.lap.length}`);
// ...and inside the 20 s window none count at all
const k = newStream();
for (let i = 0; i < 199; i++) detectLap(k, i * 0.1, [edge[0] + (i % 2 ? 2 : -2) / 110540, edge[1]], box);
assert.equal(k.history.lap.length, 1, "jitter inside 20 s = the one lap it started");

// a box dropped on the car doesn't count until the car leaves and comes back
const d = newStream();
detectLap(d, 0, at(0), box);
detectLap(d, 0.1, at(0.001), box);
assert.equal(d.history.lap, undefined, "no lap for a car that starts inside");
// no box: nothing
const n = newStream();
for (let th = -0.5; th < 1; th += 0.01) detectLap(n, th, at(th), undefined);
assert.equal(n.history.lap, undefined);

// a corner dragged past the opposite one still makes a proper box
assert.deepEqual(normalized({ minLat: 2, maxLat: 1, minLon: 4, maxLon: 3 }), { minLat: 1, maxLat: 2, minLon: 3, maxLon: 4 });

// laps are in the run data, so the CSV export has them
const csv = runCsv(s).split("\n");
assert.equal(csv[0], "ts,series,value");
assert.equal(csv.filter((r) => r.split(",")[1] === "lap").length, 3);

console.log("lapBox.check ok");
