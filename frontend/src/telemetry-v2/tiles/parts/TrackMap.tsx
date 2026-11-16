import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useMemo } from "react";
import { MapContainer, Marker, Polyline, useMap } from "react-leaflet";
import { MAP_MAX_ZOOM } from "../../config/map";
import { TILE_ZOOMS, VENUE } from "../../config/venues";
import { MapBackdrop } from "./MapBackdrop";
import { gpsTrace as trace, type LatLon, type Stream } from "../../lib/stream";

// The GPS map: a background (MapBackdrop: satellite, topo or none) under the trail the car left and the car.
// Lines are Leaflet's SVG paths so CSS tokens color them. Only the car dot moves every frame (a CSS transform, GPU
// composited); the trail is rebuilt once a second.

const REDRAW_EVERY = 10; // fixes between rebuilds of the trail: 1 s at 10 Hz
// the car dot diameter and its tile-colored ring, px by tile size; the smaller tiles have smaller maps
const CAR = { small: { r: 4, ring: 2 }, medium: { r: 5, ring: 2 }, large: { r: 7, ring: 3 } };
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

export function TrackMap({ s, car: size }: { s: Stream; car: keyof typeof CAR }) {
  const n = Math.min(s.history.gps_latitude?.length ?? 0, s.history.gps_longitude?.length ?? 0);
  const tick = Math.floor(n / REDRAW_EVERY);
  // s is one object mutated in place, so the trail rebuilds on the 1 s tick, not on every frame
  const track = useMemo(() => trace(s, 0, tick * REDRAW_EVERY), [s, tick]);
  const carIcon = useMemo(() => {
    const d = 2 * (CAR[size].r + CAR[size].ring);
    return L.divIcon({ className: `tv2-map-car ${size}`, iconSize: [d, d] });
  }, [size]);
  const carAt = n ? trace(s, n - 1, n)[0] : undefined;
  const frame = track.length ? track : carAt ? [carAt] : [];
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
      <Fit pts={frame} pad={0.1} />
      <Polyline positions={track} pathOptions={{ className: "tv2-map-track" }} />
      {carAt && <Marker position={carAt} icon={carIcon} interactive={false} />}
    </MapContainer>
  );
}
