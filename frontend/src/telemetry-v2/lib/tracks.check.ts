// Self-check for tracks.ts and the files in tracks/. Run from frontend/: node --experimental-strip-types src/telemetry-v2/lib/tracks.check.ts
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { routeLength } from "./course.ts";
import { courseFromTrack, parseTrack, trackFeature, trackFileName, trackFromCourse } from "./tracks.ts";

const dir = new URL("../tracks/", import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith(".geojson"));
const index = readFileSync(new URL("index.ts", dir), "utf8");
assert.ok(files.length > 0, "tracks/ has at least one track");
for (const f of files) {
  const t = parseTrack(readFileSync(new URL(f, dir), "utf8"), f.replace(/\.geojson$/, ""), f);
  assert.ok(typeof t !== "string", `${f}: ${t}`);
  // every property the README promises
  for (const k of ["name", "location", "recordedAt", "source", "license"] as const) assert.ok(t[k], `${f}: properties.${k} is set`);
  assert.ok(t.route.length >= 3, `${f}: route`);
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(t.recordedAt), `${f}: recordedAt is YYYY-MM-DD`);
  // the start line crosses the route's start: its middle is within 10 m of the first point
  const mid: [number, number] = [(t.startLine.a[0] + t.startLine.b[0]) / 2, (t.startLine.a[1] + t.startLine.b[1]) / 2];
  assert.ok(routeLength([mid, t.route[0]]) < 10, `${f}: start line at the route's start`);
  assert.ok(index.includes(`./${f}?raw`), `${f}: listed in tracks/index.ts`);
  assert.equal(courseFromTrack(t).splits.length, 3, `${f}: three splits`);
}

// the Nordschleife sample: ~20.8 km (JRT's Industriefahrten loop) in the Eifel
const nord = parseTrack(readFileSync(new URL("nordschleife.geojson", dir), "utf8"), "nordschleife") as Exclude<ReturnType<typeof parseTrack>, string>;
const km = routeLength(nord.route) / 1000;
assert.ok(km > 20 && km < 21.5, `Nordschleife length ${km} km`);
assert.ok(Math.abs(nord.route[0][0] - 50.34) < 0.05 && Math.abs(nord.route[0][1] - 6.95) < 0.05, "Nordschleife is at Nürburg");

// export → import keeps everything (the export format is the tracks/ format)
const back = parseTrack(JSON.stringify(trackFeature(nord)), "nordschleife");
assert.deepEqual(back, nord);
assert.equal(trackFileName(nord), "nurburgring-nordschleife.geojson");

// a recorded route becomes a track with today's date and "recorded by car"
const rec = trackFromCourse({ route: nord.route.slice(0, 50), startFinish: nord.startLine, splits: [] }, "local-1", "test loop", "Marana, AZ");
assert.equal(rec.source, "recorded by car");
assert.deepEqual(rec.startLine, nord.startLine);

// GPX from a phone keeps its <name>
const gpx = `<gpx><trk><name>Course walk</name><trkseg>${nord.route.slice(0, 20).map(([la, lo]) => `<trkpt lat="${la}" lon="${lo}"/>`).join("")}</trkseg></trk></gpx>`;
const g = parseTrack(gpx, "local-2", "walk.gpx");
assert.ok(typeof g !== "string" && g.name === "Course walk" && g.route.length === 20);
// no <name>: the file name
const g2 = parseTrack(gpx.replace(/<name>.*<\/name>/, ""), "local-3", "walk.gpx");
assert.ok(typeof g2 !== "string" && g2.name === "walk");
// KML from Google Earth ("lon,lat,alt"), its <name> kept
const kml = `<kml><Document><Placemark><name>Traced loop</name><LineString><coordinates>\n ${nord.route.slice(0, 30).map(([la, lo]) => `${lo},${la},0`).join(" ")} \n</coordinates></LineString></Placemark></Document></kml>`;
const k = parseTrack(kml, "local-4", "loop.kml");
assert.ok(typeof k !== "string" && k.name === "Traced loop" && k.route.length === 30);
assert.ok(Math.abs(k.route[5][0] - nord.route[5][0]) < 1e-9, "KML lat/lon order");
// GeoJSON from another tool (no startLine): the longest LineString is the route
const other = JSON.stringify({ type: "FeatureCollection", features: [
  { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [[0, 0], [1, 1]] } },
  { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: nord.route.slice(0, 40).map(([la, lo]) => [lo, la]) } },
] });
const o = parseTrack(other, "local-5", "drawn.geojson");
assert.ok(typeof o !== "string" && o.route.length === 40 && o.name === "drawn");
// files it can't use say why
assert.equal(typeof parseTrack("nonsense", "x"), "string");
assert.equal(typeof parseTrack("{ not json", "x"), "string");
assert.equal(typeof parseTrack(JSON.stringify({ type: "FeatureCollection", features: [] }), "x"), "string");

console.log("tracks.check ok");
