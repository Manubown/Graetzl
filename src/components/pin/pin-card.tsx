import Image from "next/image";
import Link from "next/link";
import type { Pin } from "@/lib/pins/types";
import { CATEGORIES } from "@/lib/pins/constants";
import { Badge } from "@/components/ui/badge";

interface PinCardProps {
  pin: Pin;
}

export function PinCard({ pin }: PinCardProps) {
  const category = CATEGORIES.find((c) => c.value === pin.category);
  return (
    <Link
      href={`/pin/${pin.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-background transition-shadow hover:shadow-md"
    >
      <div className="relative aspect-[4/3] w-full border border-border bg-muted">
        {pin.photo_url ? (
          <Image
            src={pin.photo_url}
            alt={pin.title}
            fill
            sizes="(max-width: 768px) 100vw, 280px"
            className="object-cover transition-transform group-hover:scale-[1.02]"
            unoptimized
          />
        ) : (
          <div className="flex h-full items-center justify-center text-3xl">
            {category?.emoji ?? "📍"}
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1 p-3">
        <h3 className="line-clamp-1 text-sm font-medium tracking-tight">
          {pin.title}
        </h3>
        <p className="line-clamp-2 text-xs text-muted-foreground">
          {pin.body}
        </p>
        {category && (
          <Badge variant="secondary" className="mt-1 gap-1">
            {category.emoji} {category.label}
          </Badge>
        )}
      </div>
    </Link>
  );
}
