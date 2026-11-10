// Self-check for colsFor(), pack() and validTiles(). Run from frontend/: node --experimental-strip-types src/telemetry-v2/presets.check.ts
import assert from "node:assert/strict";
import { PRESETS, colsFor, pack, validTiles } from "./presets.ts";

assert.equal(colsFor(1440), 6);
assert.equal(colsFor(1200), 6);
assert.equal(colsFor(1199), 4);
assert.equal(colsFor(800), 4);
assert.equal(colsFor(799), 2);

for (const cols of [2, 4, 6])
  for (const p of PRESETS) {
    const placed = pack(p.tiles, cols);
    const taken = new Set<string>();
    placed.forEach((t, k) => {
      assert.equal(t.w, p.tiles[k].w, "shape kept");
      assert.ok(t.x >= 0 && t.x + t.w <= cols, `${p.name} inside ${cols} cols`);
      for (let i = t.x; i < t.x + t.w; i++)
        for (let j = t.y; j < t.y + t.h; j++) {
          assert.ok(!taken.has(`${i},${j}`), `${p.name} overlap at ${cols} cols`);
          taken.add(`${i},${j}`);
        }
    });
  }

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
assert.ok(!validTiles([{ ...ok, kind: "xy", channels: ["track"] }]), "map must be large");
assert.ok(validTiles([{ ...ok, kind: "xy", channels: ["track"], w: 2, h: 2 }]));
console.log("validTiles ok");
