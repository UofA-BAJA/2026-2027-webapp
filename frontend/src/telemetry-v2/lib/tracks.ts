// Tracks: a saved course (route + start line + where it came from), the format of the files in tracks/ and of the
// "export .geojson" download. Pure functions; repo tracks are listed in tracks/index.ts, browser-saved ones in
// hooks/useTracks.ts. Self-check: tracks.check.ts.
import type { Gate, LatLon } from "../config/track.ts";
import { autoSplits, gateAcross, type Course } from "./course.ts";
import { nameIn, readRoute } from "./routeFiles.ts";

export type Track = {
  id: string; // file name without .geojson for repo tracks, "local-<time>" for browser-saved ones
  name: string;
  location: string;
  recordedAt: string; // YYYY-MM-DD
  startLine: Gate;
  source: string; // a URL, or "recorded by car"
  license: string;
  route: LatLon[]; // in driving order
};

type LL = { lat: number; lon: number };
const ll = (p: LatLon): LL => ({ lat: p[0], lon: p[1] });
const pt = (p: LL): LatLon => [p.lat, p.lon];

/** The track as a GeoJSON Feature: a LineString ([lon, lat], as GeoJSON wants) with the rest in properties. */
export function trackFeature(t: Track) {
  return {
    type: "Feature",
    properties: { name: t.name, location: t.location, recordedAt: t.recordedAt, startLine: { a: ll(t.startLine.a), b: ll(t.startLine.b) }, source: t.source, license: t.license },
    geometry: { type: "LineString", coordinates: t.route.map(([la, lo]) => [lo, la]) },
  };
}

/** A file name for the track: lowercase words joined by dashes, e.g. "marana-endurance.geojson". */
export const trackFileName = (t: Track) => {
  const slug = t.name.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${slug || "track"}.geojson`; // NFKD + dropping marks turns "Nürburgring" into "nurburgring"
};

const today = () => new Date().toISOString().slice(0, 10);

/**
 * A track from a file's text. Our own format (a Feature with properties.startLine) keeps everything; any other
 * GeoJSON, GPX or KML becomes a track named after the file, with the start line across the route's first point.
 * Returns an error message for a file it can't use.
 */
export function parseTrack(text: string, id: string, fileName = ""): Track | string {
  const fallbackName = fileName.replace(/\.(geo)?json$|\.gpx$|\.kml$/i, "") || "imported track";
  try {
    const j = text.trimStart().startsWith("{") ? JSON.parse(text) : undefined;
    const p = j?.type === "Feature" ? j.properties ?? {} : undefined;
    if (p?.startLine?.a && p?.startLine?.b && j.geometry?.type === "LineString") {
      const route = (j.geometry.coordinates as number[][]).map(([lo, la]) => [la, lo] as LatLon);
      if (route.length < 3 || route.some(([la, lo]) => !Number.isFinite(la) || !Number.isFinite(lo))) return "the route has too few points";
      return {
        id,
        name: String(p.name ?? fallbackName),
        location: String(p.location ?? ""),
        recordedAt: String(p.recordedAt ?? ""),
        startLine: { a: pt(p.startLine.a), b: pt(p.startLine.b) },
        source: String(p.source ?? fileName),
        license: String(p.license ?? ""),
        route,
      };
    }
  } catch {
    return "the file couldn't be read";
  }
  // any other GeoJSON, or GPX, or KML: just a route. Its own name beats the file name; the start line goes across
  // its first point. license and location stay empty: whoever commits the file fills them in (tracks.check.ts insists)
  const route = readRoute(text);
  if (typeof route === "string") return route;
  return { id, name: nameIn(text) || fallbackName, location: "", recordedAt: today(), startLine: gateAcross(route[0], route[1]), source: fileName || "imported file", license: "", route };
}

/** The course to time laps on for a track: its route and start line, splits at equal distances. */
export const courseFromTrack = (t: Track): Course => ({ startFinish: t.startLine, route: t.route, splits: autoSplits(t.route), trackId: t.id });

/** A track from a route the car just recorded. */
export function trackFromCourse(c: Course, id: string, name: string, location: string): Track {
  const route = c.route ?? [];
  return {
    id,
    name,
    location,
    recordedAt: today(),
    startLine: c.startFinish ?? gateAcross(route[0], route[1]),
    source: "recorded by car",
    license: "Own GPS recording by the team's car",
    route,
  };
}
