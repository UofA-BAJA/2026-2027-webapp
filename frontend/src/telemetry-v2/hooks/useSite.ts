import type { LatLon } from "../lib/stream";
import { persisted } from "./persisted";

// The map image under the GPS map: one per site in maps/ (an image plus a .json with its corners; see maps/README.md).
// Found at build time, so adding a site is just dropping the two files in.

export type Site = { id: string; name: string; image: string; topLeft: LatLon; bottomRight: LatLon };
type Meta = { name: string; topLeft: LatLon; bottomRight: LatLon };

const META = import.meta.glob<Meta>("../maps/*.json", { eager: true, import: "default" });
const IMAGES = import.meta.glob<string>("../maps/*.{png,jpg,jpeg,webp}", { eager: true, query: "?url", import: "default" });
const base = (path: string) => path.split("/").pop()!.replace(/\.[^.]+$/, "");

export const SITES: Site[] = Object.entries(META).flatMap(([path, m]) => {
  const image = Object.entries(IMAGES).find(([p]) => base(p) === base(path))?.[1];
  if (!image) console.error(`maps/${base(path)}.json has no image next to it`); // skipped, not fatal
  return image ? [{ id: base(path), name: m.name, image, topLeft: m.topLeft, bottomRight: m.bottomRight }] : [];
});

// GPS settings → SITE: a site's id, "none" (black), or null = whichever site the car is in
export const [useSiteChoice, setSiteChoice, getSiteChoice] = persisted<string | null>("tv2-gps-site-v1", null);

const contains = (s: Site, [la, lo]: LatLon) => la <= s.topLeft[0] && la >= s.bottomRight[0] && lo >= s.topLeft[1] && lo <= s.bottomRight[1];

/** The site picked in settings, else the one whose image the car is on; undefined = no image (black). */
export function siteFor(choice: string | null, car: LatLon | undefined): Site | undefined {
  if (choice === "none") return undefined;
  return SITES.find((s) => s.id === choice) ?? (car ? SITES.find((s) => contains(s, car)) : undefined);
}

/** The key per-site settings are saved under ("none" when there's no image). */
export const siteKey = (site: Site | undefined) => site?.id ?? "none";
