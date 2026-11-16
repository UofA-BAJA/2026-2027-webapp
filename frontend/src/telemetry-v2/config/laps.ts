// The lap box (GPS fullscreen → lap box). Data only; the logic is in lib/lapBox.ts.
export const LAPS = {
  // a new box drops centered on the car at this size (east-west × north-south); big enough to grab once zoomed in a
  // little, small enough not to catch the course passing nearby
  boxSizeM: { width: 50, height: 50 },
  reentrySeconds: 20, // after a lap starts, entering the box again this soon doesn't count (GPS jitter at its edge)
};
