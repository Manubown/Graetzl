import { Suspense } from "react";
import { MapShell } from "@/components/map/map-shell";
import { FilterBar } from "@/components/map/filter-bar";
import { WelcomeCard } from "@/components/welcome-card";
import { fetchPinsInBbox } from "@/lib/pins/fetch";
import type { Pin } from "@/lib/pins/types";

/**
 * The page always touches cookies via Supabase auth, so it's already
 * dynamic — but Next's static-export path still tries to prerender it
 * unless we say otherwise. `force-dynamic` makes that explicit.
 */
export const dynamic = "force-dynamic";

/**
 * Home page. Server-fetches all visible pins in Vienna once; the client
 * MapShell + FilterBar apply URL-driven filters on top of that.
 *
 * MapShell and FilterBar both call `useSearchParams()`, which Next
 * requires to be inside a Suspense boundary to allow the rest of the
 * tree to stream during SSR. The Suspense fallbacks are nearly empty
 * because both components mount quickly client-side.
 */
export default async function HomePage() {
  let pins: Pin[] = [];
  let dataError = false;
  try {
    pins = await fetchPinsInBbox();
  } catch (err) {
    console.error("[home] fetchPinsInBbox failed:", err);
    dataError = true;
  }

  return (
    <div className="relative flex-1">
      <Suspense
        fallback={
          <div className="flex h-full w-full items-center justify-center bg-muted">
            <p className="text-sm text-muted-foreground">Karte wird geladen…</p>
          </div>
        }
      >
        <MapShell pins={pins} />
      </Suspense>

      <Suspense fallback={null}>
        <FilterBar />
      </Suspense>

      <WelcomeCard
        errorHint={
          dataError
            ? "Hinweis: Die Pin-Tabelle ist noch nicht migriert. Führe die neueste Migration aus, dann lädt die Karte die Pins."
            : undefined
        }
        emptyHint={
          !dataError && pins.length === 0
            ? "Noch keine Pins. Lange auf die Karte tippen (Rechtsklick am Desktop), um den ersten Pin zu setzen."
            : undefined
        }
      />
    </div>
  );
}
