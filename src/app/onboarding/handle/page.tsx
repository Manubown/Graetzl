import { redirect } from "next/navigation";
import { fetchCurrentProfile } from "@/lib/profiles/fetch";
import { HandlePicker } from "@/components/auth/handle-picker";

export default async function OnboardingHandlePage() {
  const profile = await fetchCurrentProfile().catch(() => null);
  if (!profile) redirect("/sign-in?next=/onboarding/handle");

  // If they've already picked a real handle and somehow landed here, bounce to home.
  if (!/^wiener_[0-9a-f]{8}$/.test(profile.handle)) {
    redirect("/");
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-12">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Wähle deinen Handle
        </h1>
        <p className="text-sm text-muted-foreground">
          Dein Handle erscheint auf jedem Pin, den du setzt oder bearbeitest. Du
          kannst ihn später in den Einstellungen ändern.
        </p>
      </header>
      <HandlePicker currentHandle={profile.handle} />
    </main>
  );
}
