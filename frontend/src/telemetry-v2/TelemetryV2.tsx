import ReactECharts from "echarts-for-react";
import { useEffect, useRef, useState, type RefObject } from "react";
import ReactGridLayout, { useContainerWidth, type Layout } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import { Link } from "react-router-dom";
import CommandSender from "../Components/CommandSender";
import { CHANNELS, PRESETS, SIZES, seriesLabel, sizeIndex, type Channel, type ChannelId, type Tile } from "./presets";
import "./telemetry-v2.css";

const STREAM_URL = "http://localhost:8000/stream";
const N = PRESETS.length;
const SWIPE_MIN = 20; // px of horizontal wheel delta that counts as a swipe
const SWIPE_COOLDOWN = 600;
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
};
type PlacedTile = Tile & { id: string; x?: number; y?: number }; // x/y = grid cell, set once placed
const COLS = 6;

// Give every tile without a position the first free cell, scanning rows top to bottom.
function pack(tiles: PlacedTile[], extra: { w: number; h: number }[] = []) {
  const taken = new Set<string>();
  const fits = (x: number, y: number, w: number, h: number) => {
    if (x + w > COLS) return false;
    for (let i = x; i < x + w; i++) for (let j = y; j < y + h; j++) if (taken.has(`${i},${j}`)) return false;
    return true;
  };
  const claim = (x: number, y: number, w: number, h: number) => {
    for (let i = x; i < x + w; i++) for (let j = y; j < y + h; j++) taken.add(`${i},${j}`);
  };
  const free = (w: number, h: number) => {
    for (let y = 0; ; y++) for (let x = 0; x < COLS; x++) if (fits(x, y, w, h)) return { x, y };
  };
  for (const t of tiles) if (t.x !== undefined && t.y !== undefined) claim(t.x, t.y, t.w, t.h);
  const placed = tiles.map((t) => {
    if (t.x !== undefined && t.y !== undefined) return t;
    const p = free(t.w, t.h)!;
    claim(p.x, p.y, t.w, t.h);
    return { ...t, ...p };
  });
  const spots = extra.map((e) => { const p = free(e.w, e.h)!; claim(p.x, p.y, e.w, e.h); return p; });
  return { placed: placed as Required<PlacedTile>[], spots };
}

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

// points from the last `secs` seconds, scaled for display
function windowed(h: Point[] = [], secs: number, scale = 1): Point[] {
  let i = 0;
  if (secs !== Infinity) {
    const from = (h[h.length - 1]?.[0] ?? 0) - secs;
    i = h.length;
    while (i > 0 && h[i - 1][0] >= from) i--;
  }
  return h.slice(i).map(([t, v]) => [t, v * scale]);
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
function chartOption(tile: Tile, s: Stream, secs: number, tooltip: boolean, compact = false) {
  const chs: Channel[] = tile.channels.map((c) => CHANNELS[c]);
  const dual = chs.length > 1;
  const series =
    tile.kind === "xy"
      ? [{
          type: "line",
          showSymbol: false,
          data: (s.history[chs[0].keys[0]] ?? []).map((p, i) => [p[1], s.history[chs[0].keys[1]]?.[i]?.[1]]),
        }]
      : chs.flatMap((ch, ci) =>
          ch.keys.map((k) => ({
            name: dual ? ch.name : seriesLabel(k),
            yAxisIndex: ci,
            type: "line",
            showSymbol: false,
            sampling: "lttb",
            data: windowed(s.history[k], secs, ch.scale),
          })),
        );
  const legend = series.length > 1 && !compact;
  return {
    animation: false,
    color: SERIES_COLORS,
    textStyle: { fontFamily: "inherit" },
    grid: compact
      ? { left: 0, right: 0, top: 4, bottom: 4 }
      : { left: 0, right: tile.kind === "xy" ? 32 : 0, top: legend ? 30 : 8, bottom: 0, containLabel: true },
    legend: legend
      ? { left: 0, top: 0, icon: "rect", itemWidth: 10, itemHeight: 2, textStyle: { color: "#9a9a9a", fontSize: 12 } }
      : undefined,
    // no fade and no hide delay, so nothing lingers after hover
    tooltip: {
      show: tooltip, // off while customizing: dragging tiles under the pointer leaves tooltips stuck
      trigger: "axis",
      valueFormatter: (v: unknown) => (typeof v === "number" ? String(+v.toFixed(2)) : String(v)),
      className: "tv2-tooltip",
      transitionDuration: 0,
      hideDelay: 0,
      backgroundColor: "#000",
      borderColor: "#3a3a3a",
      textStyle: { color: "#e6e6e6", fontSize: 12 },
    },
    xAxis: compact ? { type: "value", show: false, scale: true } : { type: "value", ...AXIS, axisLabel: { ...AXIS.axisLabel, show: tile.kind === "xy" } },
    yAxis: chs.slice(0, 2).map((_, i) => (compact ? { type: "value", show: false, scale: true } : { type: "value", ...AXIS, position: i ? "right" : "left" })),
    series,
  };
}

type TileActions = {
  customizing: boolean;
  maximized: boolean; // temporarily enlarged to large; a view only, never saved
  onResize: () => void;
  onMinimize: () => void;
  onToggleMax: () => void;
  onDelete: () => void;
  onChannel: (c: ChannelId) => void;
  onPick: (p: string) => void;
};

// thin-line glyphs for the round Metro buttons (12x12 grid)
const GLYPHS = {
  resize: "M3 9l6-6M5.5 3H9v3.5M3 5.5V9h3.5",
  minimize: "M3 6h6",
  maximize: "M3 3h6v6H3z",
  restore: "M4.5 2.5h5v5M2.5 4.5h5v5h-5z",
  delete: "M3.5 3.5l5 5m0-5-5 5",
};

function Ctl({ glyph, label, title = label, onClick, disabled }: {
  glyph: keyof typeof GLYPHS; label: string; title?: string; onClick: () => void; disabled?: boolean;
}) {
  return (
    // aria-disabled (not disabled) so the "already smallest" tooltip still shows on hover
    <button onClick={disabled ? undefined : onClick} aria-disabled={disabled} aria-label={label} title={title}>
      <svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="square">
        <path d={GLYPHS[glyph]} />
      </svg>
    </button>
  );
}

function TileControls({ tile, a }: { tile: Tile; a: TileActions }) {
  const size = sizeIndex(tile);
  const smallest = tile.kind === "xy" || size === 0;
  return (
    <div className="tv2-controls">
      {a.customizing && tile.kind === "channel" && (
        <Ctl glyph="resize" label="resize" title={`resize to ${SIZES[(size + 1) % 3].name}`} onClick={a.onResize} />
      )}
      {a.customizing && (
        <Ctl
          glyph="minimize"
          label="minimize"
          title={smallest ? "Already the smallest size" : "minimize"}
          onClick={a.onMinimize}
          disabled={smallest}
        />
      )}
      <Ctl
        glyph={a.maximized ? "restore" : "maximize"}
        label={a.maximized ? "restore" : "maximize"}
        title={!a.maximized && size === 2 ? "Already the largest size" : undefined}
        onClick={a.onToggleMax}
        disabled={!a.maximized && size === 2}
      />
      {a.customizing && <Ctl glyph="delete" label="delete" onClick={a.onDelete} />}
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

function TileView({ tile, s, delay, a }: { tile: Tile; s: Stream; delay: number; a: TileActions }) {
  const [secs, setSecs] = useState(30);
  const chart = useRef<ReactECharts>(null);
  const size = tile.kind === "xy" ? 2 : sizeIndex(tile);
  const chs: Channel[] = tile.channels.map((c) => CHANNELS[c]);
  const ch = chs[0];
  const hideTip = () => chart.current?.getEchartsInstance().dispatchAction({ type: "hideTip" });

  // just added: the tile asks which channel it shows
  if (!ch) {
    return (
      <div className="tv2-tile tv2-in tv2-unpicked" style={{ animationDelay: `${delay}ms` }}>
        <div className="tv2-tile-head">
          <div className="tv2-label">pick a channel</div>
          <TileControls tile={tile} a={a} />
        </div>
        <div className="tv2-add-pick">
          {(Object.keys(CHANNELS) as ChannelId[]).map((c) => (
            <button key={c} onClick={() => a.onChannel(c)}>{CHANNELS[c].name}</button>
          ))}
        </div>
      </div>
    );
  }

  const r = reading(ch, tile.pick, s);
  const number = (
    <div className="tv2-reading">
      <div className="tv2-value-row">
        <span className="tv2-value">{r.text}</span>
        <span className="tv2-unit">{ch.unit}</span>
      </div>
      {ch.limits && (
        <div className="tv2-limits">
          warn {ch.limits.warn} · danger {ch.limits.danger} {ch.unit}
        </div>
      )}
    </div>
  );
  const plot = (compact: boolean) => (
    <div className="tv2-chart" onMouseLeave={hideTip}>
      <ReactECharts ref={chart} option={chartOption(tile, s, compact ? 30 : secs, !a.customizing, compact)} style={{ height: "100%" }} />
    </div>
  );

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
        {size === 2 && tile.ranges && (
          <div className="tv2-ranges">
            {RANGES.map((rg) => (
              <button key={rg.label} className={rg.s === secs ? "on" : ""} onClick={() => setSecs(rg.s)}>
                {rg.label}
              </button>
            ))}
          </div>
        )}
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
  // edited layouts per preset (per-viewer, browser only); presets.ts holds the defaults
  const [layouts, setLayouts] = useState<Record<string, PlacedTile[]>>(() => load("tv2-layouts-v3", {}));
  const [justAdded, setJustAdded] = useState<string>();
  // tiles temporarily enlarged to large; a view only, never saved, cleared on preset switch
  const [enlarged, setEnlarged] = useState<string[]>([]);
  const lastSwipe = useRef(0);
  const preset = PRESETS[active];

  const go = (step: number) => {
    setDir(step > 0 ? 1 : -1);
    setActive((a) => (a + step + N) % N);
    setEnlarged([]);
  };

  const toggleTheme = () => {
    save("tv2-theme", light ? "dark" : "light");
    setLight(!light);
  };

  const { width, containerRef, mounted } = useContainerWidth();
  const saved: PlacedTile[] = layouts[preset.name] ?? preset.tiles.map((t, i) => ({ ...t, id: `${preset.name}-${i}` }));
  const { placed: tiles, spots } = pack(saved, customizing ? [{ w: 1, h: 1 }] : []);
  const addSpot = spots[0];
  const setTiles = (next: PlacedTile[]) => {
    const all = { ...layouts, [preset.name]: next };
    setLayouts(all);
    save("tv2-layouts-v3", all);
  };

  // "+ add tile" drops a small, empty tile into the slot; the tile then asks for its channel
  const addTile = () => {
    const t: PlacedTile = { kind: "channel", channels: [], w: 1, h: 1, ...addSpot, id: String(Date.now()) };
    setTiles([...tiles, t]);
    setJustAdded(t.id);
  };
  const update = (id: string, f: (t: PlacedTile) => PlacedTile) => setTiles(tiles.map((t) => (t.id === id ? f(t) : t)));
  // new size, kept inside the 6 columns
  const resized = (t: PlacedTile, i: number): PlacedTile => {
    const { w, h } = SIZES[i];
    return { ...t, w, h, x: Math.min(t.x ?? 0, COLS - w) };
  };
  // drag-and-drop in customize mode: keep where things landed (sizes stay the saved ones, not the enlarged view)
  const onDragStop = (l: Layout) => {
    const at = new Map(l.map((it) => [it.i, it]));
    setTiles(tiles.map((t) => ({ ...t, x: at.get(t.id)?.x ?? t.x, y: at.get(t.id)?.y ?? t.y })));
  };
  const col = (width - 2 * 16 - (COLS - 1) * 8) / COLS;
  const gridLayout: Layout = [
    ...tiles.map((t) => {
      const big = enlarged.includes(t.id);
      return { i: t.id, x: big ? Math.min(t.x, COLS - 2) : t.x, y: t.y, w: big ? 2 : t.w, h: big ? 2 : t.h };
    }),
    ...(customizing ? [{ i: "add", ...addSpot, w: 1, h: 1, isDraggable: false }] : []),
  ];
  const actions = (t: PlacedTile): TileActions => ({
    customizing,
    maximized: enlarged.includes(t.id),
    onResize: () => update(t.id, (x) => resized(x, (sizeIndex(x) + 1) % SIZES.length)),
    onMinimize: () => {
      update(t.id, (x) => resized(x, Math.max(0, sizeIndex(x) - 1)));
      setEnlarged(enlarged.filter((id) => id !== t.id));
    },
    onToggleMax: () =>
      setEnlarged(enlarged.includes(t.id) ? enlarged.filter((id) => id !== t.id) : [...enlarged, t.id]),
    onDelete: () => setTiles(tiles.filter((x) => x.id !== t.id)),
    // the GPS track is its own large-only kind; let pack() find it a free 2x2
    onChannel: (c) =>
      update(t.id, (x) => (c === "track" ? { ...x, kind: "xy", channels: [c], w: 2, h: 2, x: undefined, y: undefined } : { ...x, channels: [c] })),
    onPick: (p) => update(t.id, (x) => ({ ...x, pick: p })),
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
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
        <img className="tv2-logo" src="/baja_logo.jpg" alt="Baja" />
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
            gridConfig={{ cols: COLS, rowHeight: col, margin: [8, 8], containerPadding: [16, 16] }}
            dragConfig={{ enabled: customizing, cancel: "button, select, .tv2-ranges" }}
            resizeConfig={{ enabled: false }}
            onDragStop={onDragStop}
          >
            {tiles.map((t, i) => (
              <div key={t.id}>
                <TileView
                  tile={enlarged.includes(t.id) ? { ...t, w: 2, h: 2 } : t}
                  s={s}
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
      </main>
    </div>
  );
}
