import type { ReactNode } from "react";
import type { Channel } from "../../config/channels";
import type { Tile } from "../../lib/layout";
import type { Limit, LimitState } from "../../lib/limitState";
import { seriesLabel } from "../../lib/stream";
import type { TileActions } from "../types";
import LimitBar from "./LimitBar";
import LimitOutline from "./LimitOutline";
import TileControls from "./TileControls";

// Metro tilt: the tile leans away from where it's pressed
const tilt = (e: React.PointerEvent<HTMLElement>) => {
  const r = e.currentTarget.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width - 0.5;
  const y = (e.clientY - r.top) / r.height - 0.5;
  e.currentTarget.style.setProperty("--tv2-tilt-x", `${(-y * 10).toFixed(1)}deg`);
  e.currentTarget.style.setProperty("--tv2-tilt-y", `${(x * 10).toFixed(1)}deg`);
};

type Props = {
  tile: Tile;
  a: TileActions;
  size: "small" | "medium" | "large";
  chs: Channel[]; // all of the tile's channels (label: "speed + motor rpm")
  readingLabel: string; // " · max" etc. for multi-key channels
  limit?: Limit; // the first channel's limits, if it has any
  lim?: LimitState;
  stale: boolean;
  status: string; // right side of the label row: "warming", "OVER LIMIT", "no data 0:12"
  delay: number; // entry animation stagger
  children: ReactNode; // the tile body
};

// Everything around a tile's body: outline meter, controls, the customize-mode number picker,
// and the Windows Phone style foot (limit bar, then the label bottom-left under the number, status on the right).
export default function TileShell({ tile, a, size, chs, readingLabel, limit, lim, stale, status, delay, children }: Props) {
  const ch = chs[0];
  const state = lim && lim.state !== "ok" ? ` tv2-${lim.state}` : "";
  return (
    <div className={`tv2-tile tv2-in tv2-${size}${stale ? " tv2-stale" : ""}${state}`} style={{ animationDelay: `${delay}ms` }} onPointerDown={tilt}>
      <LimitOutline lim={lim} />
      <div className="tv2-tile-head">
        <TileControls tile={tile} a={a} />
      </div>
      {a.customizing && size !== "large" && tile.kind === "channel" && ch.keys.length > 1 && (
        <select className="tv2-pick" value={tile.pick ?? ch.pick ?? "avg"} onChange={(e) => a.onPick(e.target.value)} aria-label="number shown">
          <option value="avg">average</option>
          <option value="max">max</option>
          {ch.keys.map((k) => <option key={k} value={k}>{seriesLabel(k)}</option>)}
        </select>
      )}
      {children}
      <div className="tv2-foot">
        {limit && <LimitBar limit={limit} lim={lim} />}
        <div className="tv2-foot-row">
          <span className="tv2-label">
            {chs.map((c) => c.label).join(" + ")}
            {size !== "large" && readingLabel}
          </span>
          {status && <span className={`tv2-status${lim && lim.meter >= 60 ? " strong" : ""}`}>{status}</span>}
        </div>
      </div>
    </div>
  );
}
