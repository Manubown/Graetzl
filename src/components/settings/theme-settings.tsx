"use client";

import { useCallback, useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics/plausible";
import { cn } from "@/lib/utils";
import { STORAGE_KEYS } from "@/lib/storage/keys";

type ThemeChoice = "light" | "dark" | "system";

function resolveSystem(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function readStoredChoice(): ThemeChoice {
  if (typeof window === "undefined") return "system";
  try {
    const stored = window.localStorage.getItem(STORAGE_KEYS.THEME);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    /* localStorage may be blocked — treat as system */
  }
  return "system";
}

function applyTheme(choice: ThemeChoice) {
  if (typeof document === "undefined") return;
  const resolved = choice === "system" ? resolveSystem() : choice;
  document.documentElement.setAttribute("data-theme", resolved);
}

/**
 * Theme override toggle (C-11). Three states: Light / Dark / System.
 *
 * Source of truth is `localStorage["graetzl:theme"]`:
 *   • value "light" | "dark"  → user override
 *   • missing / anything else → follow `prefers-color-scheme`
 *
 * The inline `<head>` script in `app/layout.tsx` reads the same key
 * before paint so reloads don't FOUC. This component just keeps the
 * runtime state in sync and exposes the toggle.
 *
 * Fires Plausible `theme_resolved{theme}` once per mount with the
 * resolved (post-system) theme so we can size the dark-mode audience.
 */
export function ThemeSettings() {
  const [choice, setChoice] = useState<ThemeChoice>(() => readStoredChoice());

  useEffect(() => {
    const resolved = choice === "system" ? resolveSystem() : choice;
    track("theme_resolved", { theme: resolved });
  // Intentionally runs once on mount — `choice` from the lazy initializer
  // is the persisted preference, not a reactive value here.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When in "system" mode, react to OS-level changes live.
  useEffect(() => {
    if (choice !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [choice]);

  const handleChoose = useCallback((next: ThemeChoice) => {
    setChoice(next);
    try {
      if (next === "system") window.localStorage.removeItem(STORAGE_KEYS.THEME);
      else window.localStorage.setItem(STORAGE_KEYS.THEME, next);
    } catch {
      /* persistence is best-effort */
    }
    applyTheme(next);
  }, []);

  return (
    <div
      role="radiogroup"
      aria-label="Erscheinungsbild"
      suppressHydrationWarning
      className="inline-flex w-full max-w-sm items-center gap-1 rounded-lg bg-muted p-1"
    >
      <ThemeChoiceButton
        active={choice === "light"}
        onClick={() => handleChoose("light")}
        label="Hell"
        icon={<Sun className="h-4 w-4" />}
      />
      <ThemeChoiceButton
        active={choice === "dark"}
        onClick={() => handleChoose("dark")}
        label="Dunkel"
        icon={<Moon className="h-4 w-4" />}
      />
      <ThemeChoiceButton
        active={choice === "system"}
        onClick={() => handleChoose("system")}
        label="System"
        icon={<Monitor className="h-4 w-4" />}
      />
    </div>
  );
}

function ThemeChoiceButton({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      suppressHydrationWarning
      className={cn(
        "flex-1 justify-center gap-1.5",
        active && "bg-background text-foreground shadow-sm hover:bg-background",
      )}
    >
      {icon}
      {label}
    </Button>
  );
}
