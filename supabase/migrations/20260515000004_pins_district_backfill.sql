-- =====================================================================
-- Grätzl — pins.district_id backfill (Phase 1.5, Slice B, B-4)
--
-- Run once after B-3 seed and before B-5 triggers ship.
--
-- Context:
--   Migration B-2 added pins.district_id as a nullable column.
--   Migration B-3 seeded all 23 Bezirke with their boundary polygons.
--   This migration sets district_id on every existing pin by spatially
--   matching the pin's location against the district boundaries using
--   ST_Contains.
--
-- Trigger interaction:
--   The UPDATE goes through *without* firing pin_count_cached triggers
--   because the B-5 trigger does not exist yet at this point in the
--   migration sequence. When B-5 ships, it ends with a call to
--   refresh_district_pin_counts() which reconciles the cached counts
--   from scratch, so there is no double-counting risk.
--
-- Performance:
--   Statement timeout is 60s. With <200 rows and a GIST index on
--   districts.boundary, the spatial join is a microsecond operation in
--   practice. The timeout is a safety net for unexpected table scans on
--   a loaded database.
--
-- Coverage expectation:
--   All pins within Vienna's 23 Bezirke will be matched. Pins outside
--   any seeded boundary (e.g. imported test data, precision-snapped
--   pins that crossed a border) retain district_id = null and are
--   treated as "unknown district" — this is the correct sentinel value
--   per B-2's column definition.
-- =====================================================================

set search_path = public, extensions, pg_temp;
set statement_timeout = '60s';

update public.pins
set district_id = (
  select id
  from public.districts
  where extensions.ST_Contains(
    boundary::geometry,
    location::geometry
  )
  limit 1
)
where district_id is null;

-- ── Verification ──────────────────────────────────────────────────────
-- Emit a NOTICE per district with pin counts so the migration apply log
-- shows coverage. This block does NOT raise an exception on mismatch —
-- it is informational only. Unexpected zeros may indicate that a pin's
-- location is outside all boundaries (precision-approximate snap,
-- imported edge-case, or data error in the boundary polygon).
-- =====================================================================
do $$
declare
  r record;
begin
  for r in
    select
      d.id,
      d.name,
      count(p.id) as pin_count
    from public.districts d
    left join public.pins p on p.district_id = d.id
    group by d.id, d.name
    order by d.id
  loop
    raise notice 'district % (%) : % pins', r.id, r.name, r.pin_count;
  end loop;
end $$;
