# /telemetry-v2

The live telemetry dashboard. Run it without Docker from the repo root with `./start.sh` (UI on http://localhost:5173/telemetry-v2, mock data on :8000) and stop it with `./stop.sh`.

Most changes are **data changes in `config/`**. You shouldn't need to read component code to change a redline, a range, a color or a preset.

## Where things live

| Folder | What's in it |
|---|---|
| `config/` | Data people change: `channels.ts` (every channel, its units, limits and ranges), `presets.ts` (the tile layouts), `radio.ts` (frequencies, data types, command IDs), `theme.ts` (chart colors and a few sizes code needs), `track.ts` (default start/finish and split lines, `minLapSeconds`), `venues.ts` (event venues and their downloaded imagery), `map.ts` (map background tile URLs). No JSX, no logic. |
| `tracks/` | One GeoJSON file per saved track, listed in `index.ts`. See `tracks/README.md` for the format, how to add one, and where map data comes from. |
| `contours/` | Contour lines generated from elevation files dropped in `frontend/elevation/` (see that folder's README). Don't edit by hand. |
| `styles/` | `tokens.css` holds every color, font size and spacing value by role. The other stylesheets only use those names. |
| `tiles/` | `registry.ts` (tile type → component per size), the tile bodies (`NumberTile`, `NumberChartTile`, `ChartTile`, `GpsTile`), `PickChannelTile`, `TileView` (works out the number, limits and "no data"), and `parts/` (`TileShell`, `LimitOutline`, `LimitBar`, `TileControls`, `Reading`, `RoundButton`; for the GPS tile `TrackMap` (Leaflet map), `MapBackdrop` (satellite/topo/contours/none, offline fallback), `ContourLayer`, `GpsSettings` + `TrackSection` (the gear panel) and `PageHeader`). |
| `charts/` | `TimeSeriesChart.tsx` is the only ECharts wrapper; `chartOptions.ts` builds the options. |
| `header/` | `Header`, `Logo`, `Ridges`, `Pivot`, `StatusArea`, `ThemeIcon`, `EasterEgg`. |
| `grid/` | `TileGrid` (packing, drag-to-reorder, fullscreen overlay) and `AddSlot`. |
| `radio/` | `Radio` (the signal readout), `RadioPanel`, `CommandButton`, `DataTypePicker`, `sendCommand.ts`. |
| `hooks/` | `useStream` (the live data), `useLayouts` (saved tile orders), `useResize`; GPS: `useCourse` (the course lap timing uses, `markStartFinish`), `useTracks` (repo + browser-saved tracks, export), `useGpsMode`, `useMapBackground`, and `persisted` (a small shared value saved in localStorage). |
| `lib/` | Plain logic with self-checks: `limitState.ts`, `layout.ts` (sizes, packer, validation), `axisRange.ts`, `headerFit.ts`, `systems.ts`, `stream.ts`, `format.ts`, `laps.ts` (lap and split timing, time colors), `course.ts` (start/finish and split geometry), `tracks.ts` (the track file format), `routeFiles.ts` (reading GeoJSON/GPX/KML), `dataSummary.ts`, `storage.ts`. |
| `TelemetryV2.tsx` | Only puts the pieces together and holds page-wide state. |

## Recipes

### Change a redline (or any limit)
Edit the channel in `config/channels.ts`:
- `warnAt`: where the red outline meter starts ("warming", then "near limit").
- `redline`: at or over this, the whole tile turns red with "OVER LIMIT".
- Motor rpm uses `idle` and `governor` instead. The bar runs idle → governor, and the tile is red only strictly above the governor.

The limit bar, its "/ 120" label, the outline and the status text all follow. Get the numbers from the team, and leave a `// TODO: confirm with team` on anything that isn't confirmed.

### Change a chart range
Set the channel's `axis` in `config/channels.ts`: `{ auto: true }` fits the data, `{ min: 0, max: 150 }` fixes the y axis.

### Add a channel
1. Add an entry to `CHANNELS` in `config/channels.ts`. `keys` are the field names in the live stream; see `FRAME_FIELDS` in `tools/radio_to_json.py`. `source` is the firmware DataType it comes from. Fill in `label`, `unit`, `decimals` and `axis`, plus `scale` for a unit conversion.
2. Set its `system` (for example `"Drivetrain"`). That puts it in the "pick a channel" list under that group; a new name makes a new group. Groups and channels are listed in the order they appear in `CHANNELS`.
3. Run the self-check (below). It fails if a preset names an unknown channel.

### Add or reorder a preset
Edit `PRESETS` in `config/presets.ts`. Each preset is an ordered list of `{ channel, size }`:
- `size` is `small` (number), `medium` (number + chart) or `large` (chart). For `track`: small = map + lap time, medium = + splits, large = + every lap.
- `channel` can be a list of two channels, for one chart with a y axis each.

The grid fills tiles in order, left to right, top to bottom, at any window width. A viewer who customized a preset keeps their own version, saved in their browser's localStorage (`tv2-layouts-v4`). Clearing the site data brings the default back; there's no reset button.

### Set up the endurance course
The endurance route isn't published ahead of time, so the dashboard learns it from the car. Tap the gear on the `track` tile (GPS settings):
1. MODE → **endurance**. (**free run** turns lap timing off and shows just the map.)
2. TRACK → **record new** as the car crosses the timing line (it has to be moving). The line goes through the car, square to its direction, 15 m wide. ("use car's position now" under START LINE LOCATION does the same.)
3. Let it drive one full lap. That lap becomes the route, with S1–S4 at equal distances, and every lap so far is retimed with the splits.
4. Type a name and **save track**, then **export .geojson** and commit the file to `tracks/` so everyone has it (see `tracks/README.md`). A track from the list, or one from **import file** (`.geojson`, `.gpx`, `.kml`), sets the start line and route in one tap.

The course is saved per venue in the browser, so reloading mid-race keeps it.

`minLapSeconds` in `config/track.ts`: a start/finish crossing sooner than this after the last one is ignored, so sitting on the line with a jittery GPS doesn't make laps. Keep it below your fastest possible lap. The first start/finish crossing sets the driving direction; crossing it the other way never counts.

A missed split (the car went wide of the line, or GPS dropped out) leaves those two segments blank for that lap; the lap time still counts. Averages are over completed laps, and the out lap before the first start/finish crossing isn't timed.

### Add a venue
The GPS map draws over satellite imagery of the event venue, downloaded ahead of time because the pits may have no internet.
1. Find the site's corners: south-west and north-east as latitude, longitude, wide enough to hold the whole course and pits (about 2 × 2 km).
2. From the repo root: `python3 tools/venue_tiles.py <id> <south> <west> <north> <east>`. It's slow (the NAIP server manages ~10 tiles a minute), and re-running picks up where it stopped. Tiles land in `frontend/public/tiles/<id>/`.
3. Add or edit the venue in `config/venues.ts` with the same `id` and `bounds`, and point `VENUE` at it.
4. The route doesn't go here: record it at the event or pick a saved track ("Set up the endurance course" above).
5. Optional, for the **contours** background: drop a USGS elevation GeoTIFF of the venue in `frontend/elevation/` (that folder's README says where to download one). The dev server and the build turn it into `contours/<id>.geojson`; commit that.

Imagery is USDA NAIP through USGS The National Map: public domain, US only. Credit: "Map services and data available from U.S. Geological Survey, National Geospatial Program." Details in `tracks/README.md`.

### Rename a preset or add a header control
Just do it. The header measures the logo, the preset names and the controls, and picks the richest layout that fits (five names centered, three centered, three next to the logo, or only the active name). There are no breakpoints to update.

### Change a color
- **Page, tiles, header, radio panel:** change the role in `styles/tokens.css`, for example `--alarm`, `--data-problem` or `--tile`. The light theme overrides some of them at the bottom of the file. The header ridges use `--ridge-back` / `--ridge-front` too.
- **Sizes that code also needs** (page gutter, grid gap, radio panel width, unit font): `config/theme.ts`. It hands them to CSS, so there's no second copy to keep in sync.
- **Chart lines, axes, ticks, tooltips:** these are drawn on a canvas, so they're in `CHART` in `config/theme.ts`.
- Red (`--alarm`) means the car has a problem, and blue (`--data-problem`) means the data has a problem. Don't use them for decoration.
- Lap and split times: `--time-ahead` (green) and `--time-behind` (red) against the average, white when there's nothing to compare yet. `timeTone()` in `lib/laps.ts` is the only place that decides.

### Add a tile type
1. Write the body component in `tiles/`. It receives `TileBodyProps` (`tiles/types.ts`): the tile, the stream, the time range, the channel and its current reading. Read units, limits and ranges from the channel, never hard-code them.
2. Register it in `tiles/registry.ts` under a new `kind` with the sizes it supports. The size switcher appears only for types with more than one size.
3. Add the new `kind` to the `Tile` type and to `validTiles()` in `lib/layout.ts`, so saved layouts with it are accepted.

## Self-checks
Run everything (both type checks and every self-check) from `frontend/`:

```
npm run check
```

Or one at a time:

```
node --experimental-strip-types src/telemetry-v2/lib/layout.check.ts      # packer, presets, limits, saved-layout validation
node --experimental-strip-types src/telemetry-v2/lib/radio.check.ts       # radio config and sendCommand
node --experimental-strip-types src/telemetry-v2/lib/laps.check.ts        # lap and split detection on a synthetic trace, time colors
node --experimental-strip-types src/telemetry-v2/lib/course.check.ts      # start/finish and split geometry
node --experimental-strip-types src/telemetry-v2/lib/tracks.check.ts      # every file in tracks/, export/import, GPX/KML/GeoJSON reading
node --experimental-strip-types plugins/contours.check.ts                 # elevation → contour lines (a synthetic cone)
node --experimental-strip-types src/telemetry-v2/lib/axisRange.check.ts   # round ticks, grow/shrink of chart ranges
node --experimental-strip-types src/telemetry-v2/lib/headerFit.check.ts   # which header layout fits
```

The checks need Node 22.6 or newer (`--experimental-strip-types`). The app itself builds and runs on Node 20.19+.

`lib/` and `config/` import each other with `.ts` extensions so these run in plain Node. Keep that when you add imports there.
