"use client";

import { useTransition } from "react";
import { signOut } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";

/**
 * Standalone sign-out trigger so the header (a server component)
 * can host an interactive element without becoming a client component.
 */
export function SignOutButton() {
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() => start(() => signOut())}
      disabled={pending}
      className="text-muted-foreground"
      aria-label="Abmelden"
    >
      {pending ? "…" : "Abmelden"}
    </Button>
  );
}
