import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { fetchCurrentProfile } from "@/lib/profiles/fetch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ThemeSettings } from "@/components/settings/theme-settings";

export const metadata = {
  title: "Konto",
};

/**
 * /me — account settings. Signed-out users get bounced to /sign-in.
 * Hosts the theme override toggle (C-11). Public profile lives at
 * /u/<handle>; this page is the private settings surface.
 */
export default async function MePage() {
  const profile = await fetchCurrentProfile().catch(() => null);
  if (!profile) redirect("/sign-in");

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Konto</h1>

      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Profil</CardTitle>
            <CardDescription>
              Dein öffentliches Profil unter <code>@{profile.handle}</code>.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full justify-between">
              <Link href={`/u/${profile.handle}`}>
                <span>Profil ansehen</span>
                <ChevronRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Erscheinungsbild</CardTitle>
            <CardDescription>
              Wähle hell, dunkel oder folge deinen Systemeinstellungen.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ThemeSettings />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
