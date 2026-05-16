"use client";

import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PasswordForm } from "@/components/auth/password-form";
import { requestPasswordReset } from "@/lib/auth/actions";
import { track } from "@/lib/analytics/plausible";

/**
 * Sign-in surface. Outer tabs: Magic-Link | E-Mail + Passwort.
 * Password tab has inner tabs: Anmelden | Registrieren.
 * Magic-link tab is untouched from S0-6.
 */
export function SignInForm({ nextPath = "/" }: { nextPath?: string }) {
  return (
    <Tabs defaultValue="magiclink" className="w-full">
      <TabsList aria-label="Anmeldemethode wählen">
        <TabsTrigger value="magiclink">Magic-Link</TabsTrigger>
        <TabsTrigger value="password">E-Mail + Passwort</TabsTrigger>
      </TabsList>

      <TabsContent value="magiclink">
        <MagicLinkForm />
      </TabsContent>

      <TabsContent value="password">
        <Tabs defaultValue="signin" className="w-full">
          <TabsList aria-label="Konto-Aktion wählen">
            <TabsTrigger value="signin">Anmelden</TabsTrigger>
            <TabsTrigger value="signup">Registrieren</TabsTrigger>
          </TabsList>

          <TabsContent value="signin">
            <PasswordForm mode="signin" nextPath={nextPath} />
            <ForgotPasswordLink />
          </TabsContent>

          <TabsContent value="signup">
            <PasswordForm mode="signup" nextPath={nextPath} />
          </TabsContent>
        </Tabs>
      </TabsContent>
    </Tabs>
  );
}

// ---------------------------------------------------------------------------
// ForgotPasswordLink
// ---------------------------------------------------------------------------

type ForgotStatus = "collapsed" | "open" | "sent";

function ForgotPasswordLink() {
  const [status, setStatus] = useState<ForgotStatus>("collapsed");
  const [resetEmail, setResetEmail] = useState("");
  const [pending, startTransition] = useTransition();

  function handleToggle() {
    setStatus((s) => (s === "collapsed" ? "open" : "collapsed"));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;

    const formData = new FormData();
    formData.set("email", resetEmail);

    startTransition(async () => {
      await requestPasswordReset(formData);
      // Always show the same message regardless of outcome (no enumeration).
      setStatus("sent");
      track("auth_reset_requested");
    });
  }

  if (status === "sent") {
    return (
      <p
        role="status"
        className="mt-3 text-center text-sm text-muted-foreground"
      >
        Falls ein Konto mit dieser E-Mail existiert, haben wir eine Mail gesendet.
      </p>
    );
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={handleToggle}
        className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--accent)] dark:focus-visible:ring-[var(--primary)]"
      >
        Passwort vergessen?
      </button>

      {status === "open" && (
        <form
          onSubmit={handleSubmit}
          className="mt-3 flex flex-col gap-2"
          aria-label="Passwort zurücksetzen"
        >
          <Input
            type="email"
            required
            placeholder="du@example.com"
            autoComplete="email"
            value={resetEmail}
            onChange={(e) => setResetEmail(e.target.value)}
            disabled={pending}
          />
          <Button
            type="submit"
            variant="outline"
            className="w-full"
            disabled={resetEmail.length === 0 || pending}
          >
            {pending ? "Wird gesendet…" : "Link senden"}
          </Button>
        </form>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// MagicLinkForm — untouched from S0-6
// ---------------------------------------------------------------------------

function MagicLinkForm() {
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
