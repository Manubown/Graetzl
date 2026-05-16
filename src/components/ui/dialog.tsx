"use client";

import * as RadixDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
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
 * Modal dialog. C-4 refactor: drops the native `<dialog>` element in
 * favour of Radix Dialog, which gives us a portal, focus-trap, scroll
 * lock, Escape-to-close, and overlay click-out — all behaviours we
 * previously hand-rolled.
 *
 * Public API is preserved exactly: `open`, `onClose`, `title`,
 * `className`, `children`. Call-sites (`PinDetailModal`,
 * `DropPinModal`, `ReportModal`, `ProfileEditModal`) change zero
 * lines. The `onOpenChange(open) → !open && onClose()` translation
 * means backdrop click / Escape / X-button all funnel through
 * `onClose`, so `router.back()` in the intercepting-route modal
 * still works.
 */
export function Dialog({
  open,
  onClose,
  children,
  title,
  className,
}: DialogProps) {
  return (
    <RadixDialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <RadixDialog.Portal>
        <RadixDialog.Overlay
          className={cn(
            // Light dimming + subtle blur so the dialog's own glass effect
            // (bg-background/80 backdrop-blur-xl on Content) actually has
            // something visible behind to blur — heavy overlay opacity
            // washes out the glassmorphism.
            "fixed inset-0 z-40 bg-black/20 backdrop-blur-sm",
            "duration-[var(--motion-default)] ease-[var(--motion-ease)]",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
          )}
        />
        <RadixDialog.Content
          aria-describedby={undefined}
          className={cn(
            "fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2",
            "w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-border/50 bg-background/60 p-0 text-foreground shadow-2xl backdrop-blur-2xl",
            "duration-[var(--motion-default)] ease-[var(--motion-ease)]",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
            "data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95",
            "focus:outline-none",
            className,
          )}
        >
          <div className="flex items-center justify-between border-b border-border/60 px-5 py-3">
            <RadixDialog.Title className="text-base font-semibold tracking-tight">
              {title}
            </RadixDialog.Title>
            <RadixDialog.Close
              aria-label="Schließen"
              className={cn(
                "rounded-md p-1 text-muted-foreground",
                "transition-colors duration-[var(--motion-fast)] ease-[var(--motion-ease)]",
                "hover:bg-muted hover:text-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
                "focus-visible:ring-[var(--accent)] dark:focus-visible:ring-[var(--primary)]",
              )}
            >
              <X className="h-[18px] w-[18px]" />
            </RadixDialog.Close>
          </div>
          <div className="px-5 py-4">{children}</div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
