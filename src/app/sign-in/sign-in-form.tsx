"use client";

import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";

export function SignInForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("idle");
    setErrorMsg(null);

    startTransition(async () => {
      try {
        const supabase = createClient();
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (error) throw error;
        setStatus("sent");
      } catch (err) {
        setStatus("error");
        setErrorMsg(err instanceof Error ? err.message : "Etwas lief schief.");
      }
    });
  }

  if (status === "sent") {
    return (
      <div className="rounded-lg border border-border bg-muted/50 p-4 text-center text-sm">
        <p className="font-medium">Check dein Postfach.</p>
        <p className="mt-1 text-muted-foreground">
          Wir haben einen Link an <span className="font-medium">{email}</span> geschickt.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label htmlFor="email" className="text-sm font-medium">
        E-Mail
      </label>
      <input
        id="email"
        type="email"
        required
        autoComplete="email"
        placeholder="du@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
      />
      <button
        type="submit"
        disabled={pending || email.length === 0}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Wird gesendet…" : "Magic-Link senden"}
      </button>
      {status === "error" && errorMsg && (
        <p className="text-sm text-primary">{errorMsg}</p>
      )}
    </form>
  );
}
