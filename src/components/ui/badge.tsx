import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Badge — inline status / count / handle pill. Used on profile
 * pages, filter active-count, and (Phase 2) as the level pill.
 *
 * Variants:
 *   default   — foreground/background swap (emphasis)
 *   secondary — muted background (subtle)
 *   outline   — border only, transparent
 *   accent    — Donau Türkis fill (district / map-related)
 */

export const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        default: "bg-foreground text-background",
        secondary: "bg-muted text-foreground",
        outline: "border border-border text-foreground",
        accent: "bg-accent text-accent-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}
