import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { fetchPinWithStats } from "@/lib/pins/fetch";
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
  return {
    title: pin.title,
    description: pin.body.slice(0, 160),
    openGraph: pin.photo_url ? { images: [pin.photo_url] } : undefined,
  };
}

export default async function PinPage({ params }: PageProps) {
  const { id } = await params;
  const pin = await fetchPinWithStats(id).catch(() => null);
  if (!pin) notFound();

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
          <PinDetail pin={pin} />
        </CardContent>
      </Card>
    </div>
  );
}
