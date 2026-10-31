import { setTilesSource } from "@gunari/scene-mapprint";

// A PMTiles archive URL, or a tile template such as https://api.protomaps.com/tiles/v4/{z}/{x}/{y}.mvt?key=KEY.
// Unset, Map Print uses Overpass only.
setTilesSource(process.env.NEXT_PUBLIC_PMTILES_URL);
