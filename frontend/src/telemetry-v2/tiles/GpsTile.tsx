import { useEffect, useId, useRef, useState } from "react";
import { getLapBoxes, saveLapBox, setPromptDismissed, useLapBoxes, usePromptDismissed } from "../hooks/useLapBox";
import { getSiteChoice, siteFor, siteKey, useSiteChoice } from "../hooks/useSite";
import { lapTime, miles, mph } from "../lib/format";
import { runStats } from "../lib/geo";
import { boxAround, lapStats, normalized, type Box } from "../lib/lapBox";
import { gpsTrace, type LatLon, type Stream } from "../lib/stream";
import { Glyph } from "./parts/RoundButton";
import { TrackMap, type MapView } from "./parts/TrackMap";
import type { Size } from "./registry";
import type { TileBodyProps } from "./types";

// The GPS tile. The car only sends lat/lon: the map, a red car dot, the trail behind it, and an optional lap box.
// small (or no box): map + trail. medium with a box: + lap time, last, best, distance.
// Fullscreen is where the box is placed, moved and cleared (the only fullscreen with an app bar).

const carOf = (s: Stream): LatLon | undefined => {
  const n = Math.min(s.history.gps_latitude?.length ?? 0, s.history.gps_longitude?.length ?? 0);
  return n ? gpsTrace(s, n - 1, n)[0] : undefined;
};
const corners = (b: Box): LatLon[] => [[b.maxLat, b.minLon], [b.minLat, b.maxLon]];
const time = (t: number | undefined) => (t === undefined ? "—" : lapTime(t));

// the site the car is on (or the one picked), and its lap box
function useSiteBox(s: Stream) {
  const car = carOf(s);
  const site = siteFor(useSiteChoice(), car);
  const key = siteKey(site);
  return { car, site, key, box: useLapBoxes()[key] };
}

/** The tile's label after "gps": the lap on a medium tile with a box, otherwise the distance this run. */
export function gpsLabel(s: Stream, size: Size) {
  const box = getLapBoxes()[siteKey(siteFor(getSiteChoice(), carOf(s)))];
  return size === "medium" && box ? ` · lap ${lapStats(s).lap || "—"}` : ` · ${miles(runStats(s).metres)}`;
}

type Corner = "nw" | "ne" | "sw" | "se";

// The box: diagonal red slashes, no outline. The slashes are a pattern in screen pixels, so they stay 4 px apart at
// any zoom. Editing (onChange given) adds corner handles, the "lap box" label, and dragging: move, or resize from a
// corner. Always north-up.
function LapBox({ v, box, onChange }: { v: MapView; box: Box; onChange?: (b: Box) => void }) {
  const hatch = useId();
  const drag = useRef<{ what: "move" | Corner; from: LatLon; box: Box }>(undefined);
  const [x0, y0] = v.px([box.maxLat, box.minLon]);
  const [x1, y1] = v.px([box.minLat, box.maxLon]);
  const at = (e: React.PointerEvent<SVGElement>) => {
    const r = e.currentTarget.ownerSVGElement!.getBoundingClientRect();
    return v.toLL([e.clientX - r.left, e.clientY - r.top]);
  };
  const grab = (what: "move" | Corner) => (e: React.PointerEvent<SVGElement>) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { what, from: at(e), box };
  };
  const move = (e: React.PointerEvent<SVGElement>) => {
    const d = drag.current;
    if (!d || !onChange) return;
    const [la, lo] = at(e);
    if (d.what === "move") {
      const [dLat, dLon] = [la - d.from[0], lo - d.from[1]];
      return onChange({ minLat: d.box.minLat + dLat, maxLat: d.box.maxLat + dLat, minLon: d.box.minLon + dLon, maxLon: d.box.maxLon + dLon });
    }
    const b = { ...d.box };
    if (d.what[0] === "n") b.maxLat = la;
    else b.minLat = la;
    if (d.what[1] === "w") b.minLon = lo;
    else b.maxLon = lo;
    onChange(normalized(b));
  };
  const drop = () => void (drag.current = undefined);
  const edit = !!onChange;
  const handles: [Corner, number, number][] = [["nw", x0, y0], ["ne", x1, y0], ["sw", x0, y1], ["se", x1, y1]];
  return (
    <g className={`tv2-lapbox${edit ? " editing" : ""}`} onPointerMove={move} onPointerUp={drop} onPointerCancel={drop}>
      <defs>
        <pattern id={hatch} patternUnits="userSpaceOnUse" width="4" height="4" patternTransform="rotate(45)">
          <line className="tv2-lapbox-slash" x1="0" y1="0" x2="0" y2="4" />
        </pattern>
      </defs>
      <rect x={x0} y={y0} width={x1 - x0} height={y1 - y0} fill={`url(#${hatch})`} onPointerDown={edit ? grab("move") : undefined} />
      <text className="tv2-lapbox-label" x={edit ? (x0 + x1) / 2 : x0} y={y0 - 8}>{edit ? "lap box" : "lap"}</text>
      {edit && handles.map(([c, x, y]) => (
        <g key={c} className="tv2-lapbox-handle" onPointerDown={grab(c)}>
          <circle cx={x} cy={y} r={18} fill="transparent" />
          <circle cx={x} cy={y} r={7} />
        </g>
      ))}
    </g>
  );
}

// small: map + trail
export const GpsSmall = ({ s }: TileBodyProps) => <TrackMap s={s} size="small" />;

// medium: with a box, the map on the left over the big lap time, last / best / distance on the right
export function GpsMedium({ s }: TileBodyProps) {
  const { box } = useSiteBox(s);
  if (!box) return <TrackMap s={s} size="medium" />;
  const lap = lapStats(s);
  const text = time(lap.current);
  return (
    <div className="tv2-gps-medium">
      <div className="tv2-gps-left">
        <TrackMap s={s} size="medium" keep={corners(box)}>{(v) => <LapBox v={v} box={box} />}</TrackMap>
        <div className="tv2-reading">
          <span className="tv2-value" style={{ "--tv2-chars": text.length } as React.CSSProperties}>{text}</span>
        </div>
      </div>
      <dl className="tv2-gps-stats">
        <div><dt>last</dt><dd>{time(lap.last)}</dd></div>
        <div><dt>best</dt><dd>{time(lap.best)}</dd></div>
        <div><dt>distance</dt><dd>{miles(runStats(s).metres)}</dd></div>
      </dl>
    </div>
  );
}

type AppButtonProps = { glyph: Parameters<typeof Glyph>[0]["glyph"]; label: string; onClick: () => void; primary?: boolean; disabled?: boolean };
function AppButton({ glyph, label, onClick, primary, disabled }: AppButtonProps) {
  return (
    <button type="button" className={`tv2-appbar-btn${primary ? " primary" : ""}`} onClick={onClick} disabled={disabled}>
      <span className="tv2-appbar-circle"><Glyph glyph={glyph} size={16} /></span>
      <span>{label}</span>
    </button>
  );
}

const ZOOM_MAX = 40; // × the fit-everything view
const clampZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(1, z));

// Wheel or trackpad pinch over `ref` zooms. A native listener, because React's wheel listener is passive and can't stop
// the page from scrolling (or the browser from zooming on a pinch).
function useWheelZoom(ref: React.RefObject<HTMLElement | null>, setZoom: React.Dispatch<React.SetStateAction<number>>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation(); // not a preset swipe
      setZoom((z) => clampZoom(z * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0025)))); // ctrlKey: a trackpad pinch
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, [ref, setZoom]);
}

// fullscreen: the map with the site name and run distance, zoom (wheel, pinch, or + − fit), the lap readout, the "set up a lap box?" band the first
// time per site, and the app bar that places, edits and clears the box
export function GpsFull({ s }: TileBodyProps) {
  const { car, site, key, box } = useSiteBox(s);
  const dismissed = usePromptDismissed();
  const [edit, setEdit] = useState<{ draft: Box; frame: LatLon[] }>(); // frame: the view holds still while dragging
  const [note, setNote] = useState("");
  const [zoom, setZoom] = useState(1);
  const stage = useRef<HTMLDivElement>(null);
  useWheelZoom(stage, setZoom);
  const startEdit = (b: Box) => setEdit({ draft: b, frame: corners(b) });
  const done = async () => {
    const b = edit!.draft;
    setEdit(undefined);
    const r = await saveLapBox(key, b);
    setNote(r?.ok ? "box sent to car" : `box saved · not sent to car (${r?.reason}): this page times the laps for now`);
    setTimeout(() => setNote(""), 6000);
  };
  const { metres, speed } = runStats(s);
  const lap = lapStats(s);
  const shown = edit?.draft ?? box;
  const prompt = !box && !edit && !dismissed[key];
  return (
    <div className="tv2-gps-full">
      {prompt && (
        <div className="tv2-band" role="dialog" aria-label="set up a lap box?">
          <h4>set up a lap box?</h4>
          <p>Drop a box across the start/finish: each time the car drives into it, a new lap starts.</p>
          <div className="tv2-band-buttons">
            <button type="button" className="tv2-band-btn primary" disabled={!car} onClick={() => car && startEdit(boxAround(car))}>set up</button>
            <button type="button" className="tv2-band-btn" onClick={() => setPromptDismissed({ ...dismissed, [key]: true })}>not now</button>
          </div>
        </div>
      )}
      <div className="tv2-gps-stage" ref={stage}>
        <TrackMap s={s} size="full" keep={shown ? corners(shown) : []} fitTo={edit?.frame} zoom={zoom}>
          {(v) => shown && <LapBox v={v} box={shown} onChange={edit ? (d) => setEdit({ ...edit, draft: d }) : undefined} />}
        </TrackMap>
        <div className="tv2-gps-head">
          <div className="tv2-gps-title">GPS · {site?.name ?? "no map"}</div>
          <div>{miles(metres)} this run · {mph(speed)}</div>
          {note && <div className="tv2-gps-note">{note}</div>}
        </div>
        <div className="tv2-gps-zoom">
          <button type="button" aria-label="Zoom in" title="Zoom in" onClick={() => setZoom((z) => clampZoom(z * 1.6))}>+</button>
          <button type="button" aria-label="Zoom out" title="Zoom out" disabled={zoom <= 1} onClick={() => setZoom((z) => clampZoom(z / 1.6))}>−</button>
          <button type="button" aria-label="Fit everything" title="Fit everything" disabled={zoom <= 1} onClick={() => setZoom(1)}>fit</button>
        </div>
        {edit && <div className="tv2-gps-hint">drag to move · drag a corner to resize · drop it across the start/finish</div>}
        {box && !edit && (
          <div className="tv2-gps-lap">
            <div className="tv2-gps-lapno">{lap.lap ? `lap ${lap.lap}` : "no lap yet · drive into the box"}</div>
            <div className="tv2-gps-laptime">{time(lap.current)}</div>
            <div className="tv2-gps-lapsub">last {time(lap.last)} · best {time(lap.best)}</div>
          </div>
        )}
      </div>
      <div className="tv2-appbar">
        {edit ? (
          <>
            <AppButton glyph="check" label="done" primary onClick={done} />
            <AppButton glyph="delete" label="cancel" onClick={() => setEdit(undefined)} />
          </>
        ) : box ? (
          <>
            <AppButton glyph="edit" label="edit box" onClick={() => startEdit(box)} />
            <AppButton glyph="delete" label="clear box" onClick={() => saveLapBox(key, undefined)} />
          </>
        ) : (
          <AppButton glyph="lapBox" label="lap box" disabled={!car} onClick={() => car && startEdit(boxAround(car))} />
        )}
      </div>
    </div>
  );
}
