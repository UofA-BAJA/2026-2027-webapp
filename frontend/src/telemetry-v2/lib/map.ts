// GPS track -> screen pixels for the map tile: local metres (equal aspect), fitted to the box with padding.
export type Pt = [number, number];

const M_PER_DEG_LAT = 110540;
const M_PER_DEG_LON_AT_EQUATOR = 111320;

/** [lat, lon] points -> pixel points inside a w x h box (y down), and the pixels-per-metre scale. */
export function fitTrack(ll: Pt[], w: number, h: number, pad = 0.1) {
  const [lat0, lon0] = ll[0];
  // a degree of longitude shrinks by cos(latitude); scaling by it keeps east-west and north-south distances equal
  const kx = M_PER_DEG_LON_AT_EQUATOR * Math.cos((lat0 * Math.PI) / 180);
  const m = ll.map(([la, lo]): Pt => [(lo - lon0) * kx, (la - lat0) * M_PER_DEG_LAT]);
  let [minX, maxX, minY, maxY] = [Infinity, -Infinity, Infinity, -Infinity];
  for (const [x, y] of m) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  // 1 m floor so a parked car (all points equal) doesn't divide by zero
  const k = Math.min((w * (1 - 2 * pad)) / Math.max(maxX - minX, 1), (h * (1 - 2 * pad)) / Math.max(maxY - minY, 1));
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  return { px: m.map(([x, y]): Pt => [w / 2 + (x - cx) * k, h / 2 - (y - cy) * k]), pxPerM: k };
}

/** A round scale-bar length (1, 2 or 5 x 10^n metres) at most `target` px long. */
export function scaleBar(pxPerM: number, target = 80) {
  const raw = target / pxPerM;
  const p = 10 ** Math.floor(Math.log10(raw));
  const m = [5, 2, 1].map((f) => f * p).find((v) => v <= raw)!;
  return { px: m * pxPerM, label: m >= 1000 ? `${+(m / 1000).toFixed(3)} km` : `${+m.toFixed(3)} m` };
}
