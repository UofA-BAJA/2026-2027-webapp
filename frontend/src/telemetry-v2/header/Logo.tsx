import { useRef } from "react";
import cactus from "../assets/baja-cactus-white.png";
import wordmark from "../assets/baja-wordmark-white.png";
import { EASTER_EGG_HOLD_MS, LOGO_SWAP_BELOW } from "../config/theme";

// The team wordmark, or just the cactus on narrow windows so it doesn't run into the pivot.
// Holding it plays the easter egg (onHold).
export default function Logo({ onHold }: { onHold: () => void }) {
  const timer = useRef<number>(undefined);
  const press = () => (timer.current = window.setTimeout(onHold, EASTER_EGG_HOLD_MS));
  const release = () => window.clearTimeout(timer.current);
  return (
    <picture
      onPointerDown={press}
      onPointerUp={release}
      onPointerLeave={release}
      onPointerCancel={release}
      onContextMenu={(e) => e.preventDefault()} // a long press on touch would open the image menu
    >
      <source media={`(width < ${LOGO_SWAP_BELOW}px)`} srcSet={cactus} />
      <img className="tv2-logo" src={wordmark} alt="Baja Wildcat Racing" draggable={false} />
    </picture>
  );
}
