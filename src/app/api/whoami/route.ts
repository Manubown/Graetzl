import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminUids } from "@/lib/admin/guard";

/**
 * Diagnostic endpoint: returns the current user's id, profile handle,
 * and whether they're in ADMIN_UIDS. The list of admin UIDs is
 * intentionally NOT echoed back — we only return the count and a
 * boolean — so visiting this from a browser doesn't leak the
 * allowlist if someone shoulder-surfs.
 *
 * Safe to leave deployed long-term; nothing here is sensitive.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const adminUids = getAdminUids();
  const adminUidsConfigured = adminUids.length > 0;

  if (!user) {
    return NextResponse.json({
      signedIn: false,
      adminUidsConfigured,
      adminUidCount: adminUids.length,
    });
  }

  // Pull handle just for sanity-checking; ignore errors so the diag
  // works even before migrations run.
  let handle: string | null = null;
  try {
    const { data } = await supabase
      .from("profiles")
      .select("handle")
      .eq("id", user.id)
      .maybeSingle();
    handle = (data as { handle: string } | null)?.handle ?? null;
  } catch {
    /* swallow */
  }

  return NextResponse.json({
    signedIn: true,
    userId: user.id,
    handle,
    isAdmin: adminUids.includes(user.id),
    adminUidsConfigured,
    adminUidCount: adminUids.length,
  });
}
