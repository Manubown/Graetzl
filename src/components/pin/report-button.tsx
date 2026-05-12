"use client";

import { useState } from "react";
import { Flag } from "lucide-react";
import { ReportModal } from "./report-modal";

export function ReportButton({ pinId }: { pinId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label="Pin melden"
      >
        <Flag className="h-3 w-3" />
        Melden
      </button>
      <ReportModal pinId={pinId} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
