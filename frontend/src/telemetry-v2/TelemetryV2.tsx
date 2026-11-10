import * as echarts from "echarts";
import ReactECharts from "echarts-for-react";
import { useEffect, useRef, useState, type RefObject } from "react";
import ReactGridLayout, { useContainerWidth, type Layout } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import { Link } from "react-router-dom";
import CommandSender from "../Components/CommandSender";
import { CHANNELS, PRESETS, SIZES, SYSTEMS, colsFor, pack, seriesLabel, sizeIndex, type Channel, type ChannelId, type Tile } from "./presets";
import { fitTrack, scaleBar, type Pt } from "./map";
import ridge from "./assets/header-ridge.svg";
import "./telemetry-v2.css";

const STREAM_URL = "http://localhost:8000/stream";
const N = PRESETS.length;
const SWIPE_MIN = 20; // px of horizontal wheel delta that counts as a swipe
const SWIPE_COOLDOWN = 600;
// page-wide time window; every time chart shows the same span so linked cursors line up
const RANGES = [
  { label: "30s", s: 30 },
  { label: "2m", s: 120 },
  { label: "whole run", s: Infinity },
];

type Point = [number, number];
type Stream = {
  latest: Record<string, number>;
  history: Record<string, Point[]>;
  rssi: number;
  lastAt: number;
  frames: number;
  startedAt: number;
  firstTs?: number;
  lastTs?: number;
};
type PlacedTile = Tile & { id: string }; // stored: order and size only; pack() places them per column count
// time charts share one echarts group: hovering one moves the cursor on all of them
const CURSOR_GROUP = "tv2-time";
echarts.connect(CURSOR_GROUP);

// One SSE connection for the whole page; re-renders at 10 Hz.
function useStream() {
  const ref = useRef<Stream>({ latest: {}, history: {}, rssi: -1000, lastAt: 0, frames: 0, startedAt: Date.now() });
  const [, setTick] = useState(0);
  useEffect(() => {
    const sse = new EventSource(STREAM_URL);
    sse.onmessage = (e) => {
      const p = JSON.parse(e.data);
      const s = ref.current;
      s.rssi = p.rssi;
      s.lastAt = Date.now();
      s.frames++;
      s.firstTs ??= p.ts;
      s.lastTs = p.ts;
      for (const [k, v] of Object.entries(p)) {
        if (k === "ts" || k === "rssi" || k === "header" || typeof v !== "number") continue;
        s.latest[k] = v;
        // ponytail: whole run kept in memory; downsample or cap if runs get long
        (s.history[k] ??= []).push([p.ts, v]);
      }
    };
    const id = setInterval(() => setTick((t) => t + 1), 100);
    return () => {
      sse.close();
      clearInterval(id);
    };
  }, []);
  return ref.current;
}

// points at or after `from`, scaled for display
function windowed(h: Point[] = [], from: number, scale = 1): Point[] {
  let i = h.length;
  while (i > 0 && h[i - 1][0] >= from) i--;
  return h.slice(i).map(([t, v]) => [t, v * scale]);
}

// the shared x range for the page window: [from, to] in stream seconds
function timeRange(s: Stream, secs: number): [number, number] {
  const to = s.lastTs ?? 0;
  const first = s.firstTs ?? 0;
  return [Math.max(first, to - secs), to]; // never before the first point, so a fresh run fills the width
}

const AXIS = {
  axisLabel: { color: "#9a9a9a", fontSize: 12 },
  axisLine: { show: true, lineStyle: { color: "#444444", width: 1 } },
  axisTick: { show: false },
  splitLine: { show: false },
  scale: true,
};
const SERIES_COLORS = ["#e6e6e6", "#e8a33d", "#4fb3d9", "#c06ce0"];

// compact = the small chart inside a medium tile: lines only, no legend or axes
function chartOption(tile: Tile, s: Stream, [from, to]: [number, number], tooltip: boolean, compact = false) {
  const chs: Channel[] = tile.channels.map((c) => CHANNELS[c]);
  const dual = chs.length > 1;
  const series = chs.flatMap((ch, ci) =>
    ch.keys.map((k) => ({
      name: dual ? ch.name : seriesLabel(k),
      // at least the channel's own decimals, so lat/lon changes show in the tooltip
      tooltip: { valueFormatter: (v: unknown) => (typeof v === "number" ? String(+v.toFixed(Math.max(2, ch.digits ?? 0))) : String(v)) },
      yAxisIndex: ci,
      type: "line",
      showSymbol: false,
      sampling: "lttb",
      data: windowed(s.history[k], from, ch.scale),
    })),
  );
  const legend = series.length > 1 && !compact;
  return {
    animation: false,
    color: SERIES_COLORS,
    textStyle: { fontFamily: "inherit" },
    grid: compact
      ? { left: 0, right: 0, top: 4, bottom: 4 }
      : { left: 0, right: 0, top: legend ? 30 : 8, bottom: 0, containLabel: true },
    legend: legend
      ? { left: 0, top: 0, icon: "rect", itemWidth: 10, itemHeight: 2, textStyle: { color: "#9a9a9a", fontSize: 12 } }
      : undefined,
    // no fade and no hide delay, so nothing lingers after hover
    tooltip: {
      show: tooltip, // off while customizing: dragging tiles under the pointer leaves tooltips stuck
      showContent: !compact, // medium tiles show only the linked cursor line; a box would cover their number
      trigger: "axis",
      valueFormatter: (v: unknown) => (typeof v === "number" ? String(+v.toFixed(2)) : String(v)),
      className: "tv2-tooltip",
      transitionDuration: 0,
      hideDelay: 0,
      backgroundColor: "#000",
      borderColor: "#3a3a3a",
      textStyle: { color: "#e6e6e6", fontSize: 12 },
    },
    // every chart gets the exact page window so the x axes (and linked cursors) line up
    xAxis: { type: "value", ...(compact ? { show: false } : { ...AXIS, axisLabel: { ...AXIS.axisLabel, show: false } }), scale: true, min: from, max: to },
    yAxis: chs.slice(0, 2).map((_, i) => (compact ? { type: "value", show: false, scale: true } : { type: "value", ...AXIS, position: i ? "right" : "left" })),
    series,
  };
}

type TileActions = {
  customizing: boolean;
  full?: boolean; // this is the fullscreen overlay copy; a view only, the layout never changes
  onResize: () => void;
  onFull: (on: boolean) => void;
  onDelete: () => void;
  onChannel: (c: ChannelId) => void;
  onPick: (p: string) => void;
};

// thin-line glyphs for the round Metro buttons (12x12 grid)
const GLYPHS = {
  size: "M7 5l3-3M7.5 2H10v2.5M5 7l-3 3M2 7.5V10h2.5", // diagonal arrows: next size
  fullscreen: "M2 4.5V2h2.5M7.5 2H10v2.5M10 7.5V10H7.5M4.5 10H2V7.5", // corners out
  exitFullscreen: "M4.5 2v2.5H2M10 4.5H7.5V2M7.5 10V7.5H10M2 7.5h2.5V10", // corners in
  delete: "M3.5 3.5l5 5m0-5-5 5",
};

function Ctl({ glyph, label, onClick }: { glyph: keyof typeof GLYPHS; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} aria-label={label} title={label}>
      <svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="square">
        <path d={GLYPHS[glyph]} />
      </svg>
    </button>
  );
}

// customize: delete only (tiles move by dragging); normal: size switcher + fullscreen; overlay: restore only
function TileControls({ tile, a }: { tile: Tile; a: TileActions }) {
  const size = sizeIndex(tile);
  return (
    <div className="tv2-controls">
      {a.full ? (
        <Ctl glyph="exitFullscreen" label="Restore" onClick={() => a.onFull(false)} />
      ) : a.customizing ? (
        <Ctl glyph="delete" label="Delete" onClick={a.onDelete} />
      ) : (
        <>
          {tile.kind === "channel" && <Ctl glyph="size" label={`Make ${SIZES[(size + 1) % 3].name}`} onClick={a.onResize} />}
          <Ctl glyph="fullscreen" label="Fullscreen" onClick={() => a.onFull(true)} />
        </>
      )}
    </div>
  );
}

// The single number a tile shows: one key, or avg / max across a multi-key channel.
function reading(ch: Channel, pick: string | undefined, s: Stream) {
  const multi = ch.keys.length > 1;
  const p = multi ? (pick ?? ch.pick ?? "avg") : ch.keys[0];
  const label = multi ? ` · ${p === "avg" || p === "max" ? p : seriesLabel(p)}` : "";
  const vals = (p === "avg" || p === "max" ? ch.keys : [p]).map((k) => s.latest[k]).filter((v) => v !== undefined);
  if (!vals.length) return { text: "--", label };
  const v = p === "max" ? Math.max(...vals) : vals.reduce((a, b) => a + b, 0) / vals.length;
  return { text: (v * (ch.scale ?? 1)).toFixed(ch.digits ?? 0), label };
}

// Metro tilt: the tile leans away from where it's pressed
const tilt = (e: React.PointerEvent<HTMLElement>) => {
  const r = e.currentTarget.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width - 0.5;
  const y = (e.clientY - r.top) / r.height - 0.5;
  e.currentTarget.style.setProperty("--tv2-tilt-x", `${(-y * 10).toFixed(1)}deg`);
  e.currentTarget.style.setProperty("--tv2-tilt-y", `${(x * 10).toFixed(1)}deg`);
};

// Calls fn with the element's content size now and whenever it changes (first layout, fullscreen, size switch, window resize).
function useResize(fn: (w: number, h: number) => void) {
  const ref = useRef<HTMLDivElement>(null);
  const cb = useRef(fn);
  cb.current = fn;
  useEffect(() => {
    const ro = new ResizeObserver(([e]) => cb.current(e.contentRect.width, e.contentRect.height));
    ro.observe(ref.current!);
    return () => ro.disconnect();
  }, []);
  return ref;
}

// A time chart filling its box. The canvas is absolutely positioned, so it can never push the box
// bigger or keep it small, and it is resized explicitly whenever the box changes.
function Chart({ option }: { option: object }) {
  const chart = useRef<ReactECharts>(null);
  const box = useResize(() => chart.current?.getEchartsInstance().resize());
  return (
    <div className="tv2-chart" ref={box} onMouseLeave={() => chart.current?.getEchartsInstance().dispatchAction({ type: "hideTip" })}>
      <ReactECharts ref={chart} option={option} style={{ position: "absolute", inset: 0, height: "auto" }} onChartReady={(c) => { c.group = CURSOR_GROUP; }} />
    </div>
  );
}

// The GPS track drawn as a map: equal-aspect metres, whole track fitted with 10% padding, car dot at the latest fix.
function TrackMap({ s }: { s: Stream }) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const ref = useResize((w, h) => setBox({ w, h }));
  const lat = s.history.gps_latitude ?? [];
  const lon = s.history.gps_longitude ?? [];
  const n = Math.min(lat.length, lon.length); // both come from the same frame, so index i pairs them
  // shortcut: keep ~2000 points of a long run for drawing; switch to a proper simplifier if the shape gets coarse
  const step = Math.max(1, Math.ceil(n / 2000));
  const ll: Pt[] = [];
  for (let i = 0; i < n; i += step) ll.push([lat[i][1], lon[i][1]]);
  if (n && (n - 1) % step) ll.push([lat[n - 1][1], lon[n - 1][1]]); // always end at the latest fix
  const fit = ll.length && box.w && box.h ? fitTrack(ll, box.w, box.h) : undefined;
  const bar = fit && scaleBar(fit.pxPerM);
  const car = fit?.px[fit.px.length - 1];
  const alt = s.latest.gps_altitude;
  return (
    <div className="tv2-map" ref={ref}>
      {fit && car && (
        <svg width={box.w} height={box.h} aria-hidden="true">
          <polyline className="tv2-map-path" points={fit.px.map((p) => p.join(",")).join(" ")} />
          <circle className="tv2-map-start" cx={fit.px[0][0]} cy={fit.px[0][1]} r={4} />
          <circle className="tv2-map-car" cx={car[0]} cy={car[1]} r={5} />
        </svg>
      )}
      <div className="tv2-map-info">
        {bar && (
          <div className="tv2-map-scale">
            <div style={{ width: bar.px }} />
            {bar.label}
          </div>
        )}
        {n > 0
          ? `${lat[n - 1][1].toFixed(5)}, ${lon[n - 1][1].toFixed(5)}` +
            (alt === undefined ? "" : ` · ${(alt * (CHANNELS.altitude.scale ?? 1)).toFixed(0)} ${CHANNELS.altitude.unit}`)
          : "waiting for GPS"}
      </div>
    </div>
  );
}

function TileView({ tile, s, range, delay, a }: { tile: Tile; s: Stream; range: [number, number]; delay: number; a: TileActions }) {
  const size = tile.kind === "xy" ? 2 : sizeIndex(tile);
  const chs: Channel[] = tile.channels.map((c) => CHANNELS[c]);
  const ch = chs[0];

  // just added: the tile asks which channel it shows
  if (!ch) {
    return (
      <div className="tv2-tile tv2-in tv2-unpicked" style={{ animationDelay: `${delay}ms` }}>
        <div className="tv2-tile-head">
          <div className="tv2-label">pick a channel</div>
          <TileControls tile={tile} a={a} />
        </div>
        <div className="tv2-add-pick">
          {SYSTEMS.map((sys) => (
            <section key={sys.name} className="tv2-system">
              <h3>{sys.name}</h3>
              {sys.channels.map((c) => (
                <button key={c} onClick={() => a.onChannel(c)}>{CHANNELS[c].name}</button>
              ))}
            </section>
          ))}
        </div>
      </div>
    );
  }

  const r = reading(ch, tile.pick, s);
  const number = (
    <div className="tv2-reading">
      <div className="tv2-value-row">
        {/* font shrinks with the character count so long values (lat/lon) fit any tile size; unit is 18px ≈ 13px/char + 8px gap */}
        <span className="tv2-value" style={{ "--tv2-chars": r.text.length, "--tv2-unit": `${ch.unit.length * 13 + 10}px` } as React.CSSProperties}>
          {r.text}
        </span>
        <span className="tv2-unit">{ch.unit}</span>
      </div>
      {ch.limits && (
        <div className="tv2-limits">
          warn {ch.limits.warn} · danger {ch.limits.danger} {ch.unit}
        </div>
      )}
    </div>
  );
  const plot = (compact: boolean) =>
    tile.kind === "xy" ? <TrackMap s={s} /> : <Chart option={chartOption(tile, s, range, !a.customizing, compact)} />;

  return (
    <div
      className={`tv2-tile tv2-in tv2-${SIZES[size].name}`}
      style={{ animationDelay: `${delay}ms` }}
      onPointerDown={tilt}
    >
      <div className="tv2-tile-head">
        <div className="tv2-label">
          {chs.map((c) => c.name).join(" + ")}
          {size < 2 && r.label}
        </div>
        <TileControls tile={tile} a={a} />
      </div>
      {a.customizing && size < 2 && ch.keys.length > 1 && (
        <select className="tv2-pick" value={tile.pick ?? ch.pick ?? "avg"} onChange={(e) => a.onPick(e.target.value)} aria-label="number shown">
          <option value="avg">average</option>
          <option value="max">max</option>
          {ch.keys.map((k) => <option key={k} value={k}>{seriesLabel(k)}</option>)}
        </select>
      )}
      {size === 0 && number}
      {size === 1 && <div className="tv2-medium">{number}{plot(true)}</div>}
      {size === 2 && plot(false)}
    </div>
  );
}

function AddSlot({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="tv2-add tv2-in">
      <div className="tv2-add-grid" aria-hidden />
      <button className="tv2-add-btn" onClick={onAdd}>+ add tile</button>
    </div>
  );
}

function Radio({ s }: { s: Stream }) {
  const [open, setOpen] = useState(false);
  const age = s.lastAt ? Date.now() - s.lastAt : Infinity;
  const live = age < 2000;
  const bars = !live ? 0 : s.rssi >= -50 ? 4 : s.rssi >= -65 ? 3 : s.rssi >= -80 ? 2 : 1;
  const secs = (Date.now() - s.startedAt) / 1000;
  const dbm = live ? `${s.rssi < 0 ? "−" : ""}${Math.abs(s.rssi)} dBm` : "no signal";
  return (
    <div className="tv2-radio">
      <button className="tv2-signal" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="tv2-bars" aria-hidden>
          {[1, 2, 3, 4].map((b) => <i key={b} className={b <= bars ? "on" : ""} style={{ height: 3 + b * 3 }} />)}
        </span>
        {dbm}
      </button>
      {open && (
        <div className="tv2-popover" role="dialog" aria-label="radio">
          <dl>
            <dt>signal</dt><dd>{dbm}</dd>
            <dt>last packet</dt><dd>{age === Infinity ? "never" : `${(age / 1000).toFixed(1)} s ago`}</dd>
            <dt>frames</dt><dd>{s.frames} ({(s.frames / secs).toFixed(1)}/s)</dd>
            <dt>source</dt><dd>{STREAM_URL}</dd>
          </dl>
          <CommandSender />
        </div>
      )}
    </div>
  );
}

function ThemeIcon({ light }: { light: boolean }) {
  return light ? (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function load<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, v: unknown) {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* private mode */ }
}

export default function TelemetryV2() {
  const s = useStream();
  const [active, setActive] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1); // pivot slide direction
  const [light, setLight] = useState(() => load<string>("tv2-theme", "dark") === "light");
  const [customizing, setCustomizing] = useState(false);
  // edited tile order per preset (per-viewer, browser only); presets.ts holds the defaults
  // v3 stored x/y per tile; its row-by-row order becomes the v4 order
  const [layouts, setLayouts] = useState<Record<string, PlacedTile[]>>(() =>
    load("tv2-layouts-v4", null) ??
    Object.fromEntries(
      Object.entries(load<Record<string, (PlacedTile & { x?: number; y?: number })[]>>("tv2-layouts-v3", {})).map(([k, ts]) => [
        k,
        [...ts].sort((a, b) => (a.y ?? 0) - (b.y ?? 0) || (a.x ?? 0) - (b.x ?? 0)).map(({ x: _x, y: _y, ...t }) => t),
      ]),
    ),
  );
  const [justAdded, setJustAdded] = useState<string>();
  // tile shown fullscreen over the grid; never touches the layout, cleared on preset switch
  const [fullId, setFullId] = useState<string>();
  const [secs, setSecs] = useState(30); // page-wide chart window
  const lastSwipe = useRef(0);
  const preset = PRESETS[active];

  const go = (step: number) => {
    setDir(step > 0 ? 1 : -1);
    setActive((a) => (a + step + N) % N);
    setFullId(undefined);
  };

  const toggleTheme = () => {
    save("tv2-theme", light ? "dark" : "light");
    setLight(!light);
  };

  const { width, containerRef, mounted } = useContainerWidth();
  const tiles: PlacedTile[] = layouts[preset.name] ?? preset.tiles.map((t, i) => ({ ...t, id: `${preset.name}-${i}` }));
  const cols = colsFor(width);
  // the "+ add tile" slot packs last, after every tile
  const placed = pack([...tiles, ...(customizing ? [{ id: "add", w: 1, h: 1 }] : [])], cols);
  const setTiles = (next: PlacedTile[]) => {
    const all = { ...layouts, [preset.name]: next };
    setLayouts(all);
    save("tv2-layouts-v4", all);
  };

  // "+ add tile" drops a small, empty tile into the slot; the tile then asks for its channel
  const addTile = () => {
    const t: PlacedTile = { kind: "channel", channels: [], w: 1, h: 1, id: String(Date.now()) };
    setTiles([...tiles, t]);
    setJustAdded(t.id);
  };
  const update = (id: string, f: (t: PlacedTile) => PlacedTile) => setTiles(tiles.map((t) => (t.id === id ? f(t) : t)));
  const resize = (id: string) => update(id, (t) => ({ ...t, ...SIZES[(sizeIndex(t) + 1) % SIZES.length] }));
  // drag-and-drop in customize mode: where things landed (row by row) becomes the new order
  const onDragStop = (l: Layout) => {
    const at = new Map(l.map((it) => [it.i, it.y * 100 + it.x]));
    setTiles([...tiles].sort((a, b) => at.get(a.id)! - at.get(b.id)!));
  };
  const col = (width - 2 * 16 - (cols - 1) * 8) / cols;
  const gridLayout: Layout = placed.map((t) => ({ i: t.id, x: t.x, y: t.y, w: t.w, h: t.h, ...(t.id === "add" && { isDraggable: false }) }));
  const fullTile = tiles.find((t) => t.id === fullId);
  const range = timeRange(s, secs);
  const actions = (t: PlacedTile): TileActions => ({
    customizing,
    onResize: () => resize(t.id),
    onFull: (on) => setFullId(on ? t.id : undefined),
    onDelete: () => setTiles(tiles.filter((x) => x.id !== t.id)),
    // the GPS track is its own large-only kind
    onChannel: (c) => update(t.id, (x) => (c === "track" ? { ...x, kind: "xy", channels: [c], w: 2, h: 2 } : { ...x, channels: [c] })),
    onPick: (p) => update(t.id, (x) => ({ ...x, pick: p })),
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "Escape") setFullId(undefined);
    };
    window.addEventListener("keydown", onKey);
    // stop the browser's swipe-to-go-back from eating the preset swipe
    const root = document.documentElement;
    root.style.overscrollBehaviorX = "none";
    return () => {
      window.removeEventListener("keydown", onKey);
      root.style.overscrollBehaviorX = "";
    };
  }, []);

  const onWheel = (e: React.WheelEvent) => {
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) || Math.abs(e.deltaX) < SWIPE_MIN) return;
    if (e.timeStamp - lastSwipe.current < SWIPE_COOLDOWN) return;
    lastSwipe.current = e.timeStamp;
    go(e.deltaX > 0 ? 1 : -1); // fingers move left = forward
  };

  return (
    <div className={`tv2${light ? " light" : ""}`}>
      <header className="tv2-top">
        <img className="tv2-ridge" src={ridge} alt="" />
        <nav key={active} className={`tv2-pivot ${dir > 0 ? "fwd" : "back"}`}>
          {[-2, -1, 0, 1, 2].map((d) => (
            <button
              key={d}
              className={`tv2-name ${d === 0 ? "active" : Math.abs(d) === 1 ? "near" : "far"}`}
              onClick={() => d && go(d)}
              aria-current={d === 0}
            >
              {PRESETS[(active + d + N * 2) % N].name}
            </button>
          ))}
        </nav>
        <div className="tv2-right">
          <Radio s={s} />
          {/* v2 hides the shared nav bar, so the CSV page needs its own way in */}
          <Link className="tv2-text-btn" to="/convert">csv</Link>
          <button className="tv2-icon-btn" onClick={toggleTheme} aria-label={light ? "dark theme" : "light theme"}>
            <ThemeIcon light={light} />
          </button>
          <div className="tv2-ranges" role="group" aria-label="time window">
            {RANGES.map((rg) => (
              <button key={rg.label} className={rg.s === secs ? "on" : ""} aria-pressed={rg.s === secs} onClick={() => setSecs(rg.s)}>
                {rg.label}
              </button>
            ))}
          </div>
          {!customizing && (
            <button className="tv2-text-btn" onClick={() => setCustomizing(true)}>customize</button>
          )}
        </div>
      </header>
      {customizing && (
        <div className="tv2-toolbar">
          <span>customizing {preset.name}</span>
          <button className="tv2-text-btn" onClick={() => setCustomizing(false)}>done</button>
        </div>
      )}
      <main
        ref={containerRef as RefObject<HTMLElement>}
        className={`tv2-grid${customizing ? " tv2-editing" : ""}`}
        onWheel={onWheel}
      >
        {mounted && (
          <ReactGridLayout
            key={preset.name}
            layout={gridLayout}
            width={width}
            gridConfig={{ cols: cols, rowHeight: col, margin: [8, 8], containerPadding: [16, 16] }}
            dragConfig={{ enabled: customizing, cancel: "button, select" }}
            resizeConfig={{ enabled: false }}
            onDragStop={onDragStop}
          >
            {tiles.map((t, i) => (
              <div key={t.id}>
                <TileView
                  tile={t}
                  s={s}
                  range={range}
                  a={actions(t)}
                  delay={t.id === justAdded ? 0 : Math.min(i * 35, 300)}
                />
              </div>
            ))}
            {customizing && (
              <div key="add">
                <AddSlot onAdd={addTile} />
              </div>
            )}
          </ReactGridLayout>
        )}
        {fullTile && (
          // covers the grid; react-grid-layout stays mounted underneath and is never touched
          <div className="tv2-view">
            <TileView
              key={fullTile.id}
              tile={{ ...fullTile, w: 2, h: 2 }}
              s={s}
              range={range}
              a={{ ...actions(fullTile), customizing: false, full: true }}
              delay={0}
            />
          </div>
        )}
      </main>
    </div>
  );
}
