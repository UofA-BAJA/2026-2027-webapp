import { DATA_TYPES } from "../config/radio";
import { dataSummary } from "../lib/dataSummary";

// "data from car": a dropdown that shows a summary when closed and a 2-column checkbox list when open.
type Props = { types: number[]; setTypes: (t: number[]) => void; open: boolean; setOpen: (o: boolean) => void };

export default function DataTypePicker({ types, setTypes, open, setOpen }: Props) {
  return (
    <>
      <button className="tv2-rp-select" aria-expanded={open} onClick={() => setOpen(!open)}>
        {dataSummary(types)}
        <span aria-hidden>{open ? "▴" : "▾"}</span>
      </button>
      {open && (
        <div className="tv2-rp-types">
          <div className="tv2-rp-checks">
            {DATA_TYPES.map((d) => (
              <label key={d.code}>
                <input
                  type="checkbox"
                  checked={types.includes(d.code)}
                  onChange={(e) => setTypes(e.target.checked ? [...types, d.code] : types.filter((c) => c !== d.code))}
                />
                {d.name}
              </label>
            ))}
          </div>
          <div className="tv2-rp-row">
            <button className="tv2-rp-btn" onClick={() => setTypes(DATA_TYPES.map((d) => d.code))}>select all</button>
            <button className="tv2-rp-btn" onClick={() => setTypes([])}>select none</button>
          </div>
        </div>
      )}
    </>
  );
}
