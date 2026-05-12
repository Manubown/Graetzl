import Link from "next/link";

export default function ProfileNotFound() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center px-4 py-16 text-center">
      <p className="text-4xl">🕊️</p>
      <h1 className="mt-3 text-xl font-semibold tracking-tight">
        Dieses Profil gibt es nicht
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Vielleicht hat sich das Handle geändert oder das Konto wurde gelöscht.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
      >
        Zur Karte
      </Link>
    </div>
  );
}
