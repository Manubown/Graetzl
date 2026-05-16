import { createClient } from "@/lib/supabase/server";
import type { Pin } from "@/lib/pins/types";
import type { Profile, ProfileWithStats, SavedPin } from "./types";

/**
 * Look up a profile by its case-insensitive handle. Returns null if
 * the handle doesn't exist.
 */
export async function fetchProfileByHandle(
  handle: string,
): Promise<Profile | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, handle, bio, home_city, created_at")
    .eq("handle", handle)
    .maybeSingle();
  if (error) throw error;
  return (data as Profile | null) ?? null;
}

/**
 * Profile + pin_count + the user's most-recent non-hidden pins.
 * Two queries — fine for MVP. Optimise to a single RPC if profile
 * pages become hot.
 */
export async function fetchProfileWithStats(
  handle: string,
  recentLimit = 12,
): Promise<ProfileWithStats | null> {
  const profile = await fetchProfileByHandle(handle);
  if (!profile) return null;

  const supabase = await createClient();

  // Pin count — head:true so we get only the count, no rows.
  const { count, error: countErr } = await supabase
    .from("pins")
    .select("id", { count: "exact", head: true })
    .eq("author_id", profile.id)
    .eq("is_hidden", false);
  if (countErr) throw countErr;

  const { data: recent, error: recentErr } = await supabase
    .from("pins_with_coords")
    .select("*")
    .eq("author_id", profile.id)
    .eq("is_hidden", false)
    .order("created_at", { ascending: false })
    .limit(recentLimit);
  if (recentErr) throw recentErr;

  return {
    ...profile,
    pin_count: count ?? 0,
    recent_pins: (recent ?? []) as Pin[],
  };
}

/**
 * Pins the current user has saved. RLS restricts `saves` reads to the
 * row owner, so this only returns data when called by the saving user
 * themselves — callers must gate the surface on `isOwner` before
 * invoking this. Non-owners get an empty array (not an error).
 */
export async function fetchSavedPinsForCurrentUser(
  limit = 12,
): Promise<SavedPin[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("saves")
    .select("created_at, pin:pins_with_coords(*)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;

  // Supabase generates the embedded `pin` as Pin[] even for 1:1 FK joins
  // (saves.pin_id → pins.id is unique per save row, so at most one pin),
  // hence the unknown cast + normalisation below.
  type Row = { created_at: string; pin: Pin | Pin[] | null };
  return ((data ?? []) as unknown as Row[])
    .map((r) => ({
      saved_at: r.created_at,
      pin: Array.isArray(r.pin) ? (r.pin[0] ?? null) : r.pin,
    }))
    .filter((r): r is { saved_at: string; pin: Pin } => r.pin !== null)
    .map((r) => ({ ...r.pin, saved_at: r.saved_at }));
}

/**
 * Currently-authenticated user's profile, or null if not signed in.
 * Used by the header + /me redirect.
 */
export async function fetchCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, handle, bio, home_city, created_at")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw error;
  return (data as Profile | null) ?? null;
}
