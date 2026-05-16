import { createClient } from "@/lib/supabase/server";
import {
  VIENNA_BBOX,
  type Bbox,
  type Pin,
  type PinWithStats,
} from "./types";

/**
 * Fetch all visible (non-hidden) pins in the given bbox.
 * Uses the `pins_in_bbox` RPC, RLS-enforced.
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
  if (error) {
    throw new Error(
      `pins_in_bbox failed [${error.code ?? "?"}]: ${error.message}${error.hint ? ` — hint: ${error.hint}` : ""}`,
    );
  }
  return (data ?? []) as Pin[];
}

/**
 * Bezirk-aware variant of fetchPinsInBbox. Calls `pins_in_bbox_filtered`
 * which accepts an optional `p_bezirk` argument. When bezirk is null,
 * the RPC behaves identically to `pins_in_bbox` (no district filter).
 */
export async function fetchPinsInBboxFiltered(
  bbox: Bbox = VIENNA_BBOX,
  bezirk: number | null = null,
  maxRows = 500,
): Promise<Pin[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pins_in_bbox_filtered", {
    min_lng: bbox.minLng,
    min_lat: bbox.minLat,
    max_lng: bbox.maxLng,
    max_lat: bbox.maxLat,
    p_bezirk: bezirk,
    max_rows: maxRows,
  });
  if (error) {
    throw new Error(
      `pins_in_bbox_filtered failed [${error.code ?? "?"}]: ${error.message}${error.hint ? ` — hint: ${error.hint}` : ""}`,
    );
  }
  return (data ?? []) as Pin[];
}

/**
 * Single pin lookup without stats (kept for callers that don't need
 * vote counts — currently only the legacy spots).
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

/**
 * Single pin lookup including upvote count + current-user state.
 * Used by /pin/[id] and the intercepting modal.
 */
export async function fetchPinWithStats(
  id: string,
): Promise<PinWithStats | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pin_with_stats", {
    p_pin_id: id,
  });
  if (error) throw error;
  const rows = (data ?? []) as PinWithStats[];
  return rows[0] ?? null;
}
