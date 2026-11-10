// Self-check for radio.ts. Run from frontend/: node --experimental-strip-types src/telemetry-v2/radio.check.ts
import assert from "node:assert/strict";
import { Command, DATA_TYPES, dataSummary, sendCommand } from "./radio.ts";

const all = DATA_TYPES.map((d) => d.code);
assert.equal(DATA_TYPES.length, 10);
assert.equal(dataSummary(all), "10 of 10 · all");
assert.equal(dataSummary(all.filter((c) => c !== 0x09)), "9 of 10 · all except gps");
assert.equal(dataSummary([]), "0 of 10 · none");
assert.equal(dataSummary([0x03]), "1 of 10 · motor rpm");
assert.equal(dataSummary([1, 2, 3, 4, 5]), "5 of 10");
// codes match the firmware's Commands.h
assert.deepEqual([Command.START_LOG, Command.END_LOG, Command.RETRIEVE, Command.EMERGENCY_STOP], [100, 101, 102, 104]);
// no send path yet: every send must say so, never silently succeed
assert.deepEqual(sendCommand(Command.START_LOG), { ok: false, reason: "not connected" });
console.log("radio ok");
