-- =====================================================================
-- Grätzl — districts table (Phase 1.5, Slice B, S0-4)
--
-- Holds Vienna's 23 Bezirke. Two-tier GeoJSON pipeline (ADR-04):
--   • boundary  — full-fidelity polygon, used by ST_Contains in createPin
--   • simplified rendering polygons live in public/data/bezirke.geojson
--
-- This migration lands the SHAPE only and seeds a single stub row for
-- Bezirk 1 (Innere Stadt) so the walking skeleton can render one polygon.
-- All 23 districts arrive in 20260515000003_districts_seed.sql (B-3),
-- which UPSERTs and overwrites this stub with full data.
--
-- pin_count_cached starts at 0; the trigger that keeps it fresh lands
-- in 20260515000005_pin_count_triggers.sql (B-5).
-- =====================================================================

create table if not exists public.districts (
  id                smallint primary key check (id between 1 and 23),
  name              text not null,
  slug              text not null unique,
  boundary          extensions.geography(Polygon, 4326) not null,
  centroid          extensions.geography(Point, 4326) not null,
  bbox              extensions.geography(Polygon, 4326) not null,
  pin_count_cached  integer not null default 0 check (pin_count_cached >= 0),
  created_at        timestamptz not null default now()
);

comment on table public.districts is
  'Vienna Bezirke (1..23). boundary = full-fidelity polygon for ST_Contains. Rendering uses a separate simplified GeoJSON.';
comment on column public.districts.pin_count_cached is
  'Denormalised count of non-hidden pins inside this district. Maintained by trigger on public.pins (added in 20260515000005). Use refresh_district_pin_counts() to rebuild.';

create index if not exists districts_boundary_gix on public.districts using gist (boundary);
create index if not exists districts_bbox_gix     on public.districts using gist (bbox);

-- Ensure ST_GeogFromText resolves below without a schema prefix.
set search_path = public, extensions, pg_temp;

-- RLS: public can read, only service_role (migrations) can write.
alter table public.districts enable row level security;

drop policy if exists "districts_select_public" on public.districts;
create policy "districts_select_public"
  on public.districts for select
  using (true);

-- =====================================================================
-- Walking-skeleton stub: a 4-vertex hand-typed approximation of
-- Bezirk 1 (Innere Stadt) so the map can render one polygon before B-3
-- ships the full 23-Bezirk seed. The boundary is intentionally coarse
-- (a quadrilateral around the Ringstraße area) — it is NOT accurate
-- enough for ST_Contains in production, only for visual smoke-testing.
-- B-3 will overwrite this row via UPSERT on id.
-- =====================================================================
insert into public.districts (id, name, slug, boundary, centroid, bbox, pin_count_cached)
values (
  1,
  'Innere Stadt',
  'innere-stadt',
  ST_GeogFromText('SRID=4326;POLYGON((16.3590 48.2010, 16.3820 48.2010, 16.3820 48.2170, 16.3590 48.2170, 16.3590 48.2010))'),
  ST_GeogFromText('SRID=4326;POINT(16.3705 48.2090)'),
  ST_GeogFromText('SRID=4326;POLYGON((16.3590 48.2010, 16.3820 48.2010, 16.3820 48.2170, 16.3590 48.2170, 16.3590 48.2010))'),
  0
)
on conflict (id) do nothing;
