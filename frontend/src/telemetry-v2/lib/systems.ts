// The "pick a channel" list: channels grouped by their `system`, groups and channels in the order they appear in CHANNELS.
import { CHANNELS, type ChannelId } from "../config/channels.ts";

export const SYSTEMS: { name: string; channels: ChannelId[] }[] = [];
for (const [id, ch] of Object.entries(CHANNELS) as [ChannelId, (typeof CHANNELS)[ChannelId]][]) {
  let g = SYSTEMS.find((s) => s.name === ch.system);
  if (!g) SYSTEMS.push((g = { name: ch.system, channels: [] }));
  g.channels.push(id);
}
