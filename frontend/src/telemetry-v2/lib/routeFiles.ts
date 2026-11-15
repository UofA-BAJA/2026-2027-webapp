// Reading a route out of a file: GeoJSON (any tool), GPX (phone GPS apps, gpx.studio) or KML (Google Earth).
// Only the line of points, in driving order; tracks.ts adds the start line and the rest. Self-check: tracks.check.ts.
import type { LatLon } from "../config/track.ts";

type GeoJSONish = { type?: string; features?: GeoJSONish[]; geometry?: { type?: string; coordinates?: unknown } };

// GeoJSON: the longest LineString in a Feature or FeatureCollection ([lon, lat] pairs)
function fromGeoJSON(j: GeoJSONish): LatLon[] | undefined {
  const feats = j.type === "Feature" ? [j] : (j.features ?? []);
  return feats
    .filter((f) => f.geometry?.type === "LineString")
    .map((f) => (f.geometry!.coordinates as number[][]).map(([lo, la]) => [la, lo] as LatLon))
    .sort((a, b) => b.length - a.length)[0];
}

// GPX: every <trkpt> (a recorded track) or, failing that, <rtept> (a planned route); lat/lon attributes in any order
function fromGPX(text: string): LatLon[] {
  const points = (tag: string) =>
    [...text.matchAll(new RegExp(`<${tag}\\b[^>]*>`, "g"))].map((m) => {
      const lat = /\blat="([-\d.]+)"/.exec(m[0])?.[1];
      const lon = /\blon="([-\d.]+)"/.exec(m[0])?.[1];
      return [Number(lat), Number(lon)] as LatLon;
    });
  const track = points("trkpt");
  return track.length ? track : points("rtept");
}

// KML: the longest <coordinates> list ("lon,lat[,alt]" separated by whitespace)
function fromKML(text: string): LatLon[] | undefined {
  const lists = [...text.matchAll(/<coordinates>([\s\S]*?)<\/coordinates>/g)].map((m) =>
    m[1].trim().split(/\s+/).map((t) => {
      const [lon, lat] = t.split(",").map(Number);
      return [lat, lon] as LatLon;
    }),
  );
  return lists.sort((a, b) => b.length - a.length)[0];
}

const valid = ([lat, lon]: LatLon) => Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;

/** The route in a GeoJSON, GPX or KML file, or a message saying why there isn't one. */
export function readRoute(text: string): LatLon[] | string {
  const t = text.trimStart();
  let route: LatLon[] | undefined;
  try {
    if (t.startsWith("{")) route = fromGeoJSON(JSON.parse(t));
    else if (/<gpx\b/.test(t)) route = fromGPX(t);
    else if (/<kml\b/.test(t)) route = fromKML(t);
    else return "not a GeoJSON, GPX or KML file";
  } catch {
    return "the file couldn't be read";
  }
  const ok = route?.filter(valid);
  return ok && ok.length >= 3 ? ok : "no route line in the file";
}

/** The name a GPX/KML file gives itself (<name>), or a GeoJSON properties.name. */
export const nameIn = (text: string) =>
  /<name>([^<]{1,80})<\/name>/.exec(text)?.[1]?.trim() || /"name"\s*:\s*"([^"]{1,80})"/.exec(text)?.[1] || "";
