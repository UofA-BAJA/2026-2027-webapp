// The event venues: where the GPS map's satellite imagery comes from. Data only; the map is tiles/parts/TrackMap.tsx.
// Imagery is downloaded ahead of time (no internet at the pits) with tools/venue_tiles.py into public/tiles/<id>/;
// run it with the venue's `bounds`. See README.md ("Add a venue").

import type { LatLon } from "../lib/stream.ts";

export type Venue = {
  id: string; // the tiles folder: public/tiles/<id>/{z}/{x}/{y}.jpg
  name: string;
  location: string; // town, state: saved into tracks recorded here
  dates: string;
  // south-west and north-east corners of the downloaded imagery; undefined = no imagery yet (the map draws on plain tile)
  bounds?: [LatLon, LatLon];
};

export const VENUES: Venue[] = [
  {
    id: "arizona",
    name: "Baja SAE Arizona",
    location: "Marana, AZ",
    dates: "April 29 – May 2, 2027",
    // TODO: confirm with team: the 2025 site (Marana Pumpkin Patch, 14950 N Trico Rd); 2027 not announced yet
    bounds: [[32.462, -111.312], [32.484, -111.284]],
  },
  {
    id: "williamsport",
    name: "Baja SAE Williamsport",
    location: "Williamsport, PA",
    dates: "May 20 – May 23, 2027",
    // TODO: confirm with team: 2024 was Penn College's operations site in Brady Township near Allenwood, PA; no coordinates yet
  },
  {
    id: "michigan",
    name: "Baja SAE Michigan",
    location: "Marshall, MI",
    dates: "October 7 – October 10, 2027",
    // TODO: confirm with team: Marshall, MI; the venue isn't published yet (2024 was Holly Oaks, Holly, MI)
  },
];

// the event the dashboard is set up for
export const VENUE: Venue = VENUES[0];

// zooms tools/venue_tiles.py downloads; the map scales the nearest one past these
export const TILE_ZOOMS = { min: 14, max: 18 };
