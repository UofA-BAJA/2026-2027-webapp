// The tracks that ship with the dashboard: one GeoJSON file each in this folder (see README.md).
// Add a track: drop its .geojson here, import it with ?raw and add one line to TRACKS.
import { parseTrack, type Track } from "../lib/tracks";
import nordschleife from "./nordschleife.geojson?raw";

const FILES: Record<string, string> = {
  nordschleife,
};

export const TRACKS: Track[] = Object.entries(FILES).flatMap(([id, text]) => {
  const t = parseTrack(text, id, `${id}.geojson`);
  if (typeof t === "string") {
    console.error(`tracks/${id}.geojson: ${t}`); // a broken file is skipped, not fatal
    return [];
  }
  return [t];
});
