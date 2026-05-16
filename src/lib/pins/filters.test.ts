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
      bezirk: null,
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

  it("accepts bezirk in [1, 23] and rejects everything else", () => {
    expect(parseFiltersFromParams(new URLSearchParams("bezirk=1")).bezirk).toBe(1);
    expect(parseFiltersFromParams(new URLSearchParams("bezirk=23")).bezirk).toBe(23);
    expect(parseFiltersFromParams(new URLSearchParams("bezirk=0")).bezirk).toBeNull();
    expect(parseFiltersFromParams(new URLSearchParams("bezirk=24")).bezirk).toBeNull();
    expect(parseFiltersFromParams(new URLSearchParams("bezirk=foo")).bezirk).toBeNull();
    expect(parseFiltersFromParams(new URLSearchParams("bezirk=1.5")).bezirk).toBeNull();
    expect(
      parseFiltersFromParams(new URLSearchParams("bezirk=1;DROP TABLE")).bezirk,
    ).toBeNull();
  });
});

describe("writeFiltersToParams", () => {
  it("returns an empty string when all filters are empty/null", () => {
    expect(
      writeFiltersToParams({ categories: [], language: null, bezirk: null }).toString(),
    ).toBe("");
  });

  it("serialises categories as a comma-joined cat= value", () => {
    expect(
      writeFiltersToParams({
        categories: ["food_drink", "view"],
        language: null,
        bezirk: null,
      }).toString(),
    ).toBe("cat=food_drink%2Cview");
  });

  it("round-trips through parse → write → parse without loss", () => {
    const original = "cat=food_drink,view&lang=en&bezirk=7";
    const parsed = parseFiltersFromParams(new URLSearchParams(original));
    const written = writeFiltersToParams(parsed).toString();
    const reparsed = parseFiltersFromParams(new URLSearchParams(written));
    expect(reparsed).toEqual(parsed);
  });
});

describe("applyFilters", () => {
  const pins: Pin[] = [
    pin({ id: "a", category: "food_drink", language: "de", district_id: 1 }),
    pin({ id: "b", category: "view", language: "en", district_id: 2 }),
    pin({ id: "c", category: "nightlife", language: "de", district_id: 1 }),
  ];

  it("returns all pins when filters are empty", () => {
    expect(
      applyFilters(pins, { categories: [], language: null, bezirk: null }),
    ).toHaveLength(3);
  });

  it("filters by category", () => {
    const result = applyFilters(pins, {
      categories: ["food_drink", "nightlife"] as Category[],
      language: null,
      bezirk: null,
    });
    expect(result.map((p) => p.id)).toEqual(["a", "c"]);
  });

  it("filters by language", () => {
    const result = applyFilters(pins, {
      categories: [],
      language: "en",
      bezirk: null,
    });
    expect(result.map((p) => p.id)).toEqual(["b"]);
  });

  it("filters by bezirk", () => {
    const result = applyFilters(pins, {
      categories: [],
      language: null,
      bezirk: 1,
    });
    expect(result.map((p) => p.id)).toEqual(["a", "c"]);
  });

  it("filters by bezirk and category combined", () => {
    const result = applyFilters(pins, {
      categories: ["food_drink"] as Category[],
      language: null,
      bezirk: 1,
    });
    expect(result.map((p) => p.id)).toEqual(["a"]);
  });

  it("returns empty array when bezirk matches no pins", () => {
    const result = applyFilters(pins, {
      categories: [],
      language: null,
      bezirk: 9,
    });
    expect(result).toHaveLength(0);
  });

  it("treats a pin with district_id null as not matching any bezirk filter", () => {
    const withNull = [
      ...pins,
      pin({ id: "d", district_id: null }),
    ];
    const result = applyFilters(withNull, {
      categories: [],
      language: null,
      bezirk: 1,
    });
    expect(result.map((p) => p.id)).not.toContain("d");
  });
});
