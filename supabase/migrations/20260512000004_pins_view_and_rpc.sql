-- =====================================================================
-- Grätzl — Convenience view + spatial RPC for pin fetching
-- Week 2, session 3
--
-- PostgREST cannot serialise `geography` directly. We expose a view
-- that adds plain numeric lng/lat columns; the client reads from it.
-- RLS from the underlying `pins` table is preserved via security_invoker.
--
-- We also ship a `pins_in_bbox` RPC for bounding-box fetches, which is
-- much cheaper than fetching all pins at zoom-out levels.
-- =====================================================================

drop view if exists public.pins_with_coords;
create view public.pins_with_coords
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
  st_y(p.location::geometry) as lat
from public.pins p
left join public.profiles pr on pr.id = p.author_id;

comment on view public.pins_with_coords is
  'Pins flattened with numeric lng/lat + author handle. RLS inherited from public.pins via security_invoker.';

-- Bounded-fetch RPC for map viewports.
create or replace function public.pins_in_bbox(
  min_lng double precision,
  min_lat double precision,
  max_lng double precision,
  max_lat double precision,
  max_rows integer default 500
)
returns setof public.pins_with_coords
language sql
stable
security invoker
as $$
  select *
  from public.pins_with_coords
  where lng between min_lng and max_lng
    and lat between min_lat and max_lat
    and is_hidden = false
  order by created_at desc
  limit greatest(1, least(max_rows, 2000));
$$;

comment on function public.pins_in_bbox is
  'Returns non-hidden pins within a lng/lat bounding box, newest first, capped to max_rows (default 500, max 2000).';
