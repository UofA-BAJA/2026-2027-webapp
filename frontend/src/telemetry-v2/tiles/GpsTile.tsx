import { useEffect, useId, useRef, useState } from "react";
import { getLapBoxes, saveLapBox, setPromptDismissed, useLapBoxes, usePromptDismissed } from "../hooks/useLapBox";
import { getSiteChoice, siteFor, siteKey, useSiteChoice } from "../hooks/useSite";
import { lapTime, miles, mph } from "../lib/format";
import { runStats } from "../lib/geo";
import { LAPS } from "../config/laps";
import { boxAround, boxSizeM, lapStats, normalized, type Box } from "../lib/lapBox";
import { gpsTrace, type LatLon, type Stream } from "../lib/stream";
import { Glyph } from "./parts/RoundButton";
import { clampZoom, TrackMap, type MapView } from "./parts/TrackMap";
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
const HANDLE_R = 10; // px: the red corner handles
const GRAB_R = 26; // px: the invisible target around a handle (and around a box too small for handles): finger-sized
const HANDLES_FROM = 2 * GRAB_R + 16; // px: smaller than this on screen, the box shows no corner handles (theirs would cover it)
const HANDLE_INSET = 16; // px: a corner off screen (zoomed in past the box) keeps its handle this far inside the edge

// The box: diagonal red slashes, no outline. The slashes are a pattern in screen pixels, so they stay 4 px apart at
// any zoom. Editing (onChange given) adds corner handles, the "lap box" label, and dragging: move, or resize from a
// corner. Always north-up.
function LapBox({ v, box, onChange }: { v: MapView; box: Box; onChange?: (b: Box) => void }) {
  const hatch = useId();
  const latest = useRef(onChange); // the box re-renders every frame; the drag calls the newest onChange
  latest.current = onChange;
  const [x0, y0] = v.px([box.maxLat, box.minLon]);
  const [x1, y1] = v.px([box.minLat, box.maxLon]);
  // A drag follows the pointer on the window, with the view and the map's position as they were when it started, so
  // the re-rendering box under the pointer can't lose or re-base it.
  const grab = (what: "move" | Corner) => (e: React.PointerEvent<SVGElement>) => {
    if (e.button !== 0) return;
    e.stopPropagation(); // not a map pan
    e.preventDefault();
    const r = e.currentTarget.ownerSVGElement!.getBoundingClientRect();
    const toLL = v.toLL;
    const at = (ev: PointerEvent | React.PointerEvent): LatLon => toLL([ev.clientX - r.left, ev.clientY - r.top]);
    const [from, start] = [at(e), box];
    const move = (ev: PointerEvent) => {
      const [la, lo] = at(ev);
      if (what === "move") {
        const [dLat, dLon] = [la - from[0], lo - from[1]];
        return latest.current?.({ minLat: start.minLat + dLat, maxLat: start.maxLat + dLat, minLon: start.minLon + dLon, maxLon: start.maxLon + dLon });
      }
      const b = { ...start };
      if (what[0] === "n") b.maxLat = la;
      else b.minLat = la;
      if (what[1] === "w") b.minLon = lo;
      else b.maxLon = lo;
      latest.current?.(normalized(b));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };
  const edit = !!onChange;
  // corner handles only once the box is big enough on screen to grab them apart from the box itself; zoomed out
  // (placing starts from the whole site) any drag on it moves it
  const roomy = x1 - x0 >= HANDLES_FROM && y1 - y0 >= HANDLES_FROM;
  // zoomed in past the box, its corners are off screen: their handles stay at the edge, and dragging one still moves
  // that corner to the pointer
  const inX = (x: number) => Math.min(v.w - HANDLE_INSET, Math.max(HANDLE_INSET, x));
  const inY = (y: number) => Math.min(v.h - HANDLE_INSET, Math.max(HANDLE_INSET, y));
  const handles: [Corner, number, number][] = [["nw", inX(x0), inY(y0)], ["ne", inX(x1), inY(y0)], ["sw", inX(x0), inY(y1)], ["se", inX(x1), inY(y1)]];
  return (
    <g className={`tv2-lapbox${edit ? " editing" : ""}`}>
      <defs>
        <pattern id={hatch} patternUnits="userSpaceOnUse" width="4" height="4" patternTransform="rotate(45)">
          <line className="tv2-lapbox-slash" x1="0" y1="0" x2="0" y2="4" />
        </pattern>
      </defs>
      <rect x={x0} y={y0} width={x1 - x0} height={y1 - y0} fill={`url(#${hatch})`} onPointerDown={edit ? grab("move") : undefined} />
      {/* a tiny box (zoomed out) gets a finger-sized invisible target, so it can still be picked up */}
      {edit && !roomy && <circle cx={(x0 + x1) / 2} cy={(y0 + y1) / 2} r={GRAB_R} fill="transparent" onPointerDown={grab("move")} />}
      <text className="tv2-lapbox-label" x={edit ? (x0 + x1) / 2 : x0} y={y0 - 8}>{edit ? `lap box · ${boxSizeM(box).map(Math.round).join(" × ")} m` : "lap"}</text>
      {edit && roomy && handles.map(([c, x, y]) => (
        <g key={c} className="tv2-lapbox-handle" onPointerDown={grab(c)}>
          <circle cx={x} cy={y} r={GRAB_R} fill="transparent" />
          <circle cx={x} cy={y} r={HANDLE_R} />
        </g>
      ))}
    </g>
  );
}

// small: map + trail, and the lap box when there is one
export function GpsSmall({ s }: TileBodyProps) {
  const { box } = useSiteBox(s);
  return (
    <TrackMap s={s} size="small" keep={box ? corners(box) : []}>
      {(v) => box && <LapBox v={v} box={box} />}
    </TrackMap>
  );
}

// medium: with a box, the map filling the left with the big lap time over its bottom-left corner, last / best /
// distance on the right
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

// fullscreen: the map with the site name and run distance, zoom (wheel, pinch, or + − fit) and drag to pan, the lap
// readout, the "set up a lap box?" band the first time per site, and the app bar that places, edits and clears the box
export function GpsFull({ s }: TileBodyProps) {
  const { car, site, key, box } = useSiteBox(s);
  const dismissed = usePromptDismissed();
  // editing: `at` is where a new box goes. While `fresh` (nothing touched yet) its size follows the view so it's always
  // boxScreenPx across, even as the map settles (the band above it closing); dragging, zooming or panning keeps it as is
  const [edit, setEdit] = useState<{ at: LatLon; draft?: Box; fresh?: boolean; k?: number }>();
  const viewK = useRef(0); // px per metre of the map as last drawn
  useEffect(() => {
    const k = viewK.current;
    if (edit?.fresh && k && k !== edit.k) {
      const m = LAPS.boxScreenPx / k;
      setEdit({ ...edit, k, draft: boxAround(edit.at, m, m) });
    }
  });
  const touched = () => edit?.fresh && setEdit({ ...edit, fresh: false });
  const [note, setNote] = useState("");
  const noteTimer = useRef(0); // a newer note restarts the 6 s
  const [zoom, setZoom] = useState(1);
  const [center, setCenter] = useState<LatLon>(); // set by dragging the map; fit lets go of it
  const dropAt = center ?? car; // a new box lands in the middle of the view once it's been dragged, else on the car
  // + and −: around the car, or around the box while placing it (the view starts on the whole site, so zooming its
  // middle would push the box off screen)
  const zoomBy = (f: number) => {
    touched();
    setZoom((z) => clampZoom(z * f));
    if (edit && !center) setCenter(edit.draft ? [(edit.draft.minLat + edit.draft.maxLat) / 2, (edit.draft.minLon + edit.draft.maxLon) / 2] : edit.at);
  };
  // placing starts from the whole site image (or the whole trail); zoom in to put the box exactly on the line
  const startEdit = (at: LatLon, draft?: Box) => (setEdit({ at, draft, fresh: !draft }), setZoom(1), setCenter(undefined));
  const done = async () => {
    const b = edit?.draft;
    if (!b) return;
    setEdit(undefined);
    const r = await saveLapBox(key, b);
    setNote(r?.ok ? "box sent to car" : `box saved · not sent to car (${r?.reason}): this page times the laps for now`);
    clearTimeout(noteTimer.current);
    noteTimer.current = window.setTimeout(() => setNote(""), 6000);
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
            <button type="button" className="tv2-band-btn primary" disabled={!dropAt} onClick={() => dropAt && startEdit(dropAt)}>set up</button>
            <button type="button" className="tv2-band-btn" onClick={() => setPromptDismissed({ ...dismissed, [key]: true })}>not now</button>
          </div>
        </div>
      )}
      <div className="tv2-gps-stage">
        <TrackMap s={s} size="full" keep={shown ? corners(shown) : []} hold={!!edit || zoom > 1 || !!center} frameSite={!!edit} followCar={!edit} zoom={zoom} center={center} onPan={(c) => (touched(), setCenter(c))}
          onZoom={(z, c) => (touched(), setZoom(z), setCenter(c))}>
          {(v) => ((viewK.current = v.k), shown && <LapBox v={v} box={shown} onChange={edit ? (d) => setEdit({ ...edit, draft: d, fresh: false }) : undefined} />)}
        </TrackMap>
        <div className="tv2-gps-head">
          <div className="tv2-gps-title">GPS · {site?.name ?? "no map"}</div>
          <div>{miles(metres)} this run · {mph(speed)}</div>
          {note && <div className="tv2-gps-note">{note}</div>}
        </div>
        <div className="tv2-gps-zoom">
          <button type="button" aria-label="Zoom in" title="Zoom in" onClick={() => zoomBy(1.6)}>+</button>
          <button type="button" aria-label="Zoom out" title="Zoom out" disabled={zoom <= 1} onClick={() => zoomBy(1 / 1.6)}>−</button>
          <button type="button" aria-label="Fit everything" title="Fit everything" disabled={zoom <= 1 && !center} onClick={() => (setZoom(1), setCenter(undefined))}>fit</button>
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
            {/* back onto the car, sized for the current zoom, with the view on it */}
            <AppButton glyph="reset" label="reset" disabled={!car} onClick={() => car && (setEdit({ at: car, fresh: true }), setCenter(car))} />
            <AppButton glyph="delete" label="cancel" onClick={() => setEdit(undefined)} />
          </>
        ) : box ? (
          <>
            <AppButton glyph="edit" label="edit box" onClick={() => startEdit([(box.minLat + box.maxLat) / 2, (box.minLon + box.maxLon) / 2], box)} />
            <AppButton glyph="delete" label="clear box" onClick={() => saveLapBox(key, undefined)} />
          </>
        ) : (
          <AppButton glyph="lapBox" label="lap box" disabled={!dropAt} onClick={() => dropAt && startEdit(dropAt)} />
        )}
      </div>
    </div>
  );
}
