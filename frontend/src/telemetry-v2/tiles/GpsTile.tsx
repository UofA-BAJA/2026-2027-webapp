import { useState } from "react";
import { CHANNELS } from "../config/channels";
import { useResize } from "../hooks/useResize";
import { fitTrack, scaleBar, type Pt } from "../lib/map";
import type { TileBodyProps } from "./types";

// The GPS track drawn as a map: equal-aspect metres, whole track fitted with 10% padding, car dot at the latest fix.
export default function GpsTile({ s }: TileBodyProps) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const ref = useResize((w, h) => setBox({ w, h }));
  const lat = s.history.gps_latitude ?? [];
  const lon = s.history.gps_longitude ?? [];
  const n = Math.min(lat.length, lon.length); // both come from the same frame, so index i pairs them
  // shortcut: keep ~2000 points of a long run for drawing; switch to a proper simplifier if the shape gets coarse
  const step = Math.max(1, Math.ceil(n / 2000));
  const ll: Pt[] = [];
  for (let i = 0; i < n; i += step) ll.push([lat[i][1], lon[i][1]]);
  if (n && (n - 1) % step) ll.push([lat[n - 1][1], lon[n - 1][1]]); // always end at the latest fix
  const fit = ll.length && box.w && box.h ? fitTrack(ll, box.w, box.h) : undefined;
  const bar = fit && scaleBar(fit.pxPerM);
  const car = fit?.px[fit.px.length - 1];
  const alt = s.latest.gps_altitude;
  const altCh = CHANNELS.altitude;
  return (
    <div className="tv2-map" ref={ref}>
      {fit && car && (
        <svg width={box.w} height={box.h} aria-hidden="true">
          <polyline className="tv2-map-path" points={fit.px.map((p) => p.join(",")).join(" ")} />
          <circle className="tv2-map-start" cx={fit.px[0][0]} cy={fit.px[0][1]} r={4} />
          <circle className="tv2-map-car" cx={car[0]} cy={car[1]} r={5} />
        </svg>
      )}
      <div className="tv2-map-info">
        {bar && (
          <div className="tv2-map-scale">
            <div style={{ width: bar.px }} />
            {bar.label}
          </div>
        )}
        {n > 0
          ? `${lat[n - 1][1].toFixed(5)}, ${lon[n - 1][1].toFixed(5)}` +
            (alt === undefined ? "" : ` · ${(alt * (altCh.scale ?? 1)).toFixed(altCh.decimals)} ${altCh.unit}`)
          : "waiting for GPS"}
      </div>
    </div>
  );
}
