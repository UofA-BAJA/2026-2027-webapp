// Self-check for geo.ts. Run from frontend/: node --experimental-strip-types src/telemetry-v2/lib/geo.check.ts
import assert from "node:assert/strict";
import { distM, fitView, projection, runStats } from "./geo.ts";
import type { Stream } from "./stream.ts";

const near = (a: number, b: number, tol: number, msg: string) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);

// projection: 100 m east and 100 m north at 60°N (where a degree of longitude is half as long) come out equal; round trip
const p = projection([60, 0]);
const east = p.toM([60, 100 / (111320 * 0.5)]);
const north = p.toM([60 + 100 / 110540, 0]);
near(east[0], 100, 0.01, "east is +x");
near(north[1], -100, 0.01, "north is -y (screen up)");
const back = p.toLL([123, -45]);
near(p.toM(back)[0], 123, 1e-6, "round trip x");
near(p.toM(back)[1], -45, 1e-6, "round trip y");
near(distM([60, 0], [60 + 100 / 110540, 0]), 100, 0.01, "distM north");

// fitView: a 200 × 100 m box into 400 × 400 px with 10% padding is width-limited: 320 px for 200 m, centred
const v = fitView([[0, 0], [200, 100]], 400, 400);
near(v.k, 1.6, 1e-9, "scale");
near((0 - v.x0) * v.k, 40, 1e-9, "left edge at the padding");
near((50 - v.y0) * v.k, 200, 1e-9, "vertical centre");
// one point (a parked car) still gets a sane scale: minSpan
assert.ok(Number.isFinite(fitView([[5, 5]], 300, 200).k));

// runStats: 100 m straight at 10 m/s, then parked with 1 m of jitter for a minute: distance stays ~100 m
const s = { history: { gps_latitude: [], gps_longitude: [] } } as unknown as Stream;
const push = (t: number, ll: [number, number]) => (s.history.gps_latitude.push([t, ll[0]]), s.history.gps_longitude.push([t, ll[1]]));
const at = (northM: number): [number, number] => [32 + northM / 110540, -111];
for (let i = 0; i <= 100; i++) push(i * 0.1, at(i)); // 10 s, 1 m per fix
near(runStats(s).speed, 10, 0.01, "speed while driving");
for (let i = 1; i <= 600; i++) push(10 + i * 0.1, at(100 + (i % 2 ? 1 : -1))); // jitter ±1 m
const r = runStats(s);
near(r.metres, 100, 3, "parked jitter adds no distance");
assert.ok(r.speed < 2.5, `parked speed ${r.speed}`);

console.log("geo.check ok");
