import type { BBox } from "../interpret/types";

/**
 * Build the Overpass QL query for a viewport bbox. The query fetches:
 * - roads (filtered to the supported class set)
 * - water polygons (natural=water) and waterways (waterway=*)
 * - parks (leisure=park, leisure=garden, boundary=protected_area)
 * - built-up land (landuse=residential/commercial/...) and green land (forest, grass, wood, ...)
 * - place labels (place=city/town/village/hamlet/suburb/neighbourhood)
 *
 * With `pois`, also named shops, food, landmarks, lodging and community places.
 * Buildings, transit and traffic are deliberately excluded.
 */
export interface QueryOptions {
  /** Also fetch named shops, food, landmarks, lodging and community places. */
  pois?: boolean;
}

const POI_AMENITY =
  "restaurant|cafe|fast_food|bar|pub|food_court|ice_cream|biergarten|theatre|cinema|school|university|college|hospital|clinic|place_of_worship|library|townhall|police|fire_station|bank|marketplace";
const POI_TOURISM =
  "attraction|museum|gallery|artwork|viewpoint|zoo|theme_park|hotel|hostel|guest_house|motel|apartment";

export function buildOverpassQuery(bbox: BBox, options: QueryOptions = {}): string {
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
  way["landuse"~"^(residential|commercial|retail|industrial|construction|garages)$"](${bboxStr});
  way["landuse"~"^(forest|grass|meadow|recreation_ground|village_green|cemetery|farmland|orchard)$"](${bboxStr});
  way["natural"~"^(wood|scrub|grassland|wetland|heath)$"](${bboxStr});
  way["place"~"^(city|town|village|hamlet|suburb|neighbourhood)$"](${bboxStr});
  node["place"~"^(city|town|village|hamlet|suburb|neighbourhood)$"](${bboxStr});${
    options.pois
      ? `
  node["name"]["amenity"~"^(${POI_AMENITY})$"](${bboxStr});
  node["name"]["shop"](${bboxStr});
  node["name"]["tourism"~"^(${POI_TOURISM})$"](${bboxStr});
  node["name"]["historic"](${bboxStr});
  way["name"]["tourism"~"^(${POI_TOURISM})$"](${bboxStr});
  way["name"]["historic"](${bboxStr});
  way["name"]["amenity"~"^(place_of_worship|school|university|college|hospital|theatre|cinema|library|townhall|marketplace)$"](${bboxStr});
  way["name"]["shop"~"^(mall|department_store|supermarket)$"](${bboxStr});`
      : ""
  }
);
out geom;`;
}