"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, adminSupabase } from "./guard";
import type { ReportStatus } from "@/lib/supabase/database.types";

export type AdminActionResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Mark a pin as hidden — removes it from public maps and feeds, but
 * keeps the row + photo for audit purposes.
 */
export async function hidePin(pinId: string): Promise<AdminActionResult> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: "Nicht berechtigt." };
  }
  const sb = adminSupabase();
  const { error } = await sb.from("pins").update({ is_hidden: true }).eq("id", pinId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin");
  revalidatePath(`/pin/${pinId}`);
  revalidatePath("/");
  return { ok: true };
}

/**
 * Un-hide a previously hidden pin.
 */
export async function unhidePin(pinId: string): Promise<AdminActionResult> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: "Nicht berechtigt." };
  }
  const sb = adminSupabase();
  const { error } = await sb.from("pins").update({ is_hidden: false }).eq("id", pinId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin");
  revalidatePath(`/pin/${pinId}`);
  revalidatePath("/");
  return { ok: true };
}

/**
 * Mark a pin as a "Geheimtipp" (or clear the flag). Admin-only;
 * regular users cannot self-mark even via the bare REST API because
 * no RLS policy permits UPDATEs to is_special. The service-role
 * client used here bypasses RLS — the requireAdmin() check above is
 * the sole gate.
 */
export async function setPinSpecial(
  pinId: string,
  isSpecial: boolean,
): Promise<AdminActionResult> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: "Nicht berechtigt." };
  }
  const sb = adminSupabase();
  const { error } = await sb
    .from("pins")
    .update({ is_special: isSpecial })
    .eq("id", pinId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin");
  revalidatePath(`/pin/${pinId}`);
  revalidatePath("/");
  return { ok: true };
}

/**
 * Update a report's status (reviewed / dismissed).
 */
export async function setReportStatus(
  reportId: string,
  status: ReportStatus,
): Promise<AdminActionResult> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: "Nicht berechtigt." };
  }
  const sb = adminSupabase();
  const { error } = await sb.from("reports").update({ status }).eq("id", reportId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin");
  return { ok: true };
}
