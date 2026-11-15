// Map backgrounds for the GPS tile. Data only; the map is tiles/parts/TrackMap.tsx.
// Source: USGS The National Map basemap services (imagery: USDA NAIP; topo: USGS topographic base map). Public domain,
// no use restrictions; USGS asks for credit, shown as MAP_CREDIT in the map corner. See tracks/README.md.

export type MapBackground = "satellite" | "topo" | "contours" | "none";

export const BACKGROUNDS: { id: MapBackground; label: string; url?: string }[] = [
  { id: "satellite", label: "satellite", url: "https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}" },
  { id: "topo", label: "topo", url: "https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}" },
  // black and white contour lines from USGS elevation data, generated from files in frontend/elevation/ (offline)
  { id: "contours", label: "contours" },
  { id: "none", label: "none" }, // pure black: the track line and the car only
];

export const MAP_MAX_ZOOM = 20; // the map never zooms in past this (a parked car has zero-size bounds)
export const ONLINE_MAX_ZOOM = 16; // both services stop at 16; Leaflet scales the 16 tiles up past it
export const MAP_CREDIT = "USGS";
// failed tiles with none loaded before the map gives up on the online background ("offline · map hidden")
export const OFFLINE_AFTER_ERRORS = 3;
