"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/dialog";
import { updateProfile } from "@/lib/profiles/actions";

interface ProfileEditModalProps {
  open: boolean;
  onClose: () => void;
  initial: { handle: string; bio: string | null; home_city: string };
}

export function ProfileEditModal({
  open,
  onClose,
  initial,
}: ProfileEditModalProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const fd = new FormData(form);

    startTransition(async () => {
      const result = await updateProfile(fd);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onClose();
      if (result.handle !== initial.handle) {
        router.push(`/u/${result.handle}`);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onClose={onClose} title="Profil bearbeiten">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Handle</span>
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">@</span>
            <input
              name="handle"
              type="text"
              required
              defaultValue={initial.handle}
              minLength={3}
              maxLength={30}
              pattern="[a-zA-Z0-9](?:[a-zA-Z0-9_]{1,28}[a-zA-Z0-9])?"
              className="flex-1 rounded-lg border border-border bg-background px-3 py-2 outline-none ring-primary/30 focus:ring-2"
            />
          </div>
          <span className="text-xs text-muted-foreground">
            3–30 Zeichen. Buchstaben, Zahlen, _. Anfang/Ende ohne Unterstrich.
          </span>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">
            Bio <span className="text-xs text-muted-foreground">(optional)</span>
          </span>
          <textarea
            name="bio"
            rows={3}
            maxLength={280}
            defaultValue={initial.bio ?? ""}
            placeholder="Was macht dein Wien aus?"
            className="resize-none rounded-lg border border-border bg-background px-3 py-2 outline-none ring-primary/30 focus:ring-2"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Heimatstadt</span>
          <input
            name="home_city"
            type="text"
            defaultValue={initial.home_city}
            maxLength={60}
            className="rounded-lg border border-border bg-background px-3 py-2 outline-none ring-primary/30 focus:ring-2"
          />
        </label>

        {error && <p className="text-sm text-primary">{error}</p>}

        <div className="mt-2 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-muted-foreground hover:bg-muted"
          >
            Abbrechen
          </button>
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Wird gespeichert…" : "Speichern"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
