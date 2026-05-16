"use client";

import { useState } from "react";
import { Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReportModal } from "./report-modal";

export function ReportButton({ pinId }: { pinId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        aria-label="Pin melden"
        className="text-muted-foreground hover:text-foreground"
      >
        <Flag className="h-3 w-3" />
        Melden
      </Button>
      <ReportModal pinId={pinId} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
