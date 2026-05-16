"use client";

import { useEffect } from "react";
import { track } from "@/lib/analytics/plausible";

/**
 * Fires the `app_loaded` Plausible event once per top-level page load.
 * Mounted in `app/layout.tsx` so it runs after Next paints.
 */
export function TrackAppLoaded() {
  useEffect(() => {
    track("app_loaded");
  }, []);
  return null;
}
