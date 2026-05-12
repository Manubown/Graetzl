"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client. Reads anon key + URL from public env vars.
 * Use this in client components / hooks.
 *
 * No `<Database>` generic — see lib/supabase/server.ts for the rationale.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
