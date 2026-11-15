# Tracks

One GeoJSON file per track. The GPS tile's settings list them under TRACK. Tap one and the dashboard times laps on it: start/finish comes from the file, and the splits are spread evenly along the route.

## File format

A single GeoJSON `Feature` whose geometry is a `LineString`: the route in driving order, as `[longitude, latitude]` pairs (GeoJSON's order). Everything else goes in `properties`:

| property | what it is |
|---|---|
| `name` | Shown in the list, e.g. `"Marana endurance 2027"` |
| `location` | Where it is, e.g. `"Marana, AZ"` |
| `recordedAt` | `YYYY-MM-DD` |
| `startLine` | `{ "a": { "lat", "lon" }, "b": { "lat", "lon" } }`: the ends of the start/finish line, either side of the course. The car has to cross between them. |
| `source` | A URL, or `"recorded by car"` |
| `license` | Who owns the data and how it may be used |

The "export .geojson" button writes exactly this format, so an exported file can go straight into this folder.

## Add a track

1. Get the file:
   - **Recorded by the car** (the usual way at an event): GPS settings → TRACK → **record new** as the car crosses the start line. After one full lap, type a name and **save track**, then **export .geojson**.
   - **Imported:** GPS settings → TRACK → **import file** takes `.geojson`, `.gpx` or `.kml` and converts it. Then **export .geojson**.
2. Put the file here, with a lowercase, dashed name (the export already names it that way): `marana-endurance-2027.geojson`.
3. In `index.ts`, import it with `?raw` and add it to `FILES`.
4. Run `node --experimental-strip-types src/telemetry-v2/lib/tracks.check.ts` from `frontend/`. It checks every file here: all properties set, start line at the route's start, listed in `index.ts`. Then commit.

The browser can't write to the repo. Until someone commits the file, a saved track lives only in that browser's localStorage (`tv2-tracks-v1`).

## Where route data can come from

- **Our own GPS recording.** "record new" saves the line the car actually drove, which is the most accurate source for timing. License: ours.
- **[gpx.studio](https://gpx.studio).** Draw or edit a route over a map in the browser and export GPX. A route you draw is yours. The map it's drawn over isn't, so don't trace someone else's copyrighted course map.
- **Google Earth.** Draw a path over the satellite view and save it as KML. Google's terms limit what may be copied from their imagery, so treat a line traced from it as a rough guide for the crew, not data to publish.
- **[OpenStreetMap](https://www.openstreetmap.org).** Raceways are often mapped (`highway=raceway`) and can be exported as GPX, for example with [overpass-turbo](https://overpass-turbo.eu). OSM data is under the [ODbL](https://opendatacommons.org/licenses/odbl/): credit "© OpenStreetMap contributors" in `license`.

## Tracks here

- **`nordschleife.geojson`: Nürburgring Nordschleife,** the sample. The shape is [JRT-Trackmaps](https://github.com/drjackyl/jrt-trackmaps) by drjackyl (`nurburgring nordschleife/coord`, commit fbea5d4, 2018), released into the public domain under The Unlicense. JRT stores the track in local metres with no coordinates. We placed it on the map by fitting it (mirrored, rotated and moved; its scale already matched to 0.3%) to OpenStreetMap's named corners, then refining against OSM's raceway line. The result is a median of 5 m and at most 20 m off OSM's line. The `license` property credits both. The mock server drives the same JRT shape, shrunk to 1/8 and moved to Marana.

## Map backgrounds (not in this folder)

GPS settings → BACKGROUND picks what's under the track line: **satellite**, **topo**, **contours** or **none** (pure black, the line and the car only). The choice is saved in the browser (`tv2-map-bg-v1`). All of it comes from **USGS The National Map**:

| background | tiles | what it is |
|---|---|---|
| satellite | `USGSImageryOnly` (online, zoom ≤16), plus the venue's downloaded tiles in `frontend/public/tiles/<venue>/` (zoom 14–18, from `tools/venue_tiles.py`) | USDA NAIP aerial photography |
| topo | `USGSTopo` (online, zoom ≤16) | USGS topographic base map: contours, roads, names |
| contours | `src/telemetry-v2/contours/*.geojson`, generated from USGS 3DEP elevation GeoTIFFs dropped in `frontend/elevation/` (see its README) | black-and-white elevation lines, vector, offline |

The tile URLs are in `config/map.ts`.

- **License:** USGS says National Map services and data are free and in the public domain, with no use restrictions. Saving, shipping and committing the tiles is fine.
- **Credit:** USGS asks for "Map services and data available from U.S. Geological Survey, National Geospatial Program." The map shows a small "USGS" in its bottom-right corner whenever a background is on, and this README and the main README carry the full line.
- **Coverage:** US only. The three 2027 Baja SAE venues are covered; the Nordschleife draws on black. NAIP photos are refreshed every few years; the Arizona tiles are from around 2023–2024.
- **Offline:** the online tiles need internet. When they keep failing, the map drops them and says "offline · map hidden" in the corner. With satellite at a venue whose tiles were downloaded, it keeps showing those and says "offline · saved imagery only". The track line, driven path and car never need the internet.
- **Never Esri, Google or Mapbox imagery:** their terms don't allow saving tiles for offline use.
