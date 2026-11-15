import { useEffect, useRef, useState } from "react";
import { setGpsMode, useGpsMode, type GpsMode } from "../../hooks/useGpsMode";
import type { SettingsProps } from "../types";
import { BACKGROUNDS } from "../../config/map";
import { setMapBackground, useMapBackground } from "../../hooks/useMapBackground";
import { PageHeader } from "./PageHeader";
import { TrackSection } from "./TrackSection";

// The GPS tile's settings, a black Metro panel over the tile: the mode, the track, the map background, and where the
// start line goes.
// Closes on the gear (TileControls), Esc, or a click outside the tile.

const MODES: { id: GpsMode | "accel"; label: string }[] = [
  { id: "free", label: "free run" },
  { id: "endurance", label: "endurance" },
  { id: "accel", label: "accel" }, // later: shown, not selectable
];

export function GpsSettings({ onClose }: SettingsProps) {
  const mode = useGpsMode();
  const bg = useMapBackground();
  const [note, setNote] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose); // the tile re-renders 10 times a second; listen once, call the latest
  close.current = onClose;
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && close.current();
    // outside = outside this tile: the gear and the rest of the tile's controls handle their own clicks
    const down = (e: PointerEvent) => !ref.current?.closest(".tv2-tile")?.contains(e.target as Node) && close.current();
    document.addEventListener("keydown", key);
    document.addEventListener("pointerdown", down);
    return () => {
      document.removeEventListener("keydown", key);
      document.removeEventListener("pointerdown", down);
    };
  }, []);

  return (
    <div className="tv2-settings" ref={ref} role="dialog" aria-label="gps settings">
      <PageHeader subtitle="settings" />
      <h3>mode</h3>
      <div className="tv2-settings-row">
        {MODES.map((m) =>
          m.id === "accel" ? (
            <span key={m.id} className="tv2-settings-opt">
              <button type="button" className="tv2-settings-mode off" disabled>{m.label}</button>
              <small className="tv2-settings-hint">(doesn't work yet)</small>
            </span>
          ) : (
            <button key={m.id} type="button" className={`tv2-settings-mode${mode === m.id ? " on" : ""}`} aria-pressed={mode === m.id} onClick={() => setGpsMode(m.id as GpsMode)}>
              {m.label}
            </button>
          ),
        )}
      </div>
      <TrackSection setNote={setNote} />
      <h3>background</h3>
      <div className="tv2-settings-row">
        {BACKGROUNDS.map((b) => (
          <button key={b.id} type="button" className={`tv2-settings-mode${bg === b.id ? " on" : ""}`} aria-pressed={bg === b.id} onClick={() => setMapBackground(b.id)}>
            {b.label}
          </button>
        ))}
      </div>
      <h3>start line location</h3>
      <div className="tv2-settings-row">
        <span className="tv2-settings-opt">
          {/* not wired up yet: markStartFinish() in hooks/useCourse.ts is what it would call */}
          <button type="button" className="tv2-settings-action" disabled>use car's position now</button>
          <small className="tv2-settings-hint">(doesn't work yet)</small>
        </span>
        <button type="button" className="tv2-settings-action" onClick={() => setNote("pick on map: coming soon")}>pick on map</button>
      </div>
      {note && <p className="tv2-settings-note">{note}</p>}
      <p className="tv2-settings-foot">changing the start line clears the recorded route.</p>
    </div>
  );
}
