import Link from "next/link";

export default function PinNotFound() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center px-4 py-16 text-center">
      <p className="text-4xl">📍</p>
      <h1 className="mt-3 text-xl font-semibold tracking-tight">
        Diesen Pin gibt es nicht (mehr)
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Vielleicht wurde er gelöscht oder ist privat. Schau auf der Karte nach
        anderen Orten.
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
