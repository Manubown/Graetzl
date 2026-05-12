"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

const STORAGE_KEY = "graetzl:welcome-dismissed-v1";

interface WelcomeCardProps {
  /** Hint text shown when no pins exist yet. Falsy → suppressed. */
  emptyHint?: string;
  /** Error text shown when the pin fetch failed. Falsy → suppressed. */
  errorHint?: string;
}

/**
 * Floating welcome card on the home map.
 *
 * Client component because it touches localStorage. To avoid a
 * hydration-flash the card starts hidden and reveals itself in an
 * effect once we've checked the dismissal state.
 */
export function WelcomeCard({ emptyHint, errorHint }: WelcomeCardProps) {
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setMounted(true);
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      setDismissed(stored === "1");
    } catch {
      // Private mode / storage disabled → just show the card; the user
      // can still dismiss it for this session.
      setDismissed(false);
    }
  }, []);

  function handleDismiss() {
    setDismissed(true);
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
  }

  if (!mounted || dismissed) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-6 z-10 flex justify-center px-4 sm:bottom-8">
      <div className="pointer-events-auto relative max-w-md rounded-2xl border border-border bg-background/90 p-5 pr-10 shadow-lg backdrop-blur-md">
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Karte schließen"
          className="absolute right-2 top-2 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
        <h1 className="text-lg font-semibold tracking-tight">
          Willkommen in deinem Grätzl
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Die Karte von Wien, kuratiert von echten Wienerinnen und Wienern.
          Kein Kommerz, keine Werbung — nur die Orte, die nur Einheimische
          kennen.
        </p>
        {errorHint && <p className="mt-2 text-xs text-primary">{errorHint}</p>}
        {emptyHint && (
          <p className="mt-2 text-xs text-muted-foreground">{emptyHint}</p>
        )}
      </div>
    </div>
  );
}
