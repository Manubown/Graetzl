/**
 * Grid-snap utility for the `approximate` precision toggle.
 *
 * GDPR principle: a user who chooses "approximate" should never have their
 * exact coordinate stored. We snap to a ~100m cell on the WGS84 sphere
 * and keep only the snapped value.
 *
 * Approach: at Vienna's latitude (~48.2°), 1° latitude ≈ 111.32 km and
 * 1° longitude ≈ 111.32 × cos(lat) km. We snap latitude first, then derive
 * the longitude step from the *snapped* latitude — this guarantees that
 * every point in a given lat-band uses the same lng grid, so two nearby
 * points always collide to the same cell.
 */

const METERS_PER_DEGREE_LAT = 111_320;
const TARGET_CELL_METERS = 100;
const LAT_STEP = TARGET_CELL_METERS / METERS_PER_DEGREE_LAT;

export function snapTo100mGrid(
  lat: number,
  lng: number,
): { lat: number; lng: number } {
  const snappedLat = Math.round(lat / LAT_STEP) * LAT_STEP;
  const lngStep =
    TARGET_CELL_METERS /
    (METERS_PER_DEGREE_LAT * Math.cos((snappedLat * Math.PI) / 180));
  const snappedLng = Math.round(lng / lngStep) * lngStep;

  return { lat: snappedLat, lng: snappedLng };
}

/**
 * Haversine distance in metres. Useful in tests + for the chest-drop
 * proximity check we'll need in Phase 3.
 */
export function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
