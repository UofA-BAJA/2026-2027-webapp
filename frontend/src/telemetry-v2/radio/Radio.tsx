import { useRef, useState } from "react";
import { STALE_MS } from "../config/radio";
import type { Stream } from "../lib/stream";
import RadioPanel from "./RadioPanel";

// The radio button in the header ("[bars] −70 dBm radio ▾"); it toggles the radio panel hanging underneath.
export default function Radio({ s }: { s: Stream }) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  // frames/s over the last second, not since the page opened; counted even while the panel is closed
  const rate = useRef({ frames: s.frames, at: Date.now(), perSec: 0 });
  const now = Date.now();
  if (now - rate.current.at >= 1000) rate.current = { frames: s.frames, at: now, perSec: ((s.frames - rate.current.frames) * 1000) / (now - rate.current.at) };

  const live = s.lastAt ? now - s.lastAt < STALE_MS : false;
  const bars = !live ? 0 : s.rssi >= -50 ? 4 : s.rssi >= -65 ? 3 : s.rssi >= -80 ? 2 : 1;
  const dbm = `${s.rssi < 0 ? "−" : ""}${Math.abs(s.rssi)}`;
  return (
    <div className="tv2-radio">
      <button ref={btn} className="tv2-signal" onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="dialog">
        <span className="tv2-bars" aria-hidden>
          {[1, 2, 3, 4].map((b) => <i key={b} className={b <= bars ? "on" : ""} style={{ height: 3 + b * 3 }} />)}
        </span>
        {live ? `${dbm} dBm` : "no signal"} radio ▾
      </button>
      {/* always mounted so its settings survive closing; it draws nothing while closed */}
      <RadioPanel s={s} live={live} dbm={dbm} perSec={rate.current.perSec} trigger={btn} open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
