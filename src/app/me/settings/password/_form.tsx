"use client";

import { useState, useTransition } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { updateOwnPassword } from "@/lib/auth/actions";
import { checkPassword } from "@/lib/auth/password";
import { PasswordRequirements } from "@/components/auth/password-requirements";

/**
 * Client form for /me/settings/password. Shows a live checklist of
 * complexity rules as the user types. Submit is gated by the same
 * shared `checkPassword` used server-side, so client + server never
 * disagree on what counts as valid.
 */
export function UpdatePasswordForm() {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const check = checkPassword(password);
  const canSubmit = check.ok && !pending;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSubmit) return;
    setErrorMsg(null);

    const formData = new FormData();
    formData.set("password", password);

    startTransition(async () => {
      const result = await updateOwnPassword(formData);
      // On success, updateOwnPassword redirects. On failure:
      if (!result.ok) {
        setErrorMsg(result.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="new-password" className="text-sm font-medium">
          Neues Passwort
        </label>
        <div className="relative">
          <Input
            id="new-password"
            type={showPassword ? "text" : "password"}
            required
            autoComplete="new-password"
            placeholder="mind. 12 Zeichen"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (errorMsg) setErrorMsg(null);
            }}
            disabled={pending}
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
      </div>

      <PasswordRequirements value={password} />

      {errorMsg && (
        <p role="alert" className="text-sm text-primary">
          {errorMsg}
        </p>
      )}

      <Button
        type="submit"
        variant="primary"
        className="w-full"
        disabled={!canSubmit}
      >
        {pending ? "Wird gespeichert…" : "Passwort speichern"}
      </Button>
    </form>
  );
}
