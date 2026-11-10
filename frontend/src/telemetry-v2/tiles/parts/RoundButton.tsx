// thin-line glyphs for the round Metro buttons (12x12 grid)
const GLYPHS = {
  size: "M7 5l3-3M7.5 2H10v2.5M5 7l-3 3M2 7.5V10h2.5", // diagonal arrows: next size
  fullscreen: "M2 4.5V2h2.5M7.5 2H10v2.5M10 7.5V10H7.5M4.5 10H2V7.5", // corners out
  exitFullscreen: "M4.5 2v2.5H2M10 4.5H7.5V2M7.5 10V7.5H10M2 7.5h2.5V10", // corners in
  delete: "M3.5 3.5l5 5m0-5-5 5",
};

export default function RoundButton({ glyph, label, onClick }: { glyph: keyof typeof GLYPHS; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} aria-label={label} title={label}>
      <svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="square">
        <path d={GLYPHS[glyph]} />
      </svg>
    </button>
  );
}
