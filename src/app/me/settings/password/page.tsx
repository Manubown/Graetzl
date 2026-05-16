import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { UpdatePasswordForm } from "./_form";

export const metadata = { title: "Passwort ändern" };

/**
 * /me/settings/password — standalone password-reset landing page.
 *
 * Exists so the recovery email link (`?type=recovery`) has a stable URL
 * that won't break when the full /me/settings shell ships in Slice 2.
 * The /auth/callback route exchanges the recovery code for a session before
 * redirecting here, so getUser() reliably returns a user.
 *
 * No session → bounced to sign-in with a `next` param so the user lands
 * back here after authenticating.
 */
export default async function PasswordSettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in?next=/me/settings/password");
  }

  const params = await searchParams;
  const isRecovery = params["reset"] === "1";

  return (
    <div className="mx-auto w-full max-w-md px-4 py-12">
      <div className="rounded-2xl border border-border bg-background p-8 shadow-sm">
        <h1 className="mb-1 text-2xl font-semibold tracking-tight">
          Passwort ändern
        </h1>

        {isRecovery && (
          <p className="mb-6 text-sm text-muted-foreground">
            Setze ein neues Passwort, um wieder Zugriff zu erhalten.
          </p>
        )}

        {!isRecovery && (
          <p className="mb-6 text-sm text-muted-foreground">
            Wähle ein neues Passwort mit mindestens 12 Zeichen.
          </p>
        )}

        <UpdatePasswordForm />
      </div>
    </div>
  );
}
