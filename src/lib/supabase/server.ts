import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Server-side Supabase client for Next.js Route Handlers, Server
 * Components, and Server Actions. Uses Next's cookies() store so
 * the user's session survives across requests.
 *
 * NOTE on typing: we intentionally do NOT pass our `Database` generic
 * here. Our hand-written types didn't quite match supabase-js's
 * internal `GenericDatabase` constraints, causing `Tables["X"]["Insert"]`
 * to silently collapse to `never` — which surfaced as "Object literal
 * may only specify known properties, and 'X' does not exist in type
 * 'never[]'" build errors. Until we switch to generated types via
 * `supabase gen types typescript`, callers cast their inserts/selects
 * as needed; our own typed helpers in lib/pins use the Database type
 * directly where it matters.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: { name: string; value: string; options: CookieOptions }[],
        ) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // `setAll` was called from a Server Component — fine to
            // ignore if middleware refreshes the session separately.
          }
        },
      },
    },
  );
}
