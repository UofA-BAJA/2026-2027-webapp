// Y axis ranges with round tick values, and auto ranges that don't jump around.

export type Scale = { min: number; max: number; step: number }; // ticks at min, min + step, ... max

const NICE = [1, 2, 2.5, 5];

// Round ticks covering [lo, hi]: the step is 1, 2, 2.5 or 5 × 10ⁿ, the tick count is within one of `ticks`,
// and the range is stretched as little as possible to land on round values.
export function niceScale(lo: number, hi: number, ticks: number): Scale {
  if (!(hi > lo)) {
    const pad = Math.max(Math.abs(lo) * 0.1, 1); // flat line: give it some room
    lo -= pad;
    hi += pad;
  }
  let best: (Scale & { cost: number }) | undefined;
  const p0 = Math.floor(Math.log10((hi - lo) / ticks)) - 1;
  for (let p = p0; p <= p0 + 3; p++)
    for (const n of NICE) {
      const step = n * 10 ** p;
      const min = Math.floor(lo / step + 1e-9) * step;
      const max = Math.ceil(hi / step - 1e-9) * step;
      const count = Math.round((max - min) / step) + 1;
      if (Math.abs(count - ticks) > 1) continue;
      // least stretch first, then the tick count closest to the target
      const cost = (max - min - (hi - lo)) / (hi - lo) + Math.abs(count - ticks) * 0.01;
      if (!best || cost < best.cost) best = { min: clean(min), max: clean(max), step: clean(step), cost };
    }
  return { min: best!.min, max: best!.max, step: best!.step };
}

// float noise from the multiplications above (0.30000000000000004 → 0.3)
const clean = (v: number) => +v.toPrecision(12);

export type Sticky = { scale: Scale; shrinkSince?: number };

// The range to show for data in [lo, hi]. It grows at once when the data leaves it and shrinks only after the data
// has fit a smaller range for `holdMs`. `floor` (a channel's fixed axis.min/max) is the smallest range ever shown.
export function stickyRange(prev: Sticky | undefined, lo: number, hi: number, ticks: number, now: number, holdMs: number, floor?: { min: number; max: number }): Sticky {
  if (floor) {
    lo = Math.min(lo, floor.min);
    hi = Math.max(hi, floor.max);
  }
  const want = niceScale(lo, hi, ticks);
  if (!prev || want.min < prev.scale.min || want.max > prev.scale.max)
    return { scale: niceScale(Math.min(lo, prev?.scale.min ?? lo), Math.max(hi, prev?.scale.max ?? hi), ticks) }; // grow now
  if (want.min === prev.scale.min && want.max === prev.scale.max) return { scale: prev.scale }; // fits: stay
  const since = prev.shrinkSince ?? now;
  return now - since >= holdMs ? { scale: want } : { scale: prev.scale, shrinkSince: since }; // shrink after holding
}
