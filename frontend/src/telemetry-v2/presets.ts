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
  limits?: { warn: number; danger: number };
  pick?: Pick; // default number for multi-key channels; users can change it per tile
};

export const CHANNELS = {
  speed: { name: "speed", unit: "mph", keys: ["car_state_speed"], digits: 1, scale: 2.23694 }, // stream is m/s
  distance: { name: "distance", unit: "mi", keys: ["car_state_distance"], digits: 1, scale: 1 / 1609.344 }, // stream is m
  // ponytail: guessed CVT limits; set from the CVT belt's rated temperature
  cvt_temp: { name: "cvt temp", unit: "°C", keys: ["cvt_temperature"], digits: 0, limits: { warn: 100, danger: 120 } },
  motor_rpm: { name: "motor rpm", unit: "rpm", keys: ["motor_rpm"] },
  wheel_rpm: {
    name: "wheel rpm",
    unit: "rpm",
    keys: ["wheel_rpm_front_left", "wheel_rpm_front_right", "wheel_rpm_rear"],
    pick: "avg",
  },
  // ponytail: unit is a guess, mock data has no units; confirm with firmware
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
  altitude: { name: "altitude", unit: "m", keys: ["gps_altitude"], digits: 1 },
} satisfies Record<string, Channel>;

export type ChannelId = keyof typeof CHANNELS;

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
  ranges?: boolean; // 30s / 2m / whole run buttons (large view)
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
      { kind: "channel", channels: ["speed", "motor_rpm"], ...L, ranges: true },
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
    tiles: [{ kind: "xy", channels: ["track"], ...L }, ch("altitude", L), ch("speed", M), ch("distance", M)],
  },
  { name: "custom", tiles: [] },
];
