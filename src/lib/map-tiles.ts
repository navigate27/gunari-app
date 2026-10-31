import { setTilesSource } from "@gunari/scene-mapprint";

// Protomaps' public demo file is for development only; production needs your own hosted archive.
const DEMO_TILES = "https://demo-bucket.protomaps.com/v4.pmtiles";

setTilesSource(
  process.env.NEXT_PUBLIC_PMTILES_URL ?? (process.env.NODE_ENV === "development" ? DEMO_TILES : null)
);
