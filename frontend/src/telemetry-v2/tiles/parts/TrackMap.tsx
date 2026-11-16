import { useEffect, useRef, useState, type ReactNode } from "react";
import { siteFor, useSiteChoice, type Site } from "../../hooks/useSite";
import { TRAILS, trailStart, useTrail } from "../../hooks/useTrail";
import { useResize } from "../../hooks/useResize";
import { fitView, projection, type M, type View } from "../../lib/geo";
import { gpsIndexAt, gpsTrace, type LatLon, type Stream } from "../../lib/stream";

// The GPS map, one SVG in screen pixels: the site's image (maps/, or black), the trail the car left, and the car.
// No tiles and no internet: lat/lon are scaled into the image's corner bounds (flat-earth, fine for a site a few km
// across). The view fits the trail and the car. `hold` keeps that fit as it is (while the lap box is edited, or the view
// has been zoomed or dragged) so nothing slides under the pointer as the trail grows. zoom > 1 zooms in on the car and
// follows it; `center` (set by dragging the map, or by zooming toward the pointer) pins the middle of the view instead.
// `frameSite` fits the whole site image instead of the trail (placing the lap box starts there; zoom in from it).
// With a site image, the view is kept inside the photo so it always fills the map.

const CAR = { small: { r: 4, ring: 2 }, medium: { r: 5, ring: 2 }, full: { r: 7, ring: 3 } }; // px
const TRAIL_POINTS = 1500; // most trail points drawn; a longer trail is thinned (every nth fix)
const FADE_STEPS = 12; // the trail is drawn in this many pieces, oldest faintest
const ZOOM_MAX = 60; // × the fit-everything view: the whole site down to about 40 m across
export const clampZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(1, z));

export type MapView = { px: (p: LatLon) => [number, number]; toLL: (px: [number, number]) => LatLon; k: number; w: number; h: number; site?: Site };

type Props = {
  s: Stream;
  size: keyof typeof CAR;
  keep?: LatLon[]; // more points to keep in view (the lap box)
  children?: (v: MapView) => ReactNode; // drawn over the trail, under the car
  zoom?: number; // 1 = everything fits
  hold?: boolean; // keep the current fit instead of refitting every frame
  frameSite?: boolean; // fit the whole site image (when there is one) instead of the trail
  followCar?: boolean; // zoomed in with no `center`: follow the car (default) or stay on the middle of the fit
  onZoom?: (zoom: number, center: LatLon) => void; // the wheel or a trackpad pinch zooms toward the pointer
  center?: LatLon; // the view's middle once the map has been dragged; undefined = automatic
  onPan?: (center: LatLon) => void; // dragging the map (not the lap box) pans it
};

export function TrackMap({ s, size, keep = [], children, zoom = 1, hold, frameSite, followCar = true, center, onPan, onZoom }: Props) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const ref = useResize((w, h) => setBox({ w, h }));
  const pan = useRef<{ x: number; y: number; toLL: MapView["toLL"]; k: number }>(undefined); // where a map drag started
  const keepIn = useRef<(c: LatLon, k: number) => LatLon>((c) => c); // the latest "middle of the view inside the photo"
  const held = useRef<View & { w: number; h: number; site: boolean }>(undefined); // the fit kept while `hold`
  // the wheel listener is native (React's is passive, so it couldn't stop the page scrolling or the browser zooming on
  // a pinch); it reads the latest view from here
  const live = useRef<{ toLL: MapView["toLL"]; w: number; h: number; k: number; zoom: number; onZoom?: Props["onZoom"] }>(undefined);
  useEffect(() => {
    const el = ref.current!;
    const wheel = (e: WheelEvent) => {
      const l = live.current;
      if (!l?.onZoom) return;
      e.preventDefault();
      e.stopPropagation(); // not a preset swipe
      const zoom = clampZoom(l.zoom * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0025))); // ctrlKey: a trackpad pinch
      const f = zoom / l.zoom;
      // keep the point under the pointer where it is: the middle moves toward it by 1 - 1/f
      const r = el.getBoundingClientRect();
      const [px, py] = [e.clientX - r.left, e.clientY - r.top];
      l.onZoom(zoom, keepIn.current(l.toLL([px + (l.w / 2 - px) / f, py + (l.h / 2 - py) / f]), l.k * f));
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, [ref]);
  const trailSecs = TRAILS.find((t) => t.id === useTrail())!.seconds;
  const n = Math.min(s.history.gps_latitude?.length ?? 0, s.history.gps_longitude?.length ?? 0);
  const car = n ? gpsTrace(s, n - 1, n)[0] : undefined;
  const site = siteFor(useSiteChoice(), car);
  const trail = gpsTrace(s, gpsIndexAt(s, trailStart(s, trailSecs)), n, TRAIL_POINTS);
  const origin = site?.topLeft ?? gpsTrace(s, 0, 1)[0];
  if (!box.w || !box.h || !origin) return <div className="tv2-map" ref={ref} />;

  const proj = projection(origin);
  const framed = [...trail, ...(car ? [car] : []), ...keep];
  const pts: M[] = (framed.length ? framed : site ? [site.topLeft, site.bottomRight] : []).map(proj.toM);
  const whole = !!(frameSite && site);
  if (!hold || held.current?.w !== box.w || held.current?.h !== box.h || held.current.site !== whole)
    held.current = { ...(whole ? fitView([site!.topLeft, site!.bottomRight].map(proj.toM), box.w, box.h, 0) : fitView(pts, box.w, box.h)), w: box.w, h: box.h, site: whole };
  const v = { ...held.current };
  if (zoom > 1 || center) {
    const [cx, cy] = center ? proj.toM(center) : followCar && car ? proj.toM(car) : [v.x0 + box.w / 2 / v.k, v.y0 + box.h / 2 / v.k];
    v.k *= zoom;
    v.x0 = cx - box.w / 2 / v.k;
    v.y0 = cy - box.h / 2 / v.k;
  }
  // the photo always fills the map: never zoomed out past it, never past its edges (no black bars)
  const [ix0, iy0] = site ? proj.toM(site.topLeft) : [0, 0];
  const [ix1, iy1] = site ? proj.toM(site.bottomRight) : [0, 0];
  const clamp = (a: number, lo: number, hi: number) => Math.min(Math.max(a, lo), hi);
  // the middle of a view k px/m wide that stays inside the photo; dragging or zooming toward an edge stops there, so
  // the stored middle never runs past it (dragging back would do nothing until it returned)
  keepIn.current = (c, k) => {
    if (!site) return c;
    const [x, y] = proj.toM(c);
    const [hw, hh] = [box.w / 2 / k, box.h / 2 / k];
    return proj.toLL([hw * 2 >= ix1 - ix0 ? (ix0 + ix1) / 2 : clamp(x, ix0 + hw, ix1 - hw), hh * 2 >= iy1 - iy0 ? (iy0 + iy1) / 2 : clamp(y, iy0 + hh, iy1 - hh)]);
  };
  if (site) {
    const cover = Math.max(box.w / (ix1 - ix0), box.h / (iy1 - iy0));
    if (v.k < cover) {
      const [cx, cy] = [v.x0 + box.w / 2 / v.k, v.y0 + box.h / 2 / v.k];
      v.k = cover;
      v.x0 = cx - box.w / 2 / v.k;
      v.y0 = cy - box.h / 2 / v.k;
    }
    v.x0 = clamp(v.x0, ix0, ix1 - box.w / v.k);
    v.y0 = clamp(v.y0, iy0, iy1 - box.h / v.k);
  }
  const view: MapView = {
    px: (p) => {
      const [x, y] = proj.toM(p);
      return [(x - v.x0) * v.k, (y - v.y0) * v.k];
    },
    toLL: ([x, y]) => proj.toLL([x / v.k + v.x0, y / v.k + v.y0]),
    k: v.k,
    w: box.w,
    h: box.h,
    site,
  };
  live.current = { toLL: view.toLL, w: box.w, h: box.h, k: v.k, zoom, onZoom };
  const line = (ps: LatLon[]) => ps.map((p) => view.px(p).map((c) => c.toFixed(1)).join(",")).join(" ");
  // newest brightest: FADE_STEPS pieces sharing their end points, opacity rising toward the car
  const step = Math.max(1, Math.ceil(trail.length / FADE_STEPS));
  const pieces = Array.from({ length: Math.ceil(trail.length / step) }, (_, i) => trail.slice(i * step, (i + 1) * step + 1));
  const [tl, br] = site ? [view.px(site.topLeft), view.px(site.bottomRight)] : [];
  const carAt = car && view.px(car);
  const c = CAR[size];
  return (
    <div className="tv2-map" ref={ref}>
      <svg
        width={box.w}
        height={box.h}
        className={onPan ? "pannable" : undefined}
        // the lap box stops its own presses, so these only see drags on the map itself
        onPointerDown={onPan && ((e) => {
          if (e.button !== 0) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          pan.current = { x: e.clientX, y: e.clientY, toLL: view.toLL, k: v.k };
        })}
        onPointerMove={onPan && ((e) => {
          const p = pan.current;
          if (p) onPan(keepIn.current(p.toLL([box.w / 2 - (e.clientX - p.x), box.h / 2 - (e.clientY - p.y)]), p.k));
        })}
        onPointerUp={() => void (pan.current = undefined)}
        onPointerCancel={() => void (pan.current = undefined)}
      >
        {site && tl && br && <image className="tv2-map-image" href={site.image} x={tl[0]} y={tl[1]} width={br[0] - tl[0]} height={br[1] - tl[1]} preserveAspectRatio="none" />}
        <g className="tv2-map-lines">
          {pieces.map((p, i) => p.length > 1 && <polyline key={i} className="tv2-map-trail" points={line(p)} opacity={0.12 + (0.88 * (i + 1)) / pieces.length} />)}
        </g>
        {children?.(view)}
        {carAt && (
          <g aria-hidden="true">
            <circle className="tv2-map-ring" cx={carAt[0]} cy={carAt[1]} r={c.r + c.ring} />
            <circle className="tv2-map-car" cx={carAt[0]} cy={carAt[1]} r={c.r} />
          </g>
        )}
      </svg>
    </div>
  );
}
