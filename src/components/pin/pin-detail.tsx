import Image from "next/image";
import Link from "next/link";
import type { Pin } from "@/lib/pins/types";
import { CATEGORIES } from "@/lib/pins/constants";

interface PinDetailProps {
  pin: Pin;
}

/**
 * Visual representation of a single pin. Used both standalone
 * (in /pin/[id]) and inside a modal (via the intercepting route).
 *
 * Server-renderable; no client hooks here.
 */
export function PinDetail({ pin }: PinDetailProps) {
  const category = CATEGORIES.find((c) => c.value === pin.category);
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
        <h1 className="text-xl font-semibold tracking-tight">{pin.title}</h1>
        {category && (
          <span className="shrink-0 rounded-full bg-muted px-3 py-1 text-xs font-medium">
            {category.emoji} {category.label}
          </span>
        )}
      </div>

      <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
        {pin.body}
      </p>

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
    </article>
  );
}
