import { COMMANDS } from "../config/radio";
import type { Box } from "../lib/lapBox";
import { sendCommand, type SendResult } from "../radio/sendCommand";
import { persisted } from "./persisted";

// The lap box per site ({ minLat, maxLat, minLon, maxLon }, keyed by siteKey()), saved in this browser, and the
// sites where "not now" was picked for the "set up a lap box?" prompt.
export const [useLapBoxes, setLapBoxes, getLapBoxes] = persisted<Record<string, Box>>("tv2-lap-box-v1", {});
export const [usePromptDismissed, setPromptDismissed] = persisted<Record<string, true>>("tv2-lap-box-not-now-v1", {});

/** Set (or clear, with undefined) a site's box. A new box is also sent to the car, which will time laps with it. */
export function saveLapBox(site: string, box: Box | undefined): Promise<SendResult> | undefined {
  const { [site]: _old, ...rest } = getLapBoxes();
  setLapBoxes(box ? { ...rest, [site]: box } : rest);
  return box && sendCommand(COMMANDS.SET_LAP_BOX, box);
}
