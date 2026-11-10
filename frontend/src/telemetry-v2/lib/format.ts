import type { Stream } from "./stream.ts";

// 12-hour clock with am/pm: "2:32:04 pm"
export const clock = (ms: number) =>
  new Date(ms).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" }).toLowerCase();

// the same without am/pm, for time axis labels after the first: "2:32:04"
export const clockShort = (ms: number) => clock(ms).replace(/ (am|pm)$/, "");

// stream ts is seconds since the sender started, not a clock; anchor it to when the latest frame arrived
const tsMs = (s: Stream, ts: number) => s.lastAt - ((s.lastTs ?? ts) - ts) * 1000;
export const tsClock = (s: Stream, ts: number) => clock(tsMs(s, ts));
export const tsClockShort = (s: Stream, ts: number) => clockShort(tsMs(s, ts));

// a duration as m:ss
export const mss = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;
