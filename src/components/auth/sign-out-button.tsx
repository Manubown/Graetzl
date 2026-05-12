"use client";

import { useTransition } from "react";
import { signOut } from "@/lib/auth/actions";

/**
 * Standalone sign-out trigger so the header (a server component)
 * can host an interactive element without becoming a client component.
 */
export function SignOutButton() {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      onClick={() => start(() => signOut())}
      disabled={pending}
      className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
      aria-label="Abmelden"
    >
      {pending ? "…" : "Abmelden"}
    </button>
  );
}
