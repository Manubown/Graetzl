"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

/**
 * Sign the current user out and redirect to home.
 * Used by the header's "Abmelden" button.
 */
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}

/**
 * Guard: accept only same-origin relative paths to prevent open redirects
 * (CWE-601). Inline copy — the authoritative version lives in
 * src/app/auth/callback/route.ts; T4 agent may consolidate later.
 */
function isSafePath(value: string | null | undefined): string {
  const v = value ?? "";
  if (!v.startsWith("/")) return "/";
  if (v.startsWith("//") || v.startsWith("/\\")) return "/";
  if (v.includes("\\")) return "/";
  return v;
}

// ---------------------------------------------------------------------------
// signUpWithPassword
// ---------------------------------------------------------------------------

export type AuthResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Register a new user via email + password.
 *
 * Success path: returns { ok: true } — does NOT redirect. Supabase sends a
 * confirmation email; the user must click the link before a session exists.
 *
 * Error copy is bucketed per PRD:
 *   - Invalid email format         → "Ungültige E-Mail-Adresse."
 *   - Password too short (<12)     → "Passwort muss mindestens 12 Zeichen lang sein."
 *   - HIBP breach detected         → "Dieses Passwort ist in einem bekannten Datenleck enthalten. Bitte wähle ein anderes."
 *   - Email rate limit / already registered → "Konto existiert bereits — setze ein Passwort über 'Passwort vergessen'."
 *   - Anything else                → "Etwas ist schiefgelaufen. Bitte später erneut versuchen."
 */
export async function signUpWithPassword(
  formData: FormData,
): Promise<AuthResult> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  // Server-side authoritative length check.
  if (password.length < 12 || password.length > 72) {
    return { ok: false, error: "Passwort muss mindestens 12 Zeichen lang sein." };
  }

  const origin = (await headers()).get("origin") ?? "";
  const supabase = await createClient();

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=/onboarding/handle`,
    },
  });

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("invalid email") || msg.includes("email address")) {
      return { ok: false, error: "Ungültige E-Mail-Adresse." };
    }
    if (msg.includes("password") && msg.includes("characters")) {
      return { ok: false, error: "Passwort muss mindestens 12 Zeichen lang sein." };
    }
    if (
      msg.includes("password") &&
      (msg.includes("breach") || msg.includes("hibp") || msg.includes("pwned") || msg.includes("leaked") || msg.includes("known"))
    ) {
      return {
        ok: false,
        error:
          "Dieses Passwort ist in einem bekannten Datenleck enthalten. Bitte wähle ein anderes.",
      };
    }
    if (
      msg.includes("rate limit") ||
      msg.includes("email rate") ||
      msg.includes("user already registered") ||
      msg.includes("already registered") ||
      msg.includes("already been registered") ||
      error.status === 429
    ) {
      return {
        ok: false,
        error:
          "Konto existiert bereits — setze ein Passwort über 'Passwort vergessen'.",
      };
    }
    return {
      ok: false,
      error: "Etwas ist schiefgelaufen. Bitte später erneut versuchen.",
    };
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// signInWithPassword
// ---------------------------------------------------------------------------

/**
 * Sign in with email + password.
 *
 * Design choice: the function is typed as Promise<AuthResult> rather than
 * Promise<never>. The spec allows either idiom; we return { ok: false } on
 * error so the client can show the error without wrapping the call in
 * try/catch — this is cleaner with React 19 useTransition + startTransition.
 * The success path calls redirect() internally (throws NEXT_REDIRECT), which
 * React 19 handles transparently — callers never see the success return.
 *
 * Error copy is field-agnostic per PRD (never reveals which field was wrong).
 */
export async function signInWithPassword(
  formData: FormData,
): Promise<AuthResult> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "").trim();

  // Server-side length check.
  if (password.length < 12 || password.length > 72) {
    return {
      ok: false,
      error: "E-Mail oder Passwort ist falsch.",
    };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return {
      ok: false,
      error: "E-Mail oder Passwort ist falsch.",
    };
  }

  // On success, revalidate the root layout so the session propagates to all
  // server components (e.g. the site header's sign-out button appears).
  revalidatePath("/", "layout");
  redirect(isSafePath(next));
}

// ---------------------------------------------------------------------------
// requestPasswordReset
// ---------------------------------------------------------------------------

/**
 * Send a password-reset email.
 *
 * ALWAYS returns { ok: true } regardless of whether the email belongs to a
 * real account — prevents account enumeration (GDPR / security baseline).
 */
export async function requestPasswordReset(
  formData: FormData,
): Promise<{ ok: true }> {
  const email = String(formData.get("email") ?? "").trim();
  const origin = (await headers()).get("origin") ?? "";
  const supabase = await createClient();

  // Fire-and-forget — we deliberately ignore the error to avoid enumeration.
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/reset-password`,
  });

  return { ok: true };
}

// ---------------------------------------------------------------------------
// updateOwnPassword
// ---------------------------------------------------------------------------

/**
 * Update the currently-authenticated user's password.
 * Called from /me/settings/password — the user must already have a session
 * (established via the recovery link → auth/callback → session exchange).
 */
export async function updateOwnPassword(
  formData: FormData,
): Promise<AuthResult> {
  const password = String(formData.get("password") ?? "");

  if (password.length < 12 || password.length > 72) {
    return {
      ok: false,
      error: "Passwort muss mindestens 12 Zeichen lang sein.",
    };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return {
      ok: false,
      error: "Passwort konnte nicht gespeichert werden. Bitte erneut versuchen.",
    };
  }

  revalidatePath("/", "layout");
  redirect("/?password=updated");
}
