"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Button — the single clickable-action primitive for the app.
 *
 * Variants:
 *   default     — foreground/background swap (neutral CTAs)
 *   primary     — Wiener Rot (destructive emphasis, primary actions)
 *   accent      — Donau Türkis (district / map-related actions)
 *   ghost       — transparent, hover-tinted (icon buttons in toolbars)
 *   outline     — bordered, transparent fill (secondary actions)
 *   destructive — alias of primary, kept for call-site clarity
 *
 * Sizes: sm | md (default) | lg | icon. Pass `asChild` to render as a
 * Radix Slot — useful for `<Button asChild><Link href=…/></Button>`.
 *
 * Focus ring honours the design-token contract from the PRD (C-AC2.1):
 * 2px outline at --accent on light, --primary on dark, with 2px offset.
 */

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg font-medium " +
    "transition-colors duration-[var(--motion-fast)] ease-[var(--motion-ease)] " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 " +
    "focus-visible:ring-[var(--accent)] dark:focus-visible:ring-[var(--primary)] " +
    "disabled:opacity-50 disabled:pointer-events-none",
  {
    variants: {
      variant: {
        default: "bg-foreground text-background hover:opacity-90",
        primary:
          "bg-primary text-primary-foreground hover:opacity-90",
        accent: "bg-accent text-accent-foreground hover:opacity-90",
        ghost: "bg-transparent hover:bg-muted hover:text-foreground",
        outline:
          "border border-border bg-background hover:bg-muted",
        destructive:
          "bg-primary text-primary-foreground hover:opacity-90",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-10 px-4 text-sm",
        lg: "h-12 px-6 text-base",
        icon: "h-10 w-10 p-0",
      },
    },
    defaultVariants: { variant: "default", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";
