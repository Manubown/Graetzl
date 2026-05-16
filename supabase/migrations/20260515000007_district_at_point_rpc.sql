-- =====================================================================
-- Grätzl — district_at_point RPC (Phase 1.5, Slice B, B-7)
--
-- A thin SQL function that resolves which Vienna Bezirk contains a
-- given longitude/latitude pair. Used by the createPin server action
-- to populate pins.district_id at write time (the PostgREST client
-- cannot express ST_Contains as a filter, so the logic lives here in
-- a dedicated RPC).
--
-- Signature:
--   public.district_at_point(p_lng double precision, p_lat double precision)
--   returns smallint
--
-- Returns the district id (1..23) or NULL if the point falls outside
-- all seeded boundaries. NULL is the correct "unknown district" value
-- per B-2's column definition (e.g. approximate-precision snap that
-- crossed a boundary, or a future pin imported from outside Vienna).
--
-- Security: security invoker — inherits the caller's RLS context.
-- Since public.districts has a read-for-all policy, any authenticated
-- or anonymous caller can resolve a district. No write access is
-- granted by this function.
--
-- Stability: marked STABLE because it reads from districts which is
-- effectively immutable after the B-3 seed (no triggers mutate it
-- between migrations). STABLE allows the planner to cache results
-- within a single query if called multiple times.
-- =====================================================================

set search_path = public, extensions, pg_temp;

create or replace function public.district_at_point(
  p_lng double precision,
  p_lat double precision
)
returns smallint
language sql
stable
security invoker
as $$
  select id
  from public.districts
  where extensions.ST_Contains(
    boundary::geometry,
    extensions.ST_SetSRID(
      extensions.ST_MakePoint(p_lng, p_lat),
      4326
    )
  )
  limit 1;
$$;

comment on function public.district_at_point(double precision, double precision) is
  'Returns the Vienna Bezirk id (1..23) that contains the given WGS-84 point, or NULL if outside all seeded boundaries. Used by the createPin server action (B-7). Reads from the full-fidelity boundary polygons (ADR-04).';
