// Every channel the dashboard can show. Data only: change a value here and every tile follows.
// See ../README.md for recipes (change a redline, add a channel).

export type Channel = {
  label: string; // name shown on tiles, in legends and in the "pick a channel" list
  system: string; // its group in the "pick a channel" list (Drivetrain, Suspension, ...); groups appear in the order first used below
  unit: string; // shown after the number ("" for none)
  source: string; // firmware DataType the values come from (include/DataTypes.h in the firmware repo)
  keys: string[]; // raw field names in the live stream (FRAME_FIELDS in tools/radio_to_json.py); several keys = one line each
  scale?: number; // raw value × scale = shown value (unit conversion); leave out for 1
  decimals: number; // digits after the decimal point in the big number
  axis: { auto: true } | { min: number; max: number }; // chart y axis: auto fits the data; min/max is the smallest range shown (it still grows if the data goes past it)
  warnAt?: number; // the red outline meter starts here ("warming", then "near limit")
  redline?: number; // at or over this the whole tile turns red: "OVER LIMIT"
  idle?: number; // motor rpm only: the limit bar starts here
  governor?: number; // motor rpm only: the bar ends here; red only strictly ABOVE it (at the governor is normal full power)
  pick?: string; // multi-key channels: the number shown by default: "avg", "max" or one of `keys`
};

export const CHANNELS = {
  speed: {
    label: "speed",
    system: "Drivetrain",
    unit: "mph",
    source: "CAR_STATE",
    keys: ["car_state_speed"],
    scale: 2.23694, // m/s → mph. TODO: confirm with team that the car sends m/s
    decimals: 1,
    axis: { min: 0, max: 60 }, // TODO: confirm with team (temporary range)
  },
  distance: {
    label: "distance",
    system: "Drivetrain",
    unit: "mi",
    source: "CAR_STATE",
    keys: ["car_state_distance"],
    scale: 1 / 1609.344, // m → mi. TODO: confirm with team that the car sends metres
    decimals: 1,
    axis: { auto: true },
  },
  motor_rpm: {
    label: "motor rpm",
    system: "Drivetrain",
    unit: "rpm",
    source: "MOTOR_RPM",
    keys: ["motor_rpm"],
    decimals: 0,
    axis: { min: 0, max: 4000 }, // TODO: confirm with team (temporary range)
    idle: 1750, // confirmed by the team
    governor: 3800, // confirmed by the team
  },
  wheel_rpm: {
    label: "wheel rpm",
    system: "Drivetrain",
    unit: "rpm",
    source: "WHEEL_RPM",
    keys: ["wheel_rpm_front_left", "wheel_rpm_front_right", "wheel_rpm_rear"],
    decimals: 0,
    axis: { auto: true },
    pick: "avg",
  },
  cvt_temp: {
    label: "cvt temp",
    system: "Drivetrain",
    unit: "°C",
    source: "CVT_TEMPERATURE",
    keys: ["cvt_temperature"],
    decimals: 0,
    axis: { min: 0, max: 150 }, // TODO: confirm with team (temporary range)
    warnAt: 100, // confirmed by the team
    redline: 120, // confirmed by the team
  },
  shocks: {
    label: "shocks",
    system: "Suspension",
    unit: "mm", // TODO: confirm with team (the mock data has no units)
    source: "SHOCK_DISPLACEMENT",
    keys: ["shock_displacement_front_left", "shock_displacement_front_right", "shock_displacement_rear_left", "shock_displacement_rear_right"],
    decimals: 0,
    axis: { auto: true },
    pick: "max",
  },
  brakes: {
    label: "brakes",
    system: "Brakes",
    unit: "psi", // TODO: confirm with team (the mock data has no units)
    source: "BRAKE_PRESSURE",
    keys: ["brake_pressure_front", "brake_pressure_rear"],
    decimals: 1,
    axis: { auto: true },
    pick: "max",
  },
  acceleration: {
    label: "acceleration",
    system: "IMU",
    unit: "m/s²", // TODO: confirm with team (m/s² or g)
    source: "IMU_ACCELERATION",
    keys: ["imu_acceleration_x", "imu_acceleration_y", "imu_acceleration_z"],
    decimals: 1,
    axis: { auto: true },
    pick: "imu_acceleration_x",
  },
  rotation: {
    label: "rotation",
    system: "IMU",
    unit: "°", // TODO: confirm with team (angle in ° or rate in °/s)
    source: "IMU_ROTATION",
    keys: ["imu_rotation_x", "imu_rotation_y", "imu_rotation_z"],
    decimals: 1,
    axis: { auto: true },
    pick: "imu_rotation_x",
  },
  // the GPS track map; plots longitude against latitude, large only
  track: { label: "track", system: "GPS", unit: "", source: "GPS_POSITION", keys: ["gps_longitude", "gps_latitude"], decimals: 0, axis: { auto: true } },
  // the same three GPS series the original /telemetry page charts; 6 decimals ≈ 0.1 m, so movement shows
  latitude: { label: "latitude", system: "GPS", unit: "°", source: "GPS_POSITION", keys: ["gps_latitude"], decimals: 6, axis: { auto: true } },
  longitude: { label: "longitude", system: "GPS", unit: "°", source: "GPS_POSITION", keys: ["gps_longitude"], decimals: 6, axis: { auto: true } },
  altitude: {
    label: "altitude",
    system: "GPS",
    unit: "ft",
    source: "GPS_POSITION",
    keys: ["gps_altitude"],
    scale: 3.28084, // m → ft, to match mph and mi. TODO: confirm with team that the car sends metres
    decimals: 0,
    axis: { auto: true },
  },
  // the real radio sends error_code; the mock server does not, so this reads "no data" there
  errors: { label: "error code", system: "Errors", unit: "", source: "ERRORS", keys: ["error_code"], decimals: 0, axis: { auto: true } },
} satisfies Record<string, Channel>;

export type ChannelId = keyof typeof CHANNELS;
