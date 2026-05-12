"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { CATEGORIES, LANGUAGES } from "@/lib/pins/constants";
import {
  parseFiltersFromParams,
  writeFiltersToParams,
  type PinFilters,
} from "@/lib/pins/filters";
import type { Category } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

/**
 * URL-driven filter chips. State lives in `?cat=food_drink,view&lang=de`,
 * so filtered views are shareable / back-and-forward friendly.
 */
export function FilterBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filters = parseFiltersFromParams(searchParams);
  const [pending, startTransition] = useTransition();

  function updateFilters(next: PinFilters) {
    const params = writeFiltersToParams(next, new URLSearchParams(searchParams));
    const query = params.toString();
    startTransition(() => {
      router.replace(query ? `/?${query}` : "/", { scroll: false });
    });
  }

  function toggleCategory(cat: Category) {
    const set = new Set(filters.categories);
    if (set.has(cat)) set.delete(cat);
    else set.add(cat);
    updateFilters({ ...filters, categories: Array.from(set) });
  }

  function setLanguage(lang: string | null) {
    updateFilters({ ...filters, language: lang });
  }

  function clearAll() {
    updateFilters({ categories: [], language: null });
  }

  const anyActive = filters.categories.length > 0 || filters.language !== null;

  return (
    <div
      className={cn(
        "pointer-events-auto absolute inset-x-0 top-2 z-20 mx-auto flex max-w-3xl flex-wrap items-center gap-1.5 overflow-x-auto rounded-full border border-border bg-background/85 px-3 py-1.5 shadow-md backdrop-blur-md",
        pending && "opacity-80",
      )}
      role="group"
      aria-label="Pin-Filter"
    >
      {CATEGORIES.map((c) => {
        const active = filters.categories.includes(c.value);
        return (
          <button
            key={c.value}
            type="button"
            onClick={() => toggleCategory(c.value)}
            aria-pressed={active}
            className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
              active
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background hover:bg-muted",
            )}
            title={c.label}
          >
            <span aria-hidden>{c.emoji}</span>
            <span className="hidden sm:inline">{c.label}</span>
          </button>
        );
      })}

      <span className="mx-1 hidden h-4 w-px bg-border sm:inline-block" aria-hidden />

      <button
        type="button"
        onClick={() => setLanguage(null)}
        aria-pressed={filters.language === null}
        className={cn(
          "inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
          filters.language === null
            ? "border-foreground bg-foreground text-background"
            : "border-border bg-background hover:bg-muted",
        )}
        title="Alle Sprachen"
      >
        Alle
      </button>
      {LANGUAGES.map((l) => (
        <button
          key={l.value}
          type="button"
          onClick={() => setLanguage(l.value)}
          aria-pressed={filters.language === l.value}
          className={cn(
            "inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-xs font-medium uppercase transition-colors",
            filters.language === l.value
              ? "border-foreground bg-foreground text-background"
              : "border-border bg-background hover:bg-muted",
          )}
          title={l.label}
        >
          {l.value}
        </button>
      ))}

      {anyActive && (
        <button
          type="button"
          onClick={clearAll}
          className="ml-auto inline-flex shrink-0 items-center rounded-full px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Filter zurücksetzen"
        >
          ✕ Zurücksetzen
        </button>
      )}
    </div>
  );
}
