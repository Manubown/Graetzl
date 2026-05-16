"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { track } from "@/lib/analytics/plausible";

/**
 * Fires `auth_signup_completed{method:"password"}` exactly once when the
 * page mounts with `?confirmed=1` in the URL. `?confirmed=1` is set by
 * the /auth/callback route after a successful `type=signup` email
 * confirmation, so the method is unambiguously "password" — magic-link
 * confirmations don't pass through this code path.
 */
export function TrackSignupConfirmed() {
  const searchParams = useSearchParams();
  useEffect(() => {
    if (searchParams.get("confirmed") === "1") {
      track("auth_signup_completed", { method: "password" });
    }
  }, [searchParams]);
  return null;
}
