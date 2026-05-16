# Supabase — Grätzl

SQL migrations for the Grätzl Postgres/PostGIS schema, hosted on Supabase Frankfurt.

## Running migrations — Supabase CLI (canonical)

The CLI is wired into this repo as a dev dependency. All schema changes go through `supabase db push` so the `supabase_migrations.schema_migrations` table stays in sync and we never re-introduce drift.

### One-time setup (per machine)

1. Generate a personal access token at <https://supabase.com/dashboard/account/tokens>.
2. Authenticate the CLI with the token (the OAuth browser flow does not work in non-TTY shells like Claude Code or CI):
   ```powershell
   pnpm exec supabase login --token <sbp_…>
   ```
3. Grab the database password from **Project Settings → Database → Database Password** (reset it if you don't have it).
4. Link the local checkout to the remote project:
   ```powershell
   pnpm exec supabase link --project-ref drgqxmxhiuetdirieywd -p '<db-password>'
   ```
   Both the access token and the password are cached locally (in `%USERPROFILE%\.supabase\` on Windows, `~/.supabase/` on macOS/Linux).

### Day-to-day

```powershell
# Author a new migration
pnpm exec supabase migration new <slug>

# Push pending migrations to remote
pnpm exec supabase db push

# Inspect what's local vs applied
pnpm exec supabase migration list
```

### Authoring rules (don't skip these)

- **Schema-qualify PostGIS types.** The CLI's migration runner uses a stricter `search_path` than the SQL Editor: write `extensions.geography(Polygon, 4326)`, not bare `geography(Polygon, 4326)`. If a migration uses `ST_*` helpers, add `set search_path = public, extensions, pg_temp;` after the DDL.
- **Idempotent objects only.** Use `if not exists`, `or replace`, and `on conflict do …` so a re-run is a no-op. Migrations are committed as PRs; reviewers should be able to apply them locally without surprises.
- **One file per migration**, named `<utc-date><time>_<slug>.sql`. Don't edit a file after it's been pushed — write a follow-up migration.

### If `db push` complains about already-applied objects

This means a migration was applied out-of-band (e.g. via the SQL Editor) and never got registered in `supabase_migrations.schema_migrations`. Mark each affected migration as already-applied:

```powershell
pnpm exec supabase migration repair --status applied <version> [<version> …]
```

Then re-run `pnpm exec supabase db push`.

## Escape hatch — Supabase SQL Editor

The dashboard's SQL Editor is fine for ad-hoc reads, one-off `select`s, and admin chores like `select public.refresh_district_pin_counts()`. **Do not use it to apply migrations** — that's how drift starts. If you have to (e.g. CLI is broken on a deadline), follow it up with a `supabase migration repair --status applied <version>` to keep the metadata in sync.

## Verifying after a fresh push

In the SQL Editor:

```sql
-- All public tables should have RLS on
select tablename, rowsecurity
  from pg_tables
 where schemaname = 'public'
 order by tablename;

-- PostGIS check
select postgis_version();

-- Phase 1.5 districts table check
select count(*) from public.districts;
```

## Region

Project region **must** be **Frankfurt (eu-central-1)** for GDPR posture. Verify at **Project Settings → General → Region**.
