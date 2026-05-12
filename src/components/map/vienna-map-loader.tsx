"use client";

import dynamic from "next/dynamic";

/**
 * `next/dynamic` with `ssr: false` is only legal inside a Client
 * Component (Next 16+). This thin wrapper exists solely to host that
 * dynamic import; the actual map lives in `./vienna-map.tsx`.
 *
 * MapLibre touches `window` and WebGL at module load time, so we must
 * skip SSR entirely for it.
 */
const ViennaMap = dynamic(
  () => import("./vienna-map").then((m) => m.ViennaMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-muted">
        <p className="text-sm text-muted-foreground">Karte wird geladen…</p>
      </div>
    ),
  },
);

export function ViennaMapLoader() {
  return <ViennaMap />;
}
