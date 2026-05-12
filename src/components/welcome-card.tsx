"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

const STORAGE_KEY = "graetzl:welcome-dismissed-v2";

interface WelcomeCardProps {
  emptyHint?: string;
  errorHint?: string;
}

/**
 * Small floating welcome banner. Designed to be present but not
 * dominate the map — short copy, low height, dismissible. Hidden
 * forever once dismissed (localStorage). The bump to v2 of the key
 * makes the banner reappear once for existing users after the
 * UI polish, in case they'd dismissed the older version.
 */
export function WelcomeCard({ emptyHint, errorHint }: WelcomeCardProps) {
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setMounted(true);
    try {
      setDismissed(window.localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
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
    <div className="pointer-events-none absolute inset-x-0 bottom-3 z-10 flex justify-center px-3">
      <div className="pointer-events-auto relative max-w-md rounded-xl border border-border bg-background/90 px-4 py-2.5 pr-8 shadow-md backdrop-blur-md">
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Schließen"
          className="absolute right-1.5 top-1.5 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
        <p className="text-sm font-medium tracking-tight">
          Willkommen in deinem Grätzl
        </p>
        <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
          Wien, kuratiert von echten Wienerinnen und Wienern. Kein Kommerz,
          keine Werbung.
        </p>
        {errorHint && (
          <p className="mt-1.5 text-[11px] leading-snug text-primary">
            {errorHint}
          </p>
        )}
        {emptyHint && (
          <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
            {emptyHint}
          </p>
        )}
      </div>
    </div>
  );
}
