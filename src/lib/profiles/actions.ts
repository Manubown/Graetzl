"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const HANDLE_RE = /^[a-z0-9](?:[a-z0-9_]{1,28}[a-z0-9])?$/i;

export type UpdateProfileResult =
  | { ok: true; handle: string }
  | { ok: false; error: string };

/**
 * Update the current user's profile. Only the owner can update their
 * own row (RLS enforces this independently).
 *
 * `handle` is validated client-side and server-side. Conflicts on the
 * citext UNIQUE constraint surface as a friendly "Handle bereits vergeben".
 */
export async function updateProfile(
  formData: FormData,
): Promise<UpdateProfileResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Bitte zuerst anmelden." };

  const handleRaw = String(formData.get("handle") ?? "").trim();
  const bioRaw = String(formData.get("bio") ?? "").trim();
  const homeCityRaw = String(formData.get("home_city") ?? "").trim();

  if (!HANDLE_RE.test(handleRaw)) {
    return {
      ok: false,
      error:
        "Handle: 3–30 Zeichen, nur Buchstaben, Zahlen und _. Anfang/Ende ohne Unterstrich.",
    };
  }
  if (bioRaw.length > 280) {
    return { ok: false, error: "Bio darf max. 280 Zeichen lang sein." };
  }
  if (homeCityRaw.length > 60) {
    return { ok: false, error: "Stadt darf max. 60 Zeichen lang sein." };
  }

  const update = {
    handle: handleRaw,
    bio: bioRaw.length > 0 ? bioRaw : null,
    home_city: homeCityRaw.length > 0 ? homeCityRaw : "Vienna",
  };

  const { data, error } = await supabase
    .from("profiles")
    .update(update)
    .eq("id", user.id)
    .select("handle")
    .single();

  if (error) {
    // 23505 = unique_violation (citext UNIQUE on handle)
    if (
      error.code === "23505" ||
      error.message.toLowerCase().includes("duplicate")
    ) {
      return { ok: false, error: "Dieser Handle ist bereits vergeben." };
    }
    return { ok: false, error: error.message };
  }

  const newHandle = (data as { handle: string }).handle;
  revalidatePath(`/u/${newHandle}`);
  revalidatePath("/", "layout"); // header shows the handle
  return { ok: true, handle: newHandle };
}

/**
 * Convenience: same as updateProfile, but navigates to the (possibly
 * renamed) profile on success. Used by the profile edit form.
 */
export async function updateProfileAndRedirect(formData: FormData) {
  const result = await updateProfile(formData);
  if (!result.ok) throw new Error(result.error);
  redirect(`/u/${result.handle}`);
}
