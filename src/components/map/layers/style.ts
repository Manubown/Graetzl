import type maplibregl from "maplibre-gl";
import { layers, namedFlavor } from "@protomaps/basemaps";

/**
 * Map style + camera constants. Extracted from vienna-map.tsx in S0-3
 * so layer modules and the orchestrator share one source of truth.
 *
 * As of the Protomaps swap, the base style is built from a Vienna-only
 * PMTiles file served from /data/vienna.pmtiles (the runbook at
 * docs/runbooks/protomaps-pipeline.md explains how to regenerate it).
 * The Protomaps protocol handler is registered in vienna-map.tsx at
 * module load.
 *
 * Bezirksgrenzen attribution is attached to the districts source spec
 * (see districts-layer.ts); the Protomaps source carries the OSM +
 * Protomaps credits below. MapLibre's attribution control merges them
 * automatically.
 */

export const VIENNA_CENTER: [number, number] = [16.3738, 48.2082];
export const DEFAULT_ZOOM = 12;
export const MIN_ZOOM = 10;
export const MAX_ZOOM = 19;

export const MAX_BOUNDS: maplibregl.LngLatBoundsLike = [
  [16.18, 48.10],
  [16.58, 48.33],
];

/**
 * Public URL of the Vienna-only PMTiles file. Hosted as a static asset
 * under `public/` so Vercel serves it from the same origin (no third-
 * party request, GDPR-clean). See docs/runbooks/protomaps-pipeline.md
 * for how to (re)generate it from the daily planet build.
 */
export const VIENNA_PMTILES_URL = "/data/vienna.pmtiles";

/**
 * Glyphs (PBF fonts) and sprite (icon atlas) URLs are currently
 * served from protomaps.github.io. These are tiny, infrequent GETs;
 * the runbook documents how to self-host the basemaps-assets repo
 * under `public/` for the strictest possible posture.
 */
const GLYPHS_URL =
  "https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf";
const SPRITE_BASE = "https://protomaps.github.io/basemaps-assets/sprites/v4";

export type ProtomapsFlavor = "light" | "dark";

/**
 * Build a MapLibre StyleSpecification using Protomaps vector tiles.
 *
 * Two flavours mirror the app's theme:
 *   • light — pale cream / grey, soft blues for water
 *   • dark  — near-black canvas with subtle terrain
 *
 * Labels render in German (`lang: "de"`) where translations exist —
 * Protomaps' label schema falls back to the local name when not.
 */
export function getProtomapsStyle(
  flavor: ProtomapsFlavor,
): maplibregl.StyleSpecification {
  return {
    version: 8,
    glyphs: GLYPHS_URL,
    sprite: `${SPRITE_BASE}/${flavor}`,
    sources: {
      protomaps: {
        type: "vector",
        url: `pmtiles://${VIENNA_PMTILES_URL}`,
        attribution:
          '<a href="https://protomaps.com" target="_blank" rel="noopener noreferrer">Protomaps</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>',
      },
    },
    layers: layers("protomaps", namedFlavor(flavor), { lang: "de" }),
  };
}
