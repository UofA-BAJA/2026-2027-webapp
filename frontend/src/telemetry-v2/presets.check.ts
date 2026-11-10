// Self-check for pack(). Run from frontend/: node --experimental-strip-types src/telemetry-v2/presets.check.ts
import assert from "node:assert/strict";
import { PRESETS, colsFor, pack } from "./presets.ts";

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
console.log("pack ok");
