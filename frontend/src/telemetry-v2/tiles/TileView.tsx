import { CHANNELS, type Channel } from "../config/channels";
import { STALE_MS } from "../config/radio";
import { mss } from "../lib/format";
import { SIZES, sizeIndex, type Tile } from "../lib/layout";
import { channelLimit, limitState } from "../lib/limitState";
import { reading, type Stream } from "../lib/stream";
import PickChannelTile from "./PickChannelTile";
import TileShell from "./parts/TileShell";
import { TILE_TYPES } from "./registry";
import type { TileActions } from "./types";

// One tile: works out its number, "no data" and limit state, then draws the body for its type and size.
export default function TileView({ tile, s, range, delay, a }: { tile: Tile; s: Stream; range: [number, number]; delay: number; a: TileActions }) {
  const chs: Channel[] = tile.channels.map((c) => CHANNELS[c]);
  const ch = chs[0];
  if (!ch) return <PickChannelTile tile={tile} a={a} delay={delay} />; // just added: no channel yet

  const type = TILE_TYPES[tile.kind];
  const size = type.sizes.length === 1 ? type.sizes[0] : SIZES[sizeIndex(tile)].name;
  const Body = type.views[size]!;
  const r = reading(ch, tile.pick, s);
  // no data (a DATA problem, blue): none of the tile's keys arrived in the last 3 s
  const seen = Math.max(0, ...chs.flatMap((c) => c.keys.map((k) => s.at[k] ?? 0)));
  const stale = Date.now() - (seen || s.startedAt) >= STALE_MS;
  // past a limit (a CAR problem, red); a stale value says nothing about the car
  const limit = channelLimit(ch);
  const lim = limit && !stale ? limitState(r.v, limit) : undefined;
  const status = stale
    ? `no data ${mss(Date.now() - (seen || s.startedAt))}`
    : lim?.state === "over" ? "OVER LIMIT" : lim?.state === "warn" ? (lim.meter >= 60 ? "near limit" : "warming") : "";

  return (
    <TileShell tile={tile} a={a} size={size} chs={chs} readingLabel={r.label} limit={limit} lim={lim} stale={stale} status={status} delay={delay}>
      <Body tile={tile} s={s} range={range} a={a} ch={ch} r={r} stale={stale} lim={lim} />
    </TileShell>
  );
}
