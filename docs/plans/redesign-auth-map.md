# Plan: UI Redesign + Email/Password Auth + Polygon Map

> Living document. Owned by the planner (Stage 2). Hand off to `solution-architect` (Stage 3) once approved.
> **Source PRD:** `docs/prd/redesign-auth-map.md`
> **Date:** 2026-05-15
> **Target window:** Phase 1.5 — between Week 3 (in-flight) and Week 4 (launch prep)

---

## Context

This plan implements the three slices defined in the PRD:

- **A** — Email/password auth alongside existing magic-link (no schema change)
- **B** — Vienna's 23 Bezirke as a polygon layer + districts table + server-side `district_id` association
- **C** — Radix-based UI primitives + refactor of 8 existing components + fluid type / motion / dark-mode tokens

### Decisions (already settled — do not re-debate)

1. **HIBP enabled** at Supabase Auth dashboard (k-anonymity, no leakage).
2. **`pin_count_cached` is trigger-maintained** on `pins` INSERT/UPDATE/DELETE. The architect designs idempotent triggers covering `is_hidden` flips, `district_id` changes, and deletes; ships an admin `refresh_district_pin_counts()` function as a safety net.
3. **District click zooms** (`fitBounds`, 40px padding). Un-selecting does not auto-zoom out.

### Sequencing constraint (the spine of this plan)

From the PRD's risk section, two files are collision points: `filter-bar.tsx` and `sign-in-form.tsx`. The resolution dictates the order of everything else:

1. **Slice C primitives land first** (additive — `src/components/ui/` only, no refactors yet).
2. **Slice A's new tabbed form is built directly on those primitives** (does not double-refactor).
3. **Slice C's component refactors run in parallel with Slice B's map work**, but `filter-bar.tsx` is touched by Slice C *before* Slice B adds the Bezirk section.
4. **`vienna-map.tsx` is split into layer modules** (`src/components/map/layers/`) before Slice B's MapLibre work begins — flagged as prep task **S0-3**.

### Recommendation on Dep-3 (Plausible analytics) — PULL FORWARD

The PRD currently lists Plausible as a Week 4 task; eight of the success metrics depend on `auth_signup`, `auth_signin_failed`, `filter_bezirk_set`, `theme_resolved`, etc. **Pull Plausible into prep slice S0** (one S task). Justification:

- Without it, every Slice A and Slice B metric is unmeasurable at ship — we'd be flying blind during the dogfood round.
- It's a single dev's afternoon (script tag + `<PlausibleProvider>` + 5 custom-event helpers). Cheaper now than retrofitting events after Slice A ships and we have to re-PR every form handler.
- Cost of doing it now is one S task. Cost of doing it after: at least 6 follow-on PRs across Slice A and B handlers.
- Plausible script is GDPR-clean, cookieless, and EU-hosted — no constraints violated.

This is task **S0-1**.

---

## Walking Skeleton (Slice 0 / "S0")

The smallest end-to-end thing that proves the full pipeline before any slice fills in.

**Definition of done for the skeleton:**
1. The new primitive `Button` from Slice C is mounted in the site header (visible, theme-correct, focus-ring-correct) — proves the primitive infrastructure works.
2. The `/sign-in` page renders a placeholder tabs shell built on Radix Tabs (no functionality yet, just the structure) — proves Slice A's surface compiles on Slice C's primitives.
3. The `districts` table exists in Supabase (migration applied) with one seeded row for *Innere Stadt* (Bezirk 1) — proves the migration shape.
4. The map renders a single Innere Stadt polygon, sourced from a stub `bezirke.geojson` containing only that polygon — proves the layer-module split, layer ordering, and the GeoJSON loader.
5. Plausible is wired and fires one `app_loaded` event on `/` — proves analytics ship before any slice depends on them.
6. Deployed to Vercel preview and visibly working end-to-end (header button → sign-in shell → map with one polygon).

The skeleton is **6 tasks** (S0-1 through S0-6). Once it's green, each slice fills in vertically.

---

## Slice S0 — Prep & Walking Skeleton

**Goal:** Get the pipeline assembled end-to-end with placeholder content in every slice's surface area. Unblock parallel work.

| ID | Title | Owner | Parallel? | Effort | Depends on | Fulfils |
|----|-------|-------|-----------|--------|-----------|---------|
| S0-1 | Plausible EU integration: add script tag in `app/layout.tsx`, create `src/lib/analytics/plausible.ts` helper with typed `track(event, props)` API, fire `app_loaded` event on `/`. **Configure `plausible.io/js/script.tagged-events.js`.** | devops-engineer | Y | S | — | All Slice A + B success metrics |
| S0-2 | Add Radix deps + `pnpm lighthouse` script: install `@radix-ui/react-dialog`, `@radix-ui/react-tabs`, `@radix-ui/react-toast`, `@radix-ui/react-slot`, `@radix-ui/react-label`, `@radix-ui/react-tooltip`. Add `"lighthouse": "lighthouse http://localhost:3000 --output=json --output-path=./lighthouse.json --chrome-flags='--headless'"` to `package.json`. | devops-engineer | Y | S | — | Dep-4, C-AC6.4, C-AC2.5 |
| S0-3 | Refactor `vienna-map.tsx`: extract style spec, pin-source, cluster-layer, pin-symbol-layer into `src/components/map/layers/{pins-layer.ts,style.ts}`. **No behaviour change.** Add empty `src/components/map/layers/districts-layer.ts` stub with public `attachDistrictsLayer(map)` no-op. Verify pin drop + cluster + URL filters still pass smoke test. | frontend-developer | N (blocks B) | M | S0-2 | B-R2 mitigation, prerequisite to B-AC1.1 |
| S0-4 | Migration `20260515000001_districts_table.sql`: create `public.districts` (id, name, slug, boundary, centroid, bbox, pin_count_cached) + GIST index on `boundary`. RLS: `select using (true)`, no write policies. Seed only **Bezirk 1 Innere Stadt** as a stub row (polygon from a 4-vertex hand-typed approximation — full data lands in B-1). | backend-developer | Y | S | — | B-AC4.1, B-AC4.2, B-AC4.5 |
| S0-5 | Slice C primitive scaffold (additive, no refactors): create `src/components/ui/{button.tsx,input.tsx,label.tsx,tabs.tsx}` as minimal CVA-wrapped Radix Slot/Tabs/Label components. Mount the new `<Button>` in `site-header.tsx`'s "Abmelden" position (replace the inline `<button>` only — single-line diff). | frontend-developer | Y | S | S0-2 | C-AC1.1, C-AC1.2 |
| S0-6 | Sign-in tabs shell: refactor `src/app/sign-in/sign-in-form.tsx` to wrap the existing magic-link form in a Radix Tabs container with two tabs ("Magic-Link" active, "E-Mail + Passwort" empty placeholder copy "Wird in Kürze verfügbar"). **Existing magic-link path untouched** — just nested inside Tab 1. Smoke-test on Vercel preview. | frontend-developer | N (depends S0-5) | S | S0-5 | A-AC1.1 (structural), A-AC4.1 |

**Exit criteria for S0:**
- `pnpm build` is green; `pnpm typecheck` is green; `pnpm lint` is green.
- Vercel preview URL shows: header with new Button styling, /sign-in with the empty second tab, map with Innere Stadt outline rendered.
- Plausible dashboard receives `app_loaded` from the preview.

---

## Slice C — UI Primitives + Refactor

**Goal:** A small primitive set + design tokens (fluid type, motion, dark mode override) + 8 components refactored onto the primitives. No new product surface except the theme override toggle on `/me`.

| ID | Title | Owner | Parallel? | Effort | Depends on | Fulfils |
|----|-------|-------|-----------|--------|-----------|---------|
| C-1 | Design tokens in `src/app/globals.css`: motion (`--motion-fast/default/slow`), fluid type (`--font-size-xs`…`3xl` via `clamp()`), `@theme inline` remap of `text-xs`…`text-3xl`, prefers-reduced-motion `@media` rule. Document each token with `/* 11–12px */`-style comments per PRD. | frontend-developer | Y | S | S0-2 | C-AC3.1, C-AC3.3, C-AC5.1, C-AC5.2 |
| C-2 | Primitives batch 2: `card.tsx` (Card / CardHeader / CardTitle / CardDescription / CardContent / CardFooter composition), `badge.tsx`. JSDoc header on each. | frontend-developer | Y | S | S0-5 | C-AC1.1, C-AC1.4, C-AC1.7, C-AC1.8 |
| C-3 | Primitives batch 3: `sheet.tsx` (bottom-anchored mobile, centred on `≥sm`, built on Radix Dialog with `aria-label` + focus-trap), `toast.tsx` (built on Radix Toast). | frontend-developer | Y | S | S0-5 | C-AC1.1, C-AC1.5, C-AC1.7 |
| C-4 | Refactor `dialog.tsx`: swap native `<dialog>` element for Radix Dialog. Preserve the existing `<Dialog open onClose title>` API exactly so call sites change by at most 2 lines. **Test intercepting-route modal first** (`(.)pin/[id]/page.tsx`) — `router.back()` must still close cleanly. | frontend-developer | N (must precede C-5..C-9) | M | C-3 | C-AC1.6, C-R2 mitigation |
| C-5 | Refactor `welcome-card.tsx` onto Card + Button primitives. Verify localStorage dismiss-key v2 behaviour unchanged. | frontend-developer | Y | S | C-2 | C-AC6.2 |
| C-6 | Refactor `filter-bar.tsx` onto Sheet + Button + Label primitives. **Critical: keep the public surface identical** (same exported `<FilterBar>`, same URL-param contract) — only the internals change. **No Bezirk section yet** — that's B-13. | frontend-developer | N (blocks B-13) | M | C-3 | C-AC6.2, B-R3 mitigation |
| C-7 | Refactor `drop-pin-modal.tsx` + `report-modal.tsx` + `profile-edit-modal.tsx` onto the new Dialog API. Each is a ≤2-line diff per file per PRD; combine into one PR. | frontend-developer | Y | S | C-4 | C-AC1.6, C-AC6.2 |
| C-8 | Refactor `pin-detail.tsx` + `pin-detail-modal.tsx` onto Card + Button + Badge primitives. Article semantics for the body. | frontend-developer | Y | S | C-2 | C-AC2.7, C-AC6.2 |
| C-9 | Refactor `site-header.tsx` (full pass — beyond the S0-5 Button swap) + `src/app/me/page.tsx` onto Card + Button. | frontend-developer | Y | S | C-2 | C-AC6.2 |
| C-10 | Dark-mode pass: audit `/`, `/sign-in`, `/pin/[id]`, `/u/[handle]`, `/me`, `/admin` in dark mode. Fix MapLibre attribution background (replace `rgba(255,255,255,0.7)` with `rgba(var(--background-rgb), 0.7)`). Add `--border` to PinCard photo thumbnails. WCAG AA contrast verify `--muted-foreground` on `--background`. | frontend-developer | Y | M | C-5, C-6, C-7, C-8, C-9 | C-AC4.1, C-AC4.2, C-AC4.3, C-AC4.4, C-AC2.6 |
| C-11 | Theme override toggle on `/me`: control writes `graetzl:theme` to localStorage; blocking inline `<head>` script reads it before paint to prevent FOUC. Plausible event `theme_resolved` fired with `light|dark` on mount. | frontend-developer | Y | S | C-9, S0-1 | C-AC4.5, C-R4 mitigation, success metric "Dark-mode session share" |
| C-12 | Accessibility verification pass: run `pnpm lighthouse` on `/`, `/sign-in`, `/pin/[id]` in production build; capture scores. Tab-order audit (manual, screen-reader-off). Verify `:focus-visible` rings on every primitive. Fix any score <95. | qa-engineer | N (final) | M | C-10, C-11, A-3, B-7 | C-AC2.1, C-AC2.2, C-AC2.3, C-AC2.4, C-AC2.5 |
| C-13 | Bundle-size guardrail: run `pnpm build`, capture route-size for `/`, confirm delta ≤30 KB gzipped vs the pre-S0 baseline (captured during S0-2). Document baseline + delta in the PR description. | qa-engineer | Y | S | C-12 | C-AC6.4 |
| C-14 | Visual-regression spot-check: capture screenshots of the 8 refactored components at 360×640, 768×1024, 1440×900 (manual or via Playwright `screenshot()` if added). Manu signs off. | code-reviewer | Y | S | C-12 | C-AC6.3 |

**Exit criteria for Slice C:**
- All 8 listed components refactored, no native `<dialog>` element left in the codebase.
- Lighthouse a11y ≥95 on the three target routes; Lighthouse perf mobile ≥85 on `/`.
- Bundle delta on `/` ≤30 KB gzipped.
- Dark-mode pass signed off by Manu; theme override toggle works without FOUC.

---

## Slice A — Email/Password Authentication

**Goal:** Add a second auth path (email + password + reset) alongside magic-link without weakening GDPR posture. Zero schema change.

| ID | Title | Owner | Parallel? | Effort | Depends on | Fulfils |
|----|-------|-------|-----------|--------|-----------|---------|
| A-0 | **Manu, day 1**: Supabase dashboard config — (1) Enable password auth; (2) URL Configuration → add `<prod-origin>/auth/reset-password` + Vercel preview wildcard; (3) Authentication → Policies → password strength = 10 chars + 1 upper + 1 lower + 1 number; (4) Enable HIBP check; (5) Set `flowType: 'pkce'` so reset uses `?code=`; (6) Confirm project-level rate limit = 30/min/IP. **Document each setting in `docs/runbooks/supabase-auth-config.md`** so it can be reproduced on staging. | devops-engineer | Y | S | — | Dep-1, A-AC1.5, A-R3, A-R4, decision #1 (HIBP) |
| A-1 | Magic-link form extraction: rename existing form internals to `magic-link-form.tsx`, keep behaviour identical. Composed into the tabbed parent created in S0-6. **One PR, mechanical refactor**, no logic change. | frontend-developer | N (blocks A-2) | S | S0-6 | A-AC4.1, A-R2 mitigation |
| A-2 | Password form component `password-form.tsx`: email input + password input (show/hide toggle) + segmented "Konto erstellen" / "Anmelden" control. Built on Slice C primitives (Input, Label, Button, Tabs from S0-5 / C-2). Client-side validation (length, complexity) with German error copy. `autocomplete="email"` and `autocomplete="current-password"` / `"new-password"`. **No backend wiring yet** — just the form + validation. | frontend-developer | Y | M | A-1, S0-5 | A-AC1.1, A-AC1.2, A-AC1.4, A-AC2.4 |
| A-3 | Wire signup + signin to Supabase Auth: `supabase.auth.signUp({...emailRedirectTo})` for create mode, `supabase.auth.signInWithPassword({...})` for signin mode. Generic error "E-Mail oder Passwort ist falsch." for failed signin (no enumeration leak). Surface "Bestätige deine E-Mail" copy after signup. Detect `Email rate limit exceeded` / `User already registered` and surface PRD-mandated copy ("Konto existiert bereits — setze ein Passwort über 'Passwort vergessen'."). Fire Plausible events: `auth_signup{method:password}`, `auth_signin_attempt`, `auth_signin_failed`. | frontend-developer | N | M | A-2, A-0, S0-1 | A-AC1.3, A-AC1.5, A-AC1.6, A-AC1.7, A-AC2.1, A-AC2.2, success metrics |
| A-4 | Client-side rate-limit: after 5 failed attempts in 15min (tracked in `sessionStorage`), disable submit for 60s with "Bitte kurz warten." Counter resets on success. Document that this is best-effort, real defence is Supabase project rate limit (A-0). | frontend-developer | Y | S | A-3 | A-AC2.3, A-R4 mitigation |
| A-5 | Reset-password inline flow on `/sign-in`: "Passwort vergessen?" link under password input → inline panel (no page reload) collects email, calls `resetPasswordForEmail(email, {redirectTo: '<origin>/auth/reset-password'})`. Always shows "Falls ein Konto mit dieser E-Mail existiert, haben wir eine Mail gesendet." regardless of outcome. Fire Plausible `auth_reset_requested`. | frontend-developer | Y | M | A-3 | A-AC3.1, A-AC3.2, A-AC3.3, success metric "Password-reset completion rate" |
| A-6 | New route `/auth/reset-password/page.tsx` + form: reads PKCE `?code=` param, calls `exchangeCodeForSession`, renders new-password + confirm-password form (same complexity validation as signup), calls `supabase.auth.updateUser({password})`. On success redirect to `/`. Expired-link state shows "Link ist abgelaufen. Fordere einen neuen an." with back-link. Fire Plausible `auth_reset_completed`. | frontend-developer | N | M | A-3, A-0 | A-AC3.4, A-AC3.5, A-AC3.6 |
| A-7 | Parity verification suite: manual + scripted checks for A-AC5 group — (1) password-signup user has exactly one `profiles` row with `wiener_<8hex>` handle; (2) password-authed user can read/write pins under unchanged RLS; (3) `signOut()` invalidates session identically; (4) magic-link user can request a magic-link to a password-account email and receive one; (5) magic-link user can later set password via reset flow. Capture as `docs/runbooks/auth-parity-checks.md`. | qa-engineer | N (final) | M | A-3, A-4, A-5, A-6 | A-AC5.1, A-AC5.2, A-AC5.3, A-AC5.4, A-AC5.5, A-AC4.2, A-AC4.3, A-R5 |
| A-8 | Security review: account enumeration on signup vs reset, generic error messages, PKCE flow correctness, HIBP enforcement. Sign off or request changes. | security-auditor | Y | S | A-7 | A-AC1.7, A-AC2.2, A-AC3.3, A-R1 |
| A-9 | Tech writer pass: update `README.md` "Authentication options" section + GDPR notes (HIBP disclosure). Update `graetzl-implementation-plan.md` §6 to mark password auth as Phase 1.5 ship. | tech-writer | Y | S | A-8 | Documentation requirement from PRD "Next Steps" |

**Exit criteria for Slice A:**
- Both auth paths verified by qa-engineer; A-AC5 parity checks all pass.
- Security sign-off from security-auditor.
- HIBP enabled at dashboard, confirmed in runbook.
- Plausible events firing for signup / signin / reset.

---

## Slice B — Polygon Map (Vienna Bezirke)

**Goal:** 23 Bezirk polygons rendered subtly, click-to-filter, server-side `district_id` association, `pin_count_cached` maintained by triggers.

| ID | Title | Owner | Parallel? | Effort | Depends on | Fulfils |
|----|-------|-------|-----------|--------|-----------|---------|
| B-1 | GeoJSON sourcing + simplification: download Bezirksgrenzen from data.wien.gv.at; re-project to EPSG:4326 with `ogr2ogr -t_srs EPSG:4326 in.geojson out.geojson`; simplify with `mapshaper -simplify 8% keep-shapes` to ≤80 KB gzipped (≤300 KB raw). Spot-check 10 street corners against wien.gv.at "Mein Bezirk" finder. Output: `public/data/bezirke.geojson`. **Also produce a full-fidelity `seed/districts-full.geojson` for DB seeding (B-3) — keep the original unsimplified version.** Document the pipeline in `docs/runbooks/bezirke-data-pipeline.md`. | devops-engineer | Y | M | — | B-AC1.5, B-AC1.6, Dep-2, B-R1, B-R4 |
| B-2 | Migration `20260515000002_pins_district_fk.sql`: add `district_id smallint references districts(id)` to `pins` (nullable). No index needed yet (≤200 rows). | backend-developer | Y | S | S0-4 | B-AC4.3 |
| B-3 | Seed migration `20260515000003_districts_seed.sql`: INSERT/UPSERT all 23 districts with `name`, `slug`, full-fidelity `boundary` (from `seed/districts-full.geojson`), `centroid = ST_Centroid(boundary)`, `bbox = ST_Envelope(boundary)::geography`, `pin_count_cached = 0`. Overwrites the stub row from S0-4. **Idempotent** (`on conflict (id) do update`). | backend-developer | N | M | B-1, S0-4 | B-AC4.1 |
| B-4 | Backfill migration `20260515000004_pins_district_backfill.sql`: `update pins set district_id = (select id from districts where ST_Contains(boundary::geometry, location::geometry) limit 1) where district_id is null;` Run with `statement_timeout = '60s'` set explicitly. Includes verification query that counts pins per district. Document expected coverage. | backend-developer | N | S | B-3 | B-AC4.3, B-R5 mitigation |
| B-5 | Trigger migration `20260515000005_pin_count_triggers.sql`: AFTER INSERT/UPDATE/DELETE trigger on `pins` that adjusts `districts.pin_count_cached`. **Architect must spec the trigger logic** to be idempotent under: (a) is_hidden flip, (b) district_id change, (c) hard delete, (d) author_id change to null on user deletion. **Plus** `create or replace function refresh_district_pin_counts() returns void` admin safety-net that recomputes from scratch. | backend-developer | N | M | B-4 | B-AC4.6, decision #2, B-R3 |
| B-6 | RPC migration `20260515000006_pins_in_bbox_filtered.sql`: new `public.pins_in_bbox_filtered(min_lng, min_lat, max_lng, max_lat, p_bezirk smallint default null, max_rows int default 500)` with `security_invoker`. When `p_bezirk` is set, joins to `districts` for bbox and adds `where district_id = p_bezirk`. **Decision needed from architect (see "Decisions for Architect" below):** does this replace `pins_in_bbox` or live alongside it? | backend-developer | Y | S | B-2 | B-AC4.7 |
| B-7 | `createPin` server action update: after validation, look up `district_id` via `select id from districts where ST_Contains(boundary::geometry, ST_SetSRID(ST_MakePoint($lng, $lat), 4326)) limit 1`. Insert with `district_id` (or null). Add unit-style integration test that drops a pin at known coords and asserts the right `district_id`. | backend-developer | Y | S | B-3 | B-AC4.4 |
| B-8 | Filter library extension `src/lib/pins/filters.ts`: add `bezirk: number | null` to `PinFilters`. `parseFiltersFromParams` reads `?bezirk=`, normalises invalid values to null. `writeFiltersToParams` writes/deletes. Update `applyFilters` (or wire server-side via B-6). | frontend-developer | Y | S | — | B-AC3.3 |
| B-9 | Districts data hook `src/lib/districts/use-districts.ts`: server-fetcher `getDistricts()` returns `{id, name, slug, bbox: [minLng,minLat,maxLng,maxLat], pin_count_cached}[]`. Server-side cache (`force-cache`) — districts are immutable after seed. | frontend-developer | Y | S | B-3 | B-AC2.4, B-AC5.3 |
| B-10 | Districts MapLibre layer in `src/components/map/layers/districts-layer.ts`: replace the stub from S0-3. Adds `districts-fill` + `districts-line` layers from `/data/bezirke.geojson`. Fill = `--accent` 4% opacity; line = `--accent` 50% opacity with zoom-stepped weight (0.5px @ z10–12, 1px @ z13–15, 1.5px @ z16+). **Inserts the layers below `clusters` and `pin-point`** so pins always paint on top. `performance.mark`/`measure` around the source-data event; fire Plausible `polygon_layer_painted` with duration. Wien.gv.at attribution appended to MapLibre attribution control. | frontend-developer | N (depends S0-3) | M | S0-3, B-1 | B-AC1.1, B-AC1.2, B-AC1.3, B-AC1.4 |
| B-11 | District click + zoom behaviour: click handler on `districts-fill` layer → set URL `?bezirk=<id>` and `map.fitBounds(district.bbox, {padding: 40})`. Clicking same district or outside any district clears `?bezirk` (no auto-zoom-out). Fire Plausible `district_click{bezirk}` and `filter_bezirk_set`. | frontend-developer | N | M | B-10, B-8, B-9 | B-AC2.1, B-AC2.2, B-AC2.3, B-AC2.4 |
| B-12 | Hover/tap detail UX: desktop hover → Tooltip primitive (Radix `@radix-ui/react-tooltip`) showing `<Name> · <N> Pins` at cursor. Touch device: single tap on a *non-selected* district shows a bottom-anchored persistent label for 2s before treating next tap as "select". **Coordinate with the existing 450ms long-press pin-drop gesture** — long-press still wins. Pin counts read from `districts.pin_count_cached`, never recomputed. | frontend-developer | N | M | B-10, B-9 | B-AC5.1, B-AC5.2, B-AC5.3, B-AC5.4 |
| B-13 | Filter-bar Bezirk section: add a "Bezirk" radio-list section above "Kategorie" in `filter-bar.tsx`. Options = "Alle" + 23 named entries (`1. Innere Stadt`, … `23. Liesing`). Listbox supports arrow-key + Enter (B-AC2.5). Active selection shows in collapsed chip; filter-count badge increments. "Zurücksetzen" clears Bezirk too. **Built on C-6's refactored filter-bar — must NOT land before C-6.** | frontend-developer | N (depends C-6) | M | C-6, B-8, B-9, B-11 | B-AC2.5, B-AC3.1, B-AC3.2, B-AC3.4, B-AC3.5 |
| B-14 | Pin-fetch wiring: update the map's pin loader to call `pins_in_bbox_filtered` with `p_bezirk` when active, fall back to `pins_in_bbox` when null. (Or always call `_filtered` with null — see architect decision.) Verify combined filters (`?bezirk=6&cat=hidden_gem&lang=de`) return correct subset. | frontend-developer | N | S | B-6, B-11 | B-AC3.5 |
| B-15 | Performance verification: run a Moto-G7-class throttled measurement (Chrome DevTools "Mobile - Low-tier" CPU 6× + Slow 4G), confirm polygon paint p95 ≤ 200ms. Capture three runs; if any exceeds 200ms, the architect re-spikes simplification level. | qa-engineer | N (final) | S | B-10 | B-AC1.4, success metric "Polygon layer initial paint" |
| B-16 | Spatial-correctness verification: backfill spot-check — pick 10 known pins from current dev DB across at least 6 districts, assert `district_id` matches their wien.gv.at "Mein Bezirk" answer. Document in `docs/runbooks/bezirke-data-pipeline.md`. | qa-engineer | Y | S | B-7, B-4 | B-AC1.6, B-AC4.3, B-AC4.4 |

**Exit criteria for Slice B:**
- 23 polygons render correctly on map; pin layers always on top.
- Click → filter → URL → server query → fewer pins all wired.
- `pin_count_cached` is correct after a synthetic insert/update/delete cycle.
- Filter combines AND with category + language.
- Performance and spatial-correctness verifications pass.

---

## Critical Path

The longest dependent chain runs through Slice C primitives → Slice A wiring → A QA → final a11y verification:

**S0-2 → S0-5 → S0-6 → A-1 → A-2 → A-3 → A-5 → A-7 → C-12**

Cumulative effort: S + S + S + S + M + M + M + M + M ≈ **4 × S + 5 × M = ~4 days + ~10 days = ~14 working days (≈3 weeks)** with one frontend dev.

If you parallelise (see "Parallel Tracks"), real elapsed time drops to roughly **8–10 working days** because Slice B work and Slice C refactors happen in parallel with the auth chain.

A secondary critical path through Slice B runs:

**S0-2 → S0-3 → B-10 → B-11 → B-13 → B-14 → C-12** (also ~14 days serial).

---

## Parallel Tracks

These can run concurrently after S0 is green.

- **Track 1 — Slice C primitives + tokens** (frontend-developer): C-1, C-2, C-3 — independent after S0-5; can land in any order.
- **Track 2 — Slice A auth chain** (frontend-developer, sometimes 2 if available): A-1 → A-2 → A-3 → A-4 / A-5 / A-6 (the three children of A-3 are themselves parallel-eligible). A-0 runs in parallel as devops work.
- **Track 3 — Slice B data + migrations** (backend-developer): B-1 (devops) feeds into B-3 → B-4 → B-5; B-2 → B-6 in parallel. All migrations can complete before any frontend B work needs them.
- **Track 4 — Slice B map work** (frontend-developer): unblocks after S0-3 + B-1 + B-3 land — B-9, B-10, B-11, B-12 then chain. B-13 specifically gates on C-6 from Track 1.
- **Track 5 — Slice C component refactors** (frontend-developer): C-5, C-7, C-8, C-9 are independent of each other after their primitive prereqs land. C-4 must land before C-7. C-6 must land before B-13.

**Suggested rough sequencing (calendar-free):**
- *Sprint 1:* S0 (6 tasks) + A-0 (devops parallel) + B-1 (devops parallel). Skeleton green by end.
- *Sprint 2:* Tracks 1, 2, 3 run in parallel. Get all of Slice C primitives + A-1/A-2/A-3 + all Slice B migrations done.
- *Sprint 3:* Slice C refactors (C-5..C-9) + A-4/A-5/A-6 + B-7..B-12.
- *Sprint 4:* Convergence — C-10, C-11, B-13, B-14, A-7..A-9, B-15, B-16, then C-12/C-13/C-14 final verification.

---

## Risks & Mitigations

| Risk | Linked PRD risk | Mitigation | Owner |
|------|-----------------|------------|-------|
| **`filter-bar.tsx` collision between Slice B (Bezirk section) and Slice C (primitives refactor)** | B-R3, C-R5 | Hard-sequenced: **C-6 must merge before B-13**. Both tasks explicitly note the dependency. | planner / code-reviewer at PR time |
| **`sign-in-form.tsx` collision between Slice A (tabs+password) and Slice C (primitives)** | A-R2, C-R5 | S0-6 lands the tabs shell on Slice C primitives *first*; A-1 then extracts magic-link into a child component without re-styling. | planner / code-reviewer |
| **`vienna-map.tsx` is already 300+ lines** — Slice B adds another layer pair and click handlers | B-R2 | S0-3 splits map into `layers/` modules *before* any Slice B map work. `districts-layer.ts` lands as a stub in S0-3, fleshed out in B-10. | frontend-developer (S0-3) |
| **Radix `Dialog` migration could break intercepting-route modal `(.)pin/[id]`** | C-R2 | C-4 explicitly tests intercepting-route `router.back()` *first*, in a dedicated branch. Rollback path: keep the legacy `<dialog>` wrapper file until C-7 ships. | frontend-developer (C-4) |
| **Tailwind v4 `@theme inline` fluid-type may not propagate to all utility classes** | C-R3 | C-1 is sandboxed (`/sandbox` route) before C-5..C-9 consume the tokens. If `@theme inline` fails, fallback is per-component `style={{fontSize: 'var(--font-size-base)'}}`. | frontend-developer (C-1) |
| **Theme localStorage read causes FOUC** | C-R4 | C-11 injects a blocking inline `<head>` script per Next.js docs (the standard pattern). | frontend-developer (C-11) |
| **HIBP enforcement may reject passwords users have memorised** | (new) | A-3 surfaces the Supabase HIBP error code with German copy: "Dieses Passwort ist in einem bekannten Datenleck enthalten. Bitte wähle ein anderes." | frontend-developer (A-3) |
| **PKCE `?code=` recovery flow has different shape from old hash-fragment flow** | A-R3 | A-0 explicitly configures `flowType: 'pkce'` at the Supabase client level. A-6 reads `?code=` query param, not hash. Manual test on Vercel preview before merge. | devops-engineer (A-0) + frontend-developer (A-6) |
| **GeoJSON simplification accuracy loss → wrong `district_id` for edge-case street corners** | B-R1, B-R6 | Two-tier data: full-fidelity polygons in DB (used by `ST_Contains` in B-7), simplified polygons in client (used only for render). B-16 spot-checks 10 corners. | devops-engineer (B-1) + qa-engineer (B-16) |
| **wien.gv.at GeoJSON arrives in MGI/Austria Lambert (EPSG:31256)** | B-R4 | B-1 pipeline mandates `ogr2ogr -t_srs EPSG:4326` step. Documented in runbook. | devops-engineer (B-1) |
| **`district_id` backfill lock contention on `pins`** | B-R5 | B-4 sets `statement_timeout = '60s'`, runs off-hours. Table size is currently <200 rows, so even with locking the window is sub-second. | backend-developer (B-4) |
| **Trigger logic for `pin_count_cached` is subtle (handle `is_hidden` flips, `district_id` changes, deletes)** | (decision #2 risk) | Solution-architect specs B-5 in detail before implementation. `refresh_district_pin_counts()` admin function as nightly cron safety net (operationally Manu runs weekly via SQL editor for now). | solution-architect (Stage 3), backend-developer (B-5) |
| **Bundle size guardrail breached by Radix imports** | C-R1 | S0-2 captures pre-Radix baseline. C-13 enforces ≤30 KB delta. Mitigation: named imports only; if breached, drop unused primitives (Toast first if it's the heaviest). | frontend-developer (C-13) |
| **Refactoring 8 components in parallel = merge-conflict storm** | C-R5 | One refactor per PR; serialise C-5..C-9 via PR queue (any order, but only one at a time). Primitives (C-1..C-3) are additive so can land in parallel. | code-reviewer (queue management) |
| **Plausible never integrated → success metrics unmeasurable at launch** | Dep-3 | Pulled forward to S0-1. (Recommendation made above.) | devops-engineer (S0-1) |

---

## Resourcing Notes (owners by agent type)

| Agent | Tasks owned | Total approximate effort |
|-------|-------------|--------------------------|
| **frontend-developer** | S0-3, S0-5, S0-6, C-1..C-11, A-1, A-2, A-3, A-4, A-5, A-6, B-8, B-9, B-10, B-11, B-12, B-13, B-14 | ~30 tasks; the bulk of the plan |
| **backend-developer** | S0-4, B-2, B-3, B-4, B-5, B-6, B-7 | 7 tasks (migrations + server action + RPC) |
| **devops-engineer** | S0-1, S0-2, A-0, B-1 | 4 tasks (dashboard, scripts, GeoJSON pipeline) |
| **qa-engineer** | C-12, C-13, A-7, B-15, B-16 | 5 tasks (verification gates) |
| **security-auditor** | A-8 | 1 task |
| **code-reviewer** | C-14 | 1 task (visual regression sign-off) |
| **tech-writer** | A-9 | 1 task |

**Gaps to flag:**
- **No UX designer in the agent set.** Slice C visual judgement (dark-mode "looks intentional", typography balance, motion feel) falls on Manu personally. The planner flags this so Stage 3 doesn't pretend it's covered by `qa-engineer`.

---

## Decisions for Architect (Stage 3)

These derive from planning and need answers before Slice B implementation:

1. **`pins_in_bbox_filtered` vs `pins_in_bbox`** — does the filtered version *replace* the old RPC, or live alongside? Recommendation: **live alongside, deprecate `pins_in_bbox` after B-14 ships**. Reason: zero-touch migration for any future consumer that doesn't know about districts.
2. **Trigger spec for `pin_count_cached`** — write out the exact pseudo-code for the AFTER INSERT / UPDATE / DELETE trigger, including: (a) is_hidden flip from false→true should decrement; (b) is_hidden flip true→false should increment; (c) district_id change should decrement old / increment new; (d) DELETE should decrement only if the row was non-hidden. Architect produces this before B-5 is scheduled.
3. **`pin_count_cached` initial computation** — does B-3 seed `pin_count_cached = 0` and let B-4's backfill UPDATE rely on B-5's triggers, or does B-3 seed using a SELECT? Recommendation: **B-3 seeds with the correct count via subquery** (avoid relying on B-5 triggers firing during B-4's backfill UPDATE which is a non-INSERT).
4. **`districts.bbox` storage** — PRD offers `geography(Polygon, 4326)` *or* four numeric columns. Recommendation: **geography polygon** (consistent with `boundary`, queryable with `ST_Envelope`).
5. **Lighthouse runner** — Dep-4: `lighthouse-ci` vs plain CLI? Recommendation: **plain CLI for now** (S0-2), upgrade to `lighthouse-ci` only when we have a CI pipeline.
6. **Tooltip primitive** — does B-12 use `@radix-ui/react-tooltip` (a new dep) or build on the existing Toast primitive? Recommendation: **add `react-tooltip`** (positions accurately near cursor; Toast is bottom-anchored and doesn't fit hover semantics). Adds ~3 KB gzipped — within the bundle budget.
7. **Slice A PKCE flow type** — confirm whether to switch `createClient` configuration globally or per-call for the reset flow. Recommendation: **global** (Supabase SSR docs assume PKCE for App Router anyway).
8. **Theme override storage key collision** — there's already a `graetzl:welcome-dismissed-v2` localStorage key. New key `graetzl:theme` is fine but document the convention `graetzl:<feature>` in the codebase.

---

## Next Steps

- [ ] Stage 3 (`solution-architect`): design Slice S0 + Slice C primitives + Slice B migrations. Answer the 8 architect decisions above.
- [ ] Stage 3 also produces the architecture sketch for the trigger function (B-5) before B-5 is scheduled.
- [ ] Once architect ships designs, frontend-developer + backend-developer + devops-engineer execute S0 in parallel.
- [ ] Manu personally: complete A-0 (Supabase dashboard) on day 1 of Slice A work — this is the only human-action gate.
- [ ] Manu personally: sign off on C-14 (visual regression) at end of Slice C.

---

**Total task count:** 6 (S0) + 14 (C) + 10 (A) + 16 (B) = **46 tasks**. No L-sized tasks; everything is S or M. Every task is a single PR or single migration.
