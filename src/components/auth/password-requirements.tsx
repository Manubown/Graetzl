"use client";

import { Check, Circle } from "lucide-react";
import {
  checkPassword,
  PASSWORD_RULE_LABELS,
  type PasswordRules,
} from "@/lib/auth/password";
import { cn } from "@/lib/utils";

interface PasswordRequirementsProps {
  /** The current password input value. Re-render the parent on every
   *  keystroke for live feedback. */
  value: string;
  className?: string;
}

/**
 * Live checklist of password rules. Shown beneath password inputs on
 * sign-up, password change, and reset. Satisfied rules turn accent-
 * coloured; unsatisfied stay muted. The list is purely informational —
 * the actual submit gate uses `checkPassword(value).ok` from the same
 * shared module so the UI and validator never drift apart.
 */
export function PasswordRequirements({
  value,
  className,
}: PasswordRequirementsProps) {
  const { rules } = checkPassword(value);

  return (
    <ul
      aria-label="Passwort-Anforderungen"
      className={cn("flex flex-col gap-1 text-xs", className)}
    >
      {PASSWORD_RULE_LABELS.map(({ key, label }) => {
        const ok = rules[key as keyof PasswordRules];
        return (
          <li
            key={key}
            className={cn(
              "flex items-center gap-2 transition-colors",
              ok ? "text-accent" : "text-muted-foreground",
            )}
          >
            {ok ? (
              <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />
            ) : (
              <Circle className="h-3.5 w-3.5 shrink-0" aria-hidden />
            )}
            <span>{label}</span>
          </li>
        );
      })}
    </ul>
  );
}
