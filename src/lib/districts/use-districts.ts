import { createClient } from "@/lib/supabase/server";

/**
 * Shape returned by getDistricts().
 *
 * `bbox` is derived from the PostgREST GeoJSON object that comes back when
 * you SELECT a geography column directly (PostgREST cannot project a
 * geography to four scalar columns without a wrapper RPC). We walk the
 * polygon's outer ring in JS and compute min/max — see bboxFromGeoJsonPolygon.
 */
export interface DistrictSummary {
  id: number; // 1..23
  name: string; // e.g. "Innere Stadt"
  slug: string; // e.g. "innere-stadt"
  bbox: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
  pin_count_cached: number;
}

// ─── PostgREST GeoJSON shape ───────────────────────────────────────────────
// When you SELECT a geography/geometry column via PostgREST, the column value
// is returned as a GeoJSON object rather than WKT. For a Polygon the
// coordinates array is [outerRing, ...holes] where each ring is [[lng,lat],…].
// We only need the outer ring to compute the bbox.

interface GeoJsonPolygon {
  type: "Polygon";
  coordinates: [Array<[number, number]>, ...Array<[number, number]>[]];
}

/**
 * Walk the outer ring of a GeoJSON Polygon and return
 * [minLng, minLat, maxLng, maxLat].
 */
function bboxFromGeoJsonPolygon(
  polygon: GeoJsonPolygon,
): [number, number, number, number] {
  const ring = polygon.coordinates[0];
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  for (const [lng, lat] of ring) {
    if (lng < minLng) minLng = lng;
    if (lat < minLat) minLat = lat;
    if (lng > maxLng) maxLng = lng;
    if (lat > maxLat) maxLat = lat;
  }
  return [minLng, minLat, maxLng, maxLat];
}

// ─── Raw row shape from Supabase ───────────────────────────────────────────

interface DistrictRow {
  id: number;
  name: string;
  slug: string;
  // PostgREST returns geography columns as GeoJSON objects; typed loosely so
  // we can handle the null / unexpected-shape edge cases gracefully.
  bbox: GeoJsonPolygon | null | unknown;
  pin_count_cached: number;
}

// ─── Module-level process cache ────────────────────────────────────────────
//
// Districts are treated as immutable after the seed migration (B-3). There is
// no admin UI to edit district geometries or names in Phase 1/1.5. Caching the
// Promise at module scope means a single Supabase round-trip per server process
// — identical to what Next.js `force-cache` buys you for fetch(), but applied
// at the Supabase client layer where fetch() options are not directly available.
//
// If the districts table ever changes (new migration, schema tweak), restart
// the Next.js server process to bust this cache.

let districtCache: Promise<DistrictSummary[]> | null = null;

async function loadDistricts(): Promise<DistrictSummary[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("districts")
    .select("id, name, slug, bbox, pin_count_cached")
    .order("id");

  if (error) {
    // Surface the error so callers can decide how to handle it; do not swallow.
    throw new Error(`getDistricts: Supabase error — ${error.message}`);
  }

  if (!data || data.length === 0) {
    return [];
  }

  const rows = data as DistrictRow[];
  const result: DistrictSummary[] = [];
  let warnedAboutNullBbox = false;

  for (const row of rows) {
    // Rows that predate the B-3 seed migration (e.g. the S0-4 stub with a
    // hand-typed 4-vertex bbox placeholder) may have null or malformed bbox
    // geometry. Skip them rather than crashing, but log once so it's obvious
    // in server logs.
    if (
      row.bbox == null ||
      typeof row.bbox !== "object" ||
      (row.bbox as GeoJsonPolygon).type !== "Polygon" ||
      !Array.isArray((row.bbox as GeoJsonPolygon).coordinates) ||
      !Array.isArray((row.bbox as GeoJsonPolygon).coordinates[0])
    ) {
      if (!warnedAboutNullBbox) {
        console.warn(
          "[getDistricts] One or more district rows have a null or malformed bbox " +
            "geometry — those rows are excluded. This is expected for stub rows " +
            "created before the B-3 seed migration. Run the seed migration to fix.",
        );
        warnedAboutNullBbox = true;
      }
      continue;
    }

    result.push({
      id: row.id,
      name: row.name,
      slug: row.slug,
      bbox: bboxFromGeoJsonPolygon(row.bbox as GeoJsonPolygon),
      pin_count_cached: row.pin_count_cached,
    });
  }

  return result;
}

/**
 * Returns the 23 Viennese Bezirke as lightweight summary objects.
 *
 * Server-only (calls createClient() from @/lib/supabase/server). The result
 * is process-cached — districts are immutable after the B-3 seed migration.
 * Restart the Next.js server process if the districts table changes.
 *
 * Rows with a null or malformed bbox are silently excluded (one console.warn
 * is emitted). An empty array is returned rather than throwing if no districts
 * are found.
 */
export async function getDistricts(): Promise<DistrictSummary[]> {
  if (!districtCache) {
    // Evict on rejection so a transient Supabase error doesn't poison the
    // cache for the lifetime of this serverless instance.
    districtCache = loadDistricts().catch((err) => {
      districtCache = null;
      throw err;
    });
  }
  return districtCache;
}
