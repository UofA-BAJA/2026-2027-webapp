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

// a lap or split time, cut (not rounded) to tenths like a stopwatch: "36.4", "2:42.7"
export const lapTime = (s: number) => {
  const t = Math.floor(s * 10);
  const m = Math.floor(t / 600);
  const sec = ((t % 600) / 10).toFixed(1);
  return m ? `${m}:${sec.padStart(4, "0")}` : sec;
};

// a time difference with its sign: "−0.7", "+1.1" (a real minus sign, so it lines up with the plus)
export const deltaTime = (d: number) => `${d < 0 ? "−" : "+"}${Math.abs(d).toFixed(1)}`;
