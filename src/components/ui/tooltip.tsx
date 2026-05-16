"use client";

import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "@/lib/utils";

/**
 * Tooltip — Radix Tooltip styled to match the Grätzl token set.
 *
 * Primary consumer (B-12): district hover label on the Vienna map.
 * The MapLibre map is a `<canvas>`; we cannot attach a Radix Tooltip
 * directly to a map feature. Instead callers render a zero-size
 * `position: absolute` virtual trigger anchored to the current cursor
 * pixel coordinates and drive the open state imperatively via
 * `<Tooltip open={…}>`.
 *
 * Usage:
 *   <TooltipProvider delayDuration={0} disableHoverableContent>
 *     <Tooltip open={hoverDistrict !== null}>
 *       <TooltipTrigger asChild>
 *         <span aria-hidden className="pointer-events-none absolute h-0 w-0"
 *               style={{ left: x, top: y }} />
 *       </TooltipTrigger>
 *       <TooltipContent side="top" sideOffset={12}>
 *         Innere Stadt · 3 Pins
 *       </TooltipContent>
 *     </Tooltip>
 *   </TooltipProvider>
 *
 * Motion: animate-in / animate-out classes are driven by Radix's
 * data-[state] attributes. prefers-reduced-motion is handled by the
 * global @media rule in globals.css which sets --motion-fast to 0ms.
 */

export const TooltipProvider = TooltipPrimitive.Provider;
export const Tooltip = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

export const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, collisionPadding = 8, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      collisionPadding={collisionPadding}
      className={cn(
        "z-50 overflow-hidden rounded-md border border-border bg-background px-2.5 py-1 text-xs text-foreground shadow-md",
        "data-[state=delayed-open]:animate-in data-[state=closed]:animate-out",
        "duration-[var(--motion-fast)] ease-[var(--motion-ease)]",
        "data-[state=delayed-open]:fade-in-0 data-[state=closed]:fade-out-0",
        className,
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;
