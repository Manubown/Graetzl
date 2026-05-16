-- =====================================================================
-- Grätzl — pins.district_id FK (Phase 1.5, Slice B, B-2)
--
-- Adds a nullable `district_id smallint references districts(id)` to
-- public.pins. Server-side district association is wired in B-7 (the
-- createPin server action computes district_id via ST_Contains at write
-- time) and B-4 (backfill of existing rows).
--
-- No index is added at this stage — current row count is well under 200
-- and the only query path that filters on district_id (the
-- `pins_in_bbox_filtered` RPC in B-6) is already bbox-bounded by the
-- existing GIST index on `pins.location`. Add a B-tree on district_id
-- only if dashboards eventually show it as a hot filter.
--
-- Nullable because:
--   1. Backfill in B-4 runs after this migration; pins exist briefly
--      without a district_id between B-2 and B-4 shipping.
--   2. Future imports / edge cases (e.g. pin location update that lands
--      outside any seeded boundary) should not error; null is the
--      "unknown district" state.
-- =====================================================================

alter table public.pins
  add column if not exists district_id smallint
    references public.districts (id) on delete set null;

comment on column public.pins.district_id is
  'Vienna Bezirk (1..23) computed at write time via ST_Contains, or NULL if outside any seeded boundary. Backfilled in 20260515000004. Maintained going forward by the createPin server action (B-7).';
