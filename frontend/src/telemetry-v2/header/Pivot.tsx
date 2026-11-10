import { PRESETS } from "../config/presets";

const N = PRESETS.length;

// The preset names: the active one big in the middle, two neighbours each side (wrapping around).
// It slides in from the side it came from (dir).
export default function Pivot({ active, dir, go }: { active: number; dir: 1 | -1; go: (step: number) => void }) {
  return (
    <nav key={active} className={`tv2-pivot ${dir > 0 ? "fwd" : "back"}`}>
      {[-2, -1, 0, 1, 2].map((d) => (
        <button
          key={d}
          className={`tv2-name ${d === 0 ? "active" : Math.abs(d) === 1 ? "near" : "far"}`}
          onClick={() => d && go(d)}
          aria-current={d === 0}
        >
          {PRESETS[(active + d + N * 2) % N].name}
        </button>
      ))}
    </nav>
  );
}
