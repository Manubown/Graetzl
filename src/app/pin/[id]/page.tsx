import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { fetchPinWithStats } from "@/lib/pins/fetch";
import { PinDetail } from "@/components/pin/pin-detail";

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
      <Link
        href="/"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M15 18l-6-6 6-6" />
        </svg>
        Zurück zur Karte
      </Link>
      <PinDetail pin={pin} />
    </div>
  );
}
