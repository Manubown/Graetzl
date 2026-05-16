import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safePath } from "@/lib/auth/safe-path";

/**
 * Supabase auth callback — handles magic-link sign-in, email confirmation,
 * and password-reset flows via the `type` query param Supabase appends.
 *
 * Routing table (evaluated after a successful code exchange):
 *   type=recovery → /me/settings/password?reset=1   (password reset link)
 *   type=signup   → /sign-in?confirmed=1&next=/onboarding/handle  (email confirmation)
 *   (no type)     → safePath(next)                  (magic-link sign-in, existing behavior)
 *
 * The recovery/signup destinations are hardcoded — the `next` param from the
 * URL is intentionally NOT forwarded to those routes to prevent open redirects.
 * Only the no-type (magic-link) branch passes `next` through safePath().
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const type = searchParams.get("type");
  const next = safePath(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      if (type === "recovery") {
        return NextResponse.redirect(
          `${origin}/me/settings/password?reset=1`,
        );
      }
      if (type === "signup") {
        return NextResponse.redirect(
          `${origin}/sign-in?confirmed=1&next=/onboarding/handle`,
        );
      }
      // Magic-link sign-in (no type): honour the caller-supplied `next`,
      // already sanitised by safeNext() above.
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // No code present or code exchange failed — surface a friendly error.
  return NextResponse.redirect(`${origin}/sign-in?error=callback`);
}
