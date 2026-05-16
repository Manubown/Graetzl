import type maplibregl from "maplibre-gl";
import type { Pin } from "@/lib/pins/types";
import { isCuratedPin } from "@/lib/pins/system";

/**
 * Pins layer module — owns the GeoJSON source for pins, the cluster
 * + cluster-count + pin-point layers, and the click + cursor handlers
 * scoped to those layers. Extracted from vienna-map.tsx in S0-3 with
 * no behaviour change.
 *
 * Layer ordering note: the districts layer (added later in B-10) will
 * be inserted *below* `clusters` via `map.addLayer(spec, "clusters")`,
 * so pins always paint on top of the polygon fill/line.
 *
 * Visual hierarchy for curated vs. user pins:
 *   • User pins  — Wiener Rot fill, full opacity, radius 8
 *   • Curated    — muted-grey fill, slightly translucent, same radius
 * Cluster colour stays red regardless of contents — a cluster represents
 * pins of any source and falling back to gray when a few curated pins
 * happen to aggregate would mute the wrong signal.
 */

export const PINS_SOURCE_ID = "graetzl-pins";

const USER_PIN_COLOR = "#b3322c";
const CURATED_PIN_COLOR = "#7a7a7e";
// Donau Türkis — matches --accent in light mode. Hardcoded here because
// MapLibre paint expressions don't accept CSS vars, and re-resolving on
// theme switch would require dropping/re-adding the layer; the slight
// shade difference vs dark-mode --accent (#3aa3a3) is acceptable.
const SPECIAL_RING_COLOR = "#2e8a8a";

export interface AttachPinsLayerOpts {
  /**
   * Called when the user clicks a single pin (not a cluster). The id is
   * the pin's primary key from `pins.id`.
   */
  onPinClick?: (pinId: string) => void;
}

function pinsToFeatureCollection(
  pins: Pin[],
): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: pins.map((p) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [p.lng, p.lat] },
      properties: {
        id: p.id,
        title: p.title,
        category: p.category,
        is_curated: isCuratedPin(p.author_id),
        is_special: p.is_special,
      },
    })),
  };
}

// Handlers are registered once per map instance. setStyle() (theme switch)
// drops layers but keeps the map; on re-attach we re-add layers but must
// NOT re-register click/hover handlers — MapLibre layer-scoped handlers
// survive layer removal+re-add and would stack on a second registration.
const PINS_HANDLERS_ATTACHED = new WeakSet<maplibregl.Map>();

/**
 * Adds the pins source, cluster + pin-point layers, and the related
 * click/cursor handlers to the map. Idempotent at the source, layer,
 * and handler level — safe to call after setStyle() which drops layers
 * but preserves the source.
 */
export function attachPinsLayer(
  map: maplibregl.Map,
  opts: AttachPinsLayerOpts = {},
): void {
  if (!map.getSource(PINS_SOURCE_ID)) {
    map.addSource(PINS_SOURCE_ID, {
      type: "geojson",
      data: pinsToFeatureCollection([]),
      cluster: true,
      clusterRadius: 50,
      clusterMaxZoom: 14,
    });
  }

  if (!map.getLayer("clusters")) {
    map.addLayer({
      id: "clusters",
      type: "circle",
      source: PINS_SOURCE_ID,
      filter: ["has", "point_count"],
      paint: {
        "circle-color": [
          "step",
          ["get", "point_count"],
          "#d04640",
          10, "#b3322c",
          50, "#7a1f1c",
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
  }

  // Special-pin halo — soft türkis glow behind special pins. Sits below
  // pin-point so the marker paints on top. Filtered to is_special only
  // so non-special pins don't carry the cost.
  if (!map.getLayer("pin-special-halo")) {
    map.addLayer({
      id: "pin-special-halo",
      type: "circle",
      source: PINS_SOURCE_ID,
      filter: [
        "all",
        ["!", ["has", "point_count"]],
        ["==", ["get", "is_special"], true],
      ],
      paint: {
        "circle-color": SPECIAL_RING_COLOR,
        "circle-radius": 18,
        "circle-opacity": 0.35,
        "circle-blur": 0.6,
        "circle-stroke-width": 0,
      },
    });
  }

  if (!map.getLayer("pin-point")) {
    map.addLayer({
      id: "pin-point",
      type: "circle",
      source: PINS_SOURCE_ID,
      filter: ["!", ["has", "point_count"]],
      paint: {
        // Special wins over curated: a special pin always paints Wiener
        // Rot so the editorial endorsement reads even on a curated row.
        "circle-color": [
          "case",
          ["==", ["get", "is_special"], true], USER_PIN_COLOR,
          ["==", ["get", "is_curated"], true], CURATED_PIN_COLOR,
          USER_PIN_COLOR,
        ],
        "circle-opacity": [
          "case",
          ["==", ["get", "is_special"], true], 1,
          ["==", ["get", "is_curated"], true], 0.85,
          1,
        ],
        "circle-radius": [
          "case",
          ["==", ["get", "is_special"], true], 10,
          8,
        ],
        "circle-stroke-color": [
          "case",
          ["==", ["get", "is_special"], true], SPECIAL_RING_COLOR,
          "#ffffff",
        ],
        "circle-stroke-width": [
          "case",
          ["==", ["get", "is_special"], true], 3,
          2,
        ],
      },
    });
  }

  if (PINS_HANDLERS_ATTACHED.has(map)) return;
  PINS_HANDLERS_ATTACHED.add(map);

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
    if (id) opts.onPinClick?.(id);
  });

  for (const layer of ["clusters", "pin-point"]) {
    map.on("mouseenter", layer, () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", layer, () => {
      map.getCanvas().style.cursor = "";
    });
  }
}

/**
 * Replaces the pins source data with a fresh feature collection.
 * No-op if the source has not been attached yet.
 */
export function setPins(map: maplibregl.Map, pins: Pin[]): void {
  const source = map.getSource(PINS_SOURCE_ID) as
    | maplibregl.GeoJSONSource
    | undefined;
  if (source) source.setData(pinsToFeatureCollection(pins));
}
