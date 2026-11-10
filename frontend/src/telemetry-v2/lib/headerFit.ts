// Which header layout fits, from measured widths: the richest one that leaves `gap` between logo, pivot and controls.
//   center5: five preset names, centered    center3: three names, centered
//   left3:   three names next to the logo   left1:   only the active name, next to the logo
export type Fit = "center5" | "center3" | "left3" | "left1";
export const FITS: Fit[] = ["center5", "center3", "left3", "left1"]; // richest first

export type Widths = {
  inner: number; // header width inside its padding
  logo: number;
  controls: number; // the status area on the right
  gap: number; // the least space between logo, pivot and controls
  nameGap: number; // space between preset names
  names: number[]; // the five names, outer-left to outer-right; [2] is the active one
};

// px of extra room needed before switching to a richer layout (on each side, for a centered one), so a value that changes width
// (the dBm reading) can't make the header flip back and forth
export const HYSTERESIS = 24;

export function chooseFit(m: Widths, prev?: Fit): Fit {
  const [farL, nearL, active, nearR, farR] = m.names;
  const pivot = { 5: farL + nearL + active + nearR + farR + 4 * m.nameGap, 3: nearL + active + nearR + 2 * m.nameGap, 1: active };
  const fits = (f: Fit, extra: number) => {
    const p = pivot[f === "center5" ? 5 : f === "left1" ? 1 : 3];
    return f.startsWith("center")
      ? (m.inner - p) / 2 >= Math.max(m.logo, m.controls) + m.gap + extra // centered: each side must hold the wider of logo and controls
      : m.logo + m.gap + p + m.gap + m.controls + extra <= m.inner;
  };
  const prevAt = prev ? FITS.indexOf(prev) : -1; // no current layout yet (first measure): nothing needs extra room
  // a layout richer than the current one needs the extra room; the current one or poorer just has to fit
  return FITS.find((f, i) => fits(f, i < prevAt ? HYSTERESIS : 0)) ?? "left1";
}
