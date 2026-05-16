"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PinEditModal } from "./pin-edit-modal";
import type { Category } from "@/lib/supabase/database.types";

interface PinEditButtonProps {
  pinId: string;
  initial: {
    title: string;
    body: string;
    category: Category;
    language: string;
    photo_url: string | null;
  };
}

/**
 * Rendered only on the pin detail page when the viewer is the pin
 * author. Owns the open/close state for the edit modal.
 */
export function PinEditButton({ pinId, initial }: PinEditButtonProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="h-9 gap-1.5 rounded-full"
      >
        <Pencil className="h-3.5 w-3.5" />
        Bearbeiten
      </Button>
      <PinEditModal
        open={open}
        onClose={() => setOpen(false)}
        pinId={pinId}
        initial={initial}
      />
    </>
  );
}
