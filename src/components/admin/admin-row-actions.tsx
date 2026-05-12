"use client";

import { useState, useTransition } from "react";
import { hidePin, unhidePin, setReportStatus } from "@/lib/admin/actions";

interface AdminRowActionsProps {
  reportId: string;
  pinId: string;
  pinHidden: boolean;
  reportStatus: "open" | "reviewed" | "dismissed";
}

export function AdminRowActions({
  reportId,
  pinId,
  pinHidden,
  reportStatus,
}: AdminRowActionsProps) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function wrap(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    start(async () => {
      const r = await fn();
      if (!r.ok) setError(r.error ?? "Aktion fehlgeschlagen.");
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      {pinHidden ? (
        <button
          type="button"
          onClick={() => wrap(() => unhidePin(pinId))}
          disabled={pending}
          className="rounded-md border border-border bg-background px-2 py-1 hover:bg-muted disabled:opacity-50"
        >
          Einblenden
        </button>
      ) : (
        <button
          type="button"
          onClick={() => wrap(() => hidePin(pinId))}
          disabled={pending}
          className="rounded-md bg-primary px-2 py-1 text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          Verbergen
        </button>
      )}
      {reportStatus === "open" && (
        <>
          <button
            type="button"
            onClick={() => wrap(() => setReportStatus(reportId, "reviewed"))}
            disabled={pending}
            className="rounded-md border border-border bg-background px-2 py-1 hover:bg-muted disabled:opacity-50"
          >
            Geprüft
          </button>
          <button
            type="button"
            onClick={() => wrap(() => setReportStatus(reportId, "dismissed"))}
            disabled={pending}
            className="rounded-md border border-border bg-background px-2 py-1 hover:bg-muted disabled:opacity-50"
          >
            Verwerfen
          </button>
        </>
      )}
      {error && <span className="text-primary">{error}</span>}
    </div>
  );
}
