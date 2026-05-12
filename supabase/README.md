# Supabase — Grätzl

SQL migrations for the Grätzl Postgres/PostGIS schema, hosted on Supabase Frankfurt.

## Running the migrations

You have two options. **Pick one and stick to it** — mixing the two will create drift.

### Option A — Supabase SQL Editor (fastest for MVP)

1. Open the [Supabase Dashboard](https://supabase.com/dashboard) for the `Graetzl` project.
2. In **Database → Extensions**, enable `postgis` and `citext`.
3. Open **SQL Editor → New query**.
4. Paste the contents of `migrations/20260512000001_init_schema.sql` and run it.
5. Paste the contents of `migrations/20260512000002_rls_policies.sql` and run it.

### Option B — Supabase CLI (better long-term)

```bash
# One-time setup
brew install supabase/tap/supabase   # or: npm i -g supabase
supabase login
supabase link --project-ref <your-project-ref>

# Apply migrations
supabase db push
```

The CLI tracks which migrations have been applied, so future schema changes can be a `supabase migration new <name>` + `supabase db push` away.

## Verifying

After running both migrations, in the SQL editor:

```sql
-- Should return 5 rows (one per table)
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;

-- Should confirm PostGIS is installed
select postgis_version();
```

Every table should show `rowsecurity = true`.

## Region

Project region **must** be **Frankfurt (eu-central-1)** for GDPR posture. Verify at **Project Settings → General → Region**.
