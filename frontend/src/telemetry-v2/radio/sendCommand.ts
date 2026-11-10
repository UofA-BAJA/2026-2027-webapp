import { RADIO_COMMAND_URL, SEND_TIMEOUT_MS } from "../config/radio.ts";

export type SendResult = { ok: true } | { ok: false; reason: string };

// Every pit → car send goes through here. It POSTs { id, payload } (ids from config/radio.ts) and always resolves
// with an answer the panel shows; it never throws, so no button can silently do nothing.
// No such endpoint exists yet (no route in backend/, no /api proxy in vite.config), so today every send is "not connected to car".
export async function sendCommand(id: number, payload?: number | number[]): Promise<SendResult> {
  try {
    const res = await fetch(RADIO_COMMAND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, payload }),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
    if (res.ok) return { ok: true };
    return { ok: false, reason: res.status === 404 ? "not connected to car" : `the radio server answered ${res.status}` };
  } catch {
    return { ok: false, reason: "not connected to car" }; // no server, no network, or no answer in time
  }
}
