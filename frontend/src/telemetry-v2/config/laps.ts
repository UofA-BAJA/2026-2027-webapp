// The lap box (GPS fullscreen → lap box). Data only; the logic is in lib/lapBox.ts.
export const LAPS = {
  // a new box is this many px across on screen at the zoom it drops into, so it's always big enough to grab. Placing
  // starts from the whole site, where that's a few hundred metres: zoom in and shrink it onto the start/finish.
  boxScreenPx: 140,
  reentrySeconds: 20, // after a lap starts, entering the box again this soon doesn't count (GPS jitter at its edge)
};
