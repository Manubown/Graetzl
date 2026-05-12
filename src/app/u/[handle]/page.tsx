import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { fetchProfileWithStats, fetchCurrentProfile } from "@/lib/profiles/fetch";
import { PinCard } from "@/components/pin/pin-card";
import { PigeonMark } from "@/components/pigeon-mark";
import { ProfileEditButton } from "@/components/profile/profile-edit-button";

interface PageProps {
  params: Promise<{ handle: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { handle } = await params;
  const profile = await fetchProfileWithStats(handle).catch(() => null);
  if (!profile) return { title: "Profil nicht gefunden" };
  return {
    title: `@${profile.handle}`,
    description:
      profile.bio ?? `Pins von @${profile.handle} in ${profile.home_city}.`,
  };
}

export default async function ProfilePage({ params }: PageProps) {
  const { handle } = await params;
  const [profile, current] = await Promise.all([
    fetchProfileWithStats(handle).catch(() => null),
    fetchCurrentProfile().catch(() => null),
  ]);
  if (!profile) notFound();

  const isOwner = current?.id === profile.id;
  const joined = new Date(profile.created_at).toLocaleDateString("de-AT", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <section className="flex flex-col items-start gap-4 rounded-2xl border border-border bg-background p-6 sm:flex-row sm:items-center">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-muted">
          <PigeonMark className="h-10 w-10 text-primary" />
        </div>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              @{profile.handle}
            </h1>
            {isOwner && (
              <ProfileEditButton
                handle={profile.handle}
                bio={profile.bio}
                home_city={profile.home_city}
              />
            )}
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {profile.home_city} · seit {joined} dabei · {profile.pin_count}{" "}
            {profile.pin_count === 1 ? "Pin" : "Pins"}
          </p>
          {profile.bio && (
            <p className="mt-2 max-w-prose text-sm leading-relaxed">
              {profile.bio}
            </p>
          )}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-medium tracking-tight text-muted-foreground">
          Letzte Pins
        </h2>
        {profile.recent_pins.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/30 px-6 py-10 text-center text-sm text-muted-foreground">
            Noch keine Pins.{" "}
            <Link href="/" className="underline hover:text-foreground">
              Zur Karte
            </Link>
            .
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {profile.recent_pins.map((p) => (
              <PinCard key={p.id} pin={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
