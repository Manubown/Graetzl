/**
 * Fixed UUID of the curated editorial account (`@graetzl_redaktion`)
 * that owns the seeded landmark/park/landscape pins. Seeded by
 * `supabase/migrations/20260515000008_curated_poi_pins.sql`.
 *
 * Single source of truth for the "is this an editorial pin?" check —
 * used by the map to render curated pins in a muted color so locally-
 * contributed pins stay visually dominant, and by the pin detail page
 * to flag curated entries.
 */
export const CURATED_AUTHOR_ID = "00000000-0000-0000-0000-000000000001";

export function isCuratedPin(authorId: string | null | undefined): boolean {
  return authorId === CURATED_AUTHOR_ID;
}
