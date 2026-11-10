export type SendResult = { ok: true } | { ok: false; reason: string };

// Every pit → car send goes through here, so the UI always gets an answer to show.
// shortcut: no pit → car send path exists yet, so every send fails with "not connected"; wire the radio in here once it does
export function sendCommand(_code: number, _payload?: number | number[]): SendResult {
  return { ok: false, reason: "not connected" };
}
