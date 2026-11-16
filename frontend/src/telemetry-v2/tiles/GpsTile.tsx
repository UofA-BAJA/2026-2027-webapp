import { TrackMap } from "./parts/TrackMap";
import type { TileBodyProps } from "./types";

// The GPS tile: the map (parts/TrackMap.tsx) with the car and the trail it left.
export const GpsSmall = ({ s }: TileBodyProps) => <TrackMap s={s} car="small" />;
export const GpsMedium = ({ s }: TileBodyProps) => <TrackMap s={s} car="medium" />;
export const GpsLarge = ({ s }: TileBodyProps) => <TrackMap s={s} car="large" />;
