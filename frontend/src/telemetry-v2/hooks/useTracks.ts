import { useSyncExternalStore } from "react";
import { load, save } from "../lib/storage";
import { trackFeature, trackFileName, type Track } from "../lib/tracks";
import { TRACKS } from "../tracks";

// Every track the settings panel lists: the ones in tracks/ (from the repo), then the ones saved in this browser.
// The browser can't write to the repo, so a recorded or imported track lives in localStorage until someone exports it
// and commits the file to tracks/.

const KEY = "tv2-tracks-v1"; // Track[] saved in this browser
let saved: Track[] = load<Track[]>(KEY, []);
let all: Track[] = [...TRACKS, ...saved];
const listeners = new Set<() => void>();

/** Save a track in this browser (replacing one with the same id). */
export function saveTrack(t: Track) {
  saved = [...saved.filter((x) => x.id !== t.id), t];
  save(KEY, saved);
  all = [...TRACKS, ...saved];
  listeners.forEach((l) => l());
}

export const newTrackId = () => `local-${Date.now()}`;

export function useTracks(): Track[] {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => all,
  );
}

/** Download the track as <name>.geojson, the same format as the files in tracks/. */
export function downloadTrack(t: Track) {
  const blob = new Blob([JSON.stringify(trackFeature(t), null, 1)], { type: "application/geo+json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = trackFileName(t);
  a.click();
  URL.revokeObjectURL(a.href);
}
