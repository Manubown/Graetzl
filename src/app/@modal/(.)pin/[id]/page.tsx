import { notFound } from "next/navigation";
import { fetchPinWithStats } from "@/lib/pins/fetch";
import { PinDetail } from "@/components/pin/pin-detail";
import { PinDetailModal } from "@/components/pin/pin-detail-modal";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PinModalIntercept({ params }: PageProps) {
  const { id } = await params;
  const pin = await fetchPinWithStats(id).catch(() => null);
  if (!pin) notFound();

  return (
    <PinDetailModal>
      <PinDetail pin={pin} />
    </PinDetailModal>
  );
}
