-- =====================================================================
-- Grätzl — pins_in_bbox_filtered RPC + view extension (Slice B, B-6)
--
-- Adds a Bezirk-aware bbox query that lives ALONGSIDE pins_in_bbox
-- per ADR-05. The legacy RPC stays for zero-touch back-compat;
-- pins_in_bbox_filtered is the new path that the map uses going forward.
--
-- Two changes in this file:
--
--   1. Extend the `pins_with_coords` view to expose district_id, so
--      clients filtering or styling by Bezirk can do so without a
--      second round-trip. Uses CREATE OR REPLACE to preserve grants
--      and dependent functions (pins_in_bbox keeps working).
--
--   2. Create `pins_in_bbox_filtered(min_lng, min_lat, max_lng,
--      max_lat, p_bezirk smallint default null, max_rows int default
--      500)`. Same shape as pins_in_bbox plus the optional p_bezirk
--      filter. Semantics: AND with the bbox — caller's viewport
--      constrains spatially, p_bezirk constrains by district. The
--      map's "fit bounds to district on click" behaviour (B-11) lives
--      client-side; this RPC doesn't second-guess the caller's bbox.
--
-- Both run with security_invoker so RLS on public.pins continues to
-- apply (non-hidden pins only, etc.).
-- =====================================================================

set search_path = public, extensions, pg_temp;

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
  p.district_id
from public.pins p
left join public.profiles pr on pr.id = p.author_id;

comment on view public.pins_with_coords is
  'Pins flattened with numeric lng/lat + author handle + district_id. RLS inherited from public.pins via security_invoker.';

create or replace function public.pins_in_bbox_filtered(
  min_lng double precision,
  min_lat double precision,
  max_lng double precision,
  max_lat double precision,
  p_bezirk smallint default null,
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
    and (p_bezirk is null or district_id = p_bezirk)
  order by created_at desc
  limit greatest(1, least(max_rows, 2000));
$$;

comment on function public.pins_in_bbox_filtered is
  'Bezirk-aware variant of pins_in_bbox. When p_bezirk is null, behaves identically to pins_in_bbox. When p_bezirk is set, additionally filters district_id = p_bezirk. Deprecation path for pins_in_bbox tracked in ADR-05.';
