"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { chooseInitialHandle } from "@/lib/profiles/actions";

interface HandlePickerProps {
  currentHandle: string;
}

export function HandlePicker({ currentHandle }: HandlePickerProps) {
  const [handle, setHandle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await chooseInitialHandle(fd);
      if (!result.ok) {
        setError(result.error);
      }
      // On success, the server action redirects — no client-side navigation needed.
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <Label htmlFor="handle">Handle</Label>
      <Input
        id="handle"
        name="handle"
        type="text"
        value={handle}
        onChange={(e) => setHandle(e.target.value)}
        placeholder="z.B. emma_vienna"
        autoComplete="off"
        autoFocus
        required
        minLength={3}
        maxLength={30}
        pattern="[a-z0-9_]+"
        disabled={pending}
      />
      <p className="text-xs text-muted-foreground">
        Nur Kleinbuchstaben, Zahlen und Unterstrich. Aktuell:{" "}
        <code>{currentHandle}</code>
      </p>
      {error && (
        <p className="text-sm text-primary" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" disabled={pending || handle.length < 3}>
        {pending ? "Wird gespeichert…" : "Handle festlegen"}
      </Button>
    </form>
  );
}
