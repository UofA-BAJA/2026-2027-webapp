import { useEffect, useRef } from "react";

// Calls fn with the element's content size now and whenever it changes (first layout, fullscreen, size switch, window resize).
export function useResize(fn: (w: number, h: number) => void) {
  const ref = useRef<HTMLDivElement>(null);
  const cb = useRef(fn);
  cb.current = fn;
  useEffect(() => {
    const ro = new ResizeObserver(([e]) => cb.current(e.contentRect.width, e.contentRect.height));
    ro.observe(ref.current!);
    return () => ro.disconnect();
  }, []);
  return ref;
}
