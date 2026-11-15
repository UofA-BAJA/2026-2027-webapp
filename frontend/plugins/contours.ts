// Elevation → contour lines, automatically. Drop a USGS elevation GeoTIFF into frontend/elevation/ and this turns it
// into src/telemetry-v2/contours/<name>.geojson, which the GPS map draws as its "contours" background.
// Runs as a Vite plugin: on build, on dev-server start, and whenever a file in elevation/ is added or changed.
// By hand: node --experimental-strip-types plugins/contours.ts   (from frontend/)
//
// A file that covers an event venue (config/venues.ts `bounds`) is cut to that venue at full resolution and saved as
// contours/<venue id>.geojson; a file that covers none is converted whole as contours/<file name>.geojson.

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { contours } from "d3-contour";
import { fromFile } from "geotiff";
import proj4 from "proj4";
import type { Plugin } from "vite";
import { VENUES } from "../src/telemetry-v2/config/venues.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const ELEVATION_DIR = join(ROOT, "elevation");
export const CONTOUR_DIR = join(ROOT, "src", "telemetry-v2", "contours");
// which elevation files were converted, and their modification times: machine-specific, so not committed
const DONE_FILE = join(ROOT, "node_modules", ".cache", "tv2-contours.json");

const MAX_PX = 1500; // the grid is resampled to at most this many cells per side before tracing
const MAX_LINES = 25; // the interval is the smallest step that gives at most this many contour levels
const STEPS = [0.25, 0.5, 1, 2, 5, 10, 20, 50, 100, 200]; // m
const MAJOR_EVERY = 5; // every 5th level is a major (brighter) line
const SIMPLIFY_M = 1; // points closer than this to the line through their neighbours are dropped
const SMOOTH_M = 10; // heights are blurred over about this distance first, so furrows and lidar noise don't draw lines
const MIN_LINE_M = 40; // shorter pieces (small bumps and pits) are dropped
const SETTLE_MS = 1000; // a dropped file converts once nothing has touched it for this long
const LOWEST_VALID = -1000; // m; anything lower (nodata fill like -999999 or -3.4e38) counts as no data

type LonLat = [number, number];
type Log = (msg: string) => void;

/** The file's coordinate system as a proj4 definition. Covers what USGS ships: NAD83/WGS84 lat-lon, UTM, web mercator. */
function crsOf(keys: Record<string, number | undefined>): string {
  const proj = keys.ProjectedCSTypeGeoKey;
  const geo = keys.GeographicTypeGeoKey;
  if (proj === undefined || keys.GTModelTypeGeoKey === 2) {
    if (geo === undefined || [4269, 4326, 4258, 4617, 6318].includes(geo)) return "EPSG:4326"; // NAD83 ≈ WGS84 within ~1 m
    throw new Error(`unsupported geographic system EPSG:${geo}`);
  }
  if ([3857, 3785, 900913, 102100].includes(proj)) return "EPSG:3857";
  const utm = (zone: number, datum: string) => `+proj=utm +zone=${zone} +datum=${datum} +units=m +no_defs`;
  if (proj >= 26901 && proj <= 26923) return utm(proj - 26900, "NAD83"); // NAD83 / UTM zone N
  if (proj >= 6330 && proj <= 6348) return utm(proj - 6329, "NAD83"); // NAD83(2011) / UTM zone N (USGS 1 m lidar DEMs)
  if (proj >= 32601 && proj <= 32660) return utm(proj - 32600, "WGS84"); // WGS 84 / UTM zone N
  throw new Error(`unsupported projection EPSG:${proj}: re-download in geographic (EPSG:4269) or UTM`);
}

const pick = (range: number) => STEPS.find((s) => range / s <= MAX_LINES) ?? STEPS[STEPS.length - 1];

// a box blur of radius r cells, run twice across and twice down (close to a gaussian)
function blur(g: Float64Array, w: number, h: number, r: number) {
  if (r < 1) return g;
  const tmp = new Float64Array(g.length);
  const pass = (src: Float64Array, dst: Float64Array, n: number, len: number, idx: (line: number, i: number) => number) => {
    for (let line = 0; line < n; line++) {
      let sum = 0;
      for (let i = -r; i <= r; i++) sum += src[idx(line, Math.min(len - 1, Math.max(0, i)))];
      for (let i = 0; i < len; i++) {
        dst[idx(line, i)] = sum / (2 * r + 1);
        sum += src[idx(line, Math.min(len - 1, i + r + 1))] - src[idx(line, Math.max(0, i - r))];
      }
    }
  };
  for (let k = 0; k < 2; k++) {
    pass(g, tmp, h, w, (y, x) => y * w + x);
    pass(tmp, g, w, h, (x, y) => y * w + x);
  }
  return g;
}

const lengthM = (l: LonLat[]) => {
  const kx = 111320 * Math.cos((l[0][1] * Math.PI) / 180);
  let m = 0;
  for (let i = 1; i < l.length; i++) m += Math.hypot((l[i][0] - l[i - 1][0]) * kx, (l[i][1] - l[i - 1][1]) * 110540);
  return m;
};

// Ramer–Douglas–Peucker in local metres
function simplify(pts: LonLat[], tol: number): LonLat[] {
  if (pts.length < 3) return pts;
  const kx = 111320 * Math.cos((pts[0][1] * Math.PI) / 180);
  const m = pts.map(([lo, la]) => [lo * kx, la * 110540]);
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const [ax, ay] = m[a];
    const [dx, dy] = [m[b][0] - ax, m[b][1] - ay];
    const len = Math.hypot(dx, dy);
    let worst = -1;
    let at = -1;
    for (let i = a + 1; i < b; i++) {
      // a closed line starts and ends on the same point: there is no line through them, so measure from that point
      const d = len < 1e-9 ? Math.hypot(m[i][0] - ax, m[i][1] - ay) : Math.abs((m[i][0] - ax) * dy - (m[i][1] - ay) * dx) / len;
      if (d > worst) [worst, at] = [d, i];
    }
    if (worst > tol) {
      keep[at] = 1;
      stack.push([a, at], [at, b]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

/**
 * Contour lines for a grid of heights. d3-contour returns filled bands whose rings also run along the grid's edge;
 * those edge stretches aren't contours, so each ring is cut wherever two points in a row lie on the edge.
 */
export function traceContours(values: ArrayLike<number>, w: number, h: number, toLonLat: (col: number, row: number) => LonLat, cellM: number) {
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (Number.isFinite(v) && v > LOWEST_VALID) [lo, hi] = [Math.min(lo, v), Math.max(hi, v)];
  }
  if (!Number.isFinite(lo)) throw new Error("no valid heights");
  const grid = blur(Float64Array.from(values, (v) => (Number.isFinite(v) && v > LOWEST_VALID ? v : lo - 1)), w, h, Math.round(SMOOTH_M / cellM / 2)); // no data sits below every line
  const step = pick(hi - lo || 1);
  const levels: number[] = [];
  // strictly above the lowest point: a line at the minimum only outlines flat ground and the grid's edge
  for (let z = Math.floor(lo / step) * step + step; z <= hi; z += step) levels.push(+z.toFixed(6));
  const onEdge = ([x, y]: number[]) => x <= 0 || y <= 0 || x >= w || y >= h;
  const features = [];
  for (const band of contours().size([w, h]).smooth(true).thresholds(levels)(Array.from(grid))) {
    const major = Math.abs(band.value / (step * MAJOR_EVERY) - Math.round(band.value / (step * MAJOR_EVERY))) < 1e-6;
    const lines: LonLat[][] = [];
    for (const poly of band.coordinates) for (const ring of poly) {
      let run: number[][] = [];
      const flush = () => {
        if (run.length >= 2) lines.push(simplify(run.map(([x, y]) => toLonLat(x, y)), SIMPLIFY_M));
        run = [];
      };
      for (let i = 0; i < ring.length; i++) {
        if (i > 0 && onEdge(ring[i]) && onEdge(ring[i - 1])) flush(); // an edge stretch, not a contour
        run.push(ring[i]);
      }
      flush();
    }
    const kept = lines.filter((l) => l.length >= 2 && lengthM(l) >= MIN_LINE_M).map((l) => l.map(([x, y]) => [+x.toFixed(6), +y.toFixed(6)]));
    if (kept.length) features.push({ type: "Feature", properties: { elevation_m: band.value, major }, geometry: { type: "MultiLineString", coordinates: kept } });
  }
  return { step, lo, hi, features };
}

/** Convert one GeoTIFF; returns the contour files it wrote. */
export async function convertFile(file: string, log: Log): Promise<string[]> {
  const tiff = await fromFile(file);
  const image = await tiff.getImage();
  const def = crsOf(image.getGeoKeys() as Record<string, number | undefined>);
  const toLL = def === "EPSG:4326" ? (x: number, y: number): LonLat => [x, y] : (x: number, y: number) => proj4(def, "EPSG:4326", [x, y]) as LonLat;
  const fromLL = def === "EPSG:4326" ? (p: LonLat) => p : (p: LonLat) => proj4("EPSG:4326", def, p) as LonLat;
  const [W, H] = [image.getWidth(), image.getHeight()];
  const [ox, oy] = image.getOrigin();
  const [rx, ry] = image.getResolution(); // ry < 0: rows run south

  // the pixel window [col0, row0, col1, row1] of a lat/lon box, clipped to the file; undefined if they don't overlap
  const windowOf = ([[s, w], [n, e]]: [[number, number], [number, number]]) => {
    const xy = [[w, s], [w, n], [e, s], [e, n]].map((p) => fromLL(p as LonLat));
    const cols = xy.map(([x]) => (x - ox) / rx);
    const rows = xy.map(([, y]) => (y - oy) / ry);
    const win = [Math.max(0, Math.floor(Math.min(...cols))), Math.max(0, Math.floor(Math.min(...rows))), Math.min(W, Math.ceil(Math.max(...cols))), Math.min(H, Math.ceil(Math.max(...rows)))];
    return win[2] - win[0] > 2 && win[3] - win[1] > 2 ? win : undefined;
  };
  const jobs = VENUES.flatMap((v) => {
    const win = v.bounds && windowOf(v.bounds);
    return win ? [{ name: v.id, win }] : [];
  });
  if (!jobs.length) jobs.push({ name: basename(file).replace(/\.tiff?$/i, "").toLowerCase().replace(/[^a-z0-9]+/g, "-"), win: [0, 0, W, H] });

  const written: string[] = [];
  for (const { name, win } of jobs) {
    const [cw, ch] = [win[2] - win[0], win[3] - win[1]];
    const k = Math.min(1, MAX_PX / Math.max(cw, ch)); // downsample big windows
    const cellM = Math.abs(def === "EPSG:4326" ? rx * 111320 * Math.cos((oy * Math.PI) / 180) : rx) / k;
    const out = join(CONTOUR_DIR, `${name}.geojson`);
    // two elevation files for one venue: the finer one wins, whichever order they're converted in
    const prev = existing(out);
    if (prev && prev.from !== basename(file) && existsSync(join(ELEVATION_DIR, prev.from)) && prev.cell_m < cellM) {
      log(`contours: ${basename(file)} not used for ${name}: ${prev.from} is finer (${prev.cell_m} m cells)`);
      continue;
    }
    const [w, h] = [Math.max(2, Math.round(cw * k)), Math.max(2, Math.round(ch * k))];
    const [band] = (await image.readRasters({ window: win, width: w, height: h, samples: [0], resampleMethod: "bilinear" })) as unknown as ArrayLike<number>[];
    // d3-contour puts cell (i, j) at [i, i+1]; its corner coordinates map straight onto the pixel grid
    const toLonLat = (cx: number, cy: number) => toLL(ox + (win[0] + (cx * cw) / w) * rx, oy + (win[1] + (cy * ch) / h) * ry);
    const { step, lo, hi, features } = traceContours(band, w, h, toLonLat, cellM);
    mkdirSync(CONTOUR_DIR, { recursive: true });
    writeFileSync(out, JSON.stringify({
      type: "FeatureCollection",
      // foreign members: where this came from
      source: `USGS 3DEP elevation (public domain); generated by plugins/contours.ts`,
      from: basename(file), // the elevation file it came from, for the up-to-date check
      interval_m: step,
      range_m: [+lo.toFixed(1), +hi.toFixed(1)],
      cell_m: +cellM.toFixed(2),
      features,
    }));
    log(`contours: ${basename(file)} → contours/${name}.geojson (${features.length} levels every ${step} m, ${lo.toFixed(0)}–${hi.toFixed(0)} m, ${cellM.toFixed(1)} m cells)`);
    written.push(out);
  }
  return written;
}

const isElevation = (f: string) => /\.tiff?$/i.test(f) && resolve(dirname(f)) === ELEVATION_DIR;
// what an existing contour file says about itself (undefined if missing or unreadable)
function existing(out: string): { from: string; cell_m: number } | undefined {
  try {
    return JSON.parse(readFileSync(out, "utf8"));
  } catch {
    return undefined;
  }
}

const readDone = (): Record<string, number> => {
  try {
    return JSON.parse(readFileSync(DONE_FILE, "utf8"));
  } catch {
    return {};
  }
};
function markDone(f: string) {
  const done = readDone();
  done[basename(f)] = statSync(f).mtimeMs;
  mkdirSync(dirname(DONE_FILE), { recursive: true });
  writeFileSync(DONE_FILE, JSON.stringify(done));
}
// converted before, and not changed since
const upToDate = (f: string) => readDone()[basename(f)] === statSync(f).mtimeMs;

/** Convert every GeoTIFF in elevation/ that changed since the contours were last written (or all, with force). */
export async function convertAll(log: Log, force = false) {
  if (!existsSync(ELEVATION_DIR)) return;
  for (const f of readdirSync(ELEVATION_DIR).map((n) => join(ELEVATION_DIR, n)).filter(isElevation)) {
    if (!force && upToDate(f)) continue;
    try {
      await convertFile(f, log);
      markDone(f);
    } catch (e) {
      log(`contours: ${basename(f)} skipped: ${(e as Error).message}`);
    }
  }
}

export function contoursPlugin(): Plugin {
  let queue = Promise.resolve();
  return {
    name: "tv2-contours",
    async buildStart() {
      // a build waits for the contours; the dev server starts at once and converts in the background
      const job = convertAll(console.log);
      if (this.meta.watchMode) void job;
      else await job;
    },
    configureServer(server) {
      const log = (m: string) => server.config.logger.info(m, { timestamp: true });
      server.watcher.add(ELEVATION_DIR);
      // copying a file fires "add" then "change", and a big one is still being written: wait until it's quiet
      const timers = new Map<string, ReturnType<typeof setTimeout>>();
      const onFile = (f: string) => {
        if (!isElevation(f)) return;
        clearTimeout(timers.get(f));
        timers.set(f, setTimeout(() => {
          timers.delete(f);
          queue = queue.then(() => convertFile(f, log).then(() => markDone(f), (e) => log(`contours: ${basename(f)} skipped: ${e.message}`)));
        }, SETTLE_MS));
      };
      server.watcher.on("add", onFile);
      server.watcher.on("change", onFile);
    },
  };
}

// run by hand: convert everything, ignoring what's up to date
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await convertAll(console.log, true);
