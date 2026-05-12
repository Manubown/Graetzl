"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { ProfileEditModal } from "./profile-edit-modal";

interface ProfileEditButtonProps {
  handle: string;
  bio: string | null;
  home_city: string;
}

/**
 * Rendered only by the profile page when the viewer is the owner.
 * Wraps the modal + button + state.
 */
export function ProfileEditButton(props: ProfileEditButtonProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-sm hover:bg-muted"
      >
        <Pencil className="h-3.5 w-3.5" />
        Profil bearbeiten
      </button>
      <ProfileEditModal
        open={open}
        onClose={() => setOpen(false)}
        initial={{
          handle: props.handle,
          bio: props.bio,
          home_city: props.home_city,
        }}
      />
    </>
  );
}
