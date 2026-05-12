-- =====================================================================
-- Grätzl — Row-Level Security policies
-- Week 1, session 1
--
-- Principle: every public table has RLS enabled. Reads are public for
-- non-hidden content; writes are owner-scoped. Reports are write-only
-- from the public's perspective — only admins/owners can read them.
--
-- Admin gating happens at the application layer (Week 3) via a hard-
-- coded UID check. We'll move it to a proper `is_admin` claim later.
-- =====================================================================

-- profiles ------------------------------------------------------------
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_public" on public.profiles;
create policy "profiles_select_public"
  on public.profiles for select
  using (true);

drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- pins ----------------------------------------------------------------
alter table public.pins enable row level security;

-- Anyone can read non-hidden pins. Authors can see their own hidden pins.
drop policy if exists "pins_select_visible" on public.pins;
create policy "pins_select_visible"
  on public.pins for select
  using (is_hidden = false or auth.uid() = author_id);

drop policy if exists "pins_insert_self" on public.pins;
create policy "pins_insert_self"
  on public.pins for insert
  with check (auth.uid() = author_id);

drop policy if exists "pins_update_self" on public.pins;
create policy "pins_update_self"
  on public.pins for update
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);

drop policy if exists "pins_delete_self" on public.pins;
create policy "pins_delete_self"
  on public.pins for delete
  using (auth.uid() = author_id);

-- upvotes -------------------------------------------------------------
-- Counts are public (anyone can see who upvoted; we'll aggregate
-- client-side). Inserts must be by the user themself, and self-upvoting
-- is technically impossible because the join would create a row whose
-- user_id matches the pin's author_id, which we forbid below.
alter table public.upvotes enable row level security;

drop policy if exists "upvotes_select_public" on public.upvotes;
create policy "upvotes_select_public"
  on public.upvotes for select
  using (true);

drop policy if exists "upvotes_insert_self_not_self_pin" on public.upvotes;
create policy "upvotes_insert_self_not_self_pin"
  on public.upvotes for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.pins p
      where p.id = pin_id
        and p.author_id <> auth.uid()
        and p.is_hidden = false
    )
  );

drop policy if exists "upvotes_delete_self" on public.upvotes;
create policy "upvotes_delete_self"
  on public.upvotes for delete
  using (auth.uid() = user_id);

-- saves ---------------------------------------------------------------
-- Saves are PRIVATE. A user can only see their own saves.
alter table public.saves enable row level security;

drop policy if exists "saves_select_self" on public.saves;
create policy "saves_select_self"
  on public.saves for select
  using (auth.uid() = user_id);

drop policy if exists "saves_insert_self" on public.saves;
create policy "saves_insert_self"
  on public.saves for insert
  with check (auth.uid() = user_id);

drop policy if exists "saves_delete_self" on public.saves;
create policy "saves_delete_self"
  on public.saves for delete
  using (auth.uid() = user_id);

-- reports -------------------------------------------------------------
-- Anyone authenticated can submit a report. Only the reporter can see
-- their own reports back (for "your report has been received" UX).
-- Admin access is granted out-of-band (Supabase service role in the
-- /admin route, gated by user ID at the app layer).
alter table public.reports enable row level security;

drop policy if exists "reports_select_self" on public.reports;
create policy "reports_select_self"
  on public.reports for select
  using (auth.uid() = reporter_id);

drop policy if exists "reports_insert_authed" on public.reports;
create policy "reports_insert_authed"
  on public.reports for insert
  with check (auth.uid() = reporter_id);

-- No update/delete policies → no-one (except service_role) can modify
-- reports through the public API. The admin tool will use service role.
