"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { snapTo100mGrid } from "@/lib/geo/snap";
import type { Category, Precision } from "@/lib/supabase/database.types";

const VALID_CATEGORIES: Category[] = [
  "food_drink",
  "view",
  "art_history",
  "nightlife",
  "hidden_gem",
  "warning",
  "other",
];

const VALID_LANGUAGES = ["de", "en"];

export type CreatePinResult =
  | { ok: true; pinId: string }
  | { ok: false; error: string };

/**
 * Validate + create a pin.
 *
 * Inputs come in as FormData so the same Action can be called from a
 * vanilla <form action={...}>. RLS on `pins` ensures the row's
 * `author_id` matches `auth.uid()`; we set it explicitly here for
 * clarity.
 */
export async function createPin(formData: FormData): Promise<CreatePinResult> {
  const supabase = await createClient();

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) {
    return { ok: false, error: "Bitte zuerst anmelden." };
  }

  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const category = String(formData.get("category") ?? "") as Category;
  const language = String(formData.get("language") ?? "de");
  const precision = String(formData.get("precision") ?? "exact") as Precision;
  const lngRaw = Number(formData.get("lng"));
  const latRaw = Number(formData.get("lat"));
  const photoUrl = String(formData.get("photo_url") ?? "").trim() || null;

  // --- Validation ----------------------------------------------------
  if (title.length < 1 || title.length > 80) {
    return { ok: false, error: "Titel muss 1–80 Zeichen lang sein." };
  }
  if (body.length < 1 || body.length > 500) {
    return { ok: false, error: "Beschreibung muss 1–500 Zeichen lang sein." };
  }
  if (!VALID_CATEGORIES.includes(category)) {
    return { ok: false, error: "Ungültige Kategorie." };
  }
  if (!VALID_LANGUAGES.includes(language)) {
    return { ok: false, error: "Ungültige Sprache." };
  }
  if (precision !== "exact" && precision !== "approximate") {
    return { ok: false, error: "Ungültige Präzision." };
  }
  if (!Number.isFinite(lngRaw) || !Number.isFinite(latRaw)) {
    return { ok: false, error: "Ungültige Koordinaten." };
  }
  // Vienna bbox sanity check — refuse pins outside the launch city.
  if (
    lngRaw < 16.18 ||
    lngRaw > 16.58 ||
    latRaw < 48.10 ||
    latRaw > 48.33
  ) {
    return { ok: false, error: "Pin liegt außerhalb von Wien." };
  }

  // --- Coordinate handling ------------------------------------------
  let lng = lngRaw;
  let lat = latRaw;
  if (precision === "approximate") {
    const snapped = snapTo100mGrid(latRaw, lngRaw);
    lat = snapped.lat;
    lng = snapped.lng;
  }

  // PostGIS accepts SRID-tagged WKT for geography insertion.
  const locationWkt = `SRID=4326;POINT(${lng} ${lat})`;

  // --- Insert -------------------------------------------------------
  const { data, error } = await supabase
    .from("pins")
    .insert({
      author_id: user.id,
      title,
      body,
      category,
      language,
      location: locationWkt,
      precision,
      photo_url: photoUrl,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[createPin] insert failed:", error);
    return {
      ok: false,
      error: error?.message ?? "Pin konnte nicht gespeichert werden.",
    };
  }

  // Invalidate the home page cache so the new pin appears on the map.
  revalidatePath("/");

  return { ok: true, pinId: data.id };
}

/**
 * Convenience for <form action={createPinAndRedirect}>. Calls
 * createPin, then either redirects to the new pin or throws.
 */
export async function createPinAndRedirect(formData: FormData) {
  const result = await createPin(formData);
  if (!result.ok) {
    throw new Error(result.error);
  }
  redirect(`/pin/${result.pinId}`);
}
