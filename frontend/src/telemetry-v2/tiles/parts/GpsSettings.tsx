import { useEffect, useRef } from "react";
import type { SettingsProps } from "../types";
import { setSiteChoice, siteFor, SITES, useSiteChoice } from "../../hooks/useSite";
import { clearTrail, setTrail, TRAILS, useTrail } from "../../hooks/useTrail";
import { gpsTrace } from "../../lib/stream";
import { PageHeader } from "./PageHeader";

// The GPS tile's settings, a black Metro panel over the tile: which site image is under the map, how much trail it
// draws, and clear trail.
// Closes on the gear (TileControls), Esc, or a click outside the tile.

export function GpsSettings({ s, onClose }: SettingsProps) {
  const n = s.history.gps_latitude?.length ?? 0;
  const choice = useSiteChoice();
  const site = siteFor(choice, gpsTrace(s, n - 1, n)[0]); // with no choice made, the site the car is in shows as picked
  const trail = useTrail();
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

  const option = (on: boolean, label: string, pick: () => void) => (
    <button key={label} type="button" className={`tv2-settings-mode${on ? " on" : ""}`} aria-pressed={on} onClick={pick}>
      {label}
    </button>
  );
  return (
    <div className="tv2-settings" ref={ref} role="dialog" aria-label="gps settings">
      <PageHeader title="GPS" subtitle="settings" />
      <h3>site</h3>
      <div className="tv2-settings-row">
        {SITES.map((x) => option(site?.id === x.id, x.name, () => setSiteChoice(x.id)))}
        {option(!site, "none", () => setSiteChoice("none"))}
      </div>
      <h3>trail</h3>
      <div className="tv2-settings-row">{TRAILS.map((t) => option(trail === t.id, t.label, () => setTrail(t.id)))}</div>
      <div className="tv2-settings-row">
        <button type="button" className="tv2-settings-action tv2-act" onClick={() => clearTrail(s)}>clear trail</button>
      </div>
    </div>
  );
}
