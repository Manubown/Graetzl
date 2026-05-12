"use client";

import { useState, useTransition } from "react";
import { Dialog } from "@/components/ui/dialog";
import { REPORT_REASONS } from "@/lib/reports/constants";
import { createReport } from "@/lib/reports/actions";

interface ReportModalProps {
  pinId: string;
  open: boolean;
  onClose: () => void;
}

export function ReportModal({ pinId, open, onClose }: ReportModalProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  function handleClose() {
    setError(null);
    setSubmitted(false);
    onClose();
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    fd.set("pin_id", pinId);

    startTransition(async () => {
      const result = await createReport(fd);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSubmitted(true);
    });
  }

  return (
    <Dialog open={open} onClose={handleClose} title="Pin melden">
      {submitted ? (
        <div className="flex flex-col gap-3 text-sm">
          <p>
            <span className="font-medium">Danke.</span> Die Meldung wurde an
            das Team weitergeleitet.
          </p>
          <p className="text-xs text-muted-foreground">
            Wir schauen uns jeden Report an. Wiederkehrende Verstöße führen zur
            Entfernung des Pins.
          </p>
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90"
            >
              Schließen
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <p className="text-xs text-muted-foreground">
            Hilf uns, Grätzl sauber zu halten. Was stimmt mit diesem Pin nicht?
          </p>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Grund</span>
            <select
              name="reason"
              required
              defaultValue=""
              className="rounded-lg border border-border bg-background px-3 py-2 outline-none ring-primary/30 focus:ring-2"
            >
              <option value="" disabled>
                Bitte wählen…
              </option>
              {REPORT_REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">
              Notiz <span className="text-xs text-muted-foreground">(optional)</span>
            </span>
            <textarea
              name="notes"
              rows={3}
              maxLength={500}
              placeholder="Mehr Kontext (optional)…"
              className="resize-none rounded-lg border border-border bg-background px-3 py-2 outline-none ring-primary/30 focus:ring-2"
            />
          </label>

          {error && <p className="text-sm text-primary">{error}</p>}

          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-lg px-4 py-2 text-sm text-muted-foreground hover:bg-muted"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {pending ? "Wird gesendet…" : "Melden"}
            </button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
