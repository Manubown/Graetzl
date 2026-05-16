"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CATEGORIES, LANGUAGES } from "@/lib/pins/constants";
import { updatePin } from "@/lib/pins/actions";
import type { Category } from "@/lib/supabase/database.types";

interface PinEditModalProps {
  open: boolean;
  onClose: () => void;
  pinId: string;
  initial: {
    title: string;
    body: string;
    category: Category;
    language: string;
    photo_url: string | null;
  };
}

type PhotoAction = "keep" | "remove" | "replace";

/**
 * Edit modal for the pin author. Mirrors drop-pin-modal's form fields
 * for the editable subset only (title, body, category, language,
 * photo). Location and precision are immutable — changing them would
 * invalidate the pin's district_id and break the existing
 * pin_count_cached without re-firing triggers. Pin moves are a
 * separate operation we may add later.
 */
export function PinEditModal({
  open,
  onClose,
  pinId,
  initial,
}: PinEditModalProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [photoAction, setPhotoAction] = useState<PhotoAction>("keep");
  const [newPhotoUrl, setNewPhotoUrl] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);

  async function handlePhotoSelect(file: File | null) {
    if (!file) {
      setNewPhotoUrl(null);
      setPhotoAction(initial.photo_url ? "keep" : "keep");
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
      setNewPhotoUrl(data.url);
      setPhotoAction("replace");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload fehlgeschlagen.");
      setNewPhotoUrl(null);
    } finally {
      setPhotoUploading(false);
    }
  }

  function handleRemovePhoto() {
    setNewPhotoUrl(null);
    setPhotoAction("remove");
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("photo_action", photoAction);
    if (photoAction === "replace" && newPhotoUrl) {
      fd.set("photo_url", newPhotoUrl);
    }

    startTransition(async () => {
      const result = await updatePin(pinId, fd);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onClose();
      router.refresh();
    });
  }

  const showCurrentPhoto =
    photoAction === "keep" && initial.photo_url !== null;
  const showNewPhoto = photoAction === "replace" && newPhotoUrl !== null;

  return (
    <Dialog open={open} onClose={onClose} title="Pin bearbeiten">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Titel</span>
          <input
            name="title"
            type="text"
            required
            minLength={1}
            maxLength={80}
            defaultValue={initial.title}
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
            defaultValue={initial.body}
            className="resize-none rounded-lg border border-border bg-background px-3 py-2 outline-none ring-primary/30 focus:ring-2"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Kategorie</span>
            <select
              name="category"
              required
              defaultValue={initial.category}
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
              defaultValue={initial.language}
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

        <div className="flex flex-col gap-1 text-sm">
          <span className="font-medium">
            Foto <span className="text-xs text-muted-foreground">(optional)</span>
          </span>
          {showCurrentPhoto && (
            <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-3 py-2">
              <span className="text-xs text-muted-foreground">
                Bestehendes Foto behalten
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleRemovePhoto}
                className="h-7 gap-1 text-xs"
              >
                <Trash2 className="h-3 w-3" />
                Entfernen
              </Button>
            </div>
          )}
          {showNewPhoto && (
            <span className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-accent">
              ✓ Neues Foto wird gespeichert
            </span>
          )}
          {photoAction === "remove" && (
            <span className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              Foto wird entfernt
            </span>
          )}
          <input
            type="file"
            accept="image/*"
            onChange={(e) =>
              handlePhotoSelect(e.currentTarget.files?.[0] ?? null)
            }
            className="text-sm"
            disabled={pending}
          />
          {photoUploading && (
            <span className="text-xs text-muted-foreground">
              Wird hochgeladen, EXIF wird entfernt…
            </span>
          )}
        </div>

        {error && <p className="text-sm text-primary">{error}</p>}

        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Abbrechen
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={pending || photoUploading}
          >
            {pending ? "Wird gespeichert…" : "Speichern"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
