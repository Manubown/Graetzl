import Link from "next/link";
import { PigeonMark } from "@/components/pigeon-mark";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 flex h-14 w-full items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur-md">
      <Link href="/" className="flex items-center gap-2">
        <PigeonMark className="h-7 w-7 text-primary" />
        <span className="text-lg font-semibold tracking-tight">Grätzl</span>
        <span className="hidden text-xs text-muted-foreground sm:inline">
          · Wien
        </span>
      </Link>
      <nav className="flex items-center gap-4 text-sm">
        <Link
          href="/sign-in"
          className="rounded-full bg-foreground px-4 py-1.5 text-background transition-opacity hover:opacity-90"
        >
          Anmelden
        </Link>
      </nav>
    </header>
  );
}
