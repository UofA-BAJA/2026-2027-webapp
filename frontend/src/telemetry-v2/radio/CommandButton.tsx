// A 72px command button: lowercase label, then a small caps line with the firmware code and what it does.
export default function CommandButton({ label, code, effect, disabled, onClick }: { label: string; code: number; effect: string; disabled: boolean; onClick: () => unknown }) {
  return (
    <button className="tv2-rp-cmd" disabled={disabled} onClick={onClick}>
      <span>{label}</span>
      <small>{code} · {effect}</small>
    </button>
  );
}
