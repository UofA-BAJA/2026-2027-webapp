import { useState, type RefObject } from "react";
import ReactGridLayout, { useContainerWidth, verticalCompactor, type Layout } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import { GRID } from "../config/theme";
import { SIZES, colsFor, dropOrder, pack, sizeIndex, type PlacedTile } from "../lib/layout";
import type { Stream } from "../lib/stream";
import TileView from "../tiles/TileView";
import type { TileActions } from "../tiles/types";
import AddSlot from "./AddSlot";

type Props = {
  presetName: string;
  tiles: PlacedTile[];
  setTiles: (t: PlacedTile[]) => void;
  customizing: boolean;
  s: Stream;
  range: [number, number];
  fullId?: string; // tile shown fullscreen over the grid
  setFullId: (id?: string) => void;
  onWheel: (e: React.WheelEvent) => void;
};

// The tile grid: pack() places the ordered tiles for the current column count; react-grid-layout only draws them
// and handles dragging. Fullscreen is an overlay on top and never touches the layout.
export default function TileGrid({ presetName, tiles, setTiles, customizing, s, range, fullId, setFullId, onWheel }: Props) {
  const [justAdded, setJustAdded] = useState<string>();
  const { width, containerRef, mounted } = useContainerWidth();
  const cols = colsFor(width);
  const col = (width - 2 * GRID.pad - (cols - 1) * GRID.gap) / cols; // row height = column width
  // the "+ add tile" slot packs last, after every tile
  const placed = pack([...tiles, ...(customizing ? [{ id: "add", w: 1, h: 1 }] : [])], cols);

  // "+ add tile" drops a small, empty tile into the slot; the tile then asks for its channel
  const addTile = () => {
    const t: PlacedTile = { kind: "channel", channels: [], w: 1, h: 1, id: String(Date.now()) };
    setTiles([...tiles, t]);
    setJustAdded(t.id);
  };
  const update = (id: string, f: (t: PlacedTile) => PlacedTile) => setTiles(tiles.map((t) => (t.id === id ? f(t) : t)));
  const resize = (id: string) => update(id, (t) => ({ ...t, ...SIZES[(sizeIndex(t) + 1) % SIZES.length] }));
  // the drop cell comes from where the tile was let go (RGL's own item is already compacted)
  const onDragStop = (_l: Layout, _old: unknown, item: { i: string } | null, _p: unknown, _e: unknown, el: HTMLElement | null) => {
    const moved = tiles.find((t) => t.id === item?.i);
    const grid = containerRef.current?.getBoundingClientRect();
    if (!moved || !el || !grid) return;
    const r = el.getBoundingClientRect();
    const drop = {
      x: Math.round((r.left - grid.left - GRID.pad) / (col + GRID.gap)),
      y: Math.round((r.top - grid.top - GRID.pad) / (col + GRID.gap)),
    };
    setTiles(dropOrder(tiles, moved, drop, cols, new Map(placed.map((p) => [p.id, p]))));
  };
  const gridLayout: Layout = placed.map((t) => ({ i: t.id, x: t.x, y: t.y, w: t.w, h: t.h, ...(t.id === "add" && { isDraggable: false }) }));
  const fullTile = tiles.find((t) => t.id === fullId);
  const actions = (t: PlacedTile): TileActions => ({
    customizing,
    onResize: () => resize(t.id),
    onFull: (on) => setFullId(on ? t.id : undefined),
    onDelete: () => setTiles(tiles.filter((x) => x.id !== t.id)),
    // the GPS track is its own kind (the map with lap timing)
    onChannel: (c) => update(t.id, (x) => ({ ...x, kind: c === "track" ? "xy" : "channel", channels: [c] })),
    onPick: (p) => update(t.id, (x) => ({ ...x, pick: p })),
  });

  return (
    <main ref={containerRef as RefObject<HTMLElement>} className={`tv2-grid${customizing ? " tv2-editing" : ""}`} onWheel={onWheel}>
      {mounted && (
        <ReactGridLayout
          key={presetName}
          layout={gridLayout}
          width={width}
          gridConfig={{ cols: cols, rowHeight: col, margin: [GRID.gap, GRID.gap], containerPadding: [GRID.pad, GRID.pad] }}
          dragConfig={{ enabled: customizing, cancel: "button, select" }}
          resizeConfig={{ enabled: false }}
          // positions come from pack(); vertical compaction, no collision blocking and no overlap, so RGL never refuses them
          compactor={verticalCompactor}
          onDragStop={onDragStop}
        >
          {tiles.map((t, i) => (
            <div key={t.id}>
              <TileView tile={t} s={s} range={range} a={actions(t)} delay={t.id === justAdded ? 0 : Math.min(i * 35, 300)} />
            </div>
          ))}
          {customizing && (
            <div key="add">
              <AddSlot onAdd={addTile} />
            </div>
          )}
        </ReactGridLayout>
      )}
      {fullTile && (
        // covers the grid; react-grid-layout stays mounted underneath and is never touched
        <div className="tv2-view">
          <TileView key={fullTile.id} tile={{ ...fullTile, w: 2, h: 2 }} s={s} range={range} a={{ ...actions(fullTile), customizing: false, full: true }} delay={0} />
        </div>
      )}
    </main>
  );
}
