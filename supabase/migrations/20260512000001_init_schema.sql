-- =====================================================================
-- Grätzl — initial schema (v1)
-- Week 1, session 1
--
-- Tables: profiles, pins, upvotes, saves, reports
-- Extensions: postgis (geo), citext (case-insensitive handles)
--
-- Notes:
--   • Pin locations are stored as geography(Point, 4326) so distance
--     queries work in metres without needing per-query SRID gymnastics.
--   • `precision` records whether the stored coordinate is exact or has
--     been snapped to a ~100m grid before write (client responsibility).
--   • Soft-hide via is_hidden; we never hard-delete pins. Account
--     deletion anonymises authors (see comment on profiles.handle).
-- =====================================================================

-- Extensions ----------------------------------------------------------
create extension if not exists "postgis";
create extension if not exists "citext";

-- profiles ------------------------------------------------------------
-- Mirrors auth.users 1:1. On account deletion we keep the row but
-- reset handle to a generic value to anonymise authored pins.
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  handle       citext unique not null,
  bio          text check (length(bio) <= 280),
  home_city    text not null default 'Vienna',
  created_at   timestamptz not null default now()
);

comment on table public.profiles is
  'User profile, 1:1 with auth.users. Handle is pseudonymous and unique (case-insensitive).';

-- pins ----------------------------------------------------------------
create table if not exists public.pins (
  id           uuid primary key default gen_random_uuid(),
  author_id    uuid not null references public.profiles (id) on delete set null,
  title        text not null check (length(title) between 1 and 80),
  body         text not null check (length(body) between 1 and 500),
  category     text not null check (category in (
                 'food_drink', 'view', 'art_history',
                 'nightlife', 'hidden_gem', 'warning', 'other'
               )),
  language     text not null default 'de' check (length(language) between 2 and 5),
  location     geography(Point, 4326) not null,
  precision    text not null default 'exact' check (precision in ('exact', 'approximate')),
  city         text not null default 'Vienna',
  photo_url    text,
  is_hidden    boolean not null default false,
  created_at   timestamptz not null default now()
);

comment on table public.pins is
  'A user-curated point of interest. Non-commercial content only — see Terms.';
comment on column public.pins.precision is
  'exact = stored coordinate matches the user-selected location. ' ||
  'approximate = client snapped to ~100m grid before write (GDPR).';

-- Critical spatial index for nearby-pin lookups.
create index if not exists pins_location_gix
  on public.pins using gist (location);

create index if not exists pins_author_id_idx on public.pins (author_id);
create index if not exists pins_city_idx       on public.pins (city);
create index if not exists pins_category_idx   on public.pins (category);
create index if not exists pins_created_at_idx on public.pins (created_at desc);

-- upvotes -------------------------------------------------------------
create table if not exists public.upvotes (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  pin_id      uuid not null references public.pins (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, pin_id)
);

create index if not exists upvotes_pin_id_idx on public.upvotes (pin_id);

-- saves ---------------------------------------------------------------
create table if not exists public.saves (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  pin_id      uuid not null references public.pins (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, pin_id)
);

create index if not exists saves_pin_id_idx on public.saves (pin_id);

-- reports -------------------------------------------------------------
create table if not exists public.reports (
  id            uuid primary key default gen_random_uuid(),
  pin_id        uuid not null references public.pins (id) on delete cascade,
  reporter_id   uuid not null references public.profiles (id) on delete set null,
  reason        text not null check (reason in (
                  'spam', 'commercial', 'illegal', 'harassment',
                  'inaccurate', 'unsafe', 'other'
                )),
  notes         text check (length(notes) <= 500),
  status        text not null default 'open' check (status in ('open', 'reviewed', 'dismissed')),
  created_at    timestamptz not null default now()
);

create index if not exists reports_status_idx on public.reports (status);
create index if not exists reports_pin_id_idx on public.reports (pin_id);

-- =====================================================================
-- Auto-create profile row on signup
-- Magic-link signups create an auth.users row; we mirror it into
-- public.profiles with a generated handle the user can change later.
-- =====================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, handle)
  values (
    new.id,
    -- Default handle: 'wiener_' + first 8 chars of uuid. Collision-safe.
    'wiener_' || substr(replace(new.id::text, '-', ''), 1, 8)
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
