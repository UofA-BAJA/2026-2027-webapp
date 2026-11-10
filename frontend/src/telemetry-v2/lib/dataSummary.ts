import { DATA_TYPES } from "../config/radio.ts";

// "9 of 10 · all except gps": short summary of which data types are selected
export function dataSummary(on: number[]) {
  const total = DATA_TYPES.length;
  const names = (codes: readonly number[]) => DATA_TYPES.filter((d) => codes.includes(d.code)).map((d) => d.name).join(", ");
  const off = DATA_TYPES.map((d) => d.code).filter((c) => !on.includes(c));
  const what = off.length === 0 ? "all" : on.length === 0 ? "none" : off.length <= 2 ? `all except ${names(off)}` : on.length <= 2 ? names(on) : "";
  return `${on.length} of ${total}${what ? ` · ${what}` : ""}`;
}
