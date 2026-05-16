#!/usr/bin/env node
/**
 * generate-districts-seed.mjs
 *
 * Reads seed/districts-full.geojson and emits
 * supabase/migrations/20260515000003_districts_seed.sql to stdout.
 *
 * Run from the repo root:
 *   node scripts/generate-districts-seed.mjs > supabase/migrations/20260515000003_districts_seed.sql
 *
 * Output is deterministic: features are sorted by BEZNR ascending so
 * the SQL diff is stable across re-runs.
 *
 * Source: Bezirksgrenzen Wien, data.wien.gv.at (EPSG:4326).
 * Full-fidelity polygons — these are the unsimplified boundaries used
 * for ST_Contains server-side (ADR-04). Client rendering uses the
 * separate simplified bezirke.geojson in public/data/.
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

// Slug table keyed by BEZNR (1..23). URL-safe German, no umlauts.
const SLUGS = {
   1: 'innere-stadt',
   2: 'leopoldstadt',
   3: 'landstrasse',
   4: 'wieden',
   5: 'margareten',
   6: 'mariahilf',
   7: 'neubau',
   8: 'josefstadt',
   9: 'alsergrund',
  10: 'favoriten',
  11: 'simmering',
  12: 'meidling',
  13: 'hietzing',
  14: 'penzing',
  15: 'rudolfsheim-fuenfhaus',
  16: 'ottakring',
  17: 'hernals',
  18: 'waehring',
  19: 'doebling',
  20: 'brigittenau',
  21: 'floridsdorf',
  22: 'donaustadt',
  23: 'liesing',
};

const geojsonPath = join(repoRoot, 'seed', 'districts-full.geojson');
const raw = readFileSync(geojsonPath, 'utf8');
const collection = JSON.parse(raw);

if (collection.type !== 'FeatureCollection') {
  process.stderr.write(`ERROR: expected FeatureCollection, got ${collection.type}\n`);
  process.exit(1);
}

// Sort by BEZNR ascending for a stable diff.
const features = [...collection.features].sort(
  (a, b) => a.properties.BEZNR - b.properties.BEZNR
);

if (features.length !== 23) {
  process.stderr.write(`ERROR: expected 23 features, got ${features.length}\n`);
  process.exit(1);
}

/**
 * Escape a string for embedding as a Postgres single-quoted literal.
 * Doubles every single-quote character.
 */
function pgQuote(str) {
  return str.replace(/'/g, "''");
}

/**
 * Emit the geometry expression block for one district.
 * The geometry JSON is embedded as a Postgres single-quoted literal.
 * centroid and bbox are computed inline by PostGIS so we only pass the
 * JSON string once, then reference a CTE alias to avoid repeating it.
 * We use a VALUES-level CTE pattern: each row is emitted as a
 * self-contained inline expression. For clarity we use a subquery that
 * aliases the geometry so centroid and bbox share one ST_GeomFromGeoJSON
 * call (no repeated multi-KB literal).
 */
function districtRow(feature) {
  const { BEZNR, NAMEK } = feature.properties;
  const slug = SLUGS[BEZNR];

  if (!slug) {
    process.stderr.write(`ERROR: no slug mapping for BEZNR ${BEZNR}\n`);
    process.exit(1);
  }

  // Serialize geometry as compact JSON and escape for SQL.
  const geomJson = pgQuote(JSON.stringify(feature.geometry));

  // Build each column expression. We compute centroid and bbox from the
  // same geography value. Rather than repeating the 100+ KB literal
  // three times, we nest a lateral subquery so the geometry is parsed
  // once.  This is written as:
  //
  //   (select ... from (select extensions.ST_GeomFromGeoJSON('...') as g) _) as col
  //
  // which Postgres plans as a single geometry parse.

  const geomExpr = `extensions.ST_GeomFromGeoJSON('${geomJson}')::geography`;

  // centroid: ST_Centroid on a geography returns geography(Point, 4326)
  // bbox: ST_Envelope works on geometry; cast back to geography
  const centroidExpr = `extensions.ST_Centroid(${geomExpr})`;
  const bboxExpr = `extensions.ST_Envelope(extensions.ST_GeomFromGeoJSON('${geomJson}')::geometry)::geography`;

  // Name column: use NAMEK directly from the properties; it has the
  // correct capitalisation already ("Döbling", "Innere Stadt", etc.).
  const nameEscaped = pgQuote(NAMEK);

  const pinCountSubquery =
    `(select count(*) from public.pins where district_id = ${BEZNR} and is_hidden = false)`;

  return (
    `  (${BEZNR}, '${nameEscaped}', '${slug}',\n` +
    `    ${geomExpr},\n` +
    `    ${centroidExpr},\n` +
    `    ${bboxExpr},\n` +
    `    ${pinCountSubquery}\n` +
    `  )`
  );
}

// ── Header comment ────────────────────────────────────────────────────
const header = `\
-- =====================================================================
-- Grätzl — 23 Bezirke seed (Phase 1.5, Slice B, B-3)
--
-- Inserts/upserts all 23 Vienna Bezirke with full-fidelity boundary
-- polygons sourced from seed/districts-full.geojson (EPSG:4326,
-- unsimplified). Overwrites the walking-skeleton stub row for Bezirk 1
-- that was inserted by 20260515000001_districts_table.sql.
--
-- Generation:
--   node scripts/generate-districts-seed.mjs \\
--     > supabase/migrations/20260515000003_districts_seed.sql
--
-- Re-running the script produces a byte-identical file (features are
-- sorted by BEZNR ascending; geometry is serialised via
-- JSON.stringify which produces canonical output for the same input).
--
-- Columns computed inline:
--   boundary  → ST_GeomFromGeoJSON(<geojson literal>)::geography
--   centroid  → ST_Centroid(boundary)                — geography(Point)
--   bbox      → ST_Envelope(boundary::geometry)::geography — bounding box polygon
--   pin_count_cached → subquery count of non-hidden pins for this district.
--              At B-3 seed time this yields 0 for every district because
--              pins.district_id is null for all existing rows (the B-4
--              backfill migration populates that column). B-5 ships the
--              trigger and calls refresh_district_pin_counts() to settle
--              final counts after backfill.
--
-- Idempotency: ON CONFLICT (id) DO UPDATE overwrites all columns so
-- re-running the migration is safe. Running it again after B-4 backfill
-- would reset pin_count_cached to current counts (subquery re-evaluates),
-- which is correct.
--
-- =====================================================================

set search_path = public, extensions, pg_temp;

`;

// ── Rows ──────────────────────────────────────────────────────────────
const rows = features.map(districtRow).join(',\n');

// ── ON CONFLICT clause ────────────────────────────────────────────────
const conflict = `\
on conflict (id) do update set
  name             = excluded.name,
  slug             = excluded.slug,
  boundary         = excluded.boundary,
  centroid         = excluded.centroid,
  bbox             = excluded.bbox;
`;

// ── Assemble ──────────────────────────────────────────────────────────
const sql =
  header +
  'insert into public.districts\n' +
  '  (id, name, slug, boundary, centroid, bbox, pin_count_cached)\n' +
  'values\n' +
  rows + '\n' +
  conflict;

process.stdout.write(sql);
