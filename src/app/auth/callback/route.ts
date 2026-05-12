import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Supabase magic-link callback.
 *
 * After the user clicks the email link they land here with a `code`
 * param. We exchange it for a session and redirect home.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const redirectTo = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${redirectTo}`);
    }
  }

  // Something went wrong — send them to sign-in with a flag we can use
  // later to surface a friendly error.
  return NextResponse.redirect(`${origin}/sign-in?error=callback`);
}
