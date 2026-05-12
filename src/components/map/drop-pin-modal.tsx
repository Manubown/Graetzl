"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/dialog";
import { CATEGORIES, LANGUAGES } from "@/lib/pins/constants";
import { createPin } from "@/lib/pins/actions";

interface DropPinModalProps {
  open: boolean;
  onClose: () => void;
  /** Where the user long-pressed — passed through to the Server Action. */
  coords: { lng: number; lat: number } | null;
}

export function DropPinModal({ open, onClose, coords }: DropPinModalProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);

  function reset() {
    setError(null);
    setPhotoUrl(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handlePhotoSelect(file: File | null) {
    if (!file) {
      setPhotoUrl(null);
      return;
    }
    setError(null);
    setPhotoUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload fehlgeschlagen.");
      setPhotoUrl(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload fehlgeschlagen.");
      setPhotoUrl(null);
    } finally {
      setPhotoUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!coords) return;
    setError(null);

    const form = e.currentTarget;
    const fd = new FormData(form);
    fd.set("lng", String(coords.lng));
    fd.set("lat", String(coords.lat));
    if (photoUrl) fd.set("photo_url", photoUrl);

    startTransition(async () => {
      const result = await createPin(fd);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // Close the modal and refresh so the new pin appears on the map.
      // We intentionally DON'T router.push('/pin/<id>') — that would
      // pollute browser history and make the modal's back-button
      // navigate to a previously-viewed pin instead of the map.
      // Users can click the new marker if they want the detail view.
      reset();
      onClose();
      router.refresh();
    });
  }

  if (!coords) {
    return <Dialog open={open} onClose={handleClose} title="Pin setzen" />;
  }

  return (
    <Dialog open={open} onClose={handleClose} title="Pin setzen">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <p className="text-xs text-muted-foreground">
          Position: {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
        </p>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Titel</span>
          <input
            name="title"
            type="text"
            required
            minLength={1}
            maxLength={80}
            placeholder="z.B. Bester Sonnenuntergang am Donaukanal"
            className="rounded-lg border border-border bg-background px-3 py-2 outline-none ring-primary/30 focus:ring-2"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Beschreibung</span>
          <textarea
            name="body"
            required
            minLength={1}
            maxLength={500}
            rows={3}
            placeholder="Was macht diesen Ort besonders?"
            className="resize-none rounded-lg border border-border bg-background px-3 py-2 outline-none ring-primary/30 focus:ring-2"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Kategorie</span>
            <select
              name="category"
              required
              defaultValue="hidden_gem"
              className="rounded-lg border border-border bg-background px-3 py-2 outline-none ring-primary/30 focus:ring-2"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.emoji} {c.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Sprache</span>
            <select
              name="language"
              defaultValue="de"
              className="rounded-lg border border-border bg-background px-3 py-2 outline-none ring-primary/30 focus:ring-2"
            >
              {LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <fieldset className="flex flex-col gap-1 text-sm">
          <legend className="font-medium">Präzision</legend>
          <label className="flex items-center gap-2">
            <input type="radio" name="precision" value="exact" defaultChecked />
            <span>Exakt</span>
            <span className="text-xs text-muted-foreground">
              — genaue Position
            </span>
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="precision" value="approximate" />
            <span>Ungefähr</span>
            <span className="text-xs text-muted-foreground">
              — auf ~100m gerundet (GDPR-freundlich)
            </span>
          </label>
        </fieldset>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">
            Foto <span className="text-xs text-muted-foreground">(optional)</span>
          </span>
          <input
            type="file"
            accept="image/*"
            onChange={(e) =>
              handlePhotoSelect(e.currentTarget.files?.[0] ?? null)
            }
            className="text-sm"
          />
          {photoUploading && (
            <span className="text-xs text-muted-foreground">
              Wird hochgeladen, EXIF wird entfernt…
            </span>
          )}
          {photoUrl && !photoUploading && (
            <span className="text-xs text-accent">✓ Foto hochgeladen</span>
          )}
        </label>

        {error && <p className="text-sm text-primary">{error}</p>}

        <div className="mt-2 flex justify-end gap-2">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg px-4 py-2 text-sm text-muted-foreground hover:bg-muted"
          >
            Abbrechen
          </button>
          <button
            type="submit"
            disabled={pending || photoUploading}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Wird gesetzt…" : "Pin setzen"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
