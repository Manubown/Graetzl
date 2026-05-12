import Link from "next/link";
import { PigeonMark } from "@/components/pigeon-mark";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { fetchCurrentProfile } from "@/lib/profiles/fetch";

/**
 * Minimal sticky header. Slim on mobile, full info on ≥sm.
 */
export async function SiteHeader() {
  const profile = await fetchCurrentProfile().catch(() => null);

  return (
    <header className="sticky top-0 z-30 flex h-12 w-full items-center justify-between border-b border-border bg-background/85 px-3 backdrop-blur-md sm:h-14 sm:px-4">
      <Link
        href="/"
        className="flex items-center gap-1.5 sm:gap-2"
        aria-label="Grätzl Startseite"
      >
        <PigeonMark className="h-6 w-6 text-primary sm:h-7 sm:w-7" />
        <span className="text-base font-semibold tracking-tight sm:text-lg">
          Grätzl
        </span>
        <span className="hidden text-xs text-muted-foreground sm:inline">
          · Wien
        </span>
      </Link>

      <nav className="flex items-center gap-1 text-sm sm:gap-2">
        {profile ? (
          <>
            <Link
              href={`/u/${profile.handle}`}
              className="max-w-[8rem] truncate rounded-md px-2 py-1 text-sm font-medium hover:bg-muted sm:max-w-none"
            >
              @{profile.handle}
            </Link>
            <SignOutButton />
          </>
        ) : (
          <Link
            href="/sign-in"
            className="rounded-full bg-foreground px-3.5 py-1.5 text-sm text-background transition-opacity hover:opacity-90"
          >
            Anmelden
          </Link>
        )}
      </nav>
    </header>
  );
}
