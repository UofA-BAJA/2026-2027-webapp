import { SIZES, sizeIndex, type Tile } from "../../lib/layout";
import { TILE_TYPES } from "../registry";
import type { TileActions } from "../types";
import RoundButton from "./RoundButton";

// customize: delete only (tiles move by dragging); normal: size switcher + fullscreen (+ settings, rightmost, for tiles
// that have them); overlay: exit fullscreen only
type Props = { tile: Tile; a: TileActions; onSettings?: () => void; settingsOpen?: boolean };
export default function TileControls({ tile, a, onSettings, settingsOpen }: Props) {
  const size = sizeIndex(tile);
  const canResize = TILE_TYPES[tile.kind].sizes.length > 1;
  return (
    <div className="tv2-controls">
      {a.full ? (
        <RoundButton glyph="exitFullscreen" label="Exit fullscreen" onClick={() => a.onFull(false)} />
      ) : a.customizing ? (
        <RoundButton glyph="delete" label="Delete" onClick={a.onDelete} />
      ) : (
        <>
          {canResize && <RoundButton glyph="size" label={`Change size (now: ${SIZES[size].name})`} onClick={a.onResize} />}
          <RoundButton glyph="fullscreen" label="Fullscreen" onClick={() => a.onFull(true)} />
          {onSettings && <RoundButton glyph="gear" label="Settings" onClick={onSettings} expanded={!!settingsOpen} />}
        </>
      )}
    </div>
  );
}
