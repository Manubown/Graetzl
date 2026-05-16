"use client";

import * as React from "react";
import * as RadixDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Sheet — bottom-anchored mobile sheet (centred dialog on ≥sm).
 *
 * Replaces the inline sheet logic at `src/components/map/filter-bar.tsx`
 * (C-6) without changing the URL-param contract. Backed by Radix
 * Dialog so we inherit focus-trap, Escape-to-close, scroll-locking,
 * and focus return to the trigger on close.
 *
 * `<SheetContent>` REQUIRES `aria-label` (or pair `<SheetTitle>` with
 * `aria-labelledby`) for screen-reader announcements.
 *
 * Public API:
 *   <Sheet open onOpenChange>           controlled Root
 *     <SheetTrigger asChild>…           optional, callers usually
 *                                       manage `open` themselves
 *     <SheetContent aria-label="Filter">
 *       <SheetHeader><SheetTitle/></SheetHeader>
 *       …
 *       <SheetFooter>…</SheetFooter>
 *     </SheetContent>
 *   </Sheet>
 */

export const Sheet = RadixDialog.Root;
export const SheetTrigger = RadixDialog.Trigger;
export const SheetClose = RadixDialog.Close;
export const SheetPortal = RadixDialog.Portal;

export const SheetTitle = React.forwardRef<
  React.ElementRef<typeof RadixDialog.Title>,
  React.ComponentPropsWithoutRef<typeof RadixDialog.Title>
>(({ className, ...props }, ref) => (
  <RadixDialog.Title
    ref={ref}
    className={cn("text-base font-semibold tracking-tight", className)}
    {...props}
  />
));
SheetTitle.displayName = RadixDialog.Title.displayName;

export const SheetDescription = React.forwardRef<
  React.ElementRef<typeof RadixDialog.Description>,
  React.ComponentPropsWithoutRef<typeof RadixDialog.Description>
>(({ className, ...props }, ref) => (
  <RadixDialog.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
SheetDescription.displayName = RadixDialog.Description.displayName;

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof RadixDialog.Overlay>,
  React.ComponentPropsWithoutRef<typeof RadixDialog.Overlay>
>(({ className, ...props }, ref) => (
  <RadixDialog.Overlay
    ref={ref}
    className={cn(
      // Lighter dim than default so the sheet's own glass effect on Content
      // (bg-background/80 backdrop-blur-xl) reads as glassmorphism over the
      // map rather than a solid card on a dark backdrop.
      "fixed inset-0 z-40 bg-black/20 backdrop-blur-sm",
      "data-[state=open]:animate-in data-[state=closed]:animate-out",
      "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
      "duration-[var(--motion-default)] ease-[var(--motion-ease)]",
      className,
    )}
    {...props}
  />
));
SheetOverlay.displayName = RadixDialog.Overlay.displayName;

export interface SheetContentProps
  extends React.ComponentPropsWithoutRef<typeof RadixDialog.Content> {
  /**
   * Hide the built-in close (X) button. Defaults to false. Set when
   * the consumer renders its own dismiss control in the footer.
   */
  hideClose?: boolean;
}

export const SheetContent = React.forwardRef<
  React.ElementRef<typeof RadixDialog.Content>,
  SheetContentProps
>(({ className, children, hideClose, ...props }, ref) => (
  <SheetPortal>
    <SheetOverlay />
    <RadixDialog.Content
      ref={ref}
      className={cn(
        // Mobile (default): bottom-anchored, rounded only on top.
        "fixed inset-x-0 bottom-0 z-50 mx-auto flex w-full max-w-md flex-col",
        "rounded-t-2xl border border-border/50 bg-background/60 text-foreground shadow-2xl backdrop-blur-2xl",
        // Desktop (≥sm): floats, centred horizontally, near top.
        "sm:bottom-auto sm:left-1/2 sm:top-20 sm:-translate-x-1/2 sm:rounded-2xl",
        // Motion (uses --motion-default).
        "duration-[var(--motion-default)] ease-[var(--motion-ease)]",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=open]:slide-in-from-bottom-full data-[state=closed]:slide-out-to-bottom-full",
        "sm:data-[state=open]:slide-in-from-bottom-2 sm:data-[state=closed]:slide-out-to-bottom-2",
        // Focus ring matches Button/Input contract.
        "focus:outline-none",
        className,
      )}
      {...props}
    >
      {children}
      {!hideClose && (
        <RadixDialog.Close
          aria-label="Schließen"
          className={cn(
            "absolute right-3 top-3 rounded-md p-1 text-muted-foreground",
            "transition-colors duration-[var(--motion-fast)]",
            "hover:bg-muted hover:text-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
            "focus-visible:ring-[var(--accent)] dark:focus-visible:ring-[var(--primary)]",
          )}
        >
          <X className="h-4 w-4" />
        </RadixDialog.Close>
      )}
    </RadixDialog.Content>
  </SheetPortal>
));
SheetContent.displayName = "SheetContent";

export const SheetHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex items-center justify-between border-b border-border px-5 py-3",
      className,
    )}
    {...props}
  />
);
SheetHeader.displayName = "SheetHeader";

export const SheetFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex items-center justify-between gap-2 border-t border-border px-5 py-3",
      className,
    )}
    {...props}
  />
);
SheetFooter.displayName = "SheetFooter";
