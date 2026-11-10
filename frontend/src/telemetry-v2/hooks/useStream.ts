import { useEffect, useRef, useState } from "react";
import { STREAM_URL } from "../config/radio";
import type { Stream } from "../lib/stream";

// One SSE connection for the whole page; re-renders at 10 Hz.
export function useStream() {
  const ref = useRef<Stream>({ latest: {}, history: {}, at: {}, rssi: -1000, lastAt: 0, frames: 0, startedAt: Date.now() });
  const [, setTick] = useState(0);
  useEffect(() => {
    const sse = new EventSource(STREAM_URL);
    sse.onmessage = (e) => {
      const p = JSON.parse(e.data);
      const s = ref.current;
      s.rssi = p.rssi;
      s.lastAt = Date.now();
      s.frames++;
      s.firstTs ??= p.ts;
      s.lastTs = p.ts;
      for (const [k, v] of Object.entries(p)) {
        if (k === "ts" || k === "rssi" || k === "header" || typeof v !== "number") continue;
        s.latest[k] = v;
        s.at[k] = s.lastAt;
        // shortcut: whole run kept in memory; downsample or cap if runs get long
        (s.history[k] ??= []).push([p.ts, v]);
      }
    };
    const id = setInterval(() => setTick((t) => t + 1), 100);
    return () => {
      sse.close();
      clearInterval(id);
    };
  }, []);
  return ref.current;
}
