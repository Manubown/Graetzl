import { Suspense } from "react";
import { SignInForm } from "./sign-in-form";
import { PigeonMark } from "@/components/pigeon-mark";
import { TrackSignupConfirmed } from "@/components/auth/track-signup-confirmed";

export const metadata = { title: "Anmelden" };

export default function SignInPage() {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-background p-8 shadow-sm">
        <div className="flex flex-col items-center text-center">
          <PigeonMark className="h-10 w-10 text-primary" />
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">
            Willkommen zurück
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Wir schicken dir einen Magic-Link per E-Mail. Kein Passwort, kein
            Tracking.
          </p>
        </div>
        <div className="mt-6">
          <SignInForm />
        </div>
        <Suspense fallback={null}>
          <TrackSignupConfirmed />
        </Suspense>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Mit der Anmeldung akzeptierst du unsere Nutzungsbedingungen und
          Datenschutzerklärung.
        </p>
      </div>
    </div>
  );
}
