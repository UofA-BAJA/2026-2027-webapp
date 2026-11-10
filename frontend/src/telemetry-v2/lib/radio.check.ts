// Self-check for the radio config, dataSummary and sendCommand. Run from frontend/: node --experimental-strip-types src/telemetry-v2/lib/radio.check.ts
import assert from "node:assert/strict";
import { COMMANDS, DATA_TYPES, DEFAULT_DATA_TYPES } from "../config/radio.ts";
import { sendCommand } from "../radio/sendCommand.ts";
import { dataSummary } from "./dataSummary.ts";

const all = DATA_TYPES.map((d) => d.code);
assert.equal(DATA_TYPES.length, 10);
assert.equal(dataSummary(all), "10 of 10 · all");
assert.equal(dataSummary(DEFAULT_DATA_TYPES), "9 of 10 · all except gps");
assert.equal(dataSummary([]), "0 of 10 · none");
assert.equal(dataSummary([0x03]), "1 of 10 · motor rpm");
assert.equal(dataSummary([1, 2, 3, 4, 5]), "5 of 10");
// codes match the firmware's Commands.h
assert.deepEqual([COMMANDS.START_LOG, COMMANDS.END_LOG, COMMANDS.RETRIEVE, COMMANDS.EMERGENCY_STOP], [100, 101, 102, 104]);
// no endpoint / no server: the send says so instead of throwing
assert.deepEqual(await sendCommand(COMMANDS.START_LOG), { ok: false, reason: "not connected to car" });
// with an endpoint: it posts { id, payload } and reports what came back
let posted: unknown;
globalThis.fetch = (async (_url: string, init: RequestInit) => { posted = JSON.parse(String(init.body)); return new Response("{}", { status: 200 }); }) as typeof fetch;
assert.deepEqual(await sendCommand(COMMANDS.RADIO_FREQUENCY_CHANGE, 915.3), { ok: true });
assert.deepEqual(posted, { id: 0, payload: 915.3 });
globalThis.fetch = (async () => new Response("", { status: 404 })) as typeof fetch;
assert.deepEqual(await sendCommand(COMMANDS.END_LOG), { ok: false, reason: "not connected to car" });
globalThis.fetch = (async () => new Response("", { status: 500 })) as typeof fetch;
assert.deepEqual(await sendCommand(COMMANDS.END_LOG), { ok: false, reason: "the radio server answered 500" });
console.log("radio ok");
