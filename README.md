# Grätzl

> The anti-TripAdvisor. A non-commercial, locally-curated map of cities —
> residents drop pins about places only locals know, visitors discover the
> city through their eyes.

Launching in **Wien** first. See [`graetzl-implementation-plan.md`](./graetzl-implementation-plan.md) for the full roadmap.

## Stack

| Layer            | Choice                                            |
| ---------------- | ------------------------------------------------- |
| Frontend         | Next.js 16 (App Router) + React 19 + TypeScript   |
| Styling          | Tailwind CSS v4 + shadcn-style primitives         |
| Maps             | MapLibre GL JS + OpenStreetMap raster tiles       |
| Backend          | Supabase (Frankfurt) — Postgres + PostGIS + Auth  |
| Hosting          | Vercel (MVP)                                      |

## Getting started

```bash
# 1. Install dependencies (pnpm is the convention here)
pnpm install

# 2. Set up environment variables
cp .env.local.example .env.local
# Then fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
# from your Supabase project's Project Settings → API page.

# 3. Run the dev server
pnpm dev
```

Open <http://localhost:3000> — you should see the Vienna map and the
welcome card.

## Supabase setup

1. Create a new project at <https://supabase.com/dashboard>.
   **Region must be Frankfurt (eu-central-1).**
2. In **Database → Extensions**, enable `postgis` and `citext`.
3. Run the migrations under `supabase/migrations/` — see
   [`supabase/README.md`](./supabase/README.md) for two ways to apply them.
4. In **Authentication → URL Configuration**, set:
   - **Site URL:** `http://localhost:3000` (and your Vercel URL once deployed)
   - **Redirect URLs:** include `http://localhost:3000/auth/callback`
5. Copy the URL and `anon` key into `.env.local`.

## Project layout

```
src/
  app/
    layout.tsx               root layout, sets metadata + chrome
    page.tsx                 home — renders the Vienna map
    sign-in/                 magic-link sign-in page
    auth/callback/           OAuth/magic-link callback handler
  components/
    site-header.tsx          sticky top bar
    pigeon-mark.tsx          mascot placeholder (final mascot TBD)
    map/vienna-map.tsx       MapLibre GL JS client component
  lib/
    supabase/{client,server}.ts   browser + server Supabase clients
    supabase/database.types.ts    hand-written types until we generate
    utils.ts                       cn() helper
  middleware.ts              refreshes Supabase session per request

supabase/
  migrations/                SQL migrations (schema + RLS)
  README.md                  how to apply them
```

## GDPR & non-commercial principles

These are non-negotiable; see plan §5 / §1.

- Pin locations are public content with explicit consent.
- Per-pin precision: `exact` or `approximate` (~100m grid snap, client-side).
- No third-party tracking. Plausible + Sentry EU only (Phase 1 finishing).
- No cookie banner (only essential auth-session cookie).
- Account deletion anonymises pins (author → "Former local"), never deletes content.
- Strictly **no business pins, ever**.

## Scripts

| Command          | What it does                          |
| ---------------- | ------------------------------------- |
| `pnpm dev`       | Run dev server (http://localhost:3000) |
| `pnpm build`     | Production build                       |
| `pnpm start`     | Start the production server            |
| `pnpm lint`      | ESLint                                 |
| `pnpm typecheck` | `tsc --noEmit`                         |
