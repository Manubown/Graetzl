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

/**
 * Photo URLs come from the client. Without this check, anyone scripting
 * the public Server Action could store `javascript:`, `data:`, or any
 * attacker-controlled https URL as a pin's image — turning the photo
 * field into a phishing/SSRF/fingerprinting vector. We require the URL
 * to live on the Supabase Storage host, under the *current* user's UID
 * prefix in the `pin-photos` bucket.
 */
function isOwnPinPhotoUrl(url: string, userId: string): boolean {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!baseUrl) return false;

  let parsed: URL;
  let base: URL;
  try {
    parsed = new URL(url);
    base = new URL(baseUrl);
  } catch {
    return false;
  }

  if (parsed.protocol !== "https:") return false;
  if (parsed.origin !== base.origin) return false;

  const expectedPrefix = `/storage/v1/object/public/pin-photos/${userId}/`;
  return parsed.pathname.startsWith(expectedPrefix);
}

export type CreatePinResult =
  | { ok: true; pinId: string }
  | { ok: false; error: string };

export type ToggleResult =
  | { ok: true; active: boolean }
  | { ok: false; error: string };

/**
 * Validate + create a pin. See drop-pin-modal for the calling code.
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
  if (
    lngRaw < 16.18 || lngRaw > 16.58 ||
    latRaw < 48.10 || latRaw > 48.33
  ) {
    return { ok: false, error: "Pin liegt außerhalb von Wien." };
  }
  if (photoUrl !== null && !isOwnPinPhotoUrl(photoUrl, user.id)) {
    return { ok: false, error: "Foto-URL ist ungültig." };
  }

  let lng = lngRaw;
  let lat = latRaw;
  if (precision === "approximate") {
    const snapped = snapTo100mGrid(latRaw, lngRaw);
    lat = snapped.lat;
    lng = snapped.lng;
  }

  // Resolve the Vienna Bezirk for this pin's final coordinates.
  // Returns null if the point falls outside all seeded boundaries —
  // e.g. an approximate-precision snap that crossed a district edge.
  // A null district_id is a valid "unknown district" state (ADR-04).
  const { data: districtId } = await supabase.rpc("district_at_point", {
    p_lng: lng,
    p_lat: lat,
  });

  const locationWkt = `SRID=4326;POINT(${lng} ${lat})`;

  const { data, error } = await supabase
    .from("pins")
    .insert({
      author_id: user.id,
      title, body, category, language,
      location: locationWkt,
      precision,
      photo_url: photoUrl,
      district_id: districtId ?? null,
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

  revalidatePath("/");
  return { ok: true, pinId: data.id };
}

export async function createPinAndRedirect(formData: FormData) {
  const result = await createPin(formData);
  if (!result.ok) throw new Error(result.error);
  redirect(`/pin/${result.pinId}`);
}

export type UpdatePinResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Update an existing pin's editable metadata. Mirrors createPin's
 * validation rules with two differences:
 *   • author_id is NOT changed (immutable; verified against caller via RLS)
 *   • location / precision / district_id are NOT editable — pin moves
 *     are a conceptually different operation (would invalidate
 *     district_id, ST_Contains assumptions, and the existing
 *     district pin_count_cached without trigger re-fire)
 *
 * Returns the same shape as createPin's error path so the modal can
 * surface the message. Pin authorship is enforced both here (defensive
 * check) and by RLS (`pins_update_self`).
 */
export async function updatePin(
  pinId: string,
  formData: FormData,
): Promise<UpdatePinResult> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) {
    return { ok: false, error: "Bitte zuerst anmelden." };
  }

  // Defensive check: the pin must exist and be owned by the caller.
  // RLS would reject the UPDATE silently otherwise, returning an
  // undifferentiated empty result that's hard to distinguish from
  // "no fields changed".
  const { data: existing, error: probeErr } = await supabase
    .from("pins")
    .select("author_id")
    .eq("id", pinId)
    .maybeSingle();
  if (probeErr) return { ok: false, error: probeErr.message };
  if (!existing) return { ok: false, error: "Pin nicht gefunden." };
  if (existing.author_id !== user.id) {
    return { ok: false, error: "Du kannst nur eigene Pins bearbeiten." };
  }

  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const category = String(formData.get("category") ?? "") as Category;
  const language = String(formData.get("language") ?? "de");
  // photo_url has three states: empty string = remove photo, null = no
  // change, non-empty string = new photo URL. The form sends an explicit
  // `photo_action` field to disambiguate "remove" vs "keep" without
  // requiring the existing URL to round-trip through the client.
  const photoAction = String(formData.get("photo_action") ?? "keep");
  const newPhotoUrl = String(formData.get("photo_url") ?? "").trim() || null;

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
  if (newPhotoUrl !== null && !isOwnPinPhotoUrl(newPhotoUrl, user.id)) {
    return { ok: false, error: "Foto-URL ist ungültig." };
  }

  const updates: Record<string, unknown> = {
    title,
    body,
    category,
    language,
  };
  if (photoAction === "remove") {
    updates.photo_url = null;
  } else if (photoAction === "replace" && newPhotoUrl !== null) {
    updates.photo_url = newPhotoUrl;
  }
  // photoAction === "keep" → photo_url untouched

  const { error } = await supabase
    .from("pins")
    .update(updates)
    .eq("id", pinId)
    .eq("author_id", user.id);

  if (error) {
    console.error("[updatePin] update failed:", error);
    return {
      ok: false,
      error: error.message ?? "Pin konnte nicht gespeichert werden.",
    };
  }

  revalidatePath(`/pin/${pinId}`);
  revalidatePath("/");
  return { ok: true };
}

/**
 * Toggle the current user's upvote on a pin.
 *
 * Returns the new active state. RLS forbids self-upvotes via the
 * `upvotes_insert_self_not_self_pin` policy (Week 1 migration).
 */
export async function toggleUpvote(pinId: string): Promise<ToggleResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Bitte zuerst anmelden." };

  // Probe current state — cheaper than upsert + select.
  const { data: existing, error: probeErr } = await supabase
    .from("upvotes")
    .select("user_id")
    .eq("user_id", user.id)
    .eq("pin_id", pinId)
    .maybeSingle();
  if (probeErr) {
    return { ok: false, error: probeErr.message };
  }

  if (existing) {
    const { error } = await supabase
      .from("upvotes")
      .delete()
      .eq("user_id", user.id)
      .eq("pin_id", pinId);
    if (error) return { ok: false, error: error.message };
    revalidatePath(`/pin/${pinId}`);
    return { ok: true, active: false };
  }

  const { error } = await supabase
    .from("upvotes")
    .insert({ user_id: user.id, pin_id: pinId });
  if (error) {
    // The "not self pin" policy returns a 403; surface a friendlier message.
    if (error.message.toLowerCase().includes("row-level security")) {
      return {
        ok: false,
        error: "Eigene Pins können nicht hochgevotet werden.",
      };
    }
    return { ok: false, error: error.message };
  }
  revalidatePath(`/pin/${pinId}`);
  return { ok: true, active: true };
}

/**
 * Toggle the current user's save on a pin. Saves are private (RLS).
 */
export async function toggleSave(pinId: string): Promise<ToggleResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Bitte zuerst anmelden." };

  const { data: existing, error: probeErr } = await supabase
    .from("saves")
    .select("user_id")
    .eq("user_id", user.id)
    .eq("pin_id", pinId)
    .maybeSingle();
  if (probeErr) {
    return { ok: false, error: probeErr.message };
  }

  if (existing) {
    const { error } = await supabase
      .from("saves")
      .delete()
      .eq("user_id", user.id)
      .eq("pin_id", pinId);
    if (error) return { ok: false, error: error.message };
    revalidatePath(`/pin/${pinId}`);
    return { ok: true, active: false };
  }

  const { error } = await supabase
    .from("saves")
    .insert({ user_id: user.id, pin_id: pinId });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/pin/${pinId}`);
  return { ok: true, active: true };
}
