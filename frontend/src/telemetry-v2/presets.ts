// min = where the bar starts (default 0), max = the limit, warn = where the red outline meter starts.
export type Limit = { min?: number; warn?: number; max: number };

// Where a value sits against its limit: bar fill (0..1), outline meter (0..100 of the perimeter) and status.
export function limitState(v: number | undefined, l: Limit) {
  if (v === undefined) return { state: "ok" as const, fill: 0, meter: 0 };
  const min = l.min ?? 0;
  const fill = Math.min(1, Math.max(0, (v - min) / (l.max - min)));
  // a plain range (no warn, e.g. the governor) is fine AT max; only going over it is a problem
  if (l.warn === undefined ? v > l.max : v >= l.max) return { state: "over" as const, fill: 1, meter: 100 };
  if (l.warn !== undefined && v >= l.warn) return { state: "warn" as const, fill, meter: ((v - l.warn) / (l.max - l.warn)) * 100 };
  return { state: "ok" as const, fill, meter: 0 };
}

// Channels group raw stream keys under one display name.
// `keys` are the raw field names from the SSE stream and stay the data keys.

// What a multi-key channel shows as its single number: the average, the max, or one raw key.
export type Pick = "avg" | "max" | string;

export type Channel = {
  name: string; // display name, used everywhere in the UI
  unit: string;
  keys: string[];
  digits?: number; // decimals shown in number views
  scale?: number; // raw value * scale = displayed value
  limit?: Limit; // known limits: shows the limit bar, and the tile turns red past them (car problem)
  pick?: Pick; // default number for multi-key channels; users can change it per tile
};

export const CHANNELS = {
  speed: { name: "speed", unit: "mph", keys: ["car_state_speed"], digits: 1, scale: 2.23694 }, // stream is m/s
  distance: { name: "distance", unit: "mi", keys: ["car_state_distance"], digits: 1, scale: 1 / 1609.344 }, // stream is m
  // warn/limit confirmed by the team (were first guessed from the CVT belt's rating)
  cvt_temp: { name: "cvt temp", unit: "°C", keys: ["cvt_temperature"], digits: 0, limit: { warn: 100, max: 120 } },
  // idle → governor. Running at the governor is normal full power, so only going over it is red.
  motor_rpm: { name: "motor rpm", unit: "rpm", keys: ["motor_rpm"], limit: { min: 1750, max: 3800 } },
  wheel_rpm: {
    name: "wheel rpm",
    unit: "rpm",
    keys: ["wheel_rpm_front_left", "wheel_rpm_front_right", "wheel_rpm_rear"],
    pick: "avg",
  },
  // shortcut: unit is a guess, mock data has no units; confirm with firmware
  brakes: { name: "brakes", unit: "psi", keys: ["brake_pressure_front", "brake_pressure_rear"], digits: 1, pick: "max" },
  shocks: {
    name: "shocks",
    unit: "mm",
    keys: [
      "shock_displacement_front_left",
      "shock_displacement_front_right",
      "shock_displacement_rear_left",
      "shock_displacement_rear_right",
    ],
    pick: "max",
  },
  acceleration: {
    name: "acceleration",
    unit: "m/s²",
    keys: ["imu_acceleration_x", "imu_acceleration_y", "imu_acceleration_z"],
    digits: 1,
    pick: "imu_acceleration_x",
  },
  rotation: {
    name: "rotation",
    unit: "°",
    keys: ["imu_rotation_x", "imu_rotation_y", "imu_rotation_z"],
    digits: 1,
    pick: "imu_rotation_x",
  },
  track: { name: "track", unit: "", keys: ["gps_longitude", "gps_latitude"] },
  // same three GPS series the original /telemetry page charts (DATA_TYPE_MAP); 6 decimals ≈ 0.1 m, so movement shows
  latitude: { name: "latitude", unit: "°", keys: ["gps_latitude"], digits: 6 },
  longitude: { name: "longitude", unit: "°", keys: ["gps_longitude"], digits: 6 },
  altitude: { name: "altitude", unit: "ft", keys: ["gps_altitude"], digits: 0, scale: 3.28084 }, // stream is m; ft to match mph/mi
  // the radio sends error_code (radio_to_json.py ERRORS); the mock server does not, so it reads "--" there
  errors: { name: "error code", unit: "", keys: ["error_code"], digits: 0 },
} satisfies Record<string, Channel>;

export type ChannelId = keyof typeof CHANNELS;

// "pick a channel" list, grouped by car system; every channel belongs to exactly one
export const SYSTEMS: { name: string; channels: ChannelId[] }[] = [
  { name: "Drivetrain", channels: ["speed", "distance", "motor_rpm", "wheel_rpm", "cvt_temp"] },
  { name: "Suspension", channels: ["shocks"] },
  { name: "Brakes", channels: ["brakes"] },
  { name: "IMU", channels: ["acceleration", "rotation"] },
  { name: "GPS", channels: ["track", "latitude", "longitude", "altitude"] },
  { name: "Errors", channels: ["errors"] },
];

// Size is detail: small 1x1 = number, medium 2x1 = number + small chart, large 2x2 = chart with legend/axes.
export const SIZES = [
  { name: "small", w: 1, h: 1 },
  { name: "medium", w: 2, h: 1 },
  { name: "large", w: 2, h: 2 },
] as const;
export const sizeIndex = (t: { w: number; h: number }) => (t.w === 1 ? 0 : t.h === 1 ? 1 : 2);

export type Tile = {
  kind: "channel" | "xy"; // xy plots keys[0] against keys[1] (the GPS track) and is large only
  channels: ChannelId[]; // empty = just added, waiting for the user to pick; 2 channels = 2 y axes
  w: number;
  h: number;
  pick?: Pick; // overrides the channel's default number
};

export type Preset = { name: string; tiles: Tile[] };

const S = { w: 1, h: 1 };
const M = { w: 2, h: 1 };
const L = { w: 2, h: 2 };
const ch = (c: ChannelId, size: { w: number; h: number }, extra: Partial<Tile> = {}): Tile => ({
  kind: "channel",
  channels: [c],
  ...size,
  ...extra,
});

// legend labels for multi-key channels: raw key minus the shared prefix
export const seriesLabel = (key: string) =>
  key
    .replace(/^(wheel_rpm|brake_pressure|shock_displacement|imu_acceleration|imu_rotation)_/, "")
    .replace(/_/g, " ");

export const PRESETS: Preset[] = [
  {
    name: "overview",
    tiles: [
      ch("speed", S),
      ch("motor_rpm", S),
      ch("cvt_temp", M),
      ch("brakes", M),
      { kind: "channel", channels: ["speed", "motor_rpm"], ...L },
      ch("wheel_rpm", L),
      ch("shocks", M),
      ch("distance", S),
      ch("acceleration", S),
    ],
  },
  {
    name: "drivetrain",
    tiles: [ch("motor_rpm", M), ch("cvt_temp", M), ch("speed", M), ch("wheel_rpm", L), ch("cvt_temp", L), ch("motor_rpm", L)],
  },
  {
    name: "suspension",
    tiles: [ch("shocks", L), ch("acceleration", L), ch("brakes", M), ch("speed", S), ch("distance", S)],
  },
  {
    name: "brakes",
    tiles: [
      ch("brakes", L),
      ch("wheel_rpm", L),
      ch("speed", M),
      ch("brakes", S, { pick: "brake_pressure_front" }),
      ch("brakes", S, { pick: "brake_pressure_rear" }),
    ],
  },
  {
    name: "imu",
    tiles: [ch("rotation", L), ch("acceleration", L), ch("speed", M)],
  },
  {
    name: "gps",
    tiles: [{ kind: "xy", channels: ["track"], ...L }, ch("latitude", M), ch("longitude", M), ch("altitude", M), ch("speed", S)],
  },
  { name: "custom", tiles: [] },
];

// Grid columns by the grid's own width (not the window's), so split views work too.
export const colsFor = (width: number) => (width >= 1200 ? 6 : width >= 800 ? 4 : 2);

// Dense packing: each tile, in order, takes the first free cell scanning rows top to bottom.
// Only the order and sizes are stored; positions are recomputed for every column count.
export function pack<T extends { w: number; h: number }>(tiles: T[], cols: number): (T & { x: number; y: number })[] {
  const taken = new Set<string>();
  const fits = (x: number, y: number, w: number, h: number) => {
    for (let i = x; i < x + w; i++) for (let j = y; j < y + h; j++) if (taken.has(`${i},${j}`)) return false;
    return true;
  };
  return tiles.map((t) => {
    const w = Math.min(t.w, cols); // never refuse a size: a tile wider than the grid is clamped to it
    for (let y = 0; ; y++)
      for (let x = 0; x + w <= cols; x++)
        if (fits(x, y, w, t.h)) {
          for (let i = x; i < x + w; i++) for (let j = y; j < y + t.h; j++) taken.add(`${i},${j}`);
          return { ...t, w, x, y };
        }
  });
}

// A saved layout (from localStorage, so untrusted) is usable only if every tile is a known shape and channel.
// Anything else makes that preset fall back to its default.
export function validTiles(ts: unknown): boolean {
  if (!Array.isArray(ts)) return false;
  const ids = new Set<string>();
  return ts.every((t) => {
    if (!t || typeof t.id !== "string" || ids.has(t.id)) return false;
    ids.add(t.id);
    const shape = SIZES.some((s) => s.w === t.w && s.h === t.h);
    const chans = Array.isArray(t.channels) && t.channels.every((c: unknown) => typeof c === "string" && Object.hasOwn(CHANNELS, c));
    return shape && chans && (t.kind === "channel" || (t.kind === "xy" && t.w === 2 && t.h === 2)); // the GPS map is large-only
  });
}
