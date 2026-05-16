-- =====================================================================
-- Grätzl — pin_count_cached trigger + admin refresh (Slice B, B-5)
--
-- Ships two functions and one trigger that together keep
-- districts.pin_count_cached accurate whenever a pin is inserted,
-- updated, or deleted.
--
-- Why triggers (ADR-08):
--   B-AC4.6 requires counts fresh within 60s. A scheduled job would
--   introduce operational overhead (pg_cron, monitoring) and a staleness
--   window. A materialised view refresh holds an ACCESS EXCLUSIVE lock.
--   A single trigger function adds ~200µs to every pin write, which is
--   negligible at the expected write rate (<1 pin/sec).
--
-- Function: public.trg_pins_pin_count()
--   Attached to pins AFTER INSERT OR UPDATE OR DELETE.
--   Handles all four edge cases the architect specified (ADR-08):
--     (a) is_hidden flip false→true  → decrements old district count.
--     (b) is_hidden flip true→false  → increments new district count.
--     (c) district_id change         → decrements old district, increments new.
--     (d) hard DELETE of a non-hidden pin → decrements.
--     (e) hard DELETE of a hidden pin     → no-op (count was already 0 for that pin).
--     (f) author_id set to null (anonymisation) → is_hidden and district_id are
--         unchanged, so the fast-path fires and the count is untouched.
--
--   Why greatest(0, pin_count_cached - 1):
--     Protects against drift: if the cached count somehow got out of sync
--     (e.g. a manual SQL edit, a migration run in the wrong order), a
--     decrement must never push the count below zero — the column has a
--     check constraint that enforces pin_count_cached >= 0, and a
--     constraint-violation error inside a trigger would abort the pin
--     write. The `greatest(0, ...)` guard absorbs any accumulated error
--     without hiding it permanently — running refresh_district_pin_counts()
--     will reconcile.
--
-- Function: public.refresh_district_pin_counts()
--   Admin safety net. Recomputes every district's count from scratch
--   with a single UPDATE ... SET pin_count_cached = (subquery).
--   Operators can call it from the Supabase SQL editor at any time:
--     select public.refresh_district_pin_counts();
--   It is also called at the end of this migration to reconcile counts
--   after the B-4 backfill settled pins.district_id values. This ensures
--   the counts are correct from first deploy of B-5 onward regardless
--   of the exact order in which B-4 and B-5 were applied.
--
-- Sequencing note:
--   B-4 ran the backfill UPDATE on pins with triggers NOT yet installed.
--   The final `select refresh_district_pin_counts()` below sets the
--   counts from the ground truth (current pins table state). Any
--   subsequent pin writes use the trigger to keep them fresh.
-- =====================================================================

set search_path = public, extensions, pg_temp;

-- ── Trigger function ──────────────────────────────────────────────────

create or replace function public.trg_pins_pin_count()
returns trigger
language plpgsql
as $$
declare
  old_visible boolean := tg_op in ('UPDATE', 'DELETE')
    and old.is_hidden = false
    and old.district_id is not null;
  new_visible boolean := tg_op in ('INSERT', 'UPDATE')
    and new.is_hidden = false
    and new.district_id is not null;
begin
  -- Fast path: no change in (district, visibility) — nothing to do.
  -- Covers: author_id anonymisation, title/body edits, precision changes,
  -- and any update where neither is_hidden nor district_id changed.
  if old_visible and new_visible and old.district_id = new.district_id then
    return coalesce(new, old);
  end if;

  -- Decrement the old district when the pin WAS visible there.
  -- `greatest(0, ...)` guards against underflow if counts have drifted;
  -- it absorbs the error without hard-failing the pin write. Run
  -- refresh_district_pin_counts() to reconcile if you see a count of 0
  -- on a district you know has pins.
  if old_visible then
    update public.districts
       set pin_count_cached = greatest(0, pin_count_cached - 1)
     where id = old.district_id;
  end if;

  -- Increment the new district when the pin IS NOW visible there.
  if new_visible then
    update public.districts
       set pin_count_cached = pin_count_cached + 1
     where id = new.district_id;
  end if;

  return coalesce(new, old);
end;
$$;

comment on function public.trg_pins_pin_count() is
  'AFTER INSERT/UPDATE/DELETE trigger on public.pins. Keeps districts.pin_count_cached accurate. Handles is_hidden flips, district_id changes, and hard deletes. Use refresh_district_pin_counts() to reconcile if drift is suspected.';

-- ── Trigger ───────────────────────────────────────────────────────────

drop trigger if exists pins_pin_count on public.pins;

create trigger pins_pin_count
  after insert or update or delete on public.pins
  for each row execute function public.trg_pins_pin_count();

-- ── Admin refresh function ────────────────────────────────────────────
--
-- Recomputes every district's count from scratch. Call from the
-- Supabase SQL editor when in doubt:
--   select public.refresh_district_pin_counts();
--
-- This is NOT a scheduled job — Manu runs it manually as needed.
-- When a nightly pg_cron is introduced (post-launch), wire it here.

create or replace function public.refresh_district_pin_counts()
returns void
language sql
as $$
  update public.districts d
  set pin_count_cached = coalesce((
    select count(*)
    from public.pins p
    where p.district_id = d.id
      and p.is_hidden = false
  ), 0);
$$;

comment on function public.refresh_district_pin_counts() is
  'Recomputes districts.pin_count_cached from scratch for all 23 Bezirke. Safe to run at any time — idempotent. Use when the trigger-maintained count is suspected to have drifted.';

-- ── One-time reconciliation ───────────────────────────────────────────
-- Settle counts to ground truth after B-4 backfilled pins.district_id.
-- From this point forward the trigger above keeps counts accurate.

select public.refresh_district_pin_counts();
