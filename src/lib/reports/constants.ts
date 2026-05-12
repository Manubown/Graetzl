import type { ReportReason } from "@/lib/supabase/database.types";

/**
 * UI labels for the 7 report reasons defined in the schema.
 * Order chosen for the dropdown — most common first.
 */
export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: "spam",         label: "Spam" },
  { value: "commercial",   label: "Kommerziell (Werbung, Geschäft)" },
  { value: "inaccurate",   label: "Falsche oder irreführende Info" },
  { value: "harassment",   label: "Belästigung oder Hass" },
  { value: "unsafe",       label: "Gefährlich oder unsicher" },
  { value: "illegal",      label: "Illegale Inhalte" },
  { value: "other",        label: "Sonstiges" },
];
