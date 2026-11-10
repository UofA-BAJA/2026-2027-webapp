import Reading from "./parts/Reading";
import type { TileBodyProps } from "./types";

// small (1×1): the number only
export default function NumberTile({ ch, r, stale }: TileBodyProps) {
  return <Reading ch={ch} r={r} stale={stale} />;
}
