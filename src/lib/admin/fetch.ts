import { requireAdmin, adminSupabase } from "./guard";
import type {
  PinWithCoordsRow,
  ReportReason,
  ReportStatus,
} from "@/lib/supabase/database.types";

export interface ReportRowWithContext {
  id: string;
  reason: ReportReason;
  notes: string | null;
  status: ReportStatus;
  created_at: string;
  reporter_handle: string | null;
  pin: PinWithCoordsRow | null;
}

/**
 * Returns the most recent reports (default 100) with the pin + the
 * reporter's handle joined in. Bypasses RLS via service-role.
 * Caller must have already passed requireAdmin().
 */
export async function fetchReportsWithContext(
  statusFilter: ReportStatus | "all" = "open",
  limit = 100,
): Promise<ReportRowWithContext[]> {
  await requireAdmin();
  const sb = adminSupabase();

  let q = sb
    .from("reports")
    .select("id, reason, notes, status, created_at, reporter_id, pin_id")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (statusFilter !== "all") q = q.eq("status", statusFilter);

  const { data: reports, error } = await q;
  if (error) throw error;
  const reportRows = (reports ?? []) as Array<{
    id: string;
    reason: ReportReason;
    notes: string | null;
    status: ReportStatus;
    created_at: string;
    reporter_id: string | null;
    pin_id: string;
  }>;
  if (reportRows.length === 0) return [];

  // Batch-fetch the related pins + reporter handles.
  const pinIds = Array.from(new Set(reportRows.map((r) => r.pin_id)));
  const reporterIds = Array.from(
    new Set(reportRows.map((r) => r.reporter_id).filter((x): x is string => !!x)),
  );

  const [pinsRes, profilesRes] = await Promise.all([
    sb.from("pins_with_coords").select("*").in("id", pinIds),
    reporterIds.length > 0
      ? sb.from("profiles").select("id, handle").in("id", reporterIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (pinsRes.error) throw pinsRes.error;
  if (profilesRes.error) throw profilesRes.error;

  const pinById = new Map<string, PinWithCoordsRow>();
  for (const p of (pinsRes.data ?? []) as PinWithCoordsRow[]) {
    pinById.set(p.id, p);
  }
  const handleById = new Map<string, string>();
  for (const p of (profilesRes.data ?? []) as Array<{ id: string; handle: string }>) {
    handleById.set(p.id, p.handle);
  }

  return reportRows.map((r) => ({
    id: r.id,
    reason: r.reason,
    notes: r.notes,
    status: r.status,
    created_at: r.created_at,
    reporter_handle: r.reporter_id ? handleById.get(r.reporter_id) ?? null : null,
    pin: pinById.get(r.pin_id) ?? null,
  }));
}
