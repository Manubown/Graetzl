import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { fetchPinWithStats } from "@/lib/pins/fetch";
import { fetchCurrentProfile } from "@/lib/profiles/fetch";
import { getAdminUids } from "@/lib/admin/guard";
import { PinDetail } from "@/components/pin/pin-detail";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const pin = await fetchPinWithStats(id).catch(() => null);
  if (!pin) return { title: "Pin nicht gefunden" };

  // Trim to ~160 chars for descriptions (Google snippet ceiling) without
  // mid-word breaks. Ellipsis added only if we actually had to truncate.
  const description =
    pin.body.length > 160 ? pin.body.slice(0, 157).trimEnd() + "…" : pin.body;

  const path = `/pin/${pin.id}`;
  const image = pin.photo_url ?? undefined;
  const ogTitle = `${pin.title} · Grätzl`;

  return {
    title: pin.title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: ogTitle,
      description,
      url: path,
      type: "article",
      locale: "de_AT",
      siteName: "Grätzl",
      ...(image
        ? {
            images: [
              {
                url: image,
                alt: pin.title,
                width: 1200,
                height: 630,
              },
            ],
          }
        : {}),
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title: ogTitle,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}

export default async function PinPage({ params }: PageProps) {
  const { id } = await params;
  const [pin, current] = await Promise.all([
    fetchPinWithStats(id).catch(() => null),
    fetchCurrentProfile().catch(() => null),
  ]);
  if (!pin) notFound();

  const isOwner = current?.id === pin.author_id;
  const isAdmin = current !== null && getAdminUids().includes(current.id);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <Button
        asChild
        variant="ghost"
        size="sm"
        className="mb-4 text-muted-foreground hover:text-foreground"
      >
        <Link href="/">
          <ChevronLeft className="h-3.5 w-3.5" />
          Zurück zur Karte
        </Link>
      </Button>
      <Card className="border-border/50 bg-background/60 backdrop-blur-2xl">
        <CardContent className="p-5">
          <PinDetail pin={pin} isOwner={isOwner} isAdmin={isAdmin} />
        </CardContent>
      </Card>
    </div>
  );
}
