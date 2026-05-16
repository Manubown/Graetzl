# PRD: UI Redesign + Email/Password Auth + Polygon Map

**Status:** Draft
**Owner:** Manu (manubown@gmail.com)
**Date:** 2026-05-15
**Target window:** Phase 1.5 — between Week 3 (social/moderation, in-flight) and Week 4 (launch prep)
**Source documents:**
- `README.md`
- `graetzl-implementation-plan.md` (§5 GDPR, §6 Phase 1)
- `supabase/migrations/20260512000001_init_schema.sql` (especially `handle_new_user()` trigger)
- `supabase/migrations/20260512000002_rls_policies.sql`

---

## Context

Grätzl is three weeks into its 4-week MVP build. The current state (see commits `4dd37a0`, `acc5ee2`, `9e76dac`):

- Magic-link auth works end-to-end via `signInWithOtp` — but it's the *only* path in. Friction is starting to show in the dogfooding round (every login is one round-trip to the inbox). For a non-commercial, GDPR-strict consumer app where we're asking strangers to sign up, the friction-to-conversion math on magic-link-only is unfavourable.
- The map has clusters and individual pins, URL-driven category + language filters, long-press to drop. But it is **geographically anonymous** — there's no notion of "Bezirk" anywhere in the system, despite Bezirke being the unit Viennese people actually use to talk about their neighbourhood. The Phase 2 gamification design already references district-aware concepts; those are dead-ends without a districts model.
- The UI is a bespoke set of Tailwind-handwritten primitives. It works, but every new screen re-invents button states, focus rings, sheet behaviour, dark-mode handling. We've added `class-variance-authority` to `package.json` but never wired it. README claims "shadcn-style primitives" — currently aspirational, not delivered. As we approach launch, the cost of *not* having a primitive set is starting to compound.

The three slices in this PRD are independent enough to ship in parallel:
- **A** touches `src/app/sign-in/*`, `src/lib/auth/*`, one new route `/auth/reset-password`, one Supabase Auth configuration change. Zero schema change.
- **B** touches `supabase/migrations/`, `src/lib/districts/*` (new), `src/components/map/vienna-map.tsx` (layer adds), `src/components/map/filter-bar.tsx` (new section), `src/lib/pins/filters.ts` (new filter key).
- **C** touches `src/components/ui/*` (new + existing dialog), refactors `src/app/globals.css`, refactors 8 existing components to use the new primitives. Does not touch the map's MapLibre interactions.

The risk of conflicts is concentrated on `filter-bar.tsx` (B adds a district filter; C refactors its primitives). We address that in the Risks section.

---

## Problem Statements

### Slice A — Email/Password Authentication

Magic-link is the only sign-in path. It works, but it forces every signup and every return-visit through a mailbox round-trip — a meaningful tax on engagement for an app whose core loop ("drop a pin while standing on the spot") rewards low-latency authentication. For users on patchy mobile data (a real condition in Vienna's S-Bahn tunnels), the link sometimes arrives after the impulse has passed. We need a second path — email + password — that runs alongside magic-link without weakening the GDPR posture (no third-party identity providers, no extra tracking, EU-only).

### Slice B — Polygon Map (Vienna Bezirke)

The map shows pins, not places. A pin in Margareten and a pin in Floridsdorf look identical at zoom 12, and users have no way to scope their browsing to "show me only the 6th district." For locals — the primary persona — districts are the unit of identity ("Ich bin Wieden-Stamm"). For visitors, districts are the unit of orientation ("which Bezirk should I stay in?"). Phase 2 badges presuppose a districts model that doesn't exist yet. We need 23 polygons rendered subtly on the map, click-to-filter behaviour, and a districts table that pins are associated with at write time.

### Slice C — UI Redesign Foundation

We have eight components that each reinvent a Button, an Input, a Sheet, a Dialog. Dark mode is patchy — a few screens look right, others are washed out. Focus rings are inconsistent. Typography is `text-sm` / `text-base` / `text-lg` with no fluid scale; on a 4-inch phone the WelcomeCard wraps badly, on a 27" monitor everything looks miniature. There is no motion budget — transitions are added ad-hoc, with no respect for `prefers-reduced-motion`. We need a small, owned primitive set (Button, Input, Label, Card, Sheet, Dialog, Badge, Toast) on top of Radix for accessibility, refactor existing screens onto it, and codify spacing/typography/motion tokens — without redesigning the map interaction itself.

---

## Personas

| Persona | Description | Primary device | Job-to-be-done | Pain today |
|---|---|---|---|---|
| **Local curator** (primary) | Vienna resident, mid-20s to mid-40s, drops 1–10 pins/month about cafés, viewpoints, neighbourhood quirks. Pseudonymous. Returns 2–3×/week. | Phone (iOS/Android, mixed) | "Show off my Grätzl knowledge; find what other locals know." | Magic-link friction on quick visits; no way to filter by their own district; UI feels DIY in dark mode. |
| **Casual visitor** | Tourist or new-to-Vienna, drops zero or one pin, primarily reads. May not have an account at all. | Phone (predominantly iOS, on hotel wifi or roaming) | "Find places locals like, without the TripAdvisor noise. Orient myself by district." | Anonymous reads work fine — but when they do want to upvote/save, signup is one mailbox round-trip away. No districts to anchor a "stay in this Bezirk" decision. |
| **Admin / moderator** (i.e. Manu, plus 1–2 trusted seconds later) | Looks at `/admin`, hides bad pins, bans abusive users. Currently a single hardcoded UID. | Desktop (Chrome/Firefox) | "Triage reports quickly; never accidentally hide good content." | UI is functional but un-polished; no relation to the design system the public uses (yet). |

---

## User Stories & Acceptance Criteria

> Format: Given / When / Then. Each AC is a single checkbox; "and" splits into two ACs. ACs are testable by a human in dev without a special harness unless noted.

### Slice A — Email/Password Authentication

**US-A1.** As a local curator, I want to sign up with an email + password, so that I don't have to wait for a magic-link every time I want to log in.

**US-A2.** As a returning curator, I want to sign in with my password, so that I can authenticate without leaving the browser tab.

**US-A3.** As a curator who forgot my password, I want to reset it via an emailed link, so that I'm not locked out.

**US-A4.** As any curator, I want to keep using magic-link if I prefer it, so that the existing flow isn't taken away.

**US-A5.** As an admin, I want new password-signups to behave identically to magic-link-signups downstream (profile auto-created, default handle, RLS unchanged), so that downstream code doesn't branch on auth method.

#### Acceptance criteria — Slice A

**US-A1 (sign up):**
- [ ] A-AC1.1: The `/sign-in` page shows two tabs (or equivalent visually-distinct sections): "Magic-Link" (default, current behaviour) and "E-Mail + Passwort". Tab choice is announced to assistive tech via `role="tablist"` / `role="tab"`.
- [ ] A-AC1.2: The "E-Mail + Passwort" section shows an email input, a password input (with show/hide toggle), and a "Konto erstellen" / "Anmelden" segmented control to choose mode.
- [ ] A-AC1.3: On "Konto erstellen", the system calls `supabase.auth.signUp({ email, password, options: { emailRedirectTo: ... }})`. The user receives a confirmation email; the page shows "Bestätige deine E-Mail" copy.
- [ ] A-AC1.4: Passwords shorter than 10 characters are rejected client-side before the request goes out, with German error copy.
- [ ] A-AC1.5: Passwords are validated against Supabase's password strength requirements (we configure the project to **at least 10 chars + 1 uppercase + 1 lowercase + 1 number**, in dashboard `Authentication → Policies`). Server-side rejections surface as field-level errors, not toast.
- [ ] A-AC1.6: On successful signup confirmation (email link clicked → `/auth/callback`), the user lands on `/` authenticated. The existing `handle_new_user()` trigger has run; their profile row exists with the `wiener_<8hex>` default handle.
- [ ] A-AC1.7: If a user signs up with an email that already has a magic-link-only account, the system surfaces "Konto existiert bereits — setze ein Passwort über 'Passwort vergessen'." It does NOT silently overwrite.

**US-A2 (sign in):**
- [ ] A-AC2.1: In "Anmelden" mode, the system calls `supabase.auth.signInWithPassword`. On success, the user is redirected to the `next` URL param or `/`.
- [ ] A-AC2.2: Failed login (wrong password, unknown email) shows a single generic error: "E-Mail oder Passwort ist falsch." — never reveals whether the email exists (account enumeration defence).
- [ ] A-AC2.3: After **5 failed attempts from one client in 15 minutes**, the form disables the submit button for 60 seconds and shows "Bitte kurz warten." Counter is client-side (best-effort); the real rate-limit is enforced by Supabase Auth at the project level.
- [ ] A-AC2.4: The password input has `autocomplete="current-password"`; the email input has `autocomplete="email"`.

**US-A3 (password reset):**
- [ ] A-AC3.1: A "Passwort vergessen?" link is visible under the password input in "Anmelden" mode.
- [ ] A-AC3.2: Clicking it opens an inline flow (no separate page reload) that asks for the email and calls `supabase.auth.resetPasswordForEmail(email, { redirectTo: '<origin>/auth/reset-password' })`.
- [ ] A-AC3.3: The user always sees "Falls ein Konto mit dieser E-Mail existiert, haben wir eine Mail gesendet." — even if the email is unknown (account enumeration defence).
- [ ] A-AC3.4: A new route `/auth/reset-password` exists. It reads the recovery token (Supabase's `?code=...` / fragment hash flow), calls `supabase.auth.updateUser({ password: <new> })` and on success redirects to `/` with the user authenticated.
- [ ] A-AC3.5: The new-password form requires the same password strength as signup; mismatched confirmation is rejected client-side.
- [ ] A-AC3.6: Recovery links expire after the Supabase default (1 hour). Expired-link landing shows "Link ist abgelaufen. Fordere einen neuen an." with a back-to-sign-in link.

**US-A4 (magic-link preserved):**
- [ ] A-AC4.1: The existing magic-link form continues to work exactly as before for both new and existing users.
- [ ] A-AC4.2: A user who originally signed up via magic-link can later add a password by going through the "Passwort vergessen" flow (which is functionally identical to "set password" for accounts that have none).
- [ ] A-AC4.3: A user who signed up with password can request a magic-link to the same email and receive one.

**US-A5 (parity with magic-link):**
- [ ] A-AC5.1: A new signup via password triggers `public.handle_new_user()` exactly once; verified by query `select count(*) from profiles where id = '<new-user-uid>'` returning 1.
- [ ] A-AC5.2: No new columns are added to `profiles` for Slice A. No new RLS policy is added for Slice A.
- [ ] A-AC5.3: A password-authenticated user can read/write pins under the existing RLS policies without any code path branching on `auth.amr` or similar.
- [ ] A-AC5.4: The middleware (`src/middleware.ts`) does not need modification.
- [ ] A-AC5.5: Sign-out via the existing `signOut()` server action invalidates the session identically for both auth methods.

---

### Slice B — Polygon Map (Vienna Bezirke)

**US-B1.** As any user, I want to see Vienna's 23 districts outlined on the map, so that I can orient myself geographically.

**US-B2.** As a curator, I want to click a district to zoom and filter pins to that boundary, so that I can browse "what's good in Wieden" without panning.

**US-B3.** As a curator, I want to combine the district filter with category and language filters (already in the filter bar), so that I can ask "hidden gems in Neubau, in German" in one query.

**US-B4.** As an admin, I want every new pin to be associated with the district it was dropped in (server-side), so that Phase 2 district-aware badges have data to count.

**US-B5.** As any user, I want hover/tap on a district to show the district's name and the number of pins inside it, so that I can compare districts at a glance.

#### Acceptance criteria — Slice B

**US-B1 (render polygons):**
- [ ] B-AC1.1: A new MapLibre layer pair (`districts-fill` + `districts-line`) is added to `vienna-map.tsx`, sourced from a vector source loaded from a static endpoint (`/data/bezirke.geojson` or equivalent). Fill is `--accent` (Donau Türkis) at 4% opacity; line is `--accent` at 50% opacity, 1px.
- [ ] B-AC1.2: Polygons are visible at all zoom levels from 10 (min) to 19 (max). Line weight scales subtly: 0.5px at zoom 10–12, 1px at zoom 13–15, 1.5px at zoom 16+.
- [ ] B-AC1.3: Polygons sit below the pin layers (`clusters`, `pin-point`) in z-order, never obscuring markers.
- [ ] B-AC1.4: Initial paint of the district layer happens within **200ms of map-load** on a mid-tier mobile device (Moto G7 class, 4G). Measured by `performance.mark`/`measure` around the source-data event.
- [ ] B-AC1.5: The GeoJSON file is sourced from data.wien.gv.at (Bezirksgrenzen — official open data), simplified to ≤80 KB gzipped (≤300 KB raw) using `mapshaper` or equivalent during the build/seed step. Attribution to data.wien.gv.at is added to the map's attribution control.
- [ ] B-AC1.6: The simplified polygons must retain enough fidelity that a `ST_Contains` test on a pin at any street corner returns the same Bezirk as the official polygon. Verified by spot-checking 10 random Vienna street corners against the wien.gv.at "Mein Bezirk" finder.

**US-B2 (click to filter):**
- [ ] B-AC2.1: Clicking a district polygon (anywhere in its fill) sets the URL param `?bezirk=<1..23>` and triggers a `map.fitBounds` to that district's bbox with 40px padding.
- [ ] B-AC2.2: With `?bezirk=N` in the URL, the rendered pin set is filtered to pins whose `district_id = N` (see B-AC4.1). Filtering happens server-side via a new optional argument to `pins_in_bbox` or a sibling RPC.
- [ ] B-AC2.3: Clicking the same district again, or clicking outside any district, clears `?bezirk` from the URL. The map does not auto-zoom out — the user keeps their current zoom.
- [ ] B-AC2.4: Pin counts shown in the filter bar (see B-AC5.2) update within 300ms of district click.
- [ ] B-AC2.5: Keyboard-equivalent for click: the filter sheet (US-B3) includes a "Bezirk wählen" listbox that accepts arrow-key navigation and Enter to select.

**US-B3 (filter bar integration):**
- [ ] B-AC3.1: The filter sheet gets a new section above "Kategorie", labelled "Bezirk", containing a single-select (radio-like) list of "Alle" + the 23 Bezirke labelled with their official names (`1. Innere Stadt`, `2. Leopoldstadt`, ... `23. Liesing`).
- [ ] B-AC3.2: The collapsed filter trigger chip shows the selected Bezirk name when one is active. The "filter count" badge includes the Bezirk filter (existing logic adds 1 when language is set; same pattern).
- [ ] B-AC3.3: `parseFiltersFromParams` and `writeFiltersToParams` (`src/lib/pins/filters.ts`) gain a `bezirk: number | null` field. Invalid values (not in 1..23) are normalised to null.
- [ ] B-AC3.4: The "Zurücksetzen" button clears Bezirk along with category and language.
- [ ] B-AC3.5: Bezirk + category + language combine as AND. E.g. `?bezirk=6&cat=hidden_gem&lang=de` returns hidden-gem German pins inside Mariahilf only.

**US-B4 (server-side district association):**
- [ ] B-AC4.1: A new table `public.districts` exists with columns: `id smallint PK` (1..23), `name text not null`, `slug text unique not null` (e.g. `innere-stadt`, `leopoldstadt`), `boundary geography(Polygon, 4326) not null`, `centroid geography(Point, 4326) not null`, `bbox geography(Polygon, 4326) not null` (or four numeric columns), `pin_count_cached int not null default 0` (denormalised, refreshed by trigger or scheduled job — see B-AC4.6).
- [ ] B-AC4.2: A GIST index exists on `districts.boundary`.
- [ ] B-AC4.3: The `pins` table gets a new nullable column `district_id smallint references districts(id)`. Existing pins are backfilled via a one-off migration using `ST_Contains`. The migration leaves the column nullable so a future "extra-territorial" pin (e.g. an out-of-Vienna seed) doesn't break inserts.
- [ ] B-AC4.4: The `createPin` server action populates `district_id` at insert time by querying `select id from districts where ST_Contains(boundary::geometry, ST_SetSRID(ST_MakePoint($lng, $lat), 4326))`. If no district contains the point, `district_id` is left null and the insert still succeeds.
- [ ] B-AC4.5: RLS on `districts`: SELECT public (`using (true)`); no INSERT/UPDATE/DELETE policies (managed via migrations / service role only).
- [ ] B-AC4.6: A `pin_count_cached` value is maintained either by AFTER-INSERT/UPDATE/DELETE triggers on `pins` (preferred) or by a nightly refresh function. The choice is the solution-architect's call; the AC is: the count is no more than 60 seconds stale during normal write rates (< 1 pin/sec).
- [ ] B-AC4.7: A new RPC `pins_in_bbox_filtered(min_lng, min_lat, max_lng, max_lat, p_bezirk smallint default null, max_rows int default 500)` exists and inherits RLS via `security_invoker`. Specifying `p_bezirk` short-circuits the bbox check to pins inside the district's bbox AND with `district_id = p_bezirk`.

**US-B5 (hover/tap detail):**
- [ ] B-AC5.1: On desktop, hovering a district polygon shows a tooltip near the cursor: `<District name> · <N> Pins`. Tooltip uses the Toast/Tooltip primitive from Slice C if available, otherwise a minimal positioned `<div>`.
- [ ] B-AC5.2: On touch devices, a single tap (without long-press triggering pin-drop) on a district that is NOT currently selected shows a bottom-anchored persistent label for 2 seconds before treating the next tap as "select". A long-press on a district (existing 450ms gesture) still drops a pin at that coordinate.
- [ ] B-AC5.3: Pin counts are read from `districts.pin_count_cached`, not computed on hover. Counts in the filter sheet match counts in the hover tooltip.
- [ ] B-AC5.4: Districts with zero pins are still hoverable and show `<District name> · 0 Pins`. They are not visually de-emphasised.

---

### Slice C — UI Redesign Foundation

**US-C1.** As any user on any device, I want UI elements (buttons, inputs, cards, dialogs) to look and behave consistently across screens, so that I can predict what's clickable and what's not.

**US-C2.** As a keyboard-only user, I want every interactive element to be reachable and operable without a mouse, so that I can use the app without barriers.

**US-C3.** As a user with reduced-motion preferences, I want animations to respect my system setting, so that I don't get visual discomfort.

**US-C4.** As a user in dark mode, I want every screen to look intentional (not "accidental dark mode"), so that I can use the app comfortably at night.

**US-C5.** As a user on any viewport from 320px to 1440px+, I want type to scale fluidly without manual zoom, so that nothing is too small on phones or absurdly small on monitors.

**US-C6.** As a maintainer (Manu), I want a small primitive set so that new features don't reinvent buttons/inputs/sheets every time.

#### Acceptance criteria — Slice C

**US-C1 (consistency):**
- [ ] C-AC1.1: The following primitives exist in `src/components/ui/`: `button.tsx`, `input.tsx`, `label.tsx`, `card.tsx`, `sheet.tsx`, `dialog.tsx` (refactored), `badge.tsx`, `toast.tsx`. Each is a small, owned wrapper following the shadcn-style pattern (component + CVA variants + `cn`). No external shadcn install — we hand-write them on top of Radix.
- [ ] C-AC1.2: `Button` exposes variants: `default`, `primary` (Wiener Rot), `accent` (Donau Türkis), `ghost`, `outline`, `destructive`. Sizes: `sm`, `md` (default), `lg`, `icon`. Always renders a `<button>` unless `asChild` is passed (Radix `Slot`).
- [ ] C-AC1.3: `Input` and `Label` are paired by `htmlFor`/`id`; `Label` does not render its own `for` if `Input` is wrapped (`<Label><Input/></Label>`).
- [ ] C-AC1.4: `Card` is a 3-part composition: `Card`, `CardHeader` (with `CardTitle` + `CardDescription`), `CardContent`, `CardFooter`. Used by WelcomeCard, profile pages, pin detail.
- [ ] C-AC1.5: `Sheet` is the bottom-anchored mobile pattern (centred card on `≥sm`); replaces the inline sheet in `filter-bar.tsx`. Uses Radix `Dialog` primitive under the hood with `aria-label` and focus-trap.
- [ ] C-AC1.6: `Dialog` is refactored to use Radix `Dialog` (replacing the native `<dialog>` element). Existing call sites (`DropPinModal`, `PinDetailModal`, `ReportModal`, `ProfileEditModal`) compile against the new API with at most a 2-line change per site.
- [ ] C-AC1.7: `Badge` and `Toast` exist and are used by at least one call site each (`Badge` on profile pages for handle/level placeholder; `Toast` for "Pin gespeichert" / "Upvote zurückgenommen" feedback).
- [ ] C-AC1.8: Every primitive has a 1-paragraph JSDoc header describing intent and the variants/sizes, matching the comment style of `src/components/ui/dialog.tsx` today.

**US-C2 (a11y):**
- [ ] C-AC2.1: All primitives have visible focus indicators. Focus ring is a 2px outline at `--accent` with 2px offset on light mode, `--primary` on dark mode. Outlines respect `:focus-visible`, not `:focus`.
- [ ] C-AC2.2: Tab order is logical on `/`, `/sign-in`, `/pin/[id]`, `/me`, `/u/[handle]`, `/admin`. Verified by tabbing through with a screen reader off and reading the order aloud.
- [ ] C-AC2.3: All form inputs have associated `<Label>`. No placeholder-as-label anywhere.
- [ ] C-AC2.4: The site header, the filter bar, and all modals are operable with keyboard only (Enter to open, Tab to navigate, Escape to close, arrow keys to navigate listboxes).
- [ ] C-AC2.5: Lighthouse Accessibility score is **≥ 95** on `/`, `/sign-in`, and `/pin/[id]` in production build, measured on Chrome via `pnpm lighthouse` (added as a script).
- [ ] C-AC2.6: WCAG AA contrast: all text on `--background` measures ≥ 4.5:1 ratio in both light and dark mode. Verified per token in `globals.css` against the WCAG calculator. `--muted-foreground` on `--background` is the high-risk pair; lighten/darken if needed.
- [ ] C-AC2.7: Semantic HTML: `nav`, `main`, `header`, `footer`, `section` used per page. The site header's nav is a `<nav>` (currently is). Pin detail body uses `<article>`.

**US-C3 (motion):**
- [ ] C-AC3.1: A motion design token system exists: `--motion-fast` (120ms), `--motion-default` (200ms), `--motion-slow` (320ms), all `cubic-bezier(0.2, 0, 0, 1)` (Material "standard ease"). Defined in `globals.css`.
- [ ] C-AC3.2: All animated primitives (Sheet open/close, Dialog enter, Toast slide-in) use these tokens. No hardcoded `transition-all` or arbitrary durations remain in the refactored files.
- [ ] C-AC3.3: A `@media (prefers-reduced-motion: reduce)` rule globally collapses all transitions to ≤ 1ms. Verified on macOS System Settings → Accessibility → Display → Reduce Motion + Firefox `privacy.reducedMotion = 1`.
- [ ] C-AC3.4: No animation exceeds 320ms duration (motion budget). Verified by grepping the refactored components for `duration-` and the css file for `transition-duration`.

**US-C4 (dark mode):**
- [ ] C-AC4.1: Dark-mode pass: every existing screen (`/`, `/sign-in`, `/pin/[id]`, `/u/[handle]`, `/me`, `/admin`) is reviewed in dark mode. The acceptance bar is "looks intentional, no white flash, no unreadable text, no broken focus rings".
- [ ] C-AC4.2: The MapLibre attribution control's `rgba(255,255,255,0.7)` background is replaced with a token (`rgba(var(--background-rgb), 0.7)`) so it inverts correctly.
- [ ] C-AC4.3: Photo thumbnails in `PinCard` get a subtle border in dark mode so light-coloured photos don't bleed into the card. Border colour `--border`.
- [ ] C-AC4.4: Form inputs have a visible border in dark mode (the current `border-border` token may already pass; verify per screen).
- [ ] C-AC4.5: A user can manually override dark/light via a control in `/me` — value persisted in `localStorage('graetzl:theme')` and read on mount before paint to avoid a flash. (`prefers-color-scheme` remains the default if no override.) **Note:** this is the only net-new product surface in Slice C; everything else is refactor.

**US-C5 (fluid type):**
- [ ] C-AC5.1: A fluid type scale is defined in `globals.css` using `clamp()`. Tokens: `--font-size-xs` through `--font-size-3xl`, each `clamp(min, vw-based ideal, max)`. Concrete values:
  - `--font-size-xs: clamp(0.6875rem, 0.65rem + 0.2vw, 0.75rem)` /* 11–12px */
  - `--font-size-sm: clamp(0.8125rem, 0.78rem + 0.2vw, 0.875rem)` /* 13–14px */
  - `--font-size-base: clamp(0.9375rem, 0.91rem + 0.2vw, 1rem)` /* 15–16px */
  - `--font-size-lg: clamp(1.0625rem, 1rem + 0.4vw, 1.125rem)` /* 17–18px */
  - `--font-size-xl: clamp(1.1875rem, 1.1rem + 0.5vw, 1.25rem)` /* 19–20px */
  - `--font-size-2xl: clamp(1.375rem, 1.2rem + 1vw, 1.625rem)` /* 22–26px */
  - `--font-size-3xl: clamp(1.625rem, 1.4rem + 1.5vw, 2rem)` /* 26–32px */
- [ ] C-AC5.2: Tailwind's `text-xs` … `text-3xl` are remapped via `@theme inline` to use these tokens, so existing class usage automatically goes fluid.
- [ ] C-AC5.3: Spot-check on viewport widths 360, 768, 1280, 1920: `/`, `/sign-in`, `/pin/[id]` have no text smaller than 11px effective, no headers larger than 32px.

**US-C6 (8pt spacing & maintainability):**
- [ ] C-AC6.1: Tailwind's spacing scale (`1`, `1.5`, `2`, `2.5`, `3`, `4`, `5`, `6`, `8`, `10`, `12`, `16`) is the only spacing used in refactored components. No arbitrary `[12px]`-style values remain in the refactored files.
- [ ] C-AC6.2: The 8 refactored components compile and pass `pnpm typecheck` and `pnpm lint`:
  - `src/app/sign-in/sign-in-form.tsx` (uses Slice A's new dual-mode form, built on new primitives)
  - `src/components/site-header.tsx`
  - `src/components/welcome-card.tsx`
  - `src/components/map/filter-bar.tsx` (also touched by Slice B)
  - `src/components/map/drop-pin-modal.tsx`
  - `src/components/pin/pin-detail.tsx`
  - `src/components/profile/profile-edit-modal.tsx`
  - `src/app/me/page.tsx`
- [ ] C-AC6.3: No visual regression on any of the 8 components for a 5-pin map at viewports 360×640, 768×1024, 1440×900. Screenshots captured before/after and reviewed by Manu.
- [ ] C-AC6.4: Radix is added as a dependency (`@radix-ui/react-dialog`, `@radix-ui/react-tabs`, `@radix-ui/react-toast`, `@radix-ui/react-slot`, `@radix-ui/react-label` at minimum). Bundle size impact ≤ 30 KB gzipped on the `/` route, measured by `pnpm build`'s route-size report.

---

## Success Metrics

| Metric | Slice | Type | Target | Measurement |
|---|---|---|---|---|
| % of new signups choosing email+password over magic-link | A | leading | ≥ 40% within 30 days | Plausible custom event `auth_signup` with property `method=password|magiclink` |
| Time-to-first-pin (median, for new signups) | A | lagging | ≤ 90 seconds from page-load on `/sign-in` to first pin INSERT | DB query: `min(pins.created_at) - profiles.created_at` per user |
| Password-reset completion rate | A | leading | ≥ 70% of reset emails sent → completed (within 1 hour) | Custom event pair `auth_reset_requested` → `auth_reset_completed` |
| Failed sign-in rate (auth errors / total attempts) | A | guardrail | ≤ 8% | Custom event `auth_signin_failed` / `auth_signin_attempt` |
| Bezirk filter usage | B | leading | ≥ 30% of sessions touch the Bezirk filter within 30 days | Plausible event `filter_bezirk_set` |
| District-pin coverage | B | lagging | All 23 Bezirke have at least 1 pin within 60 days | `select count(distinct district_id) from pins where district_id is not null` |
| Polygon layer initial paint | B | guardrail | p95 ≤ 200ms on Moto G7 / 4G | `performance.measure` as custom event |
| District-click-then-pin-view conversion | B | lagging | ≥ 20% within session | Funnel `district_click` → `pin_view` |
| Lighthouse Accessibility score | C | leading | ≥ 95 on `/`, `/sign-in`, `/pin/[id]` | `pnpm lighthouse` in CI |
| Lighthouse Performance score (mobile) | C | guardrail | ≥ 85 on `/` | Same CI run |
| Dark-mode session share | C | lagging | No degradation within 30 days | Plausible `theme_resolved` with `light|dark` |
| Bundle size of `/` route | C | guardrail | ≤ current + 30 KB gzipped | `pnpm build` route-size report |
| Bounce rate on `/sign-in` | A+C | lagging | ≤ current - 15% within 30 days | Plausible Sessions view |

Notes:
- All metric events go through **Plausible (EU)**. Slice A and B add their custom events as part of their own implementation.
- No third-party analytics. No Mixpanel / Amplitude / GA.
- DB-side metrics run weekly by Manu via Supabase SQL editor.

---

## Constraints (NON-NEGOTIABLE)

- **Stay on Supabase.** No migration to Auth0 / Clerk / Firebase. Email/password is added on top of existing Supabase Auth.
- **GDPR posture preserved.** No third-party identity providers. No analytics beyond Plausible EU. No password manager autofill telemetry.
- **German-first UI, English second.** Every new user-facing string is German first.
- **No third-party tracking.** Including Bezirke — no Google Maps Geocoding; we use PostGIS `ST_Contains`.
- **Mobile-first.** Every component designed for ≤ 414px width first.
- **WCAG AA minimum.** Slice C targets ≥ 95 Lighthouse a11y; A and B inherit the same bar.
- **EU-only data residency.** All new data stays in Frankfurt Supabase project. Static GeoJSON served from Vercel EU edge.
- **EXIF still stripped.** Photo upload pipeline untouched.
- **Pin coordinate precision still ~100m for "approximate" mode.** District association uses the *snapped* coordinate.
- **No new authentication factors beyond email+password.** No SMS, TOTP, WebAuthn this slice.
- **Account deletion still anonymises.** Existing `author_id on delete set null` behaviour preserved.
- **No cookie banner.** Only essential auth cookies.

---

## Out of Scope

- Migrating off Supabase
- OAuth / social providers (Google, Apple, GitHub)
- SMS / TOTP / WebAuthn
- Email change flow
- Username/handle as login
- Zählbezirke / Grätzl polygons (Phase 2)
- Heatmap / choropleth pin density
- District-level pages (`/bezirk/wieden`)
- District-aware badges (data model lands here, badge logic Phase 2)
- Push notifications
- i18n beyond DE-first / EN-second
- Custom illustrated map style / Protomaps migration
- Cluster glyph labels (still blocked on font)
- Map style picker (light/dark tile switching)
- Account deletion UI (Week 4)
- Data export UI (Week 4)
- In-app messaging / comments / following users (Phase 2)
- Gamification (Phase 2)
- Paid / subscription features (never)
- Ads (never)

---

## Open Questions — RESOLVED 2026-05-15

1. **HIBP "Pwned Passwords" check — enable or not?** → **ENABLE.** The k-anonymity model leaks only a 5-char SHA-1 prefix; full password never transits. GDPR-defensible as a security measure. Document the choice in the privacy notes (README §GDPR + future privacy policy). Configure in Supabase Dashboard → Authentication → Policies → Password Strength → "Check passwords against HaveIBeenPwned database".

2. **District `pin_count_cached` — trigger-maintained or read-time COUNT(*)?** → **TRIGGERS on INSERT/UPDATE/DELETE.** Counts are always fresh, no scheduled job required. Architect to design idempotent triggers (handle is_hidden flips, district_id changes, deletes). Add a `refresh_district_pin_counts()` admin function as a manual rebuild safety net.

3. **District click → camera move on/off?** → **ZOOM ON CLICK** (PRD default). Fit to district's bbox with 40px padding. Un-selecting (clicking same district or outside any) does NOT auto-zoom out — user keeps their current zoom.

---

## Risks & Dependencies

### Slice A — Email/Password Auth

- **A-R1:** Account enumeration via signup. **Mitigation:** A-AC1.7 surfaces conflict only after auth or via reset flow. Verify Supabase's `signUp` returns generic confirmation.
- **A-R2:** Magic-link path silently breaks during refactor. **Mitigation:** Keep existing `SignInForm` intact, rename to `MagicLinkForm`, compose into tabbed parent. Playwright smoke on both paths.
- **A-R3:** Password reset uses URL fragment hash. **Mitigation:** Configure Supabase Auth `flowType: 'pkce'` to get `?code=` query param.
- **A-R4:** Client-side rate limit bypassable. **Mitigation:** Server-side rate limit at Supabase project level (30/min/IP).
- **A-R5:** Email collision between magic-link and password accounts. **Mitigation:** Test explicitly; expected behaviour is "set password via reset flow".

### Slice B — Polygon Map

- **B-R1:** GeoJSON simplification trade-off. **Mitigation:** Two-tier — full-fidelity in DB for `ST_Contains`, simplified for client render.
- **B-R2:** `vienna-map.tsx` already 300+ lines. **Mitigation:** Architect splits layers into `src/components/map/layers/districts-layer.ts` before implementation.
- **B-R3:** Slice C filter-bar refactor + Slice B district section collide. **Mitigation:** Sequence — C ships refactored filter-bar first (same surface, primitives), then B adds Bezirk section.
- **B-R4:** wien.gv.at GeoJSON may use Austria Lambert projection. **Mitigation:** Re-project with `ogr2ogr -t_srs EPSG:4326` in seed script.
- **B-R5:** `district_id` backfill locks `pins` table. **Mitigation:** One-off off-hours, `statement_timeout` set, table volume <200 pins.

### Slice C — UI Redesign Foundation

- **C-R1:** Radix bundle weight. **Mitigation:** Bundle size guardrail (≤ 30 KB delta on `/`). Named imports only.
- **C-R2:** Native `<dialog>` vs Radix `Dialog` focus-trap divergence, especially intercepting-route modal. **Mitigation:** Refactor `(.)pin/[id]/page.tsx` first in dedicated branch, confirm `router.back()` closes correctly.
- **C-R3:** Tailwind v4 `@theme inline` fluid type may not propagate. **Mitigation:** Sandbox first; fall back to per-component classes if needed.
- **C-R4:** localStorage theme read before paint risks FOUC. **Mitigation:** Inject blocking inline `<head>` script per Next.js docs.
- **C-R5:** Refactoring 8 components in parallel with Slices A and B = merge-conflict minefield. **Mitigation:** Slice C primitives land first (additive); component refactors land as small serialised PRs.

### Cross-slice dependencies

- **Dep-1:** Supabase dashboard `Authentication → URL Configuration` must whitelist `<url>/auth/reset-password`. **Owner: Manu, day 1 of Slice A.**
- **Dep-2:** Static GeoJSON hosting. **Default:** `public/data/bezirke.geojson` in Next.js repo.
- **Dep-3:** Plausible EU must land before/together with this PRD or success metrics are unmeasurable. **Flag for planner.**
- **Dep-4:** `pnpm lighthouse` script must be added (Slice C). Architect decides `lighthouse-ci` vs plain CLI.

---

## Next Steps

- [ ] Resolve Open Questions 1, 2, 3 with stakeholder (Manu).
- [ ] Hand off to `solution-architect` for all three slices.
- [ ] Hand off to `project-planner` with the explicit sequencing constraint above (Slice C primitives first, refactors interleave, filter-bar / sign-in-form touches land last).
- [ ] Hand off to `qa-engineer` once architecture lands.
- [ ] Hand off to `tech-writer` post-implementation: README stack table, "Authentication options" section, implementation-plan §6.

---

PRD complete.
