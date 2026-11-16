// The lap box (GPS fullscreen → lap box). Data only; the logic is in lib/lapBox.ts.
export const LAPS = {
  boxSizeM: { width: 20, height: 20 }, // a new box drops centered on the car at this size (east-west × north-south)
  reentrySeconds: 20, // after a lap starts, entering the box again this soon doesn't count (GPS jitter at its edge)
};
