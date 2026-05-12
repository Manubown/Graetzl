"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SlidersHorizontal, X } from "lucide-react";
import { CATEGORIES, LANGUAGES } from "@/lib/pins/constants";
import {
  parseFiltersFromParams,
  writeFiltersToParams,
  type PinFilters,
} from "@/lib/pins/filters";
import type { Category } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

/**
 * Map filter — collapsed by default. Tapping "Filter" opens a sheet
 * (bottom-anchored on mobile, centered card on ≥sm). Active filters
 * stay visible inline next to the trigger so the user knows what's
 * applied without opening the sheet.
 *
 * State source of truth: URL params (`?cat=…&lang=…`).
 */
export function FilterBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filters = parseFiltersFromParams(searchParams);
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  // Close the sheet on Escape, in case focus is outside it.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

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
    update({ categories: [], language: null });
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
      {/* Trigger row — sits above the map, doesn't intercept map gestures
          when empty space is between chips. */}
      <div className="pointer-events-none absolute inset-x-0 top-3 z-20 flex justify-center px-3">
        <div className="pointer-events-auto flex max-w-full items-center gap-1.5 overflow-x-auto rounded-full border border-border bg-background/85 px-1.5 py-1 shadow-sm backdrop-blur-md">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
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

          {/* Active filter chips — compact, removable. Hidden on
              very narrow viewports if there are many; user can still
              manage them via the sheet. */}
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

      {/* Backdrop + sheet — fixed positioning so it overlays everything,
          bottom-anchored on mobile, centered card on sm+. */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}
      <FilterSheet
        open={open}
        onClose={() => setOpen(false)}
        filters={filters}
        onToggleCategory={toggleCategory}
        onSetLanguage={setLanguage}
        onClear={clearAll}
      />
    </>
  );
}

interface SheetProps {
  open: boolean;
  onClose: () => void;
  filters: PinFilters;
  onToggleCategory: (c: Category) => void;
  onSetLanguage: (l: string | null) => void;
  onClear: () => void;
}

function FilterSheet({
  open,
  onClose,
  filters,
  onToggleCategory,
  onSetLanguage,
  onClear,
}: SheetProps) {
  const sheetRef = useRef<HTMLDivElement | null>(null);
  return (
    <div
      ref={sheetRef}
      role="dialog"
      aria-label="Filter"
      aria-hidden={!open}
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-md transform rounded-t-2xl border border-border bg-background shadow-2xl transition-all duration-200",
        "sm:bottom-auto sm:left-1/2 sm:top-20 sm:-translate-x-1/2 sm:rounded-2xl",
        open
          ? "translate-y-0 opacity-100"
          : "translate-y-full opacity-0 sm:translate-y-2",
        !open && "pointer-events-none",
      )}
    >
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <h2 className="text-base font-semibold tracking-tight">Filter</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Schließen"
          className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

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
                  onClick={() => onToggleCategory(c.value)}
                  aria-pressed={active}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors",
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
              onClick={() => onSetLanguage(null)}
            />
            {LANGUAGES.map((l) => (
              <LangPill
                key={l.value}
                active={filters.language === l.value}
                label={l.label}
                onClick={() => onSetLanguage(l.value)}
              />
            ))}
          </div>
        </fieldset>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border px-5 py-3">
        <button
          type="button"
          onClick={onClear}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Zurücksetzen
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90"
        >
          Fertig
        </button>
      </div>
    </div>
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
        "inline-flex items-center rounded-full border px-3 py-1.5 text-sm transition-colors",
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-background hover:bg-muted",
      )}
    >
      {label}
    </button>
  );
}
