import video from "../assets/easteregg.mp4";

// With sound if the browser allows it; muted if it blocks sound (no interaction with the page yet).
// Module-level so the ref is stable: an inline ref would re-run play() on every 10 Hz render.
function playWithFallback(v: HTMLVideoElement | null) {
  v?.play().catch(() => {
    v.muted = true;
    v.play().catch(() => {});
  });
}

// The video behind the long-pressed logo, over everything. A click, Esc or the end closes it.
export default function EasterEgg({ onClose }: { onClose: () => void }) {
  return (
    <div className="tv2-egg" onClick={onClose} role="dialog" aria-label="video">
      <video src={video} playsInline onEnded={onClose} ref={playWithFallback} />
    </div>
  );
}
