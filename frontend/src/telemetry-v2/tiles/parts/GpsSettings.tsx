import { useEffect, useRef } from "react";
import type { SettingsProps } from "../types";
import { BACKGROUNDS } from "../../config/map";
import { setMapBackground, useMapBackground } from "../../hooks/useMapBackground";
import { PageHeader } from "./PageHeader";

// The GPS tile's settings, a black Metro panel over the tile: the map background.
// Closes on the gear (TileControls), Esc, or a click outside the tile.

export function GpsSettings({ onClose }: SettingsProps) {
  const bg = useMapBackground();
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
      <h3>background</h3>
      <div className="tv2-settings-row">
        {BACKGROUNDS.map((b) => (
          <button key={b.id} type="button" className={`tv2-settings-mode${bg === b.id ? " on" : ""}`} aria-pressed={bg === b.id} onClick={() => setMapBackground(b.id)}>
            {b.label}
          </button>
        ))}
      </div>
    </div>
  );
}
