import type maplibregl from "maplibre-gl";
import type { Pin } from "@/lib/pins/types";

/**
 * Pins layer module — owns the GeoJSON source for pins, the cluster
 * + cluster-count + pin-point layers, and the click + cursor handlers
 * scoped to those layers. Extracted from vienna-map.tsx in S0-3 with
 * no behaviour change.
 *
 * Layer ordering note: the districts layer (added later in B-10) will
 * be inserted *below* `clusters` via `map.addLayer(spec, "clusters")`,
 * so pins always paint on top of the polygon fill/line.
 */

export const PINS_SOURCE_ID = "graetzl-pins";

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
      properties: { id: p.id, title: p.title, category: p.category },
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

  if (!map.getLayer("pin-point")) {
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
