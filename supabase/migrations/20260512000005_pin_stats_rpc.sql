-- =====================================================================
-- Grätzl — pin_with_stats RPC
-- Week 3, session 4
--
-- Returns a pin (from pins_with_coords) with aggregated upvote/save
-- counts AND the current user's interaction state (has_upvoted /
-- has_saved). Used by the pin detail page and modal.
--
-- security_invoker so RLS on the underlying tables is enforced.
-- =====================================================================

create or replace function public.pin_with_stats(p_pin_id uuid)
returns table (
  id              uuid,
  author_id       uuid,
  author_handle   citext,
  title           text,
  body            text,
  category        text,
  language        text,
  precision       text,
  city            text,
  photo_url       text,
  is_hidden       boolean,
  created_at      timestamptz,
  lng             double precision,
  lat             double precision,
  upvote_count    bigint,
  save_count      bigint,
  has_upvoted     boolean,
  has_saved       boolean
)
language sql
stable
security invoker
as $$
  select
    pwc.id,
    pwc.author_id,
    pwc.author_handle,
    pwc.title,
    pwc.body,
    pwc.category,
    pwc.language,
    pwc.precision,
    pwc.city,
    pwc.photo_url,
    pwc.is_hidden,
    pwc.created_at,
    pwc.lng,
    pwc.lat,
    (select count(*) from public.upvotes u where u.pin_id = pwc.id) as upvote_count,
    -- save_count is private to each user under RLS, but the COUNT
    -- aggregate runs as the caller — so a non-owner just sees their
    -- own saves' count (which is what we want: have I saved it?).
    -- For a public-style "X people saved this" we'd need a separate
    -- aggregate column, but saves are intentionally not displayed.
    0::bigint as save_count,
    exists (
      select 1 from public.upvotes u
      where u.pin_id = pwc.id and u.user_id = auth.uid()
    ) as has_upvoted,
    exists (
      select 1 from public.saves s
      where s.pin_id = pwc.id and s.user_id = auth.uid()
    ) as has_saved
  from public.pins_with_coords pwc
  where pwc.id = p_pin_id;
$$;

comment on function public.pin_with_stats is
  'Pin with aggregated upvote_count + per-user has_upvoted / has_saved flags. RLS-enforced.';
