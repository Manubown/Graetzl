"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setPinSpecial } from "@/lib/admin/actions";
import { cn } from "@/lib/utils";

interface PinSpecialToggleProps {
  pinId: string;
  initialIsSpecial: boolean;
}

/**
 * Admin-only toggle on the pin detail page. Flips `is_special` via the
 * service-role server action. Pin authors cannot self-mark — the
 * server action's requireAdmin() check is the gate, the UI button is
 * only rendered for admins by the page wrapper.
 */
export function PinSpecialToggle({
  pinId,
  initialIsSpecial,
}: PinSpecialToggleProps) {
  const router = useRouter();
  const [isSpecial, setIsSpecial] = useState(initialIsSpecial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleToggle() {
    setError(null);
    const next = !isSpecial;
    setIsSpecial(next);
    startTransition(async () => {
      const result = await setPinSpecial(pinId, next);
      if (!result.ok) {
        setIsSpecial(!next);
        setError(result.error);
        return;
      }
      // Pull fresh pin data so the badge + map marker pick up the new
      // flag without a manual reload. The server action already
      // revalidated the path, so refresh() just re-renders against
      // the new cache.
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleToggle}
        disabled={pending}
        aria-pressed={isSpecial}
        className={cn(
          "h-9 gap-1.5 rounded-full",
          isSpecial &&
            "border-accent bg-accent text-accent-foreground hover:opacity-90",
        )}
      >
        <Sparkles className={cn("h-3.5 w-3.5", isSpecial && "fill-current")} />
        {isSpecial ? "Geheimtipp markiert" : "Als Geheimtipp markieren"}
      </Button>
      {error && (
        <span className="text-xs text-primary" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
