// Self-check for laps.ts. Run from frontend/: node --experimental-strip-types src/telemetry-v2/lib/laps.check.ts
import assert from "node:assert/strict";
import type { Gate, LatLon } from "../config/track.ts";
import { deltaTime, lapTime } from "./format.ts";
import { addFix, lapSummary, newLaps, segments, timeTone, type Laps } from "./laps.ts";

// A synthetic 100 m circle, driven anticlockwise, with start/finish at angle 0 and splits at 90°, 180° and 270°.
const R = 100;
const ll = (x: number, y: number): LatLon => [32 + y / 110540, -116 + x / (111320 * Math.cos((32 * Math.PI) / 180))];
const radial = (th: number): Gate => ({ a: ll(0.8 * R * Math.cos(th), 0.8 * R * Math.sin(th)), b: ll(1.2 * R * Math.cos(th), 1.2 * R * Math.sin(th)) });
const track = { startFinish: radial(0), splits: [radial(Math.PI / 2), radial(Math.PI), radial((3 * Math.PI) / 2)], minLapSeconds: 20 };
const near = (a: number | undefined, b: number, msg: string) => assert.ok(a !== undefined && Math.abs(a - b) < 0.02, `${msg}: ${a} vs ${b}`);

// Drive laps of the given lengths (s) at 10 Hz, starting 10° before the line (the untimed out lap).
// Fix times are offset by 0.037 s so crossings fall between fixes and the interpolation is exercised.
function drive(st: Laps, lapSecs: number[], ts0 = 0.037, th0 = -Math.PI / 18) {
  let th = th0;
  let ts = ts0;
  while (th < 2 * Math.PI * lapSecs.length + 0.1) { // a little past the line, so the last lap completes
    addFix(st, ts, ll(R * Math.cos(th), R * Math.sin(th)), track);
    const k = Math.min(lapSecs.length - 1, Math.max(0, Math.floor(th / (2 * Math.PI))));
    th += ((2 * Math.PI) / lapSecs[k]) * 0.1;
    ts += 0.1;
  }
  return { th, ts };
}

// three laps: 60 s, 56 s, 64 s; the 4th lap is under way
const st = newLaps();
drive(st, [60, 56, 64]);
const done = st.laps.filter((l) => l.end !== undefined);
assert.equal(done.length, 3, "three complete laps");
near(st.laps[0].start, 0.037 + (1 / 36) * 60, "lap 1 starts where the car first crosses the line (10° of a 60 s lap)");
[60, 56, 64].forEach((t, i) => {
  near(done[i].end! - done[i].start, t, `lap ${i + 1} time`);
  segments(done[i], 4).forEach((seg, k) => near(seg, t / 4, `lap ${i + 1} S${k + 1}`));
});

const sum = lapSummary(st, st.prev!.ts, 4);
near(sum.avgLap, 60, "average lap");
near(sum.bestLap, 56, "best lap");
near(sum.lastLap, 64, "last lap");
assert.equal(sum.curDone, 0, "lap 4 hasn't reached S1's end yet");
assert.equal(sum.delta, undefined, "no live delta before the first split of a lap");
assert.equal(timeTone(sum.delta), "", "white: nothing to compare yet");
near(sum.avgSegs[2], 15, "average S3");

// laps of 60, 60 and 50 s, then lap 4 at 50 s pace just past its first split: S1 12.5 s vs the 14.17 s average
const fast = newLaps();
const end = drive(fast, [60, 60, 50]);
let th = end.th;
let t = end.ts;
while (th < 2 * Math.PI * 3 + Math.PI * 0.6) {
  addFix(fast, t, ll(R * Math.cos(th), R * Math.sin(th)), track);
  th += ((2 * Math.PI) / 50) * 0.1;
  t += 0.1;
}
const f = lapSummary(fast, fast.prev!.ts, 4);
assert.equal(f.curDone, 1, "lap 4 has finished S1");
near(f.avgSegs[0], (60 + 60 + 50) / 12, "average S1 over the 3 complete laps");
near(f.delta, 12.5 - 170 / 12, "live delta = S1 vs average S1");
assert.equal(timeTone(f.delta), "ahead");
assert.equal(timeTone(1.1), "behind");
assert.equal(f.segDelta[1], undefined, "S2 is still running: no delta, so it stays white");
assert.ok(f.curSegs[1]! > 0 && f.curSegs[1]! < 12.5, `S2 running time ${f.curSegs[1]}`);

// the first lap has nothing to compare against: no averages, no deltas, so every tone is white
const first = newLaps();
drive(first, [60, 60], 0.037, -Math.PI / 18);
first.laps.splice(1); // keep only lap 1, still running
first.laps[0].end = first.laps[0].endIdx = undefined;
first.next = 2;
const one = lapSummary(first, 40, 4);
assert.equal(one.avgLap, undefined);
assert.ok(one.segDelta.every((d) => d === undefined) && one.delta === undefined && timeTone(one.delta) === "");

// jitter on the line (stopped on the grid): back and forth across start/finish must not start new laps,
// and crossing it backwards doesn't count at all
const jit = newLaps();
const p0 = ll(R, -2);
const p1 = ll(R, 2);
for (let i = 0; i < 40; i++) addFix(jit, i * 0.1, i % 2 ? p1 : p0, track);
assert.equal(jit.laps.length, 1, `jitter: ${jit.laps.length} laps`);
const back = newLaps();
addFix(back, 0, ll(R, 2), track);
addFix(back, 0.1, ll(R, -2), track); // first crossing backwards sets the direction...
addFix(back, 30, ll(R, 2), track); // ...so a forward crossing later is the wrong way and is ignored
assert.equal(back.laps.length, 1);

// a missed split (GPS dropout): the lap still ends, the two segments around the gap are unknown
const gap = newLaps();
let i = 0;
for (let a = -0.2; a < 2 * Math.PI + 0.2; a += 0.05) {
  const r = a > 1.4 && a < 1.75 ? 1.5 * R : R; // runs wide around the 90° split, outside its line
  addFix(gap, i++, ll(r * Math.cos(a), r * Math.sin(a)), track);
}
const gl = gap.laps.filter((l) => l.end !== undefined);
assert.equal(gl.length, 1, "lap ends even with a missed split");
const gs = segments(gl[0], 4);
assert.equal(gs[0], undefined);
assert.equal(gs[1], undefined);
assert.ok(gs[2] !== undefined && gs[3] !== undefined, "segments after the gap still time");

// formatting
assert.equal(lapTime(162.79), "2:42.7");
assert.equal(lapTime(36.44), "36.4");
assert.equal(lapTime(59.99), "59.9");
assert.equal(lapTime(60), "1:00.0");
assert.equal(deltaTime(-0.71), "−0.7");
assert.equal(deltaTime(1.1), "+1.1");

console.log("laps.check ok");
