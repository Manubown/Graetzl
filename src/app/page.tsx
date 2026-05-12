import { MapShell } from "@/components/map/map-shell";
import { fetchPinsInBbox } from "@/lib/pins/fetch";
import type { Pin } from "@/lib/pins/types";

/**
 * Home page is a Server Component. It fetches the visible pins for
 * Vienna's bounding box on the server (RLS-enforced), then hands them
 * to the client-side MapShell which owns the map + the drop-pin modal.
 *
 * Re-fetch is triggered after pin creation via revalidatePath('/')
 * in the Server Action.
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

      {/* Welcome / status card */}
      <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center px-4 sm:bottom-8">
        <div className="pointer-events-auto max-w-md rounded-2xl border border-border bg-background/90 p-5 shadow-lg backdrop-blur-md">
          <h1 className="text-lg font-semibold tracking-tight">
            Willkommen in deinem Grätzl
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Die Karte von Wien, kuratiert von echten Wienerinnen und Wienern.
            Kein Kommerz, keine Werbung — nur die Orte, die nur Einheimische
            kennen.
          </p>
          {dataError && (
            <p className="mt-2 text-xs text-primary">
              Hinweis: Die Pin-Tabelle ist noch nicht migriert. Führe die
              neueste Migration aus, dann lädt die Karte die Pins.
            </p>
          )}
          {!dataError && pins.length === 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              Noch keine Pins. Lange auf die Karte tippen (oder Rechtsklick am
              Desktop), um den ersten Pin zu setzen.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
