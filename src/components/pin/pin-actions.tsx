"use client";

import { useState, useTransition } from "react";
import { Heart, Bookmark } from "lucide-react";
import { toggleUpvote, toggleSave } from "@/lib/pins/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PinActionsProps {
  pinId: string;
  initialUpvoteCount: number;
  initialHasUpvoted: boolean;
  initialHasSaved: boolean;
}

export function PinActions({
  pinId,
  initialUpvoteCount,
  initialHasUpvoted,
  initialHasSaved,
}: PinActionsProps) {
  const [upvoteCount, setUpvoteCount] = useState(initialUpvoteCount);
  const [upvoted, setUpvoted] = useState(initialHasUpvoted);
  const [saved, setSaved] = useState(initialHasSaved);
  const [error, setError] = useState<string | null>(null);
  const [pendingUpvote, startUpvote] = useTransition();
  const [pendingSave, startSave] = useTransition();

  function handleUpvote() {
    setError(null);
    const prevUpvoted = upvoted;
    const prevCount = upvoteCount;
    setUpvoted(!prevUpvoted);
    setUpvoteCount(prevCount + (prevUpvoted ? -1 : 1));
    startUpvote(async () => {
      const result = await toggleUpvote(pinId);
      if (!result.ok) {
        setUpvoted(prevUpvoted);
        setUpvoteCount(prevCount);
        setError(result.error);
      } else {
        setUpvoted(result.active);
      }
    });
  }

  function handleSave() {
    setError(null);
    const prevSaved = saved;
    setSaved(!prevSaved);
    startSave(async () => {
      const result = await toggleSave(pinId);
      if (!result.ok) {
        setSaved(prevSaved);
        setError(result.error);
      } else {
        setSaved(result.active);
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleUpvote}
        disabled={pendingUpvote}
        aria-pressed={upvoted}
        aria-label={upvoted ? "Upvote entfernen" : "Upvoten"}
        className={cn(
          "h-9 rounded-full px-3",
          upvoted && "border-primary bg-primary text-primary-foreground hover:opacity-90",
        )}
      >
        <Heart className={cn("h-4 w-4", upvoted && "fill-current")} />
        <span className="tabular-nums font-medium">{upvoteCount}</span>
      </Button>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleSave}
        disabled={pendingSave}
        aria-pressed={saved}
        aria-label={saved ? "Speichern entfernen" : "Pin speichern"}
        className={cn(
          "h-9 rounded-full px-3",
          saved && "border-accent bg-accent text-accent-foreground hover:opacity-90",
        )}
      >
        <Bookmark className={cn("h-4 w-4", saved && "fill-current")} />
        <span className="hidden font-medium sm:inline">
          {saved ? "Gespeichert" : "Speichern"}
        </span>
      </Button>

      {error && (
        <span className="ml-1 text-xs text-primary" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
