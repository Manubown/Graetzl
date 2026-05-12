import { MapShell } from "@/components/map/map-shell";
import { WelcomeCard } from "@/components/welcome-card";
import { fetchPinsInBbox } from "@/lib/pins/fetch";
import type { Pin } from "@/lib/pins/types";

/**
 * Home page is a Server Component. It fetches the visible pins for
 * Vienna's bounding box (RLS-enforced), then hands them to the
 * client-side MapShell. The WelcomeCard is a separate client component
 * because it remembers dismissal in localStorage.
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
      <WelcomeCard
        errorHint={
          dataError
            ? "Hinweis: Die Pin-Tabelle ist noch nicht migriert. Führe die neueste Migration aus, dann lädt die Karte die Pins."
            : undefined
        }
        emptyHint={
          !dataError && pins.length === 0
            ? "Noch keine Pins. Lange auf die Karte tippen oder den +-Button unten rechts nutzen, um den ersten Pin zu setzen."
            : undefined
        }
      />
    </div>
  );
}
