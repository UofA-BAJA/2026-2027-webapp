import { TIME_WINDOWS } from "../config/presets";
import type { Stream } from "../lib/stream";
import Radio from "../radio/Radio";
import ThemeIcon from "./ThemeIcon";

type Props = {
  s: Stream;
  light: boolean;
  toggleTheme: () => void;
  secs: number; // the page-wide chart window
  setSecs: (s: number) => void;
  customizing: boolean;
  startCustomizing: () => void;
};

// Right side of the header: signal readout (opens the radio panel), theme, time window, customize.
export default function StatusArea({ s, light, toggleTheme, secs, setSecs, customizing, startCustomizing }: Props) {
  return (
    <div className="tv2-right">
      <Radio s={s} />
      <button className="tv2-icon-btn" onClick={toggleTheme} aria-label={light ? "dark theme" : "light theme"}>
        <ThemeIcon light={light} />
      </button>
      <div className="tv2-ranges" role="group" aria-label="time window">
        {TIME_WINDOWS.map((rg) => (
          <button key={rg.label} className={rg.s === secs ? "on" : ""} aria-pressed={rg.s === secs} onClick={() => setSecs(rg.s)}>
            {rg.label}
          </button>
        ))}
      </div>
      {!customizing && (
        <button className="tv2-text-btn" onClick={startCustomizing}>customize</button>
      )}
    </div>
  );
}
