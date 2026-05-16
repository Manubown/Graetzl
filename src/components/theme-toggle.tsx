"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { STORAGE_KEYS } from "@/lib/storage/keys";

type Theme = "light" | "dark";

/**
 * Header dark-mode toggle. Binary flip between light and dark; the
 * three-state Light/Dark/System picker lives at /me (ThemeSettings).
 *
 * Both controls write the same `localStorage["graetzl:theme"]` key
 * and the same `<html data-theme>` attribute that the blocking head
 * script in app/layout.tsx reads before first paint. ViennaMap's
 * MutationObserver picks up the change and swaps the PMTiles flavour.
 *
 * The icon is rendered after mount so SSR and first-paint client
 * render produce identical HTML (an empty 16×16 slot). Reading
 * document.dataset.theme during render would mismatch on hydration
 * because the FOUC script has already set the attribute by then.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    // Intentional: read the post-FOUC DOM attribute on mount to sync
    // React state with the value the blocking head script already set.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(
      document.documentElement.dataset.theme === "dark" ? "dark" : "light",
    );
  }, []);

  function toggle() {
    if (theme === null) return;
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      window.localStorage.setItem(STORAGE_KEYS.THEME, next);
    } catch {
      /* persistence is best-effort */
    }
  }

  const label =
    theme === "dark" ? "Helles Erscheinungsbild" : "Dunkles Erscheinungsbild";

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={toggle}
      aria-label={label}
      title={label}
      className="text-muted-foreground hover:text-foreground"
    >
      {theme === null ? (
        <span className="inline-block h-4 w-4" aria-hidden />
      ) : theme === "dark" ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
    </Button>
  );
}
