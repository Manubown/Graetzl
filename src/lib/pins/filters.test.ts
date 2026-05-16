import { describe, it, expect } from "vitest";
import {
  parseFiltersFromParams,
  writeFiltersToParams,
  applyFilters,
} from "./filters";
import type { Pin } from "./types";
import type { Category } from "@/lib/supabase/database.types";

function pin(overrides: Partial<Pin> = {}): Pin {
  return {
    id: "p1",
    author_id: "u1",
    author_handle: "alice",
    title: "Demo",
    body: "Body",
    category: "food_drink",
    language: "de",
    precision: "exact",
    city: "wien",
    photo_url: null,
    is_hidden: false,
    is_special: false,
    created_at: "2026-01-01T00:00:00Z",
    lng: 16.37,
    lat: 48.21,
    district_id: 1,
    ...overrides,
  };
}

describe("parseFiltersFromParams", () => {
  it("returns empty defaults for an empty URLSearchParams", () => {
    expect(parseFiltersFromParams(new URLSearchParams())).toEqual({
      categories: [],
      language: null,
    });
  });

  it("parses a single category from cat=", () => {
    const f = parseFiltersFromParams(new URLSearchParams("cat=food_drink"));
    expect(f.categories).toEqual(["food_drink"]);
  });

  it("parses comma-separated categories and drops unknown values", () => {
    const f = parseFiltersFromParams(
      new URLSearchParams("cat=food_drink,view,bogus,nightlife"),
    );
    expect(f.categories).toEqual(["food_drink", "view", "nightlife"]);
  });

  it("accepts known languages and rejects unknown", () => {
    expect(parseFiltersFromParams(new URLSearchParams("lang=de")).language).toBe("de");
    expect(parseFiltersFromParams(new URLSearchParams("lang=en")).language).toBe("en");
    expect(parseFiltersFromParams(new URLSearchParams("lang=fr")).language).toBeNull();
  });
});

describe("writeFiltersToParams", () => {
  it("returns an empty string when all filters are empty/null", () => {
    expect(
      writeFiltersToParams({ categories: [], language: null }).toString(),
    ).toBe("");
  });

  it("serialises categories as a comma-joined cat= value", () => {
    expect(
      writeFiltersToParams({
        categories: ["food_drink", "view"],
        language: null,
      }).toString(),
    ).toBe("cat=food_drink%2Cview");
  });

  it("round-trips through parse → write → parse without loss", () => {
    const original = "cat=food_drink,view&lang=en";
    const parsed = parseFiltersFromParams(new URLSearchParams(original));
    const written = writeFiltersToParams(parsed).toString();
    const reparsed = parseFiltersFromParams(new URLSearchParams(written));
    expect(reparsed).toEqual(parsed);
  });
});

describe("applyFilters", () => {
  const pins: Pin[] = [
    pin({ id: "a", category: "food_drink", language: "de" }),
    pin({ id: "b", category: "view", language: "en" }),
    pin({ id: "c", category: "nightlife", language: "de" }),
  ];

  it("returns all pins when filters are empty", () => {
    expect(
      applyFilters(pins, { categories: [], language: null }),
    ).toHaveLength(3);
  });

  it("filters by category", () => {
    const result = applyFilters(pins, {
      categories: ["food_drink", "nightlife"] as Category[],
      language: null,
    });
    expect(result.map((p) => p.id)).toEqual(["a", "c"]);
  });

  it("filters by language", () => {
    const result = applyFilters(pins, {
      categories: [],
      language: "en",
    });
    expect(result.map((p) => p.id)).toEqual(["b"]);
  });

  it("combines category and language filters", () => {
    const result = applyFilters(pins, {
      categories: ["food_drink"] as Category[],
      language: "de",
    });
    expect(result.map((p) => p.id)).toEqual(["a"]);
  });
});
