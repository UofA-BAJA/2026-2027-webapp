// The /telemetry-v2 page: puts the header, the tile grid and the overlays together and holds page-wide state.
// What to change where: see README.md in this folder.
import { useEffect, useRef, useState } from "react";
import { DEFAULT_TIME_WINDOW, PRESETS } from "./config/presets";
import { CSS_VARS, SWIPE_COOLDOWN_MS, SWIPE_MIN } from "./config/theme";
import TileGrid from "./grid/TileGrid";
import EasterEgg from "./header/EasterEgg";
import Header from "./header/Header";
import { useLayouts } from "./hooks/useLayouts";
import { useStream } from "./hooks/useStream";
import { load, save } from "./lib/storage";
import { timeRange } from "./lib/stream";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/header.css";
import "./styles/radio.css";
import "./styles/tiles.css";
import "./styles/grid.css";
import "./styles/motion.css";

const N = PRESETS.length;

export default function TelemetryV2() {
  const s = useStream();
  const [active, setActive] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1); // pivot slide direction
  const [light, setLight] = useState(() => load<string>("tv2-theme", "dark") === "light");
  const [customizing, setCustomizing] = useState(false);
  const [fullId, setFullId] = useState<string>(); // tile shown fullscreen over the grid; cleared on preset switch
  const [egg, setEgg] = useState(false); // easter egg video
  const [secs, setSecs] = useState(DEFAULT_TIME_WINDOW); // page-wide chart window
  const lastSwipe = useRef(0);
  const preset = PRESETS[active];
  const { tiles, setTiles } = useLayouts(preset);

  const go = (step: number) => {
    setDir(step > 0 ? 1 : -1);
    setActive((a) => (a + step + N) % N);
    setFullId(undefined);
  };

  const toggleTheme = () => {
    save("tv2-theme", light ? "dark" : "light");
    setLight(!light);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "Escape") {
        setFullId(undefined);
        setEgg(false);
      }
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
    if (e.timeStamp - lastSwipe.current < SWIPE_COOLDOWN_MS) return;
    lastSwipe.current = e.timeStamp;
    go(e.deltaX > 0 ? 1 : -1); // fingers move left = forward
  };

  return (
    <div className={`tv2${light ? " light" : ""}`} style={CSS_VARS as React.CSSProperties}>
      <Header
        onLogoHold={() => setEgg(true)}
        active={active}
        dir={dir}
        go={go}
        s={s}
        light={light}
        toggleTheme={toggleTheme}
        secs={secs}
        setSecs={setSecs}
        customizing={customizing}
        startCustomizing={() => setCustomizing(true)}
      />
      {customizing && (
        <div className="tv2-toolbar">
          <span>customizing {preset.name}</span>
          <button className="tv2-text-btn" onClick={() => setCustomizing(false)}>done</button>
        </div>
      )}
      <TileGrid
        presetName={preset.name}
        tiles={tiles}
        setTiles={setTiles}
        customizing={customizing}
        s={s}
        range={timeRange(s, secs)}
        fullId={fullId}
        setFullId={setFullId}
        onWheel={onWheel}
      />
      {egg && <EasterEgg onClose={() => setEgg(false)} />}
    </div>
  );
}
