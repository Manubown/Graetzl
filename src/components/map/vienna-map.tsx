"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import { useRouter } from "next/navigation";
import type { Pin } from "@/lib/pins/types";

const VIENNA_CENTER: [number, number] = [16.3738, 48.2082];
const DEFAULT_ZOOM = 12;
const LONG_PRESS_MS = 450;
const LONG_PRESS_MOVE_TOLERANCE_PX = 6;

/**
 * OpenStreetMap raster tiles. Phase-2 plan calls for self-hosted
 * Protomaps vector tiles once scale demands it.
 *
 * No `glyphs` URL here — we deliberately avoid pulling fonts from
 * third-party servers (some are unreliable; we hit "Unimplemented
 * type: 4" protobuf-parser errors in MapLibre on bad responses).
 * Cluster size is conveyed by circle radius alone; once we self-host
 * Protomaps in Phase 2 we'll bundle glyphs and add numeric labels back.
 */
const OSM_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: [
        "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
        "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
        "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
      maxzoom: 19,
    },
  },
  layers: [
    {
      id: "osm-tiles",
      type: "raster",
      source: "osm",
      minzoom: 0,
      maxzoom: 22,
    },
  ],
};

const PINS_SOURCE_ID = "graetzl-pins";

function pinsToFeatureCollection(
  pins: Pin[],
): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: pins.map((p) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [p.lng, p.lat] },
      properties: { id: p.id, title: p.title, category: p.category },
    })),
  };
}

interface ViennaMapProps {
  pins: Pin[];
  /**
   * Called when the user long-presses an empty spot on the map.
   * Coordinates are in lng/lat (WGS84).
   */
  onLongPress?: (lng: number, lat: number) => void;
}

export function ViennaMap({ pins, onLongPress }: ViennaMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const router = useRouter();

  const onLongPressRef = useRef<typeof onLongPress>(onLongPress);
  useEffect(() => {
    onLongPressRef.current = onLongPress;
  }, [onLongPress]);

  // One-time map init.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: OSM_STYLE,
      center: VIENNA_CENTER,
      zoom: DEFAULT_ZOOM,
      minZoom: 10,
      maxZoom: 19,
      maxBounds: [
        [16.18, 48.10],
        [16.58, 48.33],
      ],
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
      map.addSource(PINS_SOURCE_ID, {
        type: "geojson",
        data: pinsToFeatureCollection([]),
        cluster: true,
        clusterRadius: 50,
        clusterMaxZoom: 14,
      });

      // Cluster bubbles. No text inside — radius + stroke tell the story.
      map.addLayer({
        id: "clusters",
        type: "circle",
        source: PINS_SOURCE_ID,
        filter: ["has", "point_count"],
        paint: {
          "circle-color": [
            "step",
            ["get", "point_count"],
            "#d04640",  // 2–9 pins, soft
            10, "#b3322c",   // 10–49, primary Wiener Rot
            50, "#7a1f1c",   // 50+, deep
          ],
          "circle-opacity": 0.9,
          "circle-radius": [
            "step",
            ["get", "point_count"],
            14,
            10, 22,
            50, 32,
          ],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 3,
          "circle-stroke-opacity": 0.95,
        },
      });

      // Individual pins
      map.addLayer({
        id: "pin-point",
        type: "circle",
        source: PINS_SOURCE_ID,
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": "#b3322c",
          "circle-radius": 8,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
        },
      });

      map.on("click", "clusters", (e) => {
        const features = map.queryRenderedFeatures(e.point, {
          layers: ["clusters"],
        });
        const clusterId = features[0]?.properties?.cluster_id;
        const source = map.getSource(PINS_SOURCE_ID) as
          | maplibregl.GeoJSONSource
          | undefined;
        if (clusterId == null || !source) return;
        source
          .getClusterExpansionZoom(clusterId)
          .then((zoom: number) => {
            map.easeTo({
              center: (features[0].geometry as GeoJSON.Point).coordinates as [
                number,
                number,
              ],
              zoom,
            });
          })
          .catch(() => {
            /* cluster may have been re-tiled */
          });
      });

      map.on("click", "pin-point", (e) => {
        const id = e.features?.[0]?.properties?.id as string | undefined;
        if (id) router.push(`/pin/${id}`);
      });

      for (const layer of ["clusters", "pin-point"]) {
        map.on("mouseenter", layer, () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", layer, () => {
          map.getCanvas().style.cursor = "";
        });
      }
    });

    // Long-press detection (mouse + touch).
    let pressTimer: ReturnType<typeof setTimeout> | null = null;
    let pressStart: { x: number; y: number; lng: number; lat: number } | null = null;
    let pressedOverFeature = false;

    function cancelPress() {
      if (pressTimer) clearTimeout(pressTimer);
      pressTimer = null;
      pressStart = null;
      pressedOverFeature = false;
    }

    map.on("mousedown", (e) => {
      const features = map.queryRenderedFeatures(e.point, {
        layers: ["pin-point", "clusters"],
      });
      pressedOverFeature = features.length > 0;
      if (pressedOverFeature) return;

      pressStart = {
        x: e.point.x,
        y: e.point.y,
        lng: e.lngLat.lng,
        lat: e.lngLat.lat,
      };
      pressTimer = setTimeout(() => {
        if (pressStart && onLongPressRef.current) {
          onLongPressRef.current(pressStart.lng, pressStart.lat);
        }
        cancelPress();
      }, LONG_PRESS_MS);
    });

    map.on("mousemove", (e) => {
      if (!pressStart || pressedOverFeature) return;
      const dx = e.point.x - pressStart.x;
      const dy = e.point.y - pressStart.y;
      if (Math.hypot(dx, dy) > LONG_PRESS_MOVE_TOLERANCE_PX) cancelPress();
    });

    map.on("mouseup", cancelPress);
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

  // Update pin data whenever the `pins` prop changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const source = map.getSource(PINS_SOURCE_ID) as
      | maplibregl.GeoJSONSource
      | undefined;
    if (source) {
      source.setData(pinsToFeatureCollection(pins));
    } else {
      map.once("load", () => {
        const s = map.getSource(PINS_SOURCE_ID) as
          | maplibregl.GeoJSONSource
          | undefined;
        s?.setData(pinsToFeatureCollection(pins));
      });
    }
  }, [pins]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full"
      aria-label="Map of Vienna"
      role="application"
    />
  );
}
