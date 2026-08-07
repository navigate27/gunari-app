import type { BBox } from "../interpret/types";

/**
 * Build the Overpass QL query for a viewport bbox. The query fetches:
 * - roads (filtered to the supported class set)
 * - water polygons (natural=water) and waterways (waterway=*)
 * - parks (leisure=park, leisure=garden, boundary=protected_area)
 * - place labels (place=city/town/village/hamlet/suburb/neighbourhood)
 *
 * Buildings, businesses, transit, traffic, and POIs are deliberately excluded.
 */
export function buildOverpassQuery(bbox: BBox): string {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  // Overpass bbox order: (south, west, north, east) = (minLat, minLng, maxLat, maxLng)
  const bboxStr = `${minLat},${minLng},${maxLat},${maxLng}`;
  return `[out:json][timeout:25];
(
  way[highway~"^(motorway|motorway_link|trunk|trunk_link|primary|primary_link|secondary|secondary_link|tertiary|tertiary_link|unclassified|residential|living_street|path|footway|cycleway)$"](${bboxStr});
  way[waterway](${bboxStr});
  way["natural"="water"](${bboxStr});
  way["leisure"="park"](${bboxStr});
  way["leisure"="garden"](${bboxStr});
  way["boundary"="protected_area"](${bboxStr});
  way["place"~"^(city|town|village|hamlet|suburb|neighbourhood)$"](${bboxStr});
  node["place"~"^(city|town|village|hamlet|suburb|neighbourhood)$"](${bboxStr});
);
out:geom;`;
}