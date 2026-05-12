import { createClient } from "@/lib/supabase/server";
import type { Pin } from "@/lib/pins/types";
import type { Profile, ProfileWithStats } from "./types";

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
