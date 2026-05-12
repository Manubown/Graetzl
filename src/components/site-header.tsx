import Link from "next/link";
import { PigeonMark } from "@/components/pigeon-mark";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { fetchCurrentProfile } from "@/lib/profiles/fetch";

/**
 * Server component: looks up the current user's profile and renders
 * either the "@handle / Abmelden" pair (signed in) or the "Anmelden"
 * link (signed out).
 *
 * Falls back gracefully if the profile lookup throws (e.g. before
 * migrations apply) — we just render the sign-in link.
 */
export async function SiteHeader() {
  const profile = await fetchCurrentProfile().catch(() => null);

  return (
    <header className="sticky top-0 z-30 flex h-14 w-full items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur-md">
      <Link href="/" className="flex items-center gap-2">
        <PigeonMark className="h-7 w-7 text-primary" />
        <span className="text-lg font-semibold tracking-tight">Grätzl</span>
        <span className="hidden text-xs text-muted-foreground sm:inline">
          · Wien
        </span>
      </Link>

      <nav className="flex items-center gap-2 text-sm">
        {profile ? (
          <>
            <Link
              href={`/u/${profile.handle}`}
              className="rounded-md px-2 py-1 text-sm font-medium hover:bg-muted"
            >
              @{profile.handle}
            </Link>
            <SignOutButton />
          </>
        ) : (
          <Link
            href="/sign-in"
            className="rounded-full bg-foreground px-4 py-1.5 text-background transition-opacity hover:opacity-90"
          >
            Anmelden
          </Link>
        )}
      </nav>
    </header>
  );
}
