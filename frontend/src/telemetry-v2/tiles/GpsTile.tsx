import { useEffect } from "react";
import { UNIT_FONT } from "../config/theme";
import { setCourse, useCourse } from "../hooks/useCourse";
import { useGpsMode } from "../hooks/useGpsMode";
import { autoSplits, type Course } from "../lib/course";
import { deltaTime, lapTime } from "../lib/format";
import { lapSummary, lapsFor, timeTone, type LapSummary } from "../lib/laps";
import { gpsTrace, type Stream } from "../lib/stream";
import { TrackMap } from "./parts/TrackMap";
import type { TileBodyProps } from "./types";

// The GPS track map with lap timing, in three sizes. Laps and splits come from lib/laps.ts, the map is parts/TrackMap.tsx.

const tone = (d: number | undefined) => (timeTone(d) ? ` tv2-${timeTone(d)}` : "");
const time = (t: number | undefined) => (t === undefined ? "—" : lapTime(t));

// Laps against the current course. While recording (start/finish just marked), the first complete lap becomes the
// course and gets split lines at equal distances; the laps are then retimed with them, the first one included.
const FREE_RUN: Course = { splits: [] }; // no start/finish: no laps, the map shows the whole run

function useLaps(s: Stream) {
  const free = useGpsMode() === "free";
  const saved = useCourse();
  const course = free ? FREE_RUN : saved;
  const st = lapsFor(s, course);
  const first = st.laps.find((l) => l.endIdx !== undefined);
  useEffect(() => {
    if (free || !course.recording || !first) return;
    const route = gpsTrace(s, first.startIdx, first.endIdx! + 1);
    setCourse({ startFinish: course.startFinish, route, splits: autoSplits(route) });
  }, [course, first?.endIdx]);
  return { free, st, course, sum: lapSummary(st, s.lastTs ?? 0, course.splits.length + 1) };
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

// free run: just the map, the whole run drawn, no lap timing
function FreeRun(p: Parameters<typeof TrackMap>[0]) {
  return <div className="tv2-lap"><TrackMap {...p} /></div>;
}

// small: map, current lap time, delta and last lap
export function GpsSmall({ s }: TileBodyProps) {
  const { free, st, course, sum } = useLaps(s);
  if (free) return <FreeRun s={s} st={st} course={course} car="small" />;
  return (
    <div className="tv2-lap tv2-lap-small">
      <TrackMap s={s} st={st} course={course} car="small" />
      <LapReading sum={sum} small />
    </div>
  );
}

// medium: map with ticks and the lap tinted as it's driven; this lap's split times with deltas
export function GpsMedium({ s }: TileBodyProps) {
  const { free, st, course, sum } = useLaps(s);
  if (free) return <FreeRun s={s} st={st} course={course} car="medium" />;
  return (
    <div className="tv2-lap tv2-lap-medium">
      <LapReading sum={sum} />
      <TrackMap s={s} st={st} course={course} car="medium" detail />
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
  const { free, st, course, sum } = useLaps(s);
  if (free) return <FreeRun s={s} st={st} course={course} car="large" />;
  const min = (xs: (number | undefined)[]) => {
    const ok = xs.filter((t): t is number => t !== undefined);
    return ok.length ? Math.min(...ok) : undefined;
  };
  const bestSeg = sum.avgSegs.map((_, k) => min(sum.lapSegs.map((l) => l[k])));
  const best = (t: number | undefined, b: number | undefined) => (t !== undefined && t === b ? "tv2-best" : undefined);
  return (
    <div className="tv2-lap tv2-lap-large">
      <TrackMap s={s} st={st} course={course} car="large" detail labels />
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
