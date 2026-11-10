// The empty "+ add tile" slot at the end of the grid in customize mode.
export default function AddSlot({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="tv2-add tv2-in">
      <div className="tv2-add-grid" aria-hidden />
      <button className="tv2-add-btn" onClick={onAdd}>+ add tile</button>
    </div>
  );
}
