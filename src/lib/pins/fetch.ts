import { createClient } from "@/lib/supabase/server";
import { VIENNA_BBOX, type Bbox, type Pin } from "./types";

/**
 * Fetch all visible (non-hidden) pins in the given bbox.
 * Uses the `pins_in_bbox` RPC, which is RLS-enforced.
 *
 * Throws on Supabase error; callers should handle it (Server Component
 * error boundary or try/catch in a Route Handler).
 */
export async function fetchPinsInBbox(
  bbox: Bbox = VIENNA_BBOX,
  maxRows = 500,
): Promise<Pin[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pins_in_bbox", {
    min_lng: bbox.minLng,
    min_lat: bbox.minLat,
    max_lng: bbox.maxLng,
    max_lat: bbox.maxLat,
    max_rows: maxRows,
  });
  if (error) throw error;
  return (data ?? []) as Pin[];
}

/**
 * Fetch a single pin by ID (visible or owned-by-current-user, RLS-enforced).
 * Returns null if not found / not visible to the caller.
 */
export async function fetchPin(id: string): Promise<Pin | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pins_with_coords")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as Pin | null) ?? null;
}
