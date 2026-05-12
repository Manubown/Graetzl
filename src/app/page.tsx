import { ViennaMapLoader } from "@/components/map/vienna-map-loader";

export default function HomePage() {
  return (
    <div className="relative flex-1">
      <ViennaMapLoader />
      {/* Floating welcome card — informational for Week 1; we'll wire
          dismissal in Week 4 onboarding. */}
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
        </div>
      </div>
    </div>
  );
}
