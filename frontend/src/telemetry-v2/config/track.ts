// The track: start/finish and the split lines that cut a lap into segments (S1 = start/finish → first split, ...,
// the last segment = last split → start/finish). Data only; the logic is in lib/laps.ts.
// Each line is two [latitude, longitude] points, one either side of the track; the car crosses between them.
// See README.md ("Set the start/finish and split lines") for how to measure them.

export type LatLon = [number, number];
export type Gate = { a: LatLon; b: LatLon };

export const TRACK: { startFinish: Gate; splits: Gate[]; minLapSeconds: number } = {
  // TODO: temporary values for the mock server's loop (tools/mock_server.py); measure the real course
  startFinish: { a: [31.700071, -116.599934], b: [31.699929, -116.600066] },
  // TODO: temporary values for the mock loop, at 1/4, 1/2 and 3/4 of a lap
  splits: [
    { a: [31.696374, -116.598236], b: [31.696487, -116.598401] },
    { a: [31.69541, -116.602339], b: [31.695582, -116.602275] },
    { a: [31.69706, -116.604495], b: [31.696928, -116.604352] },
  ],
  // a start/finish crossing sooner than this after the last one is ignored (GPS jitter while stopped on the line)
  minLapSeconds: 20,
};
