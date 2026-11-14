# /telemetry-v2

The live telemetry dashboard. Run it without Docker from the repo root with `./start.sh` (UI on http://localhost:5173/telemetry-v2, mock data on :8000) and stop it with `./stop.sh`.

Most changes are **data changes in `config/`**. You shouldn't need to read component code to change a redline, a range, a color or a preset.

## Where things live

| Folder | What's in it |
|---|---|
| `config/` | Data people change: `channels.ts` (every channel, its units, limits and ranges), `presets.ts` (the tile layouts), `radio.ts` (frequencies, data types, command IDs), `theme.ts` (chart colors and a few sizes code needs), `track.ts` (start/finish and split lines for lap timing). No JSX, no logic. |
| `styles/` | `tokens.css` holds every color, font size and spacing value by role. The other stylesheets only use those names. |
| `tiles/` | `registry.ts` (tile type → component per size), the tile bodies (`NumberTile`, `NumberChartTile`, `ChartTile`, `GpsTile`), `PickChannelTile`, `TileView` (works out the number, limits and "no data"), and `parts/` (`TileShell`, `LimitOutline`, `LimitBar`, `TileControls`, `Reading`, `RoundButton`). |
| `charts/` | `TimeSeriesChart.tsx` is the only ECharts wrapper; `chartOptions.ts` builds the options. |
| `header/` | `Header`, `Logo`, `Ridges`, `Pivot`, `StatusArea`, `ThemeIcon`, `EasterEgg`. |
| `grid/` | `TileGrid` (packing, drag-to-reorder, fullscreen overlay) and `AddSlot`. |
| `radio/` | `Radio` (the signal readout), `RadioPanel`, `CommandButton`, `DataTypePicker`, `sendCommand.ts`. |
| `hooks/` | `useStream` (the live data), `useLayouts` (saved tile orders), `useResize`. |
| `lib/` | Plain logic with self-checks: `limitState.ts`, `layout.ts` (sizes, packer, validation), `axisRange.ts`, `headerFit.ts`, `systems.ts`, `stream.ts`, `format.ts`, `map.ts`, `laps.ts` (lap and split timing, time colors), `dataSummary.ts`, `storage.ts`. |
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

### Set the start/finish and split lines
Lap timing (the `track` tile) needs the lines in `config/track.ts`. The values there now are temporary and fit the mock server's loop, so replace them before timing the real car.
1. Pick where each line goes: start/finish, then the splits in driving order. Three splits give S1–S4. Choose places the car always passes and no other part of the course runs within ~10 m of.
2. At each one, take a GPS reading (a phone's map app works; 6 decimals) at the left edge of the course and another at the right edge, straight across. Those are `a` and `b`, as `[latitude, longitude]`. Make the line a bit wider than the course so a wide line still crosses it.
3. Drive a lap with the dashboard open: S1, S2, ... should fill in on the `track` tile, and its ticks should sit across the track. The first start/finish crossing sets the driving direction; crossing it the other way never counts.
4. `minLapSeconds`: a start/finish crossing sooner than this after the last one is ignored, so sitting on the line with a jittery GPS doesn't make laps. Keep it below your fastest possible lap.

A missed split (the car went wide of the line, or GPS dropped out) leaves those two segments blank for that lap; the lap time still counts. Averages are over completed laps, and the out lap before the first start/finish crossing isn't timed.

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
Run from `frontend/`:

```
node --experimental-strip-types src/telemetry-v2/lib/layout.check.ts   # packer, presets, limits, saved-layout validation
node --experimental-strip-types src/telemetry-v2/lib/radio.check.ts    # radio config and sendCommand
node --experimental-strip-types src/telemetry-v2/lib/map.check.ts      # GPS track maths
node --experimental-strip-types src/telemetry-v2/lib/laps.check.ts     # lap and split detection on a synthetic trace, time colors
node --experimental-strip-types src/telemetry-v2/lib/axisRange.check.ts   # round ticks, grow/shrink of chart ranges
node --experimental-strip-types src/telemetry-v2/lib/headerFit.check.ts   # which header layout fits
```

`lib/` and `config/` import each other with `.ts` extensions so these run in plain Node. Keep that when you add imports there.
