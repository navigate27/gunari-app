import { fetchOsmCached, parseOsmRequest } from "@/lib/osm-proxy";

// Public and unauthenticated by design: it serves open map data only, and the
// bbox size cap stops it being used as a general-purpose Overpass proxy.
export async function GET(request: Request): Promise<Response> {
  const parsed = parseOsmRequest(new URL(request.url).searchParams);
  if (!parsed) return Response.json({ error: "invalid bbox" }, { status: 400 });
  try {
    const data = await fetchOsmCached(parsed);
    return Response.json(data, {
      headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" },
    });
  } catch {
    return Response.json({ error: "map data unavailable" }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
