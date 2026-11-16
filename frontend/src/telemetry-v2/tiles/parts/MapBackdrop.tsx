import L from "leaflet";
import { useEffect, useRef, useState } from "react";
import { TileLayer, useMap } from "react-leaflet";
import { BACKGROUNDS, MAP_CREDIT, MAP_MAX_ZOOM, OFFLINE_AFTER_ERRORS, ONLINE_MAX_ZOOM } from "../../config/map";
import type { LatLon } from "../../lib/stream";
import { TILE_ZOOMS, VENUE } from "../../config/venues";
import { useMapBackground } from "../../hooks/useMapBackground";
import { ContourLayer, hasContours } from "./ContourLayer";

// What's under the GPS map's lines (GPS settings → BACKGROUND): USGS satellite or topo tiles, contour lines made from
// USGS elevation files (offline), or nothing (black).
// Satellite also draws the venue's downloaded imagery (public/tiles/<venue>/) on top, which works offline.
// When the online tiles keep failing (no internet), the online layer goes and "offline · map hidden" shows instead;
// the lines and the car never depend on it.

export function MapBackdrop({ frame }: { frame: LatLon[] }) {
  const bg = useMapBackground();
  const map = useMap();
  const [offline, setOffline] = useState(false);
  const failed = useRef(0); // tile errors since the last tile that loaded
  const reset = () => ((failed.current = 0), setOffline(false));
  useEffect(reset, [bg]);
  useEffect(() => {
    window.addEventListener("online", reset); // back online: try again
    return () => window.removeEventListener("online", reset);
  }, []);

  const online = BACKGROUNDS.find((b) => b.id === bg)?.url;
  const local = bg === "satellite" && VENUE.bounds;
  const localInView = !!local && frame.length > 0 && L.latLngBounds(frame).intersects(VENUE.bounds!);
  const hidden = offline && !localInView;
  // data-bg picks the dimming in tiles.css; hidden counts as none (pure black)
  useEffect(() => void (map.getContainer().dataset.bg = hidden ? "none" : bg), [map, bg, hidden]);

  return (
    <>
      {online && !offline && (
        <TileLayer
          key={bg}
          url={online}
          maxNativeZoom={ONLINE_MAX_ZOOM}
          maxZoom={MAP_MAX_ZOOM}
          zIndex={1}
          eventHandlers={{
            tileload: () => void (failed.current = 0),
            tileerror: () => {
              if (!navigator.onLine || ++failed.current >= OFFLINE_AFTER_ERRORS) setOffline(true);
            },
          }}
        />
      )}
      {local && (
        <TileLayer
          url={`${import.meta.env.BASE_URL}tiles/${VENUE.id}/{z}/{x}/{y}.jpg`}
          bounds={VENUE.bounds}
          minNativeZoom={TILE_ZOOMS.min}
          maxNativeZoom={TILE_ZOOMS.max}
          maxZoom={MAP_MAX_ZOOM}
          zIndex={2}
        />
      )}
      {bg === "contours" && hasContours && <ContourLayer />}
      {bg === "contours" && !hasContours && <div className="tv2-map-offline">no elevation data · see frontend/elevation/README.md</div>}
      {bg !== "none" && !hidden && <div className="tv2-map-credit">{MAP_CREDIT}</div>}
      {offline && bg !== "none" && <div className="tv2-map-offline">{localInView ? "offline · saved imagery only" : "offline · map hidden"}</div>}
    </>
  );
}
