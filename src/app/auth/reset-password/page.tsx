import { Suspense } from "react";
import { ResetPasswordForm } from "./_form";

export const metadata = { title: "Passwort zurücksetzen" };

export default function ResetPasswordPage() {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-12">
      <Suspense
        fallback={
          <div className="rounded-2xl border border-border bg-background p-8 shadow-sm text-center">
            <p className="text-sm text-muted-foreground">Wird geprüft…</p>
          </div>
        }
      >
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
