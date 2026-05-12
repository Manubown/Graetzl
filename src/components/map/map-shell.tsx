"use client";

import { useCallback, useState } from "react";
import dynamic from "next/dynamic";
import type { Pin } from "@/lib/pins/types";
import { DropPinModal } from "./drop-pin-modal";

/**
 * Client wrapper that:
 *  • Dynamically imports the WebGL map with ssr:false (Next 16 disallows
 *    this in Server Components, so it lives here in a client wrapper).
 *  • Owns the drop-pin modal state so the map can call back with
 *    long-press coordinates.
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

export function MapShell({ pins }: { pins: Pin[] }) {
  const [modalCoords, setModalCoords] = useState<{
    lng: number;
    lat: number;
  } | null>(null);

  const handleLongPress = useCallback((lng: number, lat: number) => {
    setModalCoords({ lng, lat });
  }, []);

  return (
    <>
      <ViennaMap pins={pins} onLongPress={handleLongPress} />
      <DropPinModal
        open={modalCoords !== null}
        coords={modalCoords}
        onClose={() => setModalCoords(null)}
      />
    </>
  );
}
