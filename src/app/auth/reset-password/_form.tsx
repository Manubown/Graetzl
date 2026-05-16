"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics/plausible";
import { checkPassword } from "@/lib/auth/password";
import { PasswordRequirements } from "@/components/auth/password-requirements";

type PageStatus =
  | "exchanging"
  | "ready"
  | "expired"
  | "submitting"
  | "success";

export function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const code = searchParams.get("code");

  const [pageStatus, setPageStatus] = useState<PageStatus>(
    code ? "exchanging" : "expired",
  );
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Strict Mode in dev double-invokes effects; exchangeCodeForSession
  // consumes the PKCE code on the first call, so the second call returns
  // "code already used" and flips the form to `expired` even though a
  // valid session was actually created. Guard with a ref so the call
  // fires exactly once per mount.
  const exchangedRef = useRef(false);
  useEffect(() => {
    if (!code) return;
    if (exchangedRef.current) return;
    exchangedRef.current = true;

    const supabase = createClient();
    supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      setPageStatus(error ? "expired" : "ready");
    });
  }, [code]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFieldError(null);

    const check = checkPassword(password);
    if (!check.ok) {
      setFieldError(check.error ?? "Passwort entspricht nicht den Anforderungen.");
      return;
    }
    if (password !== confirmPassword) {
      setFieldError("Passwörter stimmen nicht überein.");
      return;
    }

    startTransition(async () => {
      setPageStatus("submitting");
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setPageStatus("ready");
        setFieldError(
          "Passwort konnte nicht gespeichert werden. Bitte erneut versuchen.",
        );
      } else {
        track("auth_reset_completed");
        setPageStatus("success");
        router.push("/");
      }
    });
  }

  if (pageStatus === "exchanging") {
    return (
      <div className="rounded-2xl border border-border bg-background p-8 shadow-sm text-center">
        <p className="text-sm text-muted-foreground">Wird geprüft…</p>
      </div>
    );
  }

  if (pageStatus === "expired") {
    return (
      <div className="rounded-2xl border border-border bg-background p-8 shadow-sm">
        <h1 className="mb-4 text-xl font-semibold tracking-tight">
          Link abgelaufen
        </h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Link ist abgelaufen. Fordere einen neuen an.
        </p>
        <Button asChild variant="outline" className="w-full">
          <a href="/sign-in">Zurück zur Anmeldung</a>
        </Button>
      </div>
    );
  }

  if (pageStatus === "success") {
    return (
      <div className="rounded-2xl border border-border bg-background p-8 shadow-sm text-center">
        <p className="text-sm text-muted-foreground">
          Passwort gespeichert. Weiterleitung…
        </p>
      </div>
    );
  }

  const isLoading = pending || pageStatus === "submitting";
  const canSubmit =
    checkPassword(password).ok &&
    confirmPassword.length > 0 &&
    !isLoading;

  return (
    <div className="rounded-2xl border border-border bg-background p-8 shadow-sm">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">
        Neues Passwort
      </h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Wähle ein Passwort mit mind. 12 Zeichen, einem Großbuchstaben, einem
        Kleinbuchstaben und einer Zahl.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="reset-password" className="text-sm font-medium">
            Neues Passwort
          </label>
          <div className="relative">
            <Input
              id="reset-password"
              type={showPassword ? "text" : "password"}
              required
              autoComplete="new-password"
              placeholder="mind. 12 Zeichen"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (fieldError) setFieldError(null);
              }}
              disabled={isLoading}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={
                showPassword ? "Passwort verbergen" : "Passwort anzeigen"
              }
              className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[var(--accent)] dark:focus-visible:ring-[var(--primary)]"
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" aria-hidden />
              ) : (
                <Eye className="h-4 w-4" aria-hidden />
              )}
            </button>
          </div>
          {password.length > 0 && (
            <PasswordRequirements value={password} className="mt-1.5" />
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="confirm-password" className="text-sm font-medium">
            Passwort bestätigen
          </label>
          <div className="relative">
            <Input
              id="confirm-password"
              type={showConfirm ? "text" : "password"}
              required
              autoComplete="new-password"
              placeholder="Passwort wiederholen"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (fieldError) setFieldError(null);
              }}
              disabled={isLoading}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowConfirm((v) => !v)}
              aria-label={
                showConfirm ? "Bestätigung verbergen" : "Bestätigung anzeigen"
              }
              className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[var(--accent)] dark:focus-visible:ring-[var(--primary)]"
            >
              {showConfirm ? (
                <EyeOff className="h-4 w-4" aria-hidden />
              ) : (
                <Eye className="h-4 w-4" aria-hidden />
              )}
            </button>
          </div>
        </div>

        {fieldError && (
          <p role="alert" className="text-sm text-primary">
            {fieldError}
          </p>
        )}

        <Button
          type="submit"
          variant="primary"
          className="w-full"
          disabled={!canSubmit}
        >
          {isLoading ? "Wird gespeichert…" : "Passwort speichern"}
        </Button>
      </form>
    </div>
  );
}
