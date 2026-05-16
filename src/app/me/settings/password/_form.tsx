"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { updateOwnPassword } from "@/lib/auth/actions";

/**
 * Client-side form for the /me/settings/password page.
 * The server action updateOwnPassword redirects on success, or returns
 * { ok: false, error } on failure.
 */
export function UpdatePasswordForm() {
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const canSubmit = password.length >= 12 && password.length <= 72;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSubmit || pending) return;
    setErrorMsg(null);

    const formData = new FormData();
    formData.set("password", password);

    startTransition(async () => {
      const result = await updateOwnPassword(formData);
      // On success, updateOwnPassword calls redirect() — we never reach here.
      // On failure, result is { ok: false, error }.
      if (!result.ok) {
        setErrorMsg(result.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="new-password"
          className="text-sm font-medium"
        >
          Neues Passwort
        </label>
        <Input
          id="new-password"
          type="password"
          required
          autoComplete="new-password"
          placeholder="mind. 12 Zeichen"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            if (errorMsg) setErrorMsg(null);
          }}
          disabled={pending}
        />
      </div>

      {errorMsg && (
        <p role="alert" className="text-sm text-primary">
          {errorMsg}
        </p>
      )}

      <Button
        type="submit"
        variant="primary"
        className="w-full"
        disabled={!canSubmit || pending}
      >
        {pending ? "Wird gespeichert…" : "Passwort speichern"}
      </Button>
    </form>
  );
}
