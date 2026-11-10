// Self-check for layout.ts and limitState.ts. Run from frontend/: node --experimental-strip-types src/telemetry-v2/lib/layout.check.ts
import assert from "node:assert/strict";
import { CHANNELS } from "../config/channels.ts";
import { SYSTEMS } from "./systems.ts";
import { PRESETS } from "../config/presets.ts";
import { colsFor, pack, presetTiles, validTiles } from "./layout.ts";
import { channelLimit, limitState } from "./limitState.ts";

assert.equal(colsFor(1440), 6);
assert.equal(colsFor(1200), 6);
assert.equal(colsFor(1199), 4);
assert.equal(colsFor(800), 4);
assert.equal(colsFor(799), 2);

// every preset: shapes kept, inside the grid, no overlap, at every column count
for (const cols of [2, 4, 6])
  for (const p of PRESETS) {
    const tiles = presetTiles(p);
    const placed = pack(tiles, cols);
    const taken = new Set<string>();
    placed.forEach((t, k) => {
      assert.equal(t.w, tiles[k].w, "shape kept");
      assert.ok(t.x >= 0 && t.x + t.w <= cols, `${p.name} inside ${cols} cols`);
      for (let i = t.x; i < t.x + t.w; i++)
        for (let j = t.y; j < t.y + t.h; j++) {
          assert.ok(!taken.has(`${i},${j}`), `${p.name} overlap at ${cols} cols`);
          taken.add(`${i},${j}`);
        }
    });
  }

// config: every preset tile is a valid saved tile (known channel, a real size, the map large-only)
for (const p of PRESETS) assert.ok(validTiles(presetTiles(p)), `${p.name} preset is valid`);
// the picker groups come from each channel's system: same groups and order as the old hand-kept list
assert.deepEqual(SYSTEMS.map((s) => s.name), ["Drivetrain", "Suspension", "Brakes", "IMU", "GPS", "Errors"]);
assert.deepEqual(SYSTEMS.flatMap((s) => s.channels).sort(), Object.keys(CHANNELS).sort(), "every channel in exactly one group");
assert.deepEqual(SYSTEMS[0].channels, ["speed", "distance", "motor_rpm", "wheel_rpm", "cvt_temp"]);

// dense: a small tile fills the hole a medium tile leaves behind
const d = pack([{ w: 1, h: 1 }, { w: 2, h: 1 }, { w: 1, h: 1 }], 2);
assert.deepEqual(d.map((t) => [t.x, t.y]), [[0, 0], [0, 1], [1, 0]]);
// a tile wider than the grid is clamped, not refused (and never loops forever)
assert.deepEqual(pack([{ w: 2, h: 2 }], 1), [{ w: 1, h: 2, x: 0, y: 0 }]);
// growing the last tile of a full row wraps it to the next row; everything after flows down
const g = pack([{ w: 1, h: 1 }, { w: 1, h: 1 }, { w: 2, h: 1 }, { w: 1, h: 1 }], 2);
assert.deepEqual(g.map((t) => [t.x, t.y]), [[0, 0], [1, 0], [0, 1], [0, 2]]);
console.log("pack ok");

// saved layouts: bad ones are rejected so the preset falls back to its default
const ok = { id: "a", kind: "channel", channels: ["speed"], w: 2, h: 1 };
assert.ok(validTiles([ok]));
assert.ok(validTiles([]));
assert.ok(!validTiles(null));
assert.ok(!validTiles([ok, ok]), "duplicate id");
assert.ok(!validTiles([{ ...ok, w: 3 }]), "unknown shape");
assert.ok(!validTiles([{ ...ok, w: 1, h: 2 }]), "1x2 is not a size");
assert.ok(!validTiles([{ ...ok, channels: ["nope"] }]), "unknown channel");
assert.ok(!validTiles([{ ...ok, channels: ["toString"] }]), "built-in object names are not channels");
assert.ok(!validTiles([{ ...ok, kind: "xy", channels: ["track"] }]), "map must be large");
assert.ok(validTiles([{ ...ok, kind: "xy", channels: ["track"], w: 2, h: 2 }]));
console.log("validTiles ok");

// limits from channels.ts: cvt temp warns from 100, over at 120; motor rpm is a range that is only over ABOVE the governor
const cvt = channelLimit(CHANNELS.cvt_temp)!, rpm = channelLimit(CHANNELS.motor_rpm)!;
assert.deepEqual(limitState(90, cvt), { state: "ok", fill: 0.75, meter: 0 });
assert.equal(limitState(100, cvt).state, "warn");
assert.equal(limitState(112, cvt).meter, 60);
assert.equal(limitState(120, cvt).state, "over");
assert.equal(limitState(150, cvt).fill, 1);
assert.equal(limitState(undefined, cvt).state, "ok");
assert.equal(limitState(1750, rpm).fill, 0);
assert.equal(limitState(3800, rpm).state, "ok", "the governor is normal full power");
assert.equal(limitState(3801, rpm).state, "over");
assert.equal(limitState(1000, rpm).fill, 0, "below idle clamps to an empty bar");
assert.equal(channelLimit(CHANNELS.speed), undefined, "no limits = no bar");
console.log("limitState ok");
