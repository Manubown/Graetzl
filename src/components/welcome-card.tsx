"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { STORAGE_KEYS } from "@/lib/storage/keys";

interface WelcomeCardProps {
  emptyHint?: string;
  errorHint?: string;
}

function readDismissed(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(STORAGE_KEYS.WELCOME_DISMISSED) === "1";
  } catch {
    return false;
  }
}

/**
 * Small floating welcome banner. Designed to be present but not
 * dominate the map — short copy, low height, dismissible. Hidden
 * forever once dismissed (localStorage). The bump to v2 of the key
 * makes the banner reappear once for existing users after the
 * UI polish, in case they'd dismissed the older version.
 */
export function WelcomeCard({ emptyHint, errorHint }: WelcomeCardProps) {
  const [dismissed, setDismissed] = useState<boolean>(() => readDismissed());

  function handleDismiss() {
    setDismissed(true);
    try {
      window.localStorage.setItem(STORAGE_KEYS.WELCOME_DISMISSED, "1");
    } catch {
      /* ignore */
    }
  }

  if (dismissed) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-3 z-10 flex justify-center px-3">
      <Card className="pointer-events-auto relative max-w-md rounded-xl bg-background/90 px-4 py-2.5 pr-8 shadow-md backdrop-blur-md">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleDismiss}
          aria-label="Schließen"
          className="absolute right-1 top-1 h-7 w-7 text-muted-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
        <p className="text-sm font-medium tracking-tight">
          Willkommen in deinem Grätzl
        </p>
        <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
          Wien, kuratiert von echten Wienerinnen und Wienern. Kein Kommerz,
          keine Werbung.
        </p>
        {errorHint && (
          <p className="mt-1.5 text-xs leading-snug text-primary">
            {errorHint}
          </p>
        )}
        {emptyHint && (
          <p className="mt-1.5 text-xs leading-snug text-muted-foreground">
            {emptyHint}
          </p>
        )}
      </Card>
    </div>
  );
}
