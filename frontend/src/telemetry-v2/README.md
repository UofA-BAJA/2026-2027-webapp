# /telemetry-v2

The live telemetry dashboard. Run it without Docker from the repo root with `./start.sh` (UI on http://localhost:5173/telemetry-v2, mock data on :8000) and stop it with `./stop.sh`.

Most changes are **data changes in `config/`**. You shouldn't need to read component code to change a redline, a range, a color or a preset.

## Where things live

| Folder | What's in it |
|---|---|
| `config/` | Data people change: `channels.ts` (every channel, its units, limits and ranges), `presets.ts` (the tile layouts), `radio.ts` (frequencies, data types, command IDs), `theme.ts` (chart colors and a few sizes code needs), `laps.ts` (lap box default size, re-entry time). No JSX, no logic. |
| `maps/` | One image per site for the GPS map, plus a `.json` with its corner bounds. See `maps/README.md`. |
| `styles/` | `tokens.css` holds every color, font size and spacing value by role. The other stylesheets only use those names. |
| `tiles/` | `registry.ts` (tile type → component per size), the tile bodies (`NumberTile`, `NumberChartTile`, `ChartTile`, `GpsTile`), `PickChannelTile`, `TileView` (works out the number, limits and "no data"), and `parts/` (`TileShell`, `LimitOutline`, `LimitBar`, `TileControls`, `Reading`, `RoundButton`; for the GPS tile `TrackMap` (the map: site image, trail, car), `GpsSettings` (the gear panel) and `PageHeader`). |
| `charts/` | `TimeSeriesChart.tsx` is the only ECharts wrapper; `chartOptions.ts` builds the options. |
| `header/` | `Header`, `Logo`, `Ridges`, `Pivot`, `StatusArea`, `ThemeIcon`, `EasterEgg`. |
| `grid/` | `TileGrid` (packing, drag-to-reorder, fullscreen overlay) and `AddSlot`. |
| `radio/` | `Radio` (the signal readout), `RadioPanel`, `CommandButton`, `DataTypePicker`, `sendCommand.ts`. |
| `hooks/` | `useStream` (the live data), `useLayouts` (saved tile orders), `useResize`; GPS: `useSite` (the site images in `maps/`), `useTrail` (trail length, clear trail), `useLapBox` (the lap box per site, sent to the car), and `persisted` (a small shared value saved in localStorage). |
| `lib/` | Plain logic with self-checks: `limitState.ts`, `layout.ts` (sizes, packer, validation), `axisRange.ts`, `headerFit.ts`, `systems.ts`, `stream.ts`, `format.ts`, `geo.ts` (lat/lon ↔ metres, fitting the map, run distance and speed), `lapBox.ts` (lap detection from the lap box, lap times), `dataSummary.ts`, `storage.ts`. |
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
- `size` is `small` (number), `medium` (number + chart) or `large` (chart).
- `channel` can be a list of two channels, for one chart with a y axis each.

The grid fills tiles in order, left to right, top to bottom, at any window width. A viewer who customized a preset keeps their own version, saved in their browser's localStorage (`tv2-layouts-v4`). Clearing the site data brings the default back; there's no reset button.

### Add a site map
Drop an image and a small `.json` with its corner lat/lon in `maps/`. `maps/README.md` has the format and where to get free imagery.

### Time laps (the lap box)
The car only sends lat/lon. Open the GPS tile fullscreen: the first time at a site it asks **set up a lap box?** (**not now** is remembered per site), or tap **lap box** in the app bar.
1. The box drops on the car (or in the middle of the view, if you've dragged the map) with the whole site in view, sized to be easy to grab at that zoom (140 px, `boxScreenPx` in `config/laps.ts`), which is a few hundred metres. Its label shows its real size. Zoom in on the start/finish, drag the box across it and shrink it from the corners, then **done**. **reset** puts it back on the car, sized for the current zoom. Corner handles show once the box is big enough on screen.
2. Every time the car drives into the box, a new lap starts. Entering again within 20 s doesn't count (`reentrySeconds`), so GPS wandering at the edge can't add laps.
3. **edit box** / **clear box** change it later. The box is saved per site in this browser.

**done** also sends the box to the car (`SET_LAP_BOX` in `config/radio.ts`, a placeholder ID until it's in the firmware's `Commands.h`). Until the car can report laps, this page detects them itself: `detectLap()` in `lib/lapBox.ts` is the one function to replace. Laps go into the run data as the `lap` series, so **export csv** in the radio panel includes them.

Fullscreen map: the mouse wheel or a trackpad pinch zooms toward the pointer, + − zoom in and out, dragging the map pans it, and **fit** goes back to showing everything. Zoomed in without dragging, it follows the car.

### Rename a preset or add a header control
Just do it. The header measures the logo, the preset names and the controls, and picks the richest layout that fits (five names centered, three centered, three next to the logo, or only the active name). There are no breakpoints to update.

### Change a color
- **Page, tiles, header, radio panel:** change the role in `styles/tokens.css`, for example `--alarm`, `--data-problem` or `--tile`. The light theme overrides some of them at the bottom of the file. The header ridges use `--ridge-back` / `--ridge-front` too.
- **Sizes that code also needs** (page gutter, grid gap, radio panel width, unit font): `config/theme.ts`. It hands them to CSS, so there's no second copy to keep in sync.
- **Chart lines, axes, ticks, tooltips:** these are drawn on a canvas, so they're in `CHART` in `config/theme.ts`.
- Red (`--alarm`) means the car has a problem, and blue (`--data-problem`) means the data has a problem. Don't use them for decoration.

### Add a tile type
1. Write the body component in `tiles/`. It receives `TileBodyProps` (`tiles/types.ts`): the tile, the stream, the time range, the channel and its current reading. Read units, limits and ranges from the channel, never hard-code them.
2. Register it in `tiles/registry.ts` under a new `kind` with the sizes it supports. The size switcher appears only for types with more than one size.
3. Add the new `kind` to the `Tile` type and to `validTiles()` in `lib/layout.ts`, so saved layouts with it are accepted.

## Self-checks
Run everything (the type check and every self-check) from `frontend/`:

```
npm run check
```

Or one at a time:

```
node --experimental-strip-types src/telemetry-v2/lib/layout.check.ts      # packer, presets, limits, saved-layout validation
node --experimental-strip-types src/telemetry-v2/lib/radio.check.ts       # radio config and sendCommand
node --experimental-strip-types src/telemetry-v2/lib/geo.check.ts         # lat/lon ↔ metres, map fitting, run distance with GPS jitter
node --experimental-strip-types src/telemetry-v2/lib/lapBox.check.ts      # 3 passes = 3 laps, edge jitter ≠ extra laps, laps in the CSV
node --experimental-strip-types src/telemetry-v2/lib/axisRange.check.ts   # round ticks, grow/shrink of chart ranges
node --experimental-strip-types src/telemetry-v2/lib/headerFit.check.ts   # which header layout fits
```

The checks need Node 22.6 or newer (`--experimental-strip-types`). The app itself builds and runs on Node 20.19+.

`lib/` and `config/` import each other with `.ts` extensions so these run in plain Node. Keep that when you add imports there.
