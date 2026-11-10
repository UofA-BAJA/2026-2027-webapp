import type { Channel, ChannelId } from "../config/channels";
import type { Tile } from "../lib/layout";
import type { LimitState } from "../lib/limitState";
import type { Reading, Stream } from "../lib/stream";

// What a tile can ask the grid to do.
export type TileActions = {
  customizing: boolean;
  full?: boolean; // this is the fullscreen overlay copy; a view only, the layout never changes
  onResize: () => void;
  onFull: (on: boolean) => void;
  onDelete: () => void;
  onChannel: (c: ChannelId) => void;
  onPick: (p: string) => void;
};

// What every tile body (NumberTile, ChartTile, ...) gets.
export type TileBodyProps = {
  tile: Tile;
  s: Stream;
  range: [number, number];
  a: TileActions;
  ch: Channel; // the tile's first channel
  r: Reading; // its current number
  stale: boolean; // no data for 3+ s
  lim?: LimitState;
};
