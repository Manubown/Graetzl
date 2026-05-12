"use client";

import { useCallback, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Plus } from "lucide-react";
import type { Pin } from "@/lib/pins/types";
import { DropPinModal } from "./drop-pin-modal";

/** Vienna's default centre — also the fallback for the FAB when the map
 *  ref isn't ready yet (it always is, but TypeScript wants the guard). */
const VIENNA_CENTER = { lng: 16.3738, lat: 48.2082 };

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

  // Track the current map view via a ref the map updates on move events.
  // We don't need state because the FAB reads it imperatively on click.
  const viewRef = useRef<{ lng: number; lat: number }>(VIENNA_CENTER);

  const handleLongPress = useCallback((lng: number, lat: number) => {
    setModalCoords({ lng, lat });
  }, []);

  const handleViewChange = useCallback((lng: number, lat: number) => {
    viewRef.current = { lng, lat };
  }, []);

  function handleFabClick() {
    setModalCoords({ ...viewRef.current });
  }

  return (
    <>
      <ViennaMap
        pins={pins}
        onLongPress={handleLongPress}
        onViewChange={handleViewChange}
      />

      {/* Floating "+" — drop a pin at the current map centre. Primary
          drop-pin affordance on mobile, complementary on desktop. */}
      <button
        type="button"
        onClick={handleFabClick}
        aria-label="Pin an dieser Stelle setzen"
        className="absolute right-4 bottom-24 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl ring-4 ring-background transition-transform hover:scale-105 active:scale-95 sm:bottom-28"
      >
        <Plus className="h-7 w-7" strokeWidth={2.5} />
      </button>

      <DropPinModal
        open={modalCoords !== null}
        coords={modalCoords}
        onClose={() => setModalCoords(null)}
      />
    </>
  );
}
