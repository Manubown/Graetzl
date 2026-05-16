"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Input — single-line text input. Designed to be paired with
 * `<Label htmlFor>` (or wrapped by `<Label>`); renders no aria-* itself.
 *
 * Focus ring matches Button (C-AC2.1).
 */

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        "flex h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm",
        "placeholder:text-muted-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        "focus-visible:ring-[var(--accent)] dark:focus-visible:ring-[var(--primary)]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";
