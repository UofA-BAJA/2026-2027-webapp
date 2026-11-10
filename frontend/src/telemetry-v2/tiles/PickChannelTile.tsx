import { CHANNELS, SYSTEMS } from "../config/channels";
import type { Tile } from "../lib/layout";
import TileControls from "./parts/TileControls";
import type { TileActions } from "./types";

// A tile just added in customize mode: it asks which channel to show, grouped by car system.
export default function PickChannelTile({ tile, a, delay }: { tile: Tile; a: TileActions; delay: number }) {
  return (
    <div className="tv2-tile tv2-in tv2-unpicked" style={{ animationDelay: `${delay}ms` }}>
      <div className="tv2-tile-head">
        <div className="tv2-label">pick a channel</div>
        <TileControls tile={tile} a={a} />
      </div>
      <div className="tv2-add-pick">
        {SYSTEMS.map((sys) => (
          <section key={sys.name} className="tv2-system">
            <h3>{sys.name}</h3>
            {sys.channels.map((c) => (
              <button key={c} onClick={() => a.onChannel(c)}>{CHANNELS[c].label}</button>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
