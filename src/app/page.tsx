import { MapShell } from "@/components/map/map-shell";
import { FilterBar } from "@/components/map/filter-bar";
import { WelcomeCard } from "@/components/welcome-card";
import { fetchPinsInBbox } from "@/lib/pins/fetch";
import type { Pin } from "@/lib/pins/types";

/**
 * Home page. Server-fetches all visible pins in Vienna once; the client
 * MapShell + FilterBar apply URL-driven filters on top of that.
 *
 * NOTE: filtering is intentionally client-side so URL changes don't
 * trigger a full server round-trip. The cost is loading "extra" pins,
 * but the pins_in_bbox RPC caps results at 500 so the payload stays small.
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
      <MapShell pins={pins} />
      <FilterBar />
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
