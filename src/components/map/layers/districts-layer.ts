import type maplibregl from "maplibre-gl";

/**
 * Districts layer module — full implementation (B-10).
 *
 * Loads `/data/bezirke.geojson` (simplified, ≤80 KB gzipped) as a MapLibre
 * GeoJSON source and adds three layers:
 *
 *   districts-fill          — subtle fill (4 % opacity)
 *   districts-fill-selected — highlight fill for the active district (12 %)
 *   districts-line          — zoom-stepped stroke
 *
 * All three are inserted *below* the `clusters` layer so pin clusters and
 * individual pin markers always paint on top of the polygons.
 *
 * Layer-ordering note: `map.addLayer(spec, 'clusters')` inserts the spec
 * *before* the `clusters` layer in the rendering stack, i.e. below it
 * visually — which is exactly what we want.
 *
 * Attribution for the Bezirksgrenzen dataset is passed in the source spec;
 * MapLibre's attribution control auto-appends it alongside the OSM credit.
 *
 * No third-party dependencies are used: bbox computation is pure JS, colour
 * resolution reads a CSS custom property at runtime.
 */

// ─── Public types ──────────────────────────────────────────────────────────

export interface AttachDistrictsLayerOpts {
  /** URL to the simplified GeoJSON for client rendering. Defaults to '/data/bezirke.geojson'. */
  geojsonUrl?: string;
  onDistrictClick?: (
    districtId: number,
    bbox: [number, number, number, number],
  ) => void;
  /**
   * Called once after the districts source has loaded and the polygons are
   * painted. Receives the elapsed time in milliseconds measured from just
   * before addSource() to the first 'sourcedata' event with isSourceLoaded.
   */
  onPaintComplete?: (durationMs: number) => void;
}

// ─── Internal GeoJSON property shape ──────────────────────────────────────

interface DistrictFeatureProps {
  BEZNR: number; // 1..23, the Bezirk number
  NAMEK: string; // e.g. "Innere Stadt"
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * Resolve the --accent CSS custom property from the document root at
 * call-time. MapLibre cannot consume CSS variables directly in paint
 * expressions — it needs a resolved hex/rgb string. We compute once per
 * attachDistrictsLayer() call; the value is stable for the lifetime of
 * the map instance.
 */
function resolveAccentColour(): string {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue("--accent")
    .trim();
  // Fall back to a neutral blue-ish hue if the token is missing (e.g. in
  // a test environment that has no CSS loaded).
  return value || "#3b82f6";
}

/**
 * Walk the outer ring of a GeoJSON Polygon geometry and return
 * [minLng, minLat, maxLng, maxLat]. Pure JS, no turf import.
 */
function bboxFromPolygonGeometry(
  geometry: GeoJSON.Polygon,
): [number, number, number, number] {
  const ring = geometry.coordinates[0];
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  for (const coord of ring) {
    const lng = coord[0];
    const lat = coord[1];
    if (lng < minLng) minLng = lng;
    if (lat < minLat) minLat = lat;
    if (lng > maxLng) maxLng = lng;
    if (lat > maxLat) maxLat = lat;
  }
  return [minLng, minLat, maxLng, maxLat];
}

// ─── Public API ────────────────────────────────────────────────────────────

// See pins-layer.ts for the rationale — setStyle() drops layers but
// keeps the map; handlers must be registered exactly once per map.
const DISTRICTS_HANDLERS_ATTACHED = new WeakSet<maplibregl.Map>();

/**
 * Attach the districts GeoJSON source and its three render layers to the map.
 *
 * Idempotent at the source, layer, and handler level. Safe to call after
 * setStyle() which drops layers but preserves the source. On re-call,
 * layers are re-created and the existing handlers (still keyed on the
 * layer IDs) take effect again automatically.
 *
 * Layer ordering is maintained by inserting all three layers via
 * `map.addLayer(spec, 'clusters')`.
 */
export function attachDistrictsLayer(
  map: maplibregl.Map,
  opts: AttachDistrictsLayerOpts = {},
): void {
  const isFirstAttach = !DISTRICTS_HANDLERS_ATTACHED.has(map);

  const geojsonUrl = opts.geojsonUrl ?? "/data/bezirke.geojson";
  const accent = resolveAccentColour();

  if (isFirstAttach) {
    performance.mark("districts-layer:start");
  }

  if (!map.getSource("districts")) {
    map.addSource("districts", {
      type: "geojson",
      data: geojsonUrl,
      attribution:
        'Bezirksgrenzen © <a href="https://data.wien.gv.at/" target="_blank" rel="noopener">Stadt Wien</a> – data.wien.gv.at',
    });
  }

  if (!map.getLayer("districts-fill")) {
    map.addLayer(
      {
        id: "districts-fill",
        type: "fill",
        source: "districts",
        paint: {
          "fill-color": accent,
          "fill-opacity": 0.04,
        },
      },
      "clusters",
    );
  }

  if (!map.getLayer("districts-fill-selected")) {
    map.addLayer(
      {
        id: "districts-fill-selected",
        type: "fill",
        source: "districts",
        filter: ["==", ["get", "BEZNR"], -1],
        paint: {
          "fill-color": accent,
          "fill-opacity": 0.12,
        },
      },
      "clusters",
    );
  }

  if (!map.getLayer("districts-line")) {
    map.addLayer(
      {
        id: "districts-line",
        type: "line",
        source: "districts",
        paint: {
          "line-color": accent,
          "line-opacity": 0.5,
          // Zoom-stepped line width per B-10 spec:
          //   z10–12 → 0.5 px   (city-overview zoom)
          //   z13–15 → 1 px     (neighbourhood zoom)
          //   z16+   → 1.5 px   (street-level zoom)
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            10,
            0.5,
            12,
            0.5,
            13,
            1,
            15,
            1,
            16,
            1.5,
          ],
        },
      },
      "clusters",
    );
  }

  if (!isFirstAttach) return;
  DISTRICTS_HANDLERS_ATTACHED.add(map);

  // ── Click handler ─────────────────────────────────────────────────────────
  // Polygons cover the whole map, so every pin click also hits a polygon.
  // Defer to pins-layer click when a pin or cluster is at the same point —
  // otherwise the pin's `router.push(/pin/id)` races with the district click
  // and the user can't open pin detail pages.
  map.on("click", "districts-fill", (e) => {
    const probeLayers = ["pin-point", "clusters"].filter((id) =>
      map.getLayer(id),
    );
    const pinHits =
      probeLayers.length > 0
        ? map.queryRenderedFeatures(e.point, { layers: probeLayers })
        : [];
    if (pinHits.length > 0) return;

    const feature = e.features?.[0];
    if (!feature) return;

    const props = feature.properties as DistrictFeatureProps;
    const beznr = props.BEZNR;

    let bbox: [number, number, number, number] = [0, 0, 0, 0];
    if (feature.geometry.type === "Polygon") {
      bbox = bboxFromPolygonGeometry(feature.geometry as GeoJSON.Polygon);
    }

    opts.onDistrictClick?.(beznr, bbox);
  });

  // ── Cursor affordance (desktop) ─────────────────────────────────────────
  map.on("mouseenter", "districts-fill", () => {
    map.getCanvas().style.cursor = "pointer";
  });
  map.on("mouseleave", "districts-fill", () => {
    map.getCanvas().style.cursor = "";
  });

  // ── Paint-complete measurement ────────────────────────────────────────────
  const onSourceData = (e: maplibregl.MapSourceDataEvent) => {
    if (e.sourceId !== "districts" || !e.isSourceLoaded) return;

    performance.mark("districts-layer:end");
    performance.measure(
      "districts-layer",
      "districts-layer:start",
      "districts-layer:end",
    );

    const entries = performance.getEntriesByName("districts-layer");
    const durationMs = entries[entries.length - 1]?.duration ?? 0;

    opts.onPaintComplete?.(durationMs);

    map.off("sourcedata", onSourceData);
  };

  map.on("sourcedata", onSourceData);
}

/**
 * Highlight the given district by swapping the filter on the
 * `districts-fill-selected` layer.
 *
 * Pass `null` (or any value < 1) to clear the selection — the filter
 * reverts to BEZNR === -1 which matches nothing.
 *
 * No-op if the layer has not been attached yet.
 */
export function setSelectedDistrict(
  map: maplibregl.Map,
  districtId: number | null,
): void {
  if (!map.getLayer("districts-fill-selected")) return;

  const id = districtId ?? -1;
  map.setFilter("districts-fill-selected", ["==", ["get", "BEZNR"], id]);
}
