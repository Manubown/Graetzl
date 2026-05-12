import type { Category } from "@/lib/supabase/database.types";
import type { Pin } from "./types";

const VALID_CATEGORIES: readonly Category[] = [
  "food_drink",
  "view",
  "art_history",
  "nightlife",
  "hidden_gem",
  "warning",
  "other",
];

const VALID_LANGS = ["de", "en"] as const;

export interface PinFilters {
  /** Empty array = all categories. */
  categories: Category[];
  /** null = all languages. */
  language: string | null;
}

/** Reads category + language filters from a URLSearchParams. */
export function parseFiltersFromParams(
  params: URLSearchParams | ReadonlyURLSearchParams,
): PinFilters {
  const catRaw = (params.get("cat") ?? "").trim();
  const categories = catRaw
    ? catRaw
        .split(",")
        .map((s) => s.trim())
        .filter((s): s is Category =>
          VALID_CATEGORIES.includes(s as Category),
        )
    : [];

  const langRaw = (params.get("lang") ?? "").trim();
  const language = (VALID_LANGS as readonly string[]).includes(langRaw)
    ? langRaw
    : null;

  return { categories, language };
}

/** Writes filters back to a URLSearchParams-shaped object. */
export function writeFiltersToParams(
  filters: PinFilters,
  base?: URLSearchParams,
): URLSearchParams {
  const out = new URLSearchParams(base ?? "");
  if (filters.categories.length > 0) {
    out.set("cat", filters.categories.join(","));
  } else {
    out.delete("cat");
  }
  if (filters.language) {
    out.set("lang", filters.language);
  } else {
    out.delete("lang");
  }
  return out;
}

/** Pure filter — applied client-side on the loaded pin array. */
export function applyFilters(pins: Pin[], filters: PinFilters): Pin[] {
  if (filters.categories.length === 0 && !filters.language) return pins;
  return pins.filter((p) => {
    if (
      filters.categories.length > 0 &&
      !filters.categories.includes(p.category)
    ) {
      return false;
    }
    if (filters.language && p.language !== filters.language) {
      return false;
    }
    return true;
  });
}

/** Forward-compat alias to keep importers happy when the upstream
 *  `ReadonlyURLSearchParams` symbol changes shape. */
type ReadonlyURLSearchParams = {
  get(name: string): string | null;
};
