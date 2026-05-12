"use client";

import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/dialog";

interface PinDetailModalProps {
  children: React.ReactNode;
}

/**
 * Wraps PinDetail in a Dialog for use as the intercepting route.
 * Closing the dialog pops back to wherever the user was (typically /).
 */
export function PinDetailModal({ children }: PinDetailModalProps) {
  const router = useRouter();
  return (
    <Dialog
      open
      onClose={() => router.back()}
      title="Pin"
      className="w-[min(40rem,calc(100vw-2rem))]"
    >
      {children}
    </Dialog>
  );
}
