import Image from "next/image";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import type { PinWithStats } from "@/lib/pins/types";
import { CATEGORIES } from "@/lib/pins/constants";
import { isCuratedPin } from "@/lib/pins/system";
import { Badge } from "@/components/ui/badge";
import { PinActions } from "./pin-actions";
import { PinEditButton } from "./pin-edit-button";
import { PinSpecialToggle } from "./pin-special-toggle";
import { ReportButton } from "./report-button";

interface PinDetailProps {
  pin: PinWithStats;
  isOwner?: boolean;
  isAdmin?: boolean;
}

export function PinDetail({
  pin,
  isOwner = false,
  isAdmin = false,
}: PinDetailProps) {
  const category = CATEGORIES.find((c) => c.value === pin.category);
  const isCurated = isCuratedPin(pin.author_id);
  const created = new Date(pin.created_at);
  const dateLabel = created.toLocaleDateString("de-AT", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <article className="flex flex-col gap-4">
      {pin.photo_url && (
        <div className="relative aspect-[16/10] w-full overflow-hidden rounded-xl bg-muted">
          <Image
            src={pin.photo_url}
            alt={pin.title}
            fill
            sizes="(max-width: 768px) 100vw, 720px"
            className="object-cover"
            unoptimized
            priority
          />
        </div>
      )}

      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight">{pin.title}</h1>
          {pin.is_special && (
            <Badge className="shrink-0 gap-1 border-accent bg-accent text-accent-foreground">
              <Sparkles className="h-3 w-3 fill-current" aria-hidden />
              Geheimtipp
            </Badge>
          )}
          {isCurated && (
            <Badge variant="secondary" className="shrink-0">
              Kuratiert
            </Badge>
          )}
        </div>
        {category && (
          <Badge variant="secondary" className="shrink-0">
            {category.emoji} {category.label}
          </Badge>
        )}
      </div>

      <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
        {pin.body}
      </p>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <PinActions
          pinId={pin.id}
          initialUpvoteCount={pin.upvote_count}
          initialHasUpvoted={pin.has_upvoted}
          initialHasSaved={pin.has_saved}
        />
        {isOwner && (
          <PinEditButton
            pinId={pin.id}
            initial={{
              title: pin.title,
              body: pin.body,
              category: pin.category,
              language: pin.language,
              photo_url: pin.photo_url,
            }}
          />
        )}
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-border pt-3 text-xs text-muted-foreground">
        <div>
          <dt className="font-medium text-foreground">Von</dt>
          <dd>
            {pin.author_handle ? (
              <Link
                href={`/u/${pin.author_handle}`}
                className="hover:text-foreground"
              >
                @{pin.author_handle}
              </Link>
            ) : (
              <span>Former local</span>
            )}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-foreground">Gesetzt</dt>
          <dd>{dateLabel}</dd>
        </div>
        <div>
          <dt className="font-medium text-foreground">Präzision</dt>
          <dd>{pin.precision === "exact" ? "Exakt" : "~100 m gerundet"}</dd>
        </div>
        <div>
          <dt className="font-medium text-foreground">Sprache</dt>
          <dd>{pin.language === "de" ? "Deutsch" : pin.language}</dd>
        </div>
      </dl>

      <div className="flex flex-wrap items-center justify-end gap-2">
        {isAdmin && (
          <PinSpecialToggle
            pinId={pin.id}
            initialIsSpecial={pin.is_special}
          />
        )}
        <ReportButton pinId={pin.id} />
      </div>
    </article>
  );
}
