import { notFound } from "next/navigation";
import { fetchPinWithStats } from "@/lib/pins/fetch";
import { fetchCurrentProfile } from "@/lib/profiles/fetch";
import { getAdminUids } from "@/lib/admin/guard";
import { PinDetail } from "@/components/pin/pin-detail";
import { PinDetailModal } from "@/components/pin/pin-detail-modal";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PinModalIntercept({ params }: PageProps) {
  const { id } = await params;
  const [pin, current] = await Promise.all([
    fetchPinWithStats(id).catch(() => null),
    fetchCurrentProfile().catch(() => null),
  ]);
  if (!pin) notFound();

  const isOwner = current?.id === pin.author_id;
  const isAdmin = current !== null && getAdminUids().includes(current.id);

  return (
    <PinDetailModal>
      <PinDetail pin={pin} isOwner={isOwner} isAdmin={isAdmin} />
    </PinDetailModal>
  );
}
