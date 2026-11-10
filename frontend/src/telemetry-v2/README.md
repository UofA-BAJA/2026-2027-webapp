# /telemetry-v2

The live telemetry dashboard. Run it without Docker from the repo root with `./start.sh` (UI on http://localhost:5173/telemetry-v2, mock data on :8000) and stop it with `./stop.sh`.

Most changes are **data changes in `config/`**. You shouldn't need to read component code to change a redline, a range, a color or a preset.

## Where things live

| Folder | What's in it |
|---|---|
| `config/` | Data people change: `channels.ts` (every channel, its units, limits and ranges), `presets.ts` (the tile layouts), `radio.ts` (frequencies, data types, command IDs), `theme.ts` (chart colors and a few sizes code needs). No JSX, no logic. |
| `styles/` | `tokens.css` holds every color, font size and spacing value by role. The other stylesheets only use those names. |
| `tiles/` | `registry.ts` (tile type → component per size), the tile bodies (`NumberTile`, `NumberChartTile`, `ChartTile`, `GpsTile`), `PickChannelTile`, `TileView` (works out the number, limits and "no data"), and `parts/` (`TileShell`, `LimitOutline`, `LimitBar`, `TileControls`, `Reading`, `RoundButton`). |
| `charts/` | `TimeSeriesChart.tsx` is the only ECharts wrapper; `chartOptions.ts` builds the options. |
| `header/` | `Header`, `Logo`, `Ridges`, `Pivot`, `StatusArea`, `ThemeIcon`, `EasterEgg`. |
| `grid/` | `TileGrid` (packing, drag-to-reorder, fullscreen overlay) and `AddSlot`. |
| `radio/` | `Radio` (the signal readout), `RadioPanel`, `CommandButton`, `DataTypePicker`, `sendCommand.ts`. |
| `hooks/` | `useStream` (the live data), `useLayouts` (saved tile orders), `useResize`. |
| `lib/` | Plain logic with self-checks: `limitState.ts`, `layout.ts` (sizes, packer, validation), `stream.ts`, `format.ts`, `map.ts`, `dataSummary.ts`, `storage.ts`. |
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
2. Add its id to exactly one group in `SYSTEMS` (same file), so it shows in the "pick a channel" list.
3. Run the self-check (below). It fails if a channel is missing from `SYSTEMS` or a preset names an unknown channel.

### Add or reorder a preset
Edit `PRESETS` in `config/presets.ts`. Each preset is an ordered list of `{ channel, size }`:
- `size` is `small` (number), `medium` (number + chart) or `large` (chart). `track` is large only.
- `channel` can be a list of two channels, for one chart with a y axis each.

The grid fills tiles in order, left to right, top to bottom, at any window width. A viewer who customized a preset keeps their own version, saved in their browser's localStorage (`tv2-layouts-v4`). Clearing the site data brings the default back; there's no reset button.

### Change a color
- **Page, tiles, header, radio panel:** change the role in `styles/tokens.css`, for example `--alarm`, `--data-problem` or `--tile`. The light theme overrides some of them at the bottom of the file.
- **Chart lines, axes, ticks, tooltips:** these are drawn on a canvas, so they're in `CHART` in `config/theme.ts`.
- Red (`--alarm`) means the car has a problem, and blue (`--data-problem`) means the data has a problem. Don't use them for decoration.

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
```

`lib/` and `config/` import each other with `.ts` extensions so these run in plain Node. Keep that when you add imports there.
