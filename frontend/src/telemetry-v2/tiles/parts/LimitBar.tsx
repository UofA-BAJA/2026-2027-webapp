import type { Limit, LimitState } from "../../lib/limitState";

// 4px bar under the number for channels with known limits, at every size: fill = position in min → max, "/ max" at the right.
export default function LimitBar({ limit, lim }: { limit: Limit; lim?: LimitState }) {
  return (
    <div className="tv2-bar">
      <div className="tv2-bar-track"><i style={{ width: `${(lim?.fill ?? 0) * 100}%` }} /></div>
      <span>/ {limit.max}</span>
    </div>
  );
}
