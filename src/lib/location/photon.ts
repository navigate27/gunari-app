"use client";

export interface PlaceResult {
  label: string;
  lat: number;
  lng: number;
  /** Raw Photon feature properties, in case callers want extra context. */
  raw?: Record<string, unknown>;
}

const PHOTON_ENDPOINT = "https://photon.komoot.io/api/";

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    name?: string;
    street?: string;
    housenumber?: string;
    postcode?: string;
    city?: string;
    state?: string;
    country?: string;
    osm_key?: string;
    osm_value?: string;
  };
}

export async function searchPlaces(
  query: string,
  signal?: AbortSignal,
  limit = 6
): Promise<PlaceResult[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const url = `${PHOTON_ENDPOINT}?q=${encodeURIComponent(q)}&limit=${limit}`;
  const res = await fetch(url, { signal, headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`photon: ${res.status}`);
  const data = (await res.json()) as { features?: PhotonFeature[] };
  const feats = data.features ?? [];
  return feats
    .map((f) => {
      const [lng, lat] = f.geometry.coordinates;
      const p = f.properties;
      const label = buildLabel(p);
      return { label, lat, lng, raw: p as unknown as Record<string, unknown> };
    })
    .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng));
}

function buildLabel(p: PhotonFeature["properties"]): string {
  const head = p.name ?? p.street ?? [p.housenumber, p.street].filter(Boolean).join(" ");
  const tail = [p.postcode, p.city, p.state, p.country]
    .filter(Boolean)
    .filter((x, i, arr) => arr.indexOf(x) === i)
    .join(", ");
  return [head, tail].filter(Boolean).join(", ");
}

const PHOTON_REVERSE = "https://photon.komoot.io/reverse";

/**
 * Reverse-geocode coordinates to a human-readable label.
 * Returns null if no result. Used by the "use my location" button so the
 * location field shows the place name, not raw coordinates.
 */
export async function reverseGeocode(
  lat: number,
  lng: number,
  signal?: AbortSignal
): Promise<string | null> {
  const url = `${PHOTON_REVERSE}?lon=${encodeURIComponent(lng)}&lat=${encodeURIComponent(lat)}`;
  try {
    const res = await fetch(url, { signal, headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const data = (await res.json()) as { features?: PhotonFeature[] };
    const f = data.features?.[0];
    if (!f) return null;
    const label = buildLabel(f.properties);
    return label || null;
  } catch {
    return null;
  }
}