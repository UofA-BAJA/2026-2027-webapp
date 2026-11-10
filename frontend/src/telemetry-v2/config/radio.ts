// Radio settings, data types and command IDs. Data only.
// DATA_TYPES and COMMANDS are copied from the firmware repo so the pit and the car agree on the codes:
// https://github.com/UofA-BAJA/2026-2027-firmware include/DataTypes.h and include/Commands.h (commit d0b8c9d).
// Change them there first, then here.

export const STREAM_URL = "http://localhost:8000/stream"; // live data (Server-Sent Events) from tools/radio_to_json.py or the mock server
export const RADIO_COMMAND_URL = "/api/radio/command"; // pit → car commands: POST { id, payload }; no backend route exists yet
export const SEND_TIMEOUT_MS = 5000; // a send with no answer by then counts as "not connected to car"
export const STALE_MS = 3000; // no new value for this long = "no data" on a tile, "silent" in the radio panel

export const FREQ_MIN = 902; // MHz, bottom of the radio band
export const FREQ_MAX = 928; // MHz, top of the radio band
export const FREQ_DEFAULT = 915; // MHz, shown when the panel opens
export const FREQ_STEP = 0.1; // MHz per − / + press

export const ESTOP_HOLD_MS = 2000; // how long the emergency stop must be held before it sends

// firmware Command enum (Commands.h)
export const COMMANDS = {
  RADIO_FREQUENCY_CHANGE: 0, // frequency change flag (radio command)
  RADIO_DATA_CHANGE: 1, // change which data is sent via radio
  DEFAULT_CAR_START: 2, // received when the car starts (starts everything)
  START_LOG: 100, // starts recording data and realtime transmission
  END_LOG: 101, // stops recording data and realtime transmission
  RETRIEVE: 102, // sends the logs to the pit computer
  EMERGENCY_STOP: 104, // "crash the program" response
  ENABLE_CHECK_ENGINE: 69, // check engine light on the dash on
  DISABLE_CHECK_ENGINE: 70, // check engine light on the dash off
  START_CAM: 105, // testing
  ACCELERATION: 106, // testing
} as const;

// firmware DataType enum (DataTypes.h). code = the type's bit in the live-data mask; name = shown in the panel.
export const DATA_TYPES = [
  { code: 0x01, name: "wheel rpm" },
  { code: 0x02, name: "car state" },
  { code: 0x03, name: "motor rpm" },
  { code: 0x04, name: "imu rotation" },
  { code: 0x05, name: "imu acceleration" },
  { code: 0x06, name: "brake pressure" },
  { code: 0x07, name: "shock displacement" },
  { code: 0x08, name: "cvt temperature" },
  { code: 0x09, name: "gps" },
  { code: 0xaa, name: "errors" },
] as const;

export const DEFAULT_DATA_TYPES: number[] = [0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0xaa]; // everything except gps
