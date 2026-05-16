-- =====================================================================
-- Grätzl — refresh pin_with_stats to expose is_special + district_id
--
-- Migration 009 added pins.is_special and updated pins_with_coords to
-- expose it, but pin_with_stats has a hardcoded RETURNS TABLE column
-- list that doesn't pick up new view columns automatically. The detail
-- page calls pin_with_stats (not the view) so without this migration
-- the new column is invisible to the UI even after a successful
-- backend write — the admin's "Geheimtipp" toggle would appear to do
-- nothing on reload because pin.is_special comes back undefined.
--
-- district_id was missed by the original RPC for the same reason; we
-- patch both at once.
--
-- DROP + CREATE because Postgres rejects RETURNS TABLE signature
-- changes via CREATE OR REPLACE FUNCTION.
-- =====================================================================

set search_path = public, extensions, pg_temp;

drop function if exists public.pin_with_stats(uuid);

create function public.pin_with_stats(p_pin_id uuid)
returns table (
  id              uuid,
  author_id       uuid,
  author_handle   citext,
  title           text,
  body            text,
  category        text,
  language        text,
  "precision"     text,
  city            text,
  photo_url       text,
  is_hidden       boolean,
  created_at      timestamptz,
  lng             double precision,
  lat             double precision,
  district_id     smallint,
  is_special      boolean,
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
    pwc."precision",
    pwc.city,
    pwc.photo_url,
    pwc.is_hidden,
    pwc.created_at,
    pwc.lng,
    pwc.lat,
    pwc.district_id,
    pwc.is_special,
    (select count(*) from public.upvotes u where u.pin_id = pwc.id) as upvote_count,
    -- save_count is private under RLS; we always return 0 to match the
    -- "saves are private, don't display a public count" UX rule.
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
  'Pin with aggregated upvote_count + per-user has_upvoted / has_saved flags + district_id + is_special. RLS-enforced.';
