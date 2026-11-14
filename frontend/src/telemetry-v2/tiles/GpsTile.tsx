import { useState } from "react";
import { TRACK, type Gate } from "../config/track";
import { UNIT_FONT } from "../config/theme";
import { useResize } from "../hooks/useResize";
import { deltaTime, lapTime } from "../lib/format";
import { lapSummary, lapsFor, timeTone, type LapSummary, type Laps } from "../lib/laps";
import { fitTrack, type Pt } from "../lib/map";
import type { Stream } from "../lib/stream";
import type { TileBodyProps } from "./types";

// The GPS track map with lap timing, in three sizes. Laps and splits come from lib/laps.ts, lines from config/track.ts.

const MAX_POINTS = 2000; // ponytail: plain every-nth thinning; switch to a simplifier if long laps look coarse
const TICK = 14; // px, start/finish and split ticks across the track
const LABEL_OFFSET = 14; // px, S1–S4 labels sit this far outside the track
// the car dot and its tile-colored ring, px by tile size; the smaller tiles have smaller maps
const CAR = { small: { r: 4, ring: 2 }, medium: { r: 5, ring: 2 }, large: { r: 7, ring: 3 } };

// GPS fixes [from, to) as [lat, lon], thinned to MAX_POINTS, always keeping the last one
function trace(s: Stream, from: number, to: number): Pt[] {
  const lat = s.history.gps_latitude ?? [];
  const lon = s.history.gps_longitude ?? [];
  const step = Math.max(1, Math.ceil((to - from) / MAX_POINTS));
  const out: Pt[] = [];
  for (let i = from; i < to; i += step) out.push([lat[i][1], lon[i][1]]);
  if (to > from && (to - 1 - from) % step) out.push([lat[to - 1][1], lon[to - 1][1]]);
  return out;
}

const tone = (d: number | undefined) => (timeTone(d) ? ` tv2-${timeTone(d)}` : "");
const time = (t: number | undefined) => (t === undefined ? "—" : lapTime(t));

function useLaps(s: Stream) {
  const st = lapsFor(s);
  return { st, sum: lapSummary(st, s.lastTs ?? 0) };
}

// The map. The track is the last complete lap (so it doesn't thicken lap after lap), or all fixes until there is one.
// detail: ticks at start/finish and the splits + the current lap drawn over the track; labels: S1–S4.
function TrackMap({ s, st, car: dot, detail, labels }: { s: Stream; st: Laps; car: keyof typeof CAR; detail?: boolean; labels?: boolean }) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const ref = useResize((w, h) => setBox({ w, h }));
  const n = st.n;
  const done = st.laps.filter((l) => l.endIdx !== undefined).at(-1);
  const track = done ? trace(s, done.startIdx, done.endIdx! + 1) : trace(s, 0, n);
  const car = track.length ? trace(s, n - 1, n)[0] : undefined;
  if (!car || !box.w || !box.h) return <div className="tv2-map" ref={ref} />;

  const fit = fitTrack([...track, car], box.w, box.h, labels ? 0.14 : 0.1);
  const line = (pts: Pt[]) => pts.map((p) => fit.toPx(p).map((v) => v.toFixed(1)).join(",")).join(" ");
  const cur = st.laps.find((l) => l.end === undefined);
  const tick = (g: Gate, cls: string) => {
    const [a, b] = [fit.toPx(g.a), fit.toPx(g.b)];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const [ux, uy] = [((b[0] - a[0]) / len) * (TICK / 2), ((b[1] - a[1]) / len) * (TICK / 2)];
    const [cx, cy] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    return <line key={cls + g.a.join()} className={`tv2-map-tick ${cls}`} x1={cx - ux} y1={cy - uy} x2={cx + ux} y2={cy + uy} />;
  };
  // S1–S4 at the middle of each segment of the drawn lap, pushed outward from the map centre
  const bounds = done ? [done.startIdx, ...done.splitIdx, done.endIdx!] : [];
  const segLabels =
    labels && bounds.length === TRACK.splits.length + 2 && bounds.every((i) => i !== undefined)
      ? bounds.slice(0, -1).map((i, k) => {
          const [x, y] = fit.toPx(trace(s, Math.round((i! + bounds[k + 1]!) / 2), Math.round((i! + bounds[k + 1]!) / 2) + 1)[0]);
          const d = Math.hypot(x - box.w / 2, y - box.h / 2) || 1;
          return (
            <text key={k} className="tv2-map-label" x={x + ((x - box.w / 2) / d) * LABEL_OFFSET} y={y + ((y - box.h / 2) / d) * LABEL_OFFSET}>
              S{k + 1}
            </text>
          );
        })
      : null;
  const [carX, carY] = fit.toPx(car);
  return (
    <div className="tv2-map" ref={ref}>
      <svg width={box.w} height={box.h} aria-hidden="true">
        <polyline className="tv2-map-track" points={line(track)} />
        {detail && cur && <polyline className="tv2-map-driven" points={line(trace(s, cur.startIdx, n))} />}
        {detail && [tick(TRACK.startFinish, "sf"), ...TRACK.splits.map((g) => tick(g, "split"))]}
        {segLabels}
        <circle className="tv2-map-ring" cx={carX} cy={carY} r={CAR[dot].r + CAR[dot].ring} />
        <circle className="tv2-map-car" cx={carX} cy={carY} r={CAR[dot].r} />
      </svg>
    </div>
  );
}

// The big current-lap time; its delta to the average goes next to it, or on the line below (small).
function LapReading({ sum, small }: { sum: LapSummary; small?: boolean }) {
  const text = time(sum.curTime);
  const delta = sum.delta === undefined ? "" : deltaTime(sum.delta);
  const unitPx = small || !delta ? 0 : Math.round(delta.length * UNIT_FONT * 0.62) + 10;
  return (
    <div className="tv2-reading">
      <div className="tv2-value-row">
        <span className="tv2-value" style={{ "--tv2-chars": text.length, "--tv2-unit": `${unitPx}px` } as React.CSSProperties}>
          {text}
        </span>
        {!small && delta && <span className={`tv2-lap-delta${tone(sum.delta)}`}>{delta}</span>}
      </div>
      {small && (
        <div className="tv2-lap-sub">
          {delta || sum.lastLap !== undefined ? (
            <>
              {delta && <span className={tone(sum.delta).trim()}>{delta}</span>}
              {delta && " vs avg"}
              {delta && sum.lastLap !== undefined && " · "}
              {sum.lastLap !== undefined && `last ${lapTime(sum.lastLap)}`}
            </>
          ) : sum.cur ? "first lap" : "out lap"}
        </div>
      )}
    </div>
  );
}

// small: map, current lap time, delta and last lap
export function GpsSmall({ s }: TileBodyProps) {
  const { st, sum } = useLaps(s);
  return (
    <div className="tv2-lap tv2-lap-small">
      <TrackMap s={s} st={st} car="small" />
      <LapReading sum={sum} small />
    </div>
  );
}

// medium: map with ticks and the lap tinted as it's driven; this lap's split times with deltas
export function GpsMedium({ s }: TileBodyProps) {
  const { st, sum } = useLaps(s);
  return (
    <div className="tv2-lap tv2-lap-medium">
      <LapReading sum={sum} />
      <TrackMap s={s} st={st} car="medium" detail />
      <div className="tv2-splits">
        {sum.avgSegs.map((_, k) => {
          const t = sum.curSegs[k];
          const d = sum.segDelta[k];
          return (
            <div className="tv2-split" key={k}>
              <span className="tv2-split-name">S{k + 1}</span>
              <span className={`tv2-split-time${tone(d)}`}>{time(t)}</span>
              <span className={`tv2-split-delta${tone(d)}`}>{d === undefined ? "" : deltaTime(d)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// large: bigger map with S1–S4, every lap × every segment (best per column in blue), best and average lap
export function GpsLarge({ s }: TileBodyProps) {
  const { st, sum } = useLaps(s);
  const min = (xs: (number | undefined)[]) => {
    const ok = xs.filter((t): t is number => t !== undefined);
    return ok.length ? Math.min(...ok) : undefined;
  };
  const bestSeg = sum.avgSegs.map((_, k) => min(sum.lapSegs.map((l) => l[k])));
  const best = (t: number | undefined, b: number | undefined) => (t !== undefined && t === b ? "tv2-best" : undefined);
  return (
    <div className="tv2-lap tv2-lap-large">
      <TrackMap s={s} st={st} car="large" detail labels />
      {(sum.cur || sum.done.length > 0) && (
        <div className="tv2-laps-wrap">
          <table className="tv2-laps">
            <thead>
              <tr>
                <th>lap</th>
                {sum.avgSegs.map((_, k) => <th key={k}>S{k + 1}</th>)}
                <th>time</th>
              </tr>
            </thead>
            <tbody>
              {sum.cur && (
                <tr className="tv2-live">
                  <td>{sum.done.length + 1}</td>
                  {sum.curSegs.map((t, k) => (
                    <td key={k} className={tone(sum.segDelta[k]).trim() || undefined}>
                      {t === undefined ? "" : lapTime(t)}
                    </td>
                  ))}
                  <td className={tone(sum.delta).trim() || undefined}>{time(sum.curTime)}</td>
                </tr>
              )}
              {sum.done
                .map((_, i) => i)
                .reverse()
                .map((i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    {sum.lapSegs[i].map((t, k) => <td key={k} className={best(t, bestSeg[k])}>{time(t)}</td>)}
                    <td className={best(sum.times[i], sum.bestLap)}>{lapTime(sum.times[i])}</td>
                  </tr>
                ))}
            </tbody>
            {sum.done.length > 0 && (
              <tfoot>
                <tr>
                  <td>avg</td>
                  {sum.avgSegs.map((t, k) => <td key={k}>{time(t)}</td>)}
                  <td>{time(sum.avgLap)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
      <div className="tv2-lap-foot">
        <LapReading sum={sum} />
        <div className="tv2-lap-stats">
          <div>best <span>{time(sum.bestLap)}</span></div>
          <div>avg <span>{time(sum.avgLap)}</span></div>
        </div>
      </div>
    </div>
  );
}
