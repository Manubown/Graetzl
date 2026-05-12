import { notFound } from "next/navigation";
import { fetchPin } from "@/lib/pins/fetch";
import { PinDetail } from "@/components/pin/pin-detail";
import { PinDetailModal } from "@/components/pin/pin-detail-modal";

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * Intercepting route: triggered when the user navigates to /pin/[id]
 * from the home map (router.push from marker click, etc). The same URL
 * accessed directly (reload, deep link) renders the full page instead.
 */
export default async function PinModalIntercept({ params }: PageProps) {
  const { id } = await params;
  const pin = await fetchPin(id).catch(() => null);
  if (!pin) notFound();

  return (
    <PinDetailModal>
      <PinDetail pin={pin} />
    </PinDetailModal>
  );
}
