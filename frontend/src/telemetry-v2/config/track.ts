// The track: start/finish and the split lines that cut a lap into segments (S1 = start/finish → first split, ...,
// the last segment = last split → start/finish). Data only; the logic is in lib/laps.ts.
// Each line is two [latitude, longitude] points, one either side of the track; the car crosses between them.
// See README.md ("Set the start/finish and split lines") for how to measure them.

export type LatLon = [number, number];
export type Gate = { a: LatLon; b: LatLon };

export const TRACK: { startFinish: Gate; splits: Gate[]; minLapSeconds: number } = {
  // TODO: temporary values for the mock server's loop (tools/mock_server.py); measure the real course
  startFinish: { a: [32.474571, -111.296433], b: [32.474429, -111.296567] },
  // TODO: temporary values for the mock loop, at 1/4, 1/2 and 3/4 of a lap
  splits: [
    { a: [32.470874, -111.294721], b: [32.470987, -111.294887] },
    { a: [32.46991, -111.298859], b: [32.470082, -111.298794] },
    { a: [32.47156, -111.301033], b: [32.471428, -111.300889] },
  ],
  // a start/finish crossing sooner than this after the last one is ignored (GPS jitter while stopped on the line)
  minLapSeconds: 20,
};
