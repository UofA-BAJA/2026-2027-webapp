import type { LimitState } from "../../lib/limitState";

// The outline is a meter: clockwise from the top-left corner, (value - warn) / (limit - warn) of the perimeter.
// Shown only while warning or over the limit.
export default function LimitOutline({ lim }: { lim?: LimitState }) {
  if (!lim || lim.state === "ok") return null;
  return (
    <svg className="tv2-meter" aria-hidden="true">
      <rect className="tv2-meter-track" pathLength={100} />
      <rect className="tv2-meter-fill" pathLength={100} style={{ strokeDasharray: `${lim.meter} 100` }} />
    </svg>
  );
}
