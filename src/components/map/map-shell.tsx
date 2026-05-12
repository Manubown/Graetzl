"use client";

import { useCallback, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import type { Pin } from "@/lib/pins/types";
import { parseFiltersFromParams, applyFilters } from "@/lib/pins/filters";
import { DropPinModal } from "./drop-pin-modal";

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
  const searchParams = useSearchParams();
  const filters = useMemo(
    () => parseFiltersFromParams(searchParams),
    [searchParams],
  );
  const filteredPins = useMemo(
    () => applyFilters(pins, filters),
    [pins, filters],
  );

  const [modalCoords, setModalCoords] = useState<{
    lng: number;
    lat: number;
  } | null>(null);

  const handleLongPress = useCallback((lng: number, lat: number) => {
    setModalCoords({ lng, lat });
  }, []);

  return (
    <>
      <ViennaMap pins={filteredPins} onLongPress={handleLongPress} />
      <DropPinModal
        open={modalCoords !== null}
        coords={modalCoords}
        onClose={() => setModalCoords(null)}
      />
    </>
  );
}
