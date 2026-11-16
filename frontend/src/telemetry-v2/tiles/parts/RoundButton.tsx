// thin-line glyphs for the round Metro buttons (12x12 grid)
const GLYPHS = {
  size: "M7 5l3-3M7.5 2H10v2.5M5 7l-3 3M2 7.5V10h2.5", // diagonal arrows: next size
  fullscreen: "M2 4.5V2h2.5M7.5 2H10v2.5M10 7.5V10H7.5M4.5 10H2V7.5", // corners out
  exitFullscreen: "M4.5 2v2.5H2M10 4.5H7.5V2M7.5 10V7.5H10M2 7.5h2.5V10", // corners in
  delete: "M3.5 3.5l5 5m0-5-5 5",
  // settings: a hollow ring (r 3.2) and 8 square teeth from r 4.1 to 5.2
  lapBox: "M2 2h8v8H2zM2 6l4-4M2 10l8-8M6 10l4-4", // a hatched square
  edit: "M2 10l.8-2.6L8 2.2 9.8 4 4.6 9.2zM7 3.2 8.8 5", // a pencil
  check: "M2.2 6.4 4.8 9 9.8 3.2",
  gear: "M9.2 6a3.2 3.2 0 1 1-6.4 0a3.2 3.2 0 1 1 6.4 0M10.1 6h1.1M8.9 8.9l.78.78M6 10.1v1.1M3.1 8.9l-.78.78M1.9 6H.8M3.1 3.1l-.78-.78M6 1.9V.8M8.9 3.1l.78-.78",
};

export function Glyph({ glyph, size = 12 }: { glyph: keyof typeof GLYPHS; size?: number }) {
  return (
    <svg viewBox="0 0 12 12" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="square" aria-hidden="true">
      <path d={GLYPHS[glyph]} />
    </svg>
  );
}

type Props = { glyph: keyof typeof GLYPHS; label: string; onClick: () => void; expanded?: boolean };
export default function RoundButton({ glyph, label, onClick, expanded }: Props) {
  return (
    <button onClick={onClick} aria-label={label} title={label} aria-expanded={expanded}>
      <Glyph glyph={glyph} />
    </button>
  );
}
