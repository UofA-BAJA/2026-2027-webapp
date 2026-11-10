// Radio commands and data types, copied from the firmware repo so the pit and the car agree on the codes:
// https://github.com/UofA-BAJA/2026-2027-firmware include/Commands.h and include/DataTypes.h (commit d0b8c9d).
// Change them there first, then here.

export const Command = {
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

// The code is also the shift amount for that type's bit in the live-data mask.
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

// Radio band for the car and pit radios.
export const FREQ_MIN = 902;
export const FREQ_MAX = 928;

export type SendResult = { ok: true } | { ok: false; reason: string };

// Every pit → car send goes through here, so the UI always gets an answer to show.
// shortcut: no pit → car send path exists yet, so every send fails with "not connected"; wire the radio in here once it does
export function sendCommand(_code: number, _payload?: number | number[]): SendResult {
  return { ok: false, reason: "not connected" };
}

// "9 of 10 · all except gps": short summary of which data types are selected
export function dataSummary(on: number[]) {
  const total = DATA_TYPES.length;
  const names = (codes: readonly number[]) => DATA_TYPES.filter((d) => codes.includes(d.code)).map((d) => d.name).join(", ");
  const off = DATA_TYPES.map((d) => d.code).filter((c) => !on.includes(c));
  const what = off.length === 0 ? "all" : on.length === 0 ? "none" : off.length <= 2 ? `all except ${names(off)}` : on.length <= 2 ? names(on) : "";
  return `${on.length} of ${total}${what ? ` · ${what}` : ""}`;
}
