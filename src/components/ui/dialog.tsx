"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  /**
   * Optional body content. Self-closing `<Dialog ... />` is allowed so
   * callers can render a "shell" dialog while their content prepares
   * (see DropPinModal's `coords === null` branch).
   */
  children?: React.ReactNode;
  title: string;
  className?: string;
}

/**
 * Minimal modal dialog. Uses the native <dialog> element via
 * `showModal()` for free focus-trap, scrim, and Esc-to-close.
 * We add an explicit close button + click-on-backdrop handler.
 */
export function Dialog({
  open,
  onClose,
  children,
  title,
  className,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  // Close via Escape or native cancel → propagate to parent.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    el.addEventListener("cancel", onCancel);
    return () => el.removeEventListener("cancel", onCancel);
  }, [onClose]);

  return (
    <dialog
      ref={ref}
      onClick={(e) => {
        // Click on backdrop (i.e. on the dialog element itself, not its
        // content) → close.
        if (e.target === ref.current) onClose();
      }}
      className={cn(
        "fixed inset-0 m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-border bg-background p-0 text-foreground shadow-2xl backdrop:bg-black/40 backdrop:backdrop-blur-sm",
        className,
      )}
      aria-labelledby="dialog-title"
    >
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <h2 id="dialog-title" className="text-base font-semibold tracking-tight">
          {title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Schließen"
          className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 6L6 18" />
            <path d="M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="px-5 py-4">{children}</div>
    </dialog>
  );
}
