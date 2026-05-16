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

/** Vienna has 23 Bezirke, numbered 1..23. */
const MIN_BEZIRK = 1;
const MAX_BEZIRK = 23;

export interface PinFilters {
  /** Empty array = all categories. */
  categories: Category[];
  /** null = all languages. */
  language: string | null;
  /**
   * Vienna Bezirk filter (1..23) or `null` for "all districts".
   * Lives in the URL as `?bezirk=<n>`. Invalid values are normalised
   * to null at parse time so a malformed URL never breaks the map.
   */
  bezirk: number | null;
}

/** Reads category + language + bezirk filters from a URLSearchParams. */
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

  const bezirkRaw = (params.get("bezirk") ?? "").trim();
  // Use Number() rather than parseInt so "1.5" → 1.5 → rejected by isInteger,
  // not silently truncated to 1.
  const bezirkParsed = bezirkRaw ? Number(bezirkRaw) : NaN;
  const bezirk =
    Number.isInteger(bezirkParsed) &&
    bezirkParsed >= MIN_BEZIRK &&
    bezirkParsed <= MAX_BEZIRK
      ? bezirkParsed
      : null;

  return { categories, language, bezirk };
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
  if (filters.bezirk !== null) {
    out.set("bezirk", String(filters.bezirk));
  } else {
    out.delete("bezirk");
  }
  return out;
}

/**
 * Pure filter — applied client-side on the loaded pin array.
 *
 * For the bezirk filter, server-side filtering via the
 * `pins_in_bbox_filtered` RPC (B-6, B-14) is the primary path: when
 * the bezirk filter is active, the server returns only matching pins
 * so this function is effectively a no-op for that axis. We still
 * honour `bezirk` here as belt-and-braces in case the loaded pin set
 * contains stale rows (e.g. before B-14's RPC wiring lands, or in
 * test setups where the client array is built without the server
 * filter).
 */
export function applyFilters(pins: Pin[], filters: PinFilters): Pin[] {
  if (
    filters.categories.length === 0 &&
    !filters.language &&
    filters.bezirk === null
  ) {
    return pins;
  }
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
    if (filters.bezirk !== null && p.district_id !== filters.bezirk) {
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
