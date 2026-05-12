import { createClient as createUserClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

/**
 * Parse the ADMIN_UIDS env var (comma-separated UUIDs).
 * Server-only — never use NEXT_PUBLIC_ here.
 */
export function getAdminUids(): string[] {
  const raw = process.env.ADMIN_UIDS ?? "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Throws unless the current request belongs to a user whose UID is in
 * ADMIN_UIDS. Call at the top of every admin-only page / action.
 */
export async function requireAdmin(): Promise<{ userId: string }> {
  const supabase = await createUserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("FORBIDDEN: not signed in");

  const allow = getAdminUids();
  if (!allow.includes(user.id)) {
    throw new Error("FORBIDDEN: not an admin");
  }
  return { userId: user.id };
}

/**
 * Service-role Supabase client. Bypasses RLS — use ONLY after
 * requireAdmin() has succeeded.
 *
 * Never expose this to the browser; it's intentionally not the
 * default client. SUPABASE_SERVICE_ROLE_KEY is server-only (no
 * NEXT_PUBLIC prefix).
 */
export function adminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Admin client misconfigured: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.",
    );
  }
  return createAdminClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
