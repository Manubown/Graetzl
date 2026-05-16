"use client";

import { useCallback, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import type { Pin } from "@/lib/pins/types";
import { parseFiltersFromParams, applyFilters } from "@/lib/pins/filters";
import type { DistrictSummary } from "@/lib/districts/use-districts";
import { track } from "@/lib/analytics/plausible";
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

interface MapShellProps {
  pins: Pin[];
  districts: DistrictSummary[];
}

export function MapShell({ pins, districts }: MapShellProps) {
  const searchParams = useSearchParams();

  const filters = useMemo(
    () => parseFiltersFromParams(searchParams),
    [searchParams],
  );

  // Selected bezirk lives in local state only — clicking a polygon highlights
  // and zooms but never writes to the URL and never filters pins. Pin list
  // is governed by category + language filters from the URL.
  const [selectedBezirk, setSelectedBezirk] = useState<number | null>(null);
  const [selectedBezirkBbox, setSelectedBezirkBbox] = useState<
    [number, number, number, number] | null
  >(null);

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

  const handleBezirkChange = useCallback(
    (
      nextBezirk: number | null,
      bbox?: [number, number, number, number],
    ) => {
      if (nextBezirk !== null) {
        track("district_click", { bezirk: nextBezirk });
      }
      setSelectedBezirk(nextBezirk);
      setSelectedBezirkBbox(nextBezirk === null ? null : bbox ?? null);
    },
    [],
  );

  return (
    <>
      <ViennaMap
        pins={filteredPins}
        districts={districts}
        selectedBezirk={selectedBezirk}
        selectedBezirkBbox={selectedBezirkBbox}
        onBezirkChange={handleBezirkChange}
        onLongPress={handleLongPress}
      />
      <DropPinModal
        open={modalCoords !== null}
        coords={modalCoords}
        onClose={() => setModalCoords(null)}
      />
    </>
  );
}
