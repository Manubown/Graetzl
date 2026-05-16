"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SlidersHorizontal, X } from "lucide-react";
import { CATEGORIES, LANGUAGES } from "@/lib/pins/constants";
import {
  parseFiltersFromParams,
  writeFiltersToParams,
  type PinFilters,
} from "@/lib/pins/filters";
import type { Category } from "@/lib/supabase/database.types";
import { Sheet, SheetContent, SheetHeader, SheetFooter, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function FilterBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filters = parseFiltersFromParams(searchParams);
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  function update(next: PinFilters) {
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
    update({ ...filters, categories: Array.from(set) });
  }

  function setLanguage(lang: string | null) {
    update({ ...filters, language: lang });
  }

  function clearAll() {
    update({ categories: [], language: null, bezirk: null });
  }

  const activeCount =
    filters.categories.length + (filters.language ? 1 : 0);

  const langLabel = filters.language
    ? LANGUAGES.find((l) => l.value === filters.language)?.label ?? null
    : null;

  const activeCategoryObjs = filters.categories
    .map((c) => CATEGORIES.find((C) => C.value === c))
    .filter((c): c is (typeof CATEGORIES)[number] => Boolean(c));

  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-3 z-20 flex justify-center px-3">
        <div className="pointer-events-auto flex max-w-full items-center gap-1.5 overflow-x-auto rounded-full border border-border bg-background/85 px-1.5 py-1 shadow-sm backdrop-blur-md">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium",
              "transition-colors duration-[var(--motion-fast)] ease-[var(--motion-ease)]",
              activeCount > 0
                ? "bg-foreground text-background hover:opacity-90"
                : "hover:bg-muted",
            )}
            aria-label="Filter öffnen"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span>Filter</span>
            {activeCount > 0 && (
              <span className="ml-0.5 rounded-full bg-background/20 px-1.5 py-0.5 text-[10px] tabular-nums">
                {activeCount}
              </span>
            )}
          </button>

          {activeCategoryObjs.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => toggleCategory(c.value)}
              className="hidden shrink-0 items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium hover:bg-muted/70 sm:inline-flex"
              aria-label={`${c.label} entfernen`}
            >
              <span aria-hidden>{c.emoji}</span>
              <span>{c.label}</span>
              <X className="h-3 w-3 text-muted-foreground" />
            </button>
          ))}
          {langLabel && (
            <button
              type="button"
              onClick={() => setLanguage(null)}
              className="hidden shrink-0 items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium hover:bg-muted/70 sm:inline-flex"
              aria-label="Sprachfilter entfernen"
            >
              {langLabel}
              <X className="h-3 w-3 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent aria-label="Filter">
          <SheetHeader>
            <SheetTitle>Filter</SheetTitle>
          </SheetHeader>

          <div className="flex max-h-[70vh] flex-col gap-5 overflow-y-auto px-5 py-4">
            <fieldset>
              <legend className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Kategorie
              </legend>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORIES.map((c) => {
                  const active = filters.categories.includes(c.value);
                  return (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => toggleCategory(c.value)}
                      aria-pressed={active}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm",
                        "transition-colors duration-[var(--motion-fast)] ease-[var(--motion-ease)]",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
                        "focus-visible:ring-[var(--accent)] dark:focus-visible:ring-[var(--primary)]",
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background hover:bg-muted",
                      )}
                    >
                      <span aria-hidden>{c.emoji}</span>
                      <span>{c.label}</span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <fieldset>
              <legend className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Sprache
              </legend>
              <div className="flex flex-wrap gap-1.5">
                <LangPill
                  active={filters.language === null}
                  label="Alle"
                  onClick={() => setLanguage(null)}
                />
                {LANGUAGES.map((l) => (
                  <LangPill
                    key={l.value}
                    active={filters.language === l.value}
                    label={l.label}
                    onClick={() => setLanguage(l.value)}
                  />
                ))}
              </div>
            </fieldset>
          </div>

          <SheetFooter>
            <Button type="button" variant="ghost" onClick={clearAll}>
              Zurücksetzen
            </Button>
            <Button type="button" onClick={() => setOpen(false)}>
              Fertig
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}

function LangPill({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1.5 text-sm",
        "transition-colors duration-[var(--motion-fast)] ease-[var(--motion-ease)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        "focus-visible:ring-[var(--accent)] dark:focus-visible:ring-[var(--primary)]",
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-background hover:bg-muted",
      )}
    >
      {label}
    </button>
  );
}
