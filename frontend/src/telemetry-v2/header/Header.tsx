import { useLayoutEffect, useRef, useState } from "react";
import { chooseFit, type Fit } from "../lib/headerFit";
import Logo from "./Logo";
import Pivot from "./Pivot";
import Ridges from "./Ridges";
import StatusArea from "./StatusArea";

type Props = React.ComponentProps<typeof StatusArea> & React.ComponentProps<typeof Pivot> & { onLogoHold: () => void };

// The red header: logo, ridges, preset pivot and the status area. Sticky at the top of the page.
// It measures itself (logo, each preset name, the controls) and picks the richest layout that fits (lib/headerFit.ts),
// so renaming a preset or adding a control needs no breakpoints.
export default function Header({ onLogoHold, active, dir, go, ...status }: Props) {
  const ref = useRef<HTMLElement>(null);
  const [fit, setFit] = useState<Fit>();
  // every render (the page re-renders at 10 Hz, so a resize is picked up within 0.1 s), before the browser paints
  useLayoutEffect(() => {
    const h = ref.current!;
    const cs = getComputedStyle(h);
    const nav = h.querySelector(".tv2-pivot")!;
    const width = (sel: string) => h.querySelector(sel)!.getBoundingClientRect().width;
    const next = chooseFit(
      {
        inner: h.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight),
        logo: width("picture"),
        controls: width(".tv2-right"),
        gap: parseFloat(cs.columnGap),
        nameGap: parseFloat(getComputedStyle(nav).columnGap),
        names: [...nav.children].map((b) => b.getBoundingClientRect().width), // hidden names are still measurable
      },
      fit,
    );
    if (next !== fit) setFit(next);
  });
  return (
    <header ref={ref} className="tv2-top" data-fit={fit ?? "left1"}>
      <Logo onHold={onLogoHold} />
      <Ridges />
      <Pivot active={active} dir={dir} go={go} />
      <StatusArea {...status} />
    </header>
  );
}
