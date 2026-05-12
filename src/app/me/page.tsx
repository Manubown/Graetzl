import { redirect } from "next/navigation";
import { fetchCurrentProfile } from "@/lib/profiles/fetch";

/**
 * /me — convenience redirect to the signed-in user's profile.
 * Used by future "My profile" links; signed-out users get bounced
 * to the sign-in page.
 */
export default async function MePage() {
  const profile = await fetchCurrentProfile().catch(() => null);
  if (!profile) redirect("/sign-in");
  redirect(`/u/${profile.handle}`);
}
