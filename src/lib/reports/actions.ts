"use server";

import { createClient } from "@/lib/supabase/server";
import type { ReportReason } from "@/lib/supabase/database.types";

const VALID_REASONS: ReportReason[] = [
  "spam",
  "commercial",
  "illegal",
  "harassment",
  "inaccurate",
  "unsafe",
  "other",
];

export type CreateReportResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Submit a report against a pin. Anyone authenticated can report;
 * RLS on `reports` enforces that reporter_id = auth.uid().
 *
 * Reports are write-only from the public side — admins read them
 * via the service-role client.
 */
export async function createReport(
  formData: FormData,
): Promise<CreateReportResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Bitte zuerst anmelden." };

  const pinId = String(formData.get("pin_id") ?? "").trim();
  const reason = String(formData.get("reason") ?? "") as ReportReason;
  const notesRaw = String(formData.get("notes") ?? "").trim();

  if (!pinId) return { ok: false, error: "Pin fehlt." };
  if (!VALID_REASONS.includes(reason)) {
    return { ok: false, error: "Ungültiger Grund." };
  }
  if (notesRaw.length > 500) {
    return { ok: false, error: "Notiz darf max. 500 Zeichen lang sein." };
  }

  const { error } = await supabase.from("reports").insert({
    pin_id: pinId,
    reporter_id: user.id,
    reason,
    notes: notesRaw.length > 0 ? notesRaw : null,
  });

  if (error) {
    console.error("[createReport] insert failed:", error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
