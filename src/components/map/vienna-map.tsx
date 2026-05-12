"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";

/**
 * Vienna's geographic centre — Stephansdom, near enough.
 * Used as the default map view until we wire in geolocation.
 */
const VIENNA_CENTER: [number, number] = [16.3738, 48.2082];
const DEFAULT_ZOOM = 12;

/**
 * OpenStreetMap raster tiles — fine for MVP. Phase-2 plan calls for
 * migration to self-hosted Protomaps vector tiles if scale demands it.
 *
 * Attribution is mandatory under OSM's ODbL; MapLibre renders it via
 * the default attribution control which we explicitly enable.
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

export function ViennaMap() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: OSM_STYLE,
      center: VIENNA_CENTER,
      zoom: DEFAULT_ZOOM,
      minZoom: 10,
      maxZoom: 19,
      // Vienna sits roughly within these bounds — keeps panning sane for MVP.
      maxBounds: [
        [16.18, 48.10],
        [16.58, 48.33],
      ],
      attributionControl: { compact: true },
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(
      new maplibregl.GeolocateControl({
        positionOptions: { enableHighAccuracy: false },
        // GDPR: location is consulted client-side only to centre the map.
        // We never transmit the user's coordinates server-side.
        trackUserLocation: false,
        showUserHeading: false,
      }),
      "top-right",
    );

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="h-full w-full"
      aria-label="Map of Vienna"
      role="application"
    />
  );
}
