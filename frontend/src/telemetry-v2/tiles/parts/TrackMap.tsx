import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useMemo } from "react";
import { MapContainer, Marker, Polyline, useMap } from "react-leaflet";
import { MAP_MAX_ZOOM } from "../../config/map";
import type { Gate, LatLon } from "../../config/track";
import { TILE_ZOOMS, VENUE } from "../../config/venues";
import type { Course } from "../../lib/course";
import type { Laps } from "../../lib/laps";
import { MapBackdrop } from "./MapBackdrop";
import { gpsTrace as trace, type Stream } from "../../lib/stream";

// The GPS map: a background (MapBackdrop: satellite, topo or none) under the course, the driven lap and the car.
// Lines are Leaflet's SVG paths so CSS tokens color them. Only the car dot moves every frame (a CSS transform, GPU
// composited); the long lines are rebuilt once a second, with a two-point tail joining them to the car in between.

const REDRAW_EVERY = 10; // fixes between rebuilds of the long lines: 1 s at 10 Hz
// the car dot diameter and its tile-colored ring, px by tile size; the smaller tiles have smaller maps
const CAR = { small: { r: 4, ring: 2 }, medium: { r: 5, ring: 2 }, large: { r: 7, ring: 3 } };
const LABEL = { w: 24, h: 16, above: 12 }; // px: S1–S4 label box, and how far above the lap it sits

// Frames `pts` with `pad` (a fraction of the box) on each side, now and whenever the box resizes. Leaflet doesn't
// watch its own size, so a size switch or fullscreen has to tell it.
function Fit({ pts, pad }: { pts: LatLon[]; pad: number }) {
  const map = useMap();
  useEffect(() => {
    const fit = () => {
      const { x, y } = map.getSize();
      if (x && y && pts.length) map.fitBounds(L.latLngBounds(pts), { padding: [x * pad, y * pad], animate: false });
    };
    fit();
    const ro = new ResizeObserver(() => {
      map.invalidateSize({ animate: false });
      fit();
    });
    ro.observe(map.getContainer());
    return () => ro.disconnect();
  }, [map, pts, pad]);
  return null;
}

const gateLine = (g: Gate, cls: string) => <Polyline key={cls + g.a.join()} positions={[g.a, g.b]} pathOptions={{ className: `tv2-map-tick ${cls}` }} />;

// The track is the last complete lap (so it doesn't thicken lap after lap), or all fixes until there is one.
// detail: start/finish and split lines + the current lap drawn over the track; labels: S1–S4.
type Props = { s: Stream; st: Laps; course: Course; car: keyof typeof CAR; detail?: boolean; labels?: boolean };
export function TrackMap({ s, st, course, car: size, detail, labels }: Props) {
  const n = st.n;
  const done = st.laps.filter((l) => l.endIdx !== undefined).at(-1);
  const cur = st.laps.find((l) => l.end === undefined);
  const tick = Math.floor(n / REDRAW_EVERY);
  // s is one object mutated in place, so these rebuild on the lap or the 1 s tick, not on every frame
  const track = useMemo(() => (done ? trace(s, done.startIdx, done.endIdx! + 1) : trace(s, 0, tick * REDRAW_EVERY)), [done?.startIdx, done?.endIdx, done ? 0 : tick, st]);
  const driven = useMemo(() => (cur ? trace(s, cur.startIdx, tick * REDRAW_EVERY) : []), [cur?.startIdx, tick, st]);
  const carIcon = useMemo(() => {
    const d = 2 * (CAR[size].r + CAR[size].ring);
    return L.divIcon({ className: `tv2-map-car ${size}`, iconSize: [d, d] });
  }, [size]);
  const segLabels = useMemo(() => {
    const b = done ? [done.startIdx, ...done.splitIdx, done.endIdx!] : [];
    if (!labels || b.length !== course.splits.length + 2 || b.some((i) => i === undefined)) return [];
    return b.slice(0, -1).map((i, k) => {
      const mid = Math.round((i! + b[k + 1]!) / 2);
      return trace(s, mid, mid + 1)[0];
    });
  }, [labels, done?.startIdx, done?.endIdx, course]);
  const labelIcons = useMemo(
    () => Array.from({ length: course.splits.length + 1 }, (_, k) =>
      L.divIcon({ className: "tv2-map-label", html: `S${k + 1}`, iconSize: [LABEL.w, LABEL.h], iconAnchor: [LABEL.w / 2, LABEL.h / 2 + LABEL.above] })),
    [course.splits.length],
  );

  const carAt = n ? trace(s, n - 1, n)[0] : undefined;
  const frame = course.route ?? (track.length ? track : carAt ? [carAt] : []);
  const tail = cur && carAt && driven.length ? [driven[driven.length - 1], carAt] : undefined;
  return (
    <MapContainer
      className="tv2-map"
      center={carAt ?? VENUE.bounds?.[0] ?? [0, 0]}
      zoom={TILE_ZOOMS.max}
      maxZoom={MAP_MAX_ZOOM}
      zoomSnap={0}
      zoomControl={false}
      attributionControl={false}
      dragging={false}
      scrollWheelZoom={false}
      doubleClickZoom={false}
      touchZoom={false}
      boxZoom={false}
      keyboard={false}
      fadeAnimation={false}
    >
      <MapBackdrop frame={frame} />
      <Fit pts={frame} pad={labels ? 0.14 : 0.1} />
      {course.route && <Polyline positions={course.route} pathOptions={{ className: "tv2-map-course" }} />}
      <Polyline positions={track} pathOptions={{ className: "tv2-map-track" }} />
      {detail && driven.length > 0 && <Polyline positions={driven} pathOptions={{ className: "tv2-map-driven" }} />}
      {detail && tail && <Polyline positions={tail} pathOptions={{ className: "tv2-map-driven" }} />}
      {detail && course.startFinish && gateLine(course.startFinish, "sf")}
      {detail && course.splits.map((g) => gateLine(g, "split"))}
      {segLabels.map((p, k) => <Marker key={k} position={p} icon={labelIcons[k]} interactive={false} />)}
      {carAt && <Marker position={carAt} icon={carIcon} interactive={false} />}
    </MapContainer>
  );
}
