"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import { Protocol } from "pmtiles";
import { useRouter } from "next/navigation";
import type { Pin } from "@/lib/pins/types";
import type { DistrictSummary } from "@/lib/districts/use-districts";
import {
  DEFAULT_ZOOM,
  MAX_BOUNDS,
  MAX_ZOOM,
  MIN_ZOOM,
  VIENNA_CENTER,
  getProtomapsStyle,
  type ProtomapsFlavor,
} from "@/components/map/layers/style";
import {
  attachPinsLayer,
  setPins,
  PINS_SOURCE_ID,
} from "@/components/map/layers/pins-layer";
import {
  attachDistrictsLayer,
  setSelectedDistrict,
} from "@/components/map/layers/districts-layer";
import { track } from "@/lib/analytics/plausible";

// Sources + layers added by our overlay modules. When the basemap style
// is swapped (dark/light theme), we hand these to setStyle's transformStyle
// callback so MapLibre re-mounts them on top of the new style instead of
// dropping them via its default diff.
const CUSTOM_SOURCE_IDS = [PINS_SOURCE_ID, "districts"] as const;
const CUSTOM_LAYER_IDS = new Set([
  "districts-fill",
  "districts-fill-selected",
  "districts-line",
  "clusters",
  "pin-point",
]);

const LONG_PRESS_MS = 450;
const LONG_PRESS_MOVE_TOLERANCE_PX = 8;

// ─── Protomaps protocol registration ──────────────────────────────────────
if (typeof window !== "undefined") {
  const pmtilesProtocol = new Protocol();
  maplibregl.addProtocol("pmtiles", pmtilesProtocol.tile);
}

// ─── Theme → Protomaps flavour ────────────────────────────────────────────
function resolveThemeFlavor(): ProtomapsFlavor {
  if (typeof document === "undefined") return "light";
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

// ─── Types ─────────────────────────────────────────────────────────────────

interface ViennaMapProps {
  pins: Pin[];
  onLongPress?: (lng: number, lat: number) => void;
  onViewChange?: (lng: number, lat: number) => void;
  selectedBezirk?: number | null;
  selectedBezirkBbox?: [number, number, number, number] | null;
  districts?: DistrictSummary[];
  onBezirkChange?: (
    next: number | null,
    bbox?: [number, number, number, number],
  ) => void;
}

// ─── Component ─────────────────────────────────────────────────────────────

export function ViennaMap({
  pins,
  onLongPress,
  onViewChange,
  selectedBezirk,
  selectedBezirkBbox,
  districts = [],
  onBezirkChange,
}: ViennaMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const router = useRouter();

  // ── Stable callback refs ────────────────────────────────────────────────
  const onLongPressRef = useRef<typeof onLongPress>(onLongPress);
  const onViewChangeRef = useRef<typeof onViewChange>(onViewChange);
  const onBezirkChangeRef = useRef<typeof onBezirkChange>(onBezirkChange);
  const selectedBezirkRef = useRef<number | null>(selectedBezirk ?? null);
  const latestPinsRef = useRef<Pin[]>(pins);
  const currentFlavorRef = useRef<ProtomapsFlavor | null>(null);

  useEffect(() => { onLongPressRef.current = onLongPress; }, [onLongPress]);
  useEffect(() => { onViewChangeRef.current = onViewChange; }, [onViewChange]);
  useEffect(() => { onBezirkChangeRef.current = onBezirkChange; }, [onBezirkChange]);
  useEffect(() => { selectedBezirkRef.current = selectedBezirk ?? null; }, [selectedBezirk]);
  useEffect(() => { latestPinsRef.current = pins; }, [pins]);

  // ── Map init (one-time) ────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const initialFlavor = resolveThemeFlavor();
    currentFlavorRef.current = initialFlavor;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: getProtomapsStyle(initialFlavor),
      center: VIENNA_CENTER,
      zoom: DEFAULT_ZOOM,
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
      maxBounds: MAX_BOUNDS,
      attributionControl: { compact: true },
    });

    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "top-right",
    );
    map.addControl(
      new maplibregl.GeolocateControl({
        positionOptions: { enableHighAccuracy: false },
        trackUserLocation: false,
      }),
      "top-right",
    );

    map.on("load", () => {
      if (onViewChangeRef.current) {
        const c = map.getCenter();
        onViewChangeRef.current(c.lng, c.lat);
      }
    });

    const attachOverlays = () => {
      attachPinsLayer(map, {
        onPinClick: (id) => router.push(`/pin/${id}`),
      });

      attachDistrictsLayer(map, {
        onPaintComplete: (durationMs) => {
          track("polygon_layer_painted", {
            duration_ms: Math.round(durationMs),
          });
        },
        onDistrictClick: (bezirk, bbox) => {
          const cur = selectedBezirkRef.current;
          const next = cur === bezirk ? null : bezirk;
          onBezirkChangeRef.current?.(next, next === null ? undefined : bbox);
        },
      });

      setPins(map, latestPinsRef.current);
      setSelectedDistrict(map, selectedBezirkRef.current);
    };

    map.on("style.load", attachOverlays);

    map.on("moveend", () => {
      const c = map.getCenter();
      onViewChangeRef.current?.(c.lng, c.lat);
    });

    // ================================================================
    // Long-press detection — mouse AND touch (long-press still wins).
    // ================================================================
    let pressTimer: ReturnType<typeof setTimeout> | null = null;
    let pressStart: {
      x: number;
      y: number;
      lng: number;
      lat: number;
    } | null = null;
    let pressedOverFeature = false;

    function cancelPress() {
      if (pressTimer) clearTimeout(pressTimer);
      pressTimer = null;
      pressStart = null;
      pressedOverFeature = false;
    }

    function beginPress(
      point: maplibregl.Point,
      lngLat: maplibregl.LngLat,
    ) {
      // Filter layer list to ones that actually exist — during a setStyle()
      // (theme switch) layers are dropped briefly before being re-added,
      // and queryRenderedFeatures throws on missing layer IDs.
      const probeLayers = ["pin-point", "clusters"].filter((id) =>
        map.getLayer(id),
      );
      const features =
        probeLayers.length > 0
          ? map.queryRenderedFeatures(point, { layers: probeLayers })
          : [];
      pressedOverFeature = features.length > 0;
      if (pressedOverFeature) return;

      pressStart = {
        x: point.x,
        y: point.y,
        lng: lngLat.lng,
        lat: lngLat.lat,
      };
      pressTimer = setTimeout(() => {
        if (pressStart && onLongPressRef.current) {
          onLongPressRef.current(pressStart.lng, pressStart.lat);
        }
        cancelPress();
      }, LONG_PRESS_MS);
    }

    function checkMove(point: maplibregl.Point) {
      if (!pressStart || pressedOverFeature) return;
      const dx = point.x - pressStart.x;
      const dy = point.y - pressStart.y;
      if (Math.hypot(dx, dy) > LONG_PRESS_MOVE_TOLERANCE_PX) cancelPress();
    }

    map.on("mousedown", (e) => beginPress(e.point, e.lngLat));
    map.on("mousemove", (e) => checkMove(e.point));
    map.on("mouseup", cancelPress);

    map.on("touchstart", (e) => {
      if (e.originalEvent.touches.length > 1) {
        cancelPress();
        return;
      }
      beginPress(e.point, e.lngLat);
    });
    map.on("touchmove", (e) => {
      if (e.originalEvent.touches.length > 1) {
        cancelPress();
        return;
      }
      checkMove(e.point);
    });
    map.on("touchend", cancelPress);
    map.on("touchcancel", cancelPress);

    map.on("dragstart", cancelPress);
    map.on("contextmenu", (e) => {
      if (onLongPressRef.current) {
        onLongPressRef.current(e.lngLat.lng, e.lngLat.lat);
        e.preventDefault();
      }
    });

    mapRef.current = map;

    return () => {
      cancelPress();
      map.remove();
      mapRef.current = null;
    };
  }, [router]);

  // ── Sync pins into the map source ──────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (map.isStyleLoaded()) {
      setPins(map, pins);
    } else {
      map.once("load", () => setPins(map, pins));
    }
  }, [pins]);

  // ── Theme → Protomaps flavour swap ─────────────────────────────────────
  useEffect(() => {
    if (typeof MutationObserver === "undefined") return;
    const observer = new MutationObserver(() => {
      const map = mapRef.current;
      if (!map) return;
      const nextFlavor = resolveThemeFlavor();
      if (nextFlavor === currentFlavorRef.current) return;
      currentFlavorRef.current = nextFlavor;

      // Preserve our custom overlay sources + layers across the basemap
      // swap. Without transformStyle, MapLibre's default style-diff drops
      // anything not in the next style spec — pins and districts vanish
      // until the user reloads. With it, pins stay visible mid-swap and
      // attachOverlays' idempotency guards safely no-op on the re-attach.
      map.setStyle(getProtomapsStyle(nextFlavor), {
        diff: false,
        transformStyle: (previousStyle, nextStyle) => {
          if (!previousStyle) return nextStyle;

          const preservedSources: Record<string, maplibregl.SourceSpecification> =
            {};
          for (const id of CUSTOM_SOURCE_IDS) {
            const src = previousStyle.sources?.[id];
            if (src) preservedSources[id] = src;
          }

          const preservedLayers = (previousStyle.layers ?? []).filter((l) =>
            CUSTOM_LAYER_IDS.has(l.id),
          );

          return {
            ...nextStyle,
            sources: { ...nextStyle.sources, ...preservedSources },
            layers: [...(nextStyle.layers ?? []), ...preservedLayers],
          };
        },
      });
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);

  // ── B-11: react to selectedBezirk prop changes ─────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    function applySelection() {
      if (!map) return;
      setSelectedDistrict(map, selectedBezirk ?? null);

      if (selectedBezirk != null) {
        const bbox =
          selectedBezirkBbox ??
          districts.find((d) => d.id === selectedBezirk)?.bbox ??
          null;
        if (bbox) {
          setTimeout(() => {
            if (!mapRef.current) return;
            mapRef.current.fitBounds(
              [
                [bbox[0], bbox[1]],
                [bbox[2], bbox[3]],
              ],
              { padding: 40, duration: 600 },
            );
          }, 0);
        }
      }
    }

    if (map.isStyleLoaded()) {
      applySelection();
    } else {
      map.once("load", applySelection);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBezirk]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full"
      aria-label="Map of Vienna"
      role="application"
    />
  );
}
