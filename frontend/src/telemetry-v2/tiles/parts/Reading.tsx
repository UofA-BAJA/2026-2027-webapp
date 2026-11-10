import type { Channel } from "../../config/channels";
import { UNIT_FONT } from "../../config/theme";
import type { Reading as R } from "../../lib/stream";

// The big number and its unit. "—" when the channel has no data.
export default function Reading({ ch, r, stale }: { ch: Channel; r: R; stale: boolean }) {
  return (
    <div className="tv2-reading">
      <div className="tv2-value-row">
        {/* font shrinks with the character count so long values (lat/lon) fit any tile size; the unit takes ≈ 0.72em per character + the 8px gap */}
        <span className="tv2-value" style={{ "--tv2-chars": r.text.length, "--tv2-unit": `${Math.round(ch.unit.length * UNIT_FONT * 0.72) + 10}px` } as React.CSSProperties}>
          {stale ? "—" : r.text}
        </span>
        <span className="tv2-unit">{ch.unit}</span>
      </div>
    </div>
  );
}
