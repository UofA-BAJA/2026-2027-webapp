// The presets in the header pivot, in order. Data only.
// Each preset is an ordered list of tiles; the grid fills them left to right, top to bottom, at any width.
// A viewer's own edits (customize mode) are saved in their browser and override these until reset.
import type { ChannelId } from "./channels.ts";

export type PresetTile = {
  channel: ChannelId | ChannelId[]; // one channel, or two for one chart with a y axis each
  size: "small" | "medium" | "large"; // small = number, medium = number + chart, large = chart ("track": map + lap time, + splits, + every lap)
  pick?: string; // multi-key channels: which number to show ("avg", "max" or one key); default from channels.ts
};

export type Preset = { name: string; tiles: PresetTile[] };

export const PRESETS: Preset[] = [
  {
    name: "overview",
    tiles: [
      { channel: "speed", size: "small" },
      { channel: "motor_rpm", size: "small" },
      { channel: "cvt_temp", size: "medium" },
      { channel: "brakes", size: "medium" },
      { channel: ["speed", "motor_rpm"], size: "large" },
      { channel: "wheel_rpm", size: "large" },
      { channel: "shocks", size: "medium" },
      { channel: "distance", size: "small" },
      { channel: "acceleration", size: "small" },
    ],
  },
  {
    name: "drivetrain",
    tiles: [
      { channel: "motor_rpm", size: "medium" },
      { channel: "cvt_temp", size: "medium" },
      { channel: "speed", size: "medium" },
      { channel: "wheel_rpm", size: "large" },
      { channel: "cvt_temp", size: "large" },
      { channel: "motor_rpm", size: "large" },
    ],
  },
  {
    name: "suspension",
    tiles: [
      { channel: "shocks", size: "large" },
      { channel: "acceleration", size: "large" },
      { channel: "brakes", size: "medium" },
      { channel: "speed", size: "small" },
      { channel: "distance", size: "small" },
    ],
  },
  {
    name: "brakes",
    tiles: [
      { channel: "brakes", size: "large" },
      { channel: "wheel_rpm", size: "large" },
      { channel: "speed", size: "medium" },
      { channel: "brakes", size: "small", pick: "brake_pressure_front" },
      { channel: "brakes", size: "small", pick: "brake_pressure_rear" },
    ],
  },
  {
    name: "imu",
    tiles: [
      { channel: "rotation", size: "large" },
      { channel: "acceleration", size: "large" },
      { channel: "speed", size: "medium" },
    ],
  },
  {
    name: "gps",
    tiles: [
      { channel: "track", size: "large" },
      { channel: "latitude", size: "medium" },
      { channel: "longitude", size: "medium" },
      { channel: "altitude", size: "medium" },
      { channel: "speed", size: "small" },
    ],
  },
  { name: "custom", tiles: [] },
];

// The page-wide chart time window buttons in the header. s = seconds shown (Infinity = the whole run).
export const TIME_WINDOWS = [
  { label: "30s", s: 30 },
  { label: "2m", s: 120 },
  { label: "whole run", s: Infinity },
];
export const DEFAULT_TIME_WINDOW = 30; // seconds
