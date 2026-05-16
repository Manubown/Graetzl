-- =====================================================================
-- Grätzl — special pins ("Geheimtipp" markers)
--
-- Adds a boolean `is_special` flag to public.pins for editorial
-- promotion of standout user contributions. Only admins (via the
-- service-role-backed setPinSpecial server action) can flip it; regular
-- users cannot — there is no RLS UPDATE policy allowing self-marking
-- and the existing `pins_update_self` policy is left untouched, which
-- still permits authors to edit title/body/category/etc but NOT this
-- column (Postgres column-level grants would harden it further if we
-- ever exposed direct table access).
--
-- The flag rides in the same `pins_with_coords` view that fuels
-- `pins_in_bbox`, so the map and detail page both see the new field
-- without any RPC signature change.
--
-- Visual contract (frontend):
--   • is_special pins paint with Wiener Rot center + Donau Türkis ring
--     and a soft halo, slightly larger radius
--   • is_special wins over is_curated for fill color — the "this is a
--     standout" signal takes priority over "this is editorial seed"
-- =====================================================================

set search_path = public, extensions, pg_temp;

alter table public.pins
  add column if not exists is_special boolean not null default false;

comment on column public.pins.is_special is
  'Admin-marked "Geheimtipp" flag. Flipped by the setPinSpecial server action (lib/admin/actions.ts) using the service-role client. Users cannot self-mark — no RLS UPDATE policy permits writes to this column.';

-- Re-create the view so it exposes is_special. PostgREST refreshes the
-- function-return shape automatically when the underlying view changes;
-- if a stale cache is observed, `notify pgrst, 'reload schema'` settles it.
--
-- CREATE OR REPLACE VIEW can only APPEND new columns — Postgres rejects
-- any positional shuffle as a column rename (SQLSTATE 42P16). The
-- columns up to `district_id` mirror the previous view exactly; new
-- columns introduced by this migration go at the end.
create or replace view public.pins_with_coords
with (security_invoker = true)
as
select
  p.id,
  p.author_id,
  pr.handle as author_handle,
  p.title,
  p.body,
  p.category,
  p.language,
  p.precision,
  p.city,
  p.photo_url,
  p.is_hidden,
  p.created_at,
  st_x(p.location::geometry) as lng,
  st_y(p.location::geometry) as lat,
  p.district_id,
  p.is_special
from public.pins p
left join public.profiles pr on pr.id = p.author_id;

comment on view public.pins_with_coords is
  'Pins flattened with numeric lng/lat + author handle + district_id + is_special. RLS inherited from public.pins via security_invoker.';
