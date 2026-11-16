import { useState, type ReactNode } from "react";
import { siteFor, useSiteChoice, type Site } from "../../hooks/useSite";
import { TRAILS, trailStart, useTrail } from "../../hooks/useTrail";
import { useResize } from "../../hooks/useResize";
import { fitView, projection, type M } from "../../lib/geo";
import { gpsIndexAt, gpsTrace, type LatLon, type Stream } from "../../lib/stream";

// The GPS map, one SVG in screen pixels: the site's image (maps/, or black), the trail the car left, and the car.
// No tiles and no internet: lat/lon are scaled into the image's corner bounds (flat-earth, fine for a site a few km
// across). The view fits the trail and the car, or `fitTo` when given (the lap box editor holds it still).
// zoom > 1 zooms in on the car and follows it (on the middle of `fitTo` while that's given).

const CAR = { small: { r: 4, ring: 2 }, medium: { r: 5, ring: 2 }, full: { r: 7, ring: 3 } }; // px
const TRAIL_POINTS = 1500; // most trail points drawn; a longer trail is thinned (every nth fix)
const FADE_STEPS = 12; // the trail is drawn in this many pieces, oldest faintest

export type MapView = { px: (p: LatLon) => [number, number]; toLL: (px: [number, number]) => LatLon; k: number; site?: Site };

type Props = {
  s: Stream;
  size: keyof typeof CAR;
  keep?: LatLon[]; // more points to keep in view (the lap box)
  fitTo?: LatLon[]; // frame these instead of the trail
  children?: (v: MapView) => ReactNode; // drawn over the trail, under the car
  zoom?: number; // 1 = everything fits
};

export function TrackMap({ s, size, keep = [], fitTo, children, zoom = 1 }: Props) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const ref = useResize((w, h) => setBox({ w, h }));
  const trailSecs = TRAILS.find((t) => t.id === useTrail())!.seconds;
  const n = Math.min(s.history.gps_latitude?.length ?? 0, s.history.gps_longitude?.length ?? 0);
  const car = n ? gpsTrace(s, n - 1, n)[0] : undefined;
  const site = siteFor(useSiteChoice(), car);
  const trail = gpsTrace(s, gpsIndexAt(s, trailStart(s, trailSecs)), n, TRAIL_POINTS);
  const origin = site?.topLeft ?? gpsTrace(s, 0, 1)[0];
  if (!box.w || !box.h || !origin) return <div className="tv2-map" ref={ref} />;

  const proj = projection(origin);
  const framed = fitTo ?? [...trail, ...(car ? [car] : []), ...keep];
  const pts: M[] = (framed.length ? framed : site ? [site.topLeft, site.bottomRight] : []).map(proj.toM);
  const v = fitView(pts, box.w, box.h);
  if (zoom > 1) {
    const [cx, cy] = !fitTo && car ? proj.toM(car) : [v.x0 + box.w / 2 / v.k, v.y0 + box.h / 2 / v.k];
    v.k *= zoom;
    v.x0 = cx - box.w / 2 / v.k;
    v.y0 = cy - box.h / 2 / v.k;
  }
  const view: MapView = {
    px: (p) => {
      const [x, y] = proj.toM(p);
      return [(x - v.x0) * v.k, (y - v.y0) * v.k];
    },
    toLL: ([x, y]) => proj.toLL([x / v.k + v.x0, y / v.k + v.y0]),
    k: v.k,
    site,
  };
  const line = (ps: LatLon[]) => ps.map((p) => view.px(p).map((c) => c.toFixed(1)).join(",")).join(" ");
  // newest brightest: FADE_STEPS pieces sharing their end points, opacity rising toward the car
  const step = Math.max(1, Math.ceil(trail.length / FADE_STEPS));
  const pieces = Array.from({ length: Math.ceil(trail.length / step) }, (_, i) => trail.slice(i * step, (i + 1) * step + 1));
  const [tl, br] = site ? [view.px(site.topLeft), view.px(site.bottomRight)] : [];
  const carAt = car && view.px(car);
  const c = CAR[size];
  return (
    <div className="tv2-map" ref={ref}>
      <svg width={box.w} height={box.h}>
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
