# Design: UI Redesign + Email/Password Auth + Polygon Map

**Source PRD:** `docs/prd/redesign-auth-map.md`
**Source Plan:** `docs/plans/redesign-auth-map.md`
**Date:** 2026-05-15
**Status:** Proposed (Stage 3 hand-off to implementers)

---

## Context & scope

This design covers the architecture for all three slices of the Phase 1.5 effort: email/password auth (Slice A), Vienna Bezirk polygons with server-side district association (Slice B), and a Radix-based UI primitive set with token refresh (Slice C). It is the smallest architecture that satisfies the PRD's acceptance criteria, the planner's task graph, and the three resolved Open Questions (HIBP on, triggers for `pin_count_cached`, zoom-on-click). It deliberately does **not** redesign: the OSM raster tile source, the long-press pin-drop gesture (`src/components/map/vienna-map.tsx:215â€“271`), the existing RLS policies on `pins`/`profiles`/`upvotes`/`saves`/`reports`, the `handle_new_user` trigger (`supabase/migrations/20260512000001_init_schema.sql:110â€“125`), or the photo-upload Sharp pipeline. Where this design defers a decision to the implementer, it is called out in "Open questions for Stage 4."

The codebase has no prior ADRs â€” `docs/design/` was created for this design. I recommend a future "architecture snapshot" ADR captures the existing decisions (raster OSM, magic-link auth, intercepting-route modal pattern, `security_invoker` RPC style) so subsequent designs have a baseline.

---

## Architect Decisions (answers to planner's 8 questions)

### 1. `pins_in_bbox_filtered` vs `pins_in_bbox` â€” co-exist with deprecation path

**Decision:** Ship `pins_in_bbox_filtered` as a **new RPC alongside** `pins_in_bbox`. Do not modify the existing function. After B-14 lands and the client switches over, mark `pins_in_bbox` with a `comment on function` deprecation note. Remove only after Phase 2 lands (we want the deprecation window to be at least 30 days for any unknown consumers, including manual SQL editor users).

**Rationale:** The planner's recommendation is correct. The existing function has a stable signature, is referenced by name in `src/lib/pins/fetch.ts`, and any rename or signature change is a breaking change for the SQL editor users (Manu, future moderators) who paste queries from memory. Adding a sibling is a single migration, costs nothing, and keeps rollback to "client reverts to old function call." See ADR-05.

### 2. Trigger spec for `pin_count_cached` â€” full pseudo-code in "Data model" section

**Decision:** A single trigger function `public.bump_district_pin_count()` fires on `pins` AFTER INSERT / AFTER UPDATE / AFTER DELETE. The function reads `OLD` and `NEW` and emits up to two arithmetic updates (decrement old, increment new) inside one statement to keep the work atomic. The full SQL is in "Data model & migrations" below. All four edge cases (hidden flip in both directions, `district_id` change, hard delete of non-hidden, hard delete of hidden as no-op) are handled by a single matrix of `was_visible` Ã— `is_visible` decisions on a per-district basis. See ADR-08 for why triggers rather than a scheduled refresh.

### 3. `pin_count_cached` initial computation â€” seed via subquery at seed time, not via backfill triggers

**Decision:** Migration `20260515000003_districts_seed.sql` (task B-3) seeds each district row with `pin_count_cached` computed at insert time via a correlated subquery against the existing pins. The B-4 backfill migration (which only sets `pins.district_id` on existing rows) then explicitly **disables the trigger** for its UPDATE window with `set local session_replication_role = 'replica'`, and re-runs `refresh_district_pin_counts()` at the end. This avoids any double-counting if a pin existed before its district row did, and it makes the trigger's UPDATE branch a no-op during backfill.

**Rationale:** The planner correctly identified that the trigger's UPDATE branch *would* fire during backfill (it's an UPDATE on `pins`). Without disabling it, every backfilled row would increment its new district by 1, then immediately the seeded count would already include that pin â€” double count. The session-replication trick is the postgres-canonical "I am a migration, please pretend triggers don't exist" pattern. See ADR-08.

### 4. `districts.bbox` storage â€” `geography(Polygon, 4326)`

**Decision:** Store `bbox` as `geography(Polygon, 4326)`, identical type to `boundary`. Compute it as `ST_Envelope(boundary::geometry)::geography` at seed time.

**Rationale:** Consistency with `boundary` (same indexing strategy works, same cast-to-geometry pattern), one column instead of four (cleaner select shape from `getDistricts()`), and PostGIS handles envelope intersection efficiently with GIST. The four-numeric-columns alternative was only attractive if we wanted to skip PostGIS for the bbox query â€” we don't, because the consumer (`pins_in_bbox_filtered`) is already in PostGIS-land.

### 5. Lighthouse runner â€” plain CLI in `package.json`

**Decision:** Plain `lighthouse` CLI as a `pnpm` script: `"lighthouse": "lighthouse http://localhost:3000 --output=json --output-path=./lighthouse.json --chrome-flags='--headless'"`. No `lighthouse-ci`. Manu runs it locally before each Slice A/B/C exit.

**Rationale:** There is no CI pipeline yet. `lighthouse-ci` is a server-side tool whose value comes from artifact storage, PR comments, and trend tracking â€” none of which we have. Adding it now is premature infra. When CI lands (post-launch), swap CLI for lighthouse-ci as a 1-task migration.

### 6. Tooltip primitive â€” `@radix-ui/react-tooltip`, new dep

**Decision:** Add `@radix-ui/react-tooltip` (â‰ˆ3 KB gzipped). Build `src/components/ui/tooltip.tsx` as a CVA-wrapped Radix tooltip. Use it for district hover labels on desktop. On touch devices, fall back to a custom bottom-anchored persistent label (the planner's B-AC5.2 spec) â€” Radix Tooltip is hover-only and doesn't fit the "tap once for info, tap again to select" pattern.

**Rationale:** Reusing Toast for hover labels would mean re-implementing positioning logic and conflating two semantically different surfaces (transient notification vs. persistent attached label). 3 KB on a â‰¤30 KB delta budget is acceptable. See ADR-01 and the "Component design" Tooltip entry below.

### 7. Slice A PKCE flow type â€” global configuration in both client init files

**Decision:** Set `flowType: 'pkce'` at the top-level options for both `createBrowserClient` (`src/lib/supabase/client.ts`) and `createServerClient` (`src/lib/supabase/server.ts`). This makes every Supabase auth call use PKCE â€” including the existing magic-link path, which transparently switches from hash-fragment to `?code=`. The existing `/auth/callback` route already handles `exchangeCodeForSession`, so no callback-route change is needed. See ADR-06.

**Rationale:** PKCE per-call doesn't exist in `@supabase/ssr` as a clean option; you'd have to instantiate a second client for the reset flow only, which is more code and more risk of inconsistency. Global PKCE is what the Supabase SSR docs recommend for App Router projects anyway. The transparent magic-link migration is a positive side effect â€” magic-link emails will hit `/auth/callback?code=...` instead of `/auth/callback#access_token=...`, which is more robust against email-client URL-fragment stripping.

### 8. Theme override storage key collision â€” namespace and document

**Decision:** Use `graetzl:theme` (values: `"light" | "dark" | "system"`). Document the prefix convention `graetzl:<feature>` in `src/lib/storage/keys.ts` (a new 10-line file enumerating all keys as constants). Existing keys are migrated to constants in the same PR (`graetzl:welcome-dismissed-v2`).

**Rationale:** The collision risk is real if we keep using stringly-typed keys scattered across components. A 1-file enum costs nothing now and prevents a class of bugs (typo'd key writes that never read back). The constant becomes the single source of truth for the inline-script that reads theme before paint (C-11).

---

## ADRs

### ADR-01: Radix-on-top-of-Tailwind primitive pattern (no shadcn install)

**Status:** Proposed
**Context:** PRD C-AC1.1 requires "shadcn-style primitives" without an external `shadcn` install. We need a primitive set (Button, Input, Label, Card, Sheet, Dialog, Badge, Toast, Tabs, Tooltip) that owns its code, supports CVA variants, and inherits Radix accessibility for interactive primitives.
**Decision:** Hand-write each primitive in `src/components/ui/<name>.tsx` following the shadcn convention: component + `cva` variants + `cn(...)` from `src/lib/utils.ts`. Interactive primitives (Dialog, Sheet, Tabs, Tooltip, Toast, Label) wrap a Radix primitive via named imports. Non-interactive primitives (Button, Card, Badge) are pure Tailwind + CVA â€” Button uses `@radix-ui/react-slot` for `asChild` semantics.
**Consequences:**
- No `shadcn-cli` dependency, no `components.json`, no codegen step. Plain TS files reviewed in PRs.
- Bundle is bounded by named Radix imports. Each new primitive adds 1â€“4 KB gzipped.
- Future contributors can grep the file directly to understand variants â€” no hidden codegen.
- We diverge from shadcn's exact API shape (we name `Button` not `button`, our Card variants are minimal). Acceptable cost; we never claimed shadcn API compatibility.
**Alternatives considered:**
- Install `shadcn-cli` and import its templates. Rejected: adds a dev tool that runs codegen against your repo, complicates review, and we don't need the upgrade path.
- Headless UI / Ariakit instead of Radix. Rejected: Radix is mainstream, well-documented, and already in the planner's S0-2 install list.
- Roll our own focus-trap / `aria-*` wiring. Rejected: maintenance burden for zero functional differentiation.

### ADR-02: Native `<dialog>` â†’ Radix Dialog migration path (intercepting-route safety)

**Status:** Proposed
**Context:** The existing `src/components/ui/dialog.tsx` (94 lines) uses the native `<dialog>` element via `showModal()`. The intercepting-route modal at `src/app/@modal/(.)pin/[id]/page.tsx` wraps `<PinDetail>` in a `<Dialog open onClose={() => router.back()}>` (`src/components/pin/pin-detail-modal.tsx:14â€“26`). Native `<dialog>` and Radix `Dialog` have divergent focus-trap and close-on-escape semantics. PRD C-R2 calls out this risk explicitly.
**Decision:** Refactor `dialog.tsx` to wrap `@radix-ui/react-dialog`. Preserve the exact existing prop shape (`{ open, onClose, children, title, className }`) by mapping internally: `onClose` becomes `onOpenChange(open => !open && onClose())`. The component continues to render its own close button and title bar inside `Dialog.Content` (we don't expose Radix's compound API at the call-site level for Slice C â€” that can come later if needed). The intercepting-route consumer (`pin-detail-modal.tsx`) requires **zero changes**: its `<Dialog open onClose={() => router.back()}>` call still compiles and still pops the history stack on backdrop click / Escape / close button.
**Consequences:**
- Single-PR refactor (task C-4). Test plan: open `/`, click a pin marker â†’ modal opens via intercepting route; click backdrop â†’ `router.back()` lands on `/` not on the deep-linked page; press Escape â†’ same; click close button â†’ same. Then open `/pin/<id>` directly â†’ full page renders, no modal.
- Focus-trap behaviour is now Radix's (which is closer to ARIA than native `<dialog>`'s).
- We retain the `title` prop and render it inside `Dialog.Title` (Radix requires a `Dialog.Title` for a11y; we satisfy it transparently).
- We lose the native `<dialog>::backdrop` pseudo-element. Replacement: `Dialog.Overlay` with `bg-black/40 backdrop-blur-sm` â€” pixel-equivalent.
**Alternatives considered:**
- Keep native `<dialog>` and not migrate. Rejected: PRD C-AC1.6 explicitly mandates Radix, and the focus-trap behaviour is inconsistent across browsers (Firefox's native `<dialog>` focus-trap was buggy until v122).
- Migrate to Radix and change the call-site API simultaneously. Rejected: doubles the diff at every call site, fights C-AC1.6 "at most 2-line change per site."

### ADR-03: Districts as a separate table with denormalised `pin_count_cached`

**Status:** Proposed
**Context:** B-AC4.1 requires a `districts` table; B-AC4.6 requires `pin_count_cached` that's fresh within 60s. Three alternatives: (a) compute counts at query time via `count(*)` join; (b) keep counts in a materialized view refreshed on schedule; (c) denormalise on the row with trigger-maintained invariant.
**Decision:** Option (c) â€” denormalised column maintained by triggers (see ADR-08). Districts live in their own table (`public.districts`), not as a view over pins, because boundaries need to be GIST-indexed and that requires real storage. Counts are denormalised to avoid the cost of a `count(*)` join on every hover (B-AC5.3 reads counts from this column).
**Consequences:**
- `getDistricts()` is a single fast SELECT (returns 23 rows with id, name, slug, bbox, pin_count_cached). No join.
- The trigger is the new code surface that must be tested for correctness (ADR-08 spec).
- Admin safety net `refresh_district_pin_counts()` is available to rebuild from scratch.
**Alternatives considered:**
- Materialized view refreshed every 60s. Rejected: needs a scheduled job (we don't have one), counts can be stale, refresh holds an ACCESS EXCLUSIVE lock briefly.
- Compute at query time. Rejected: every B-AC5.3 hover and every filter-bar render does a `count(*) â€¦ group by district_id` over the pin table. At 200 pins it's fine; at 5,000 (Phase 2 target) it's a measurable hot path; at 50,000 (multi-city) it's pathological.

### ADR-04: Two-tier GeoJSON â€” full-fidelity for `ST_Contains`, simplified for client render

**Status:** Proposed
**Context:** B-AC1.5 requires â‰¤80 KB gzipped (â‰¤300 KB raw) GeoJSON for the client. B-AC1.6 requires that the polygons retain enough fidelity that `ST_Contains` at any street corner returns the same Bezirk as the official polygon. These constraints conflict: simplification reduces fidelity.
**Decision:** Two artefacts from the same source download.
- **Full-fidelity** polygons stored in `districts.boundary` (column type `geography(Polygon, 4326)`). Used only by `ST_Contains` server-side in `createPin` (B-7) and by the backfill (B-4). Never sent to the client. Stored unsimplified â€” about 1.5 MB total across 23 polygons.
- **Simplified** polygons in `public/data/bezirke.geojson`. Served by Vercel EU edge as a static asset. Loaded by the client only for visual rendering. Target â‰¤80 KB gzipped via `mapshaper -simplify 8% keep-shapes`.
**Consequences:**
- Two pipeline steps in `docs/runbooks/bezirke-data-pipeline.md`. Documented in B-1.
- Visual polygons may not match `ST_Contains` exactly at zoom 19 (a pin near a district edge might render *just* outside its polygon by a few metres). Acceptable: the user cares which district their pin is *in*, not whether the rendered fill aligns to the metre.
- One source of truth for the seed: the full-fidelity GeoJSON checked in at `seed/districts-full.geojson` (gitignored from the build output, but committed for reproducibility â€” about 1.5 MB).
**Alternatives considered:**
- Ship only simplified polygons and use the simplified geometry for `ST_Contains`. Rejected: violates B-AC1.6.
- Ship only full-fidelity polygons. Rejected: violates B-AC1.5 (300 KB â†’ 1.5 MB blows the budget).

### ADR-05: `pins_in_bbox_filtered` as a NEW RPC alongside `pins_in_bbox` (deprecation path)

**Status:** Proposed
**Context:** See decision #1 above. We need a filtered RPC for district-aware fetching.
**Decision:** New RPC `public.pins_in_bbox_filtered(min_lng, min_lat, max_lng, max_lat, p_bezirk smallint default null, max_rows int default 500)`, signature documented in "Data model" below. Keep `pins_in_bbox` unchanged. After B-14, the client always calls `pins_in_bbox_filtered` (passing `p_bezirk = null` when no district filter is active). Mark `pins_in_bbox` with a deprecation comment; remove it in a follow-on migration â‰¥30 days later.
**Consequences:**
- Zero-touch for any out-of-band consumer (SQL editor scripts, future RLS-aware tooling).
- One additional function in the schema â€” negligible cost.
- B-14 is a 5-line client change, not a full migration.
**Alternatives considered:**
- Replace `pins_in_bbox` in-place (alter signature). Rejected: breaks any consumer that explicitly references the old name. See decision #1.
- Add `p_bezirk` as an OPTIONAL trailing argument to `pins_in_bbox`. Rejected: PostgREST does not handle optional-with-default arguments across overloads cleanly â€” the function selection becomes implicit, and callers would have to pass `null` explicitly anyway.

### ADR-06: PKCE flow type configured globally in `createBrowserClient` / `createServerClient`

**Status:** Proposed
**Context:** See decision #7 above. The password-reset flow needs `?code=` query-param semantics, which Supabase emits only when the client is configured with `flowType: 'pkce'`.
**Decision:** Add `auth: { flowType: 'pkce' }` to the options passed to both `createBrowserClient` (`src/lib/supabase/client.ts:11â€“16`) and `createServerClient` (`src/lib/supabase/server.ts:19â€“45`). This applies to every Supabase client instantiation in the app.
**Consequences:**
- Magic-link emails now produce `<origin>/auth/callback?code=<pkce-code>` URLs instead of `<origin>/auth/callback#access_token=...`. The existing `/auth/callback/route.ts` already handles the `?code=` path (Supabase SSR does this automatically), so no callback change is needed â€” verified by Manu manually in A-0.
- Password-reset emails produce `<origin>/auth/reset-password?code=<pkce-code>`. The new `/auth/reset-password` route reads `code` from the query string, calls `exchangeCodeForSession`, then `updateUser({ password })`.
- All existing tests of the magic-link path must still pass â€” flagged as a regression test point in A-7.
**Alternatives considered:**
- Configure PKCE only inside the reset-password route by instantiating a second client. Rejected: two Supabase client configs in one app is a footgun; the reset client wouldn't see the cookies from the global one.
- Stay on hash-fragment recovery flow. Rejected: more brittle (some email clients strip fragments), undocumented in current Supabase SSR App-Router examples.

### ADR-07: Plausible integration shape (no PII, named events, helpful types)

**Status:** Proposed
**Context:** Eight success metrics depend on Plausible events. The planner pulled Plausible forward to S0-1.
**Decision:** Create `src/lib/analytics/plausible.ts` exporting:
```ts
type EventName =
  | 'app_loaded'
  | 'auth_signup' | 'auth_signin_attempt' | 'auth_signin_failed'
  | 'auth_reset_requested' | 'auth_reset_completed'
  | 'filter_bezirk_set' | 'district_click'
  | 'polygon_layer_painted'
  | 'theme_resolved'
type PropsFor<E extends EventName> = /* discriminated record per event */
export function track<E extends EventName>(event: E, props?: PropsFor<E>): void
```
The script tag is added in `app/layout.tsx` via the `<script defer data-domain="â€¦" src="https://plausible.io/js/script.tagged-events.js" />` pattern; `track()` is a thin wrapper around `window.plausible(event, { props })`. **No PII in any property â€” no email, no user ID, no IP, no Bezirk that doubles as user location.** Event property values are always primitive enum strings (`method: 'password' | 'magiclink'`, `bezirk: number`, `theme: 'light' | 'dark'`, `duration_ms: number` clamped to 5000).
**Consequences:**
- Compile-time-checked event names and props. A misspelled event name fails `pnpm typecheck`.
- Single audit surface for GDPR review (one file).
- The `tagged-events.js` script also auto-fires `outbound_link` / `file_download` events; we accept these defaults â€” they're domain-event level, no PII.
**Alternatives considered:**
- Generic `window.plausible(...)` calls scattered through components. Rejected: typos compile silently, no central audit.
- Add a custom event dispatcher with our own queue. Rejected: over-engineering; Plausible's script is idempotent.

### ADR-08: Trigger-based `pin_count_cached` maintenance (vs scheduled refresh)

**Status:** Proposed
**Context:** Decision #2 (already settled) chose trigger maintenance. PRD B-AC4.6 caps staleness at 60 s. The trigger spec must handle four edge cases the planner flagged (hidden flip both directions, `district_id` change, hard delete, hidden-row delete as no-op).
**Decision:** A single function `public.bump_district_pin_count()` attached to `pins` via three triggers (AFTER INSERT, AFTER UPDATE, AFTER DELETE). The function computes `was_visible := (TG_OP <> 'INSERT' AND OLD.is_hidden = false)` and `is_visible := (TG_OP <> 'DELETE' AND NEW.is_hidden = false)`, then emits up to two arithmetic updates: `-1` on OLD.district_id when `was_visible`, `+1` on NEW.district_id when `is_visible`. NULL district_ids are skipped. The function is `security definer` so it can update `districts` regardless of RLS â€” but with `set search_path = public, pg_temp` and a strict `coalesce` shape to avoid TOCTOU risks. The full body is in "Data model" below. A `refresh_district_pin_counts()` admin function recomputes from scratch and is exempt from RLS.
**Consequences:**
- Counts are always fresh â€” no scheduled job, no staleness window.
- Adds ~200 Âµs to every pin write (single arithmetic update). Negligible at the planned write rate (<1 pin/sec).
- The trigger must be disabled during backfill (B-4) using `set local session_replication_role = 'replica'` â€” see decision #3.
- One function, one test surface. Unit-style integration test in B-5: insertâ†’updateâ†’hideâ†’unhideâ†’change-districtâ†’delete and assert count is 0 at the end.
**Alternatives considered:**
- Materialized view refreshed nightly. Rejected: staleness window exceeds B-AC4.6.
- Scheduled `pg_cron` job. Rejected: introduces a new operational surface (pg_cron extension, cron monitoring), and we don't operate it.
- Separate trigger per TG_OP with copy-pasted logic. Rejected: three places to forget to update the same matrix.

---

## Component design â€” Slice C primitives

All primitives live in `src/components/ui/`. Each file is a single export (the primitive plus its sub-components and variant types). All use `cn` from `src/lib/utils.ts` and `cva` from `class-variance-authority`. Each starts with a JSDoc header in the style of the existing `src/components/ui/dialog.tsx` (decision #C-AC1.8).

### Button â€” `src/components/ui/button.tsx`

- **Purpose:** All clickable actions in the app. Replaces the inline `<button>`s in site-header, welcome-card, filter-bar, etc.
- **Public API:**
  ```ts
  export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
    asChild?: boolean
  }
  export const Button: React.ForwardRefExoticComponent<ButtonProps>
  export const buttonVariants: (props?: { variant?: ...; size?: ... }) => string
  ```
- **Variants:** `default | primary | accent | ghost | outline | destructive` (per C-AC1.2). `primary` = Wiener Rot bg; `accent` = Donau TÃ¼rkis bg; `default` = foreground/background swap.
- **Sizes:** `sm | md (default) | lg | icon`.
- **ARIA / focus:** Inherits `<button>` defaults. `:focus-visible` ring uses `outline outline-2 outline-offset-2 outline-[--accent] dark:outline-[--primary]` (C-AC2.1).
- **Radix:** `@radix-ui/react-slot` only for `asChild`.
- **Sketch:**
  ```tsx
  import * as React from "react"
  import { Slot } from "@radix-ui/react-slot"
  import { cva, type VariantProps } from "class-variance-authority"
  import { cn } from "@/lib/utils"

  export const buttonVariants = cva(
    "inline-flex items-center justify-center gap-2 rounded-lg font-medium " +
    "transition-colors duration-[var(--motion-fast)] ease-[cubic-bezier(0.2,0,0,1)] " +
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 " +
    "focus-visible:outline-[var(--accent)] dark:focus-visible:outline-[var(--primary)] " +
    "disabled:opacity-50 disabled:pointer-events-none",
    {
      variants: {
        variant: {
          default: "bg-foreground text-background hover:opacity-90",
          primary: "bg-primary text-primary-foreground hover:opacity-90",
          accent: "bg-accent text-accent-foreground hover:opacity-90",
          ghost: "bg-transparent hover:bg-muted",
          outline: "border border-border bg-background hover:bg-muted",
          destructive: "bg-primary text-primary-foreground hover:opacity-90",
        },
        size: {
          sm: "h-8 px-3 text-xs",
          md: "h-10 px-4 text-sm",
          lg: "h-12 px-6 text-base",
          icon: "h-10 w-10 p-0",
        },
      },
      defaultVariants: { variant: "default", size: "md" },
    },
  )

  export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
      VariantProps<typeof buttonVariants> {
    asChild?: boolean
  }

  export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, asChild, ...props }, ref) => {
      const Comp = asChild ? Slot : "button"
      return <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
    },
  )
  Button.displayName = "Button"
  ```

### Input â€” `src/components/ui/input.tsx`

- **Purpose:** Single-line text input, used by sign-in forms and `<Label><Input/></Label>` compositions.
- **Public API:**
  ```ts
  export type InputProps = React.InputHTMLAttributes<HTMLInputElement>
  export const Input: React.ForwardRefExoticComponent<InputProps>
  ```
- **ARIA:** No `aria-` defaults; consumer pairs with `<Label htmlFor>`. Inherits native input semantics.
- **Sketch:**
  ```tsx
  export const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className, type, ...props }, ref) => (
      <input
        ref={ref}
        type={type}
        className={cn(
          "flex h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm",
          "ring-offset-background placeholder:text-muted-foreground",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
          "focus-visible:outline-[var(--accent)] dark:focus-visible:outline-[var(--primary)]",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      />
    ),
  )
  Input.displayName = "Input"
  ```

### Label â€” `src/components/ui/label.tsx`

- **Purpose:** Form labels. Wraps `@radix-ui/react-label` for "click label, focus input" without manual `htmlFor` plumbing.
- **Public API:**
  ```ts
  export type LabelProps = React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
  export const Label: React.ForwardRefExoticComponent<LabelProps>
  ```
- **Sketch:**
  ```tsx
  import * as LabelPrimitive from "@radix-ui/react-label"

  export const Label = React.forwardRef<
    React.ElementRef<typeof LabelPrimitive.Root>,
    LabelProps
  >(({ className, ...props }, ref) => (
    <LabelPrimitive.Root
      ref={ref}
      className={cn(
        "text-sm font-medium leading-none",
        "peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
        className,
      )}
      {...props}
    />
  ))
  Label.displayName = "Label"
  ```

### Card â€” `src/components/ui/card.tsx`

- **Purpose:** Container surface for grouped content. Replaces ad-hoc bordered divs in `welcome-card.tsx`, profile pages, pin detail.
- **Public API:** `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter` (composition, per C-AC1.4). All pure `<div>` / `<h3>` / `<p>` with class composition.
- **Sketch:**
  ```tsx
  export const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => (
      <div
        ref={ref}
        className={cn("rounded-2xl border border-border bg-background text-foreground shadow-sm", className)}
        {...props}
      />
    ),
  )
  Card.displayName = "Card"

  export const CardHeader = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => (
    <div className={cn("flex flex-col gap-1.5 p-5", className)} {...p} />
  )
  export const CardTitle = ({ className, ...p }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h3 className={cn("text-lg font-semibold leading-tight tracking-tight", className)} {...p} />
  )
  export const CardDescription = ({ className, ...p }: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p className={cn("text-sm text-muted-foreground", className)} {...p} />
  )
  export const CardContent = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => (
    <div className={cn("p-5 pt-0", className)} {...p} />
  )
  export const CardFooter = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => (
    <div className={cn("flex items-center p-5 pt-0", className)} {...p} />
  )
  ```

### Sheet â€” `src/components/ui/sheet.tsx`

- **Purpose:** Bottom-anchored mobile sheet (centred dialog on `â‰¥sm`). Replaces the inline sheet logic at `src/components/map/filter-bar.tsx:128â€“263` without changing the URL-param contract.
- **Public API:**
  ```ts
  export const Sheet: React.FC<{ open: boolean; onOpenChange: (open: boolean) => void; children: React.ReactNode }>
  export const SheetTrigger: typeof RadixDialog.Trigger
  export const SheetContent: React.FC<{ children: React.ReactNode; side?: 'bottom' /* default */; className?: string; 'aria-label': string }>
  export const SheetHeader: React.FC<...>
  export const SheetTitle: typeof RadixDialog.Title
  export const SheetDescription: typeof RadixDialog.Description
  export const SheetFooter: React.FC<...>
  ```
- **Variants:** Currently only `side="bottom"` (the mobile pattern). Future `side="left|right"` deferred.
- **ARIA / focus / keyboard:** Inherits Radix Dialog â€” Escape closes, focus trap, focus returns to trigger on close. `aria-label` required on `SheetContent`.
- **Radix:** `@radix-ui/react-dialog`.
- **How it replaces filter-bar logic:** `filter-bar.tsx` currently owns `open` state, a backdrop `<div>`, a positioned sheet `<div>`, and an Escape-key listener (`src/components/map/filter-bar.tsx:32â€“38`). After C-6, that all becomes:
  ```tsx
  // BEFORE (FilterBar function body, today)
  const [open, setOpen] = useState(false)
  useEffect(() => { /* Escape listener */ }, [open])
  // ...
  {open && <div className="fixed inset-0 ... backdrop" onClick={() => setOpen(false)} />}
  <FilterSheet open={open} onClose={() => setOpen(false)} ... />

  // AFTER (FilterBar after C-6)
  const [open, setOpen] = useState(false)
  return (
    <>
      {/* trigger row stays identical */}
      <button onClick={() => setOpen(true)}>...</button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent aria-label="Filter">
          <SheetHeader><SheetTitle>Filter</SheetTitle></SheetHeader>
          {/* category fieldset + language fieldset + (B-13) bezirk fieldset, same code */}
          <SheetFooter>
            <Button variant="ghost" onClick={clearAll}>ZurÃ¼cksetzen</Button>
            <Button onClick={() => setOpen(false)}>Fertig</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  )
  ```
  URL-param contract (`parseFiltersFromParams` / `writeFiltersToParams` at `src/lib/pins/filters.ts`) is untouched. The `<FilterSheet>` inner component disappears â€” its body folds into `SheetContent`'s children.
- **Sketch:**
  ```tsx
  import * as RadixDialog from "@radix-ui/react-dialog"
  export const Sheet = RadixDialog.Root
  export const SheetTrigger = RadixDialog.Trigger
  export const SheetTitle = RadixDialog.Title
  export const SheetDescription = RadixDialog.Description

  export function SheetContent({ children, className, ...props }: SheetContentProps) {
    return (
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out duration-[var(--motion-default)]" />
        <RadixDialog.Content
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-md rounded-t-2xl border border-border bg-background shadow-2xl",
            "sm:bottom-auto sm:left-1/2 sm:top-20 sm:-translate-x-1/2 sm:rounded-2xl sm:max-w-md",
            "data-[state=open]:animate-in data-[state=closed]:animate-out duration-[var(--motion-default)]",
            "data-[state=open]:slide-in-from-bottom-full data-[state=closed]:slide-out-to-bottom-full",
            "sm:data-[state=open]:slide-in-from-bottom-2 sm:data-[state=closed]:slide-out-to-bottom-2",
            className,
          )}
          {...props}
        >
          {children}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    )
  }
  export const SheetHeader = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => (
    <div className={cn("flex items-center justify-between border-b border-border px-5 py-3", className)} {...p} />
  )
  export const SheetFooter = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => (
    <div className={cn("flex items-center justify-between gap-2 border-t border-border px-5 py-3", className)} {...p} />
  )
  ```

### Dialog â€” `src/components/ui/dialog.tsx` (refactor)

- **Purpose:** Modal dialog. Refactor of the existing 94-line native-`<dialog>` wrapper.
- **Public API (preserved):**
  ```ts
  interface DialogProps {
    open: boolean
    onClose: () => void
    children?: React.ReactNode
    title: string
    className?: string
  }
  export function Dialog(props: DialogProps): JSX.Element
  ```
- **Radix:** `@radix-ui/react-dialog`.
- **Migration path â€” intercepting-route modal (`src/app/@modal/(.)pin/[id]/page.tsx`)**:
  - **Files that change in C-4:** only `src/components/ui/dialog.tsx`.
  - **Files that stay byte-identical:** `src/app/@modal/(.)pin/[id]/page.tsx`, `src/components/pin/pin-detail-modal.tsx`, `src/components/map/drop-pin-modal.tsx`, `src/components/admin/report-modal.tsx`, `src/components/profile/profile-edit-modal.tsx`.
  - **Why `router.back()` still works:** Radix Dialog's `onOpenChange` fires when the user presses Escape, clicks the overlay, or clicks any element with `data-dismiss` (we add this to the close button). We translate `onOpenChange(open) â†’ !open && onClose()` inside the wrapper. `onClose` is `() => router.back()` at the call site. Behaviour: backdrop click â†’ `onOpenChange(false)` â†’ wrapper calls `onClose` â†’ `router.back()` pops the intercepting route â†’ the underlying `/` page is shown.
  - **Why the title prop still works:** Radix requires a `Dialog.Title` for a11y. The wrapper renders one inside `Dialog.Content` using the `title` prop. We do NOT expose `Dialog.Title` at the call-site level in Slice C.
- **Before/after of the wrapper file:**

  **Before** (`src/components/ui/dialog.tsx:1â€“94`, today):
  ```tsx
  "use client"
  import { useEffect, useRef } from "react"
  import { cn } from "@/lib/utils"

  interface DialogProps { open: boolean; onClose: () => void; children?: React.ReactNode; title: string; className?: string }

  export function Dialog({ open, onClose, children, title, className }: DialogProps) {
    const ref = useRef<HTMLDialogElement | null>(null)
    useEffect(() => {
      const el = ref.current
      if (!el) return
      if (open && !el.open) el.showModal()
      if (!open && el.open) el.close()
    }, [open])
    useEffect(() => {
      const el = ref.current
      if (!el) return
      const onCancel = (e: Event) => { e.preventDefault(); onClose() }
      el.addEventListener("cancel", onCancel)
      return () => el.removeEventListener("cancel", onCancel)
    }, [onClose])
    return (
      <dialog
        ref={ref}
        onClick={(e) => { if (e.target === ref.current) onClose() }}
        className={cn("fixed inset-0 m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-border bg-background p-0 text-foreground shadow-2xl backdrop:bg-black/40 backdrop:backdrop-blur-sm", className)}
        aria-labelledby="dialog-title"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 id="dialog-title" className="text-base font-semibold tracking-tight">{title}</h2>
          <button type="button" onClick={onClose} aria-label="SchlieÃŸen" className="rounded-md p-1 ...">
            <svg ...>...</svg>
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </dialog>
    )
  }
  ```

  **After** (`src/components/ui/dialog.tsx`, post-C-4):
  ```tsx
  "use client"
  import * as RadixDialog from "@radix-ui/react-dialog"
  import { X } from "lucide-react"
  import { cn } from "@/lib/utils"

  interface DialogProps { open: boolean; onClose: () => void; children?: React.ReactNode; title: string; className?: string }

  /**
   * Modal dialog wrapping Radix Dialog. API is preserved from the legacy
   * native-`<dialog>` implementation: pass `open` + `onClose`, and the
   * component renders its own title bar and close button.
   *
   * Used by DropPinModal, PinDetailModal (intercepting route), ReportModal,
   * ProfileEditModal. Backdrop click, Escape, and the X button all trigger
   * `onClose` â€” for the intercepting route, that's `() => router.back()`.
   */
  export function Dialog({ open, onClose, children, title, className }: DialogProps) {
    return (
      <RadixDialog.Root open={open} onOpenChange={(o) => { if (!o) onClose() }}>
        <RadixDialog.Portal>
          <RadixDialog.Overlay
            className={cn(
              "fixed inset-0 z-40 bg-black/40 backdrop-blur-sm",
              "data-[state=open]:animate-in data-[state=closed]:animate-out",
              "duration-[var(--motion-default)]",
            )}
          />
          <RadixDialog.Content
            className={cn(
              "fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2",
              "w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-border bg-background p-0 text-foreground shadow-2xl",
              "data-[state=open]:animate-in data-[state=closed]:animate-out",
              "duration-[var(--motion-default)]",
              className,
            )}
            aria-labelledby="dialog-title"
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <RadixDialog.Title id="dialog-title" className="text-base font-semibold tracking-tight">
                {title}
              </RadixDialog.Title>
              <RadixDialog.Close asChild>
                <button type="button" aria-label="SchlieÃŸen" className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </RadixDialog.Close>
            </div>
            <div className="px-5 py-4">{children}</div>
          </RadixDialog.Content>
        </RadixDialog.Portal>
      </RadixDialog.Root>
    )
  }
  ```
- **What changes elsewhere as a result of C-4:** nothing in the call-site contract. C-7 then refactors `drop-pin-modal.tsx`, `report-modal.tsx`, `profile-edit-modal.tsx` only to ensure they don't rely on any incidental DOM behaviour of `<dialog>` (e.g. CSS targeting `dialog[open]`, which a grep shows none of them do).

### Badge â€” `src/components/ui/badge.tsx`

- **Purpose:** Inline status / count / handle pill. Used on profile pages, filter active-count, and as the level placeholder in Phase 2.
- **Public API:**
  ```ts
  export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}
  export const Badge: React.FC<BadgeProps>
  ```
- **Variants:** `default | secondary | outline | accent` (4 max).
- **Sketch:**
  ```tsx
  export const badgeVariants = cva(
    "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
    {
      variants: {
        variant: {
          default: "bg-foreground text-background",
          secondary: "bg-muted text-foreground",
          outline: "border border-border text-foreground",
          accent: "bg-accent text-accent-foreground",
        },
      },
      defaultVariants: { variant: "default" },
    },
  )
  export function Badge({ className, variant, ...props }: BadgeProps) {
    return <span className={cn(badgeVariants({ variant }), className)} {...props} />
  }
  ```

### Toast â€” `src/components/ui/toast.tsx`

- **Purpose:** Transient feedback ("Pin gespeichert", "Upvote zurÃ¼ckgenommen", "Eintrag wurde gelÃ¶scht").
- **Public API:** Re-export the standard Radix Toast pattern plus a `<Toaster />` provider and a `useToast()` hook:
  ```ts
  export const ToastProvider, ToastViewport, Toast, ToastTitle, ToastDescription, ToastClose, ToastAction
  export function useToast(): { toast: (opts: { title: string; description?: string; variant?: 'default'|'destructive' }) => void }
  ```
- **Mounting:** A single `<Toaster />` is mounted in `app/layout.tsx`. `useToast` writes to a module-level store; `<Toaster />` subscribes.
- **ARIA:** Inherited from Radix Toast (`role="status"` / `aria-live="polite"`).
- **Sketch (omitted â€” Radix Toast has a well-known pattern; the implementer copies the Radix docs example and replaces colors with our tokens. ~80 lines total).**

### Tabs â€” `src/components/ui/tabs.tsx`

- **Purpose:** Sign-in page tabs (Magic-Link / Email+Password) â€” primary consumer. Future use anywhere with sibling alternatives.
- **Public API:**
  ```ts
  export const Tabs, TabsList, TabsTrigger, TabsContent /* all from @radix-ui/react-tabs, styled */
  ```
- **ARIA:** Inherits Radix Tabs â€” `role="tablist"`, `role="tab"`, `role="tabpanel"`, arrow-key navigation. Satisfies A-AC1.1.
- **Sketch:**
  ```tsx
  import * as TabsPrimitive from "@radix-ui/react-tabs"
  export const Tabs = TabsPrimitive.Root
  export const TabsList = React.forwardRef<
    React.ElementRef<typeof TabsPrimitive.List>,
    React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
  >(({ className, ...p }, ref) => (
    <TabsPrimitive.List
      ref={ref}
      className={cn("inline-flex h-10 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground", className)}
      {...p}
    />
  ))
  export const TabsTrigger = React.forwardRef<
    React.ElementRef<typeof TabsPrimitive.Trigger>,
    React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
  >(({ className, ...p }, ref) => (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium",
        "transition-all duration-[var(--motion-fast)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]",
        "data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
        className,
      )}
      {...p}
    />
  ))
  export const TabsContent = React.forwardRef<
    React.ElementRef<typeof TabsPrimitive.Content>,
    React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
  >(({ className, ...p }, ref) => (
    <TabsPrimitive.Content ref={ref} className={cn("mt-4 focus-visible:outline-none", className)} {...p} />
  ))
  ```

### Tooltip â€” `src/components/ui/tooltip.tsx`

- **Purpose:** Desktop hover tooltip for district labels (B-AC5.1) and future "what does this icon mean?" affordances.
- **Public API:** `Tooltip`, `TooltipTrigger`, `TooltipContent`, `TooltipProvider` (re-exports from `@radix-ui/react-tooltip`).
- **Radix:** `@radix-ui/react-tooltip` (added per decision #6).
- **ARIA:** Inherits Radix Tooltip â€” hidden on touch devices automatically.
- **Sketch:**
  ```tsx
  import * as TooltipPrimitive from "@radix-ui/react-tooltip"
  export const TooltipProvider = TooltipPrimitive.Provider
  export const Tooltip = TooltipPrimitive.Root
  export const TooltipTrigger = TooltipPrimitive.Trigger
  export const TooltipContent = React.forwardRef<
    React.ElementRef<typeof TooltipPrimitive.Content>,
    React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
  >(({ className, sideOffset = 4, ...p }, ref) => (
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 overflow-hidden rounded-md border border-border bg-background px-2.5 py-1 text-xs text-foreground shadow-md",
        "data-[state=delayed-open]:animate-in data-[state=closed]:animate-out duration-[var(--motion-fast)]",
        className,
      )}
      {...p}
    />
  ))
  ```

  Note: the MapLibre map is a `<canvas>`; we cannot directly attach a Radix Tooltip to a feature. The map integration (B-12) computes the hovered district id from a `mousemove` handler, then renders a positioned `<TooltipContent>` separately (anchored to cursor coordinates via `style={{ left, top }}`). The Radix primitive is only used for the visual + focus container; we drive the open state imperatively.

---

## Data model & migrations â€” Slice B

The migration sequence below uses the `20260515` date prefix, matching the planner's task IDs. Each is a single file under `supabase/migrations/`.

### Migration `20260515000001_districts_table.sql` (task S0-4 stub â†’ B-3 full seed)

**S0-4** lands the table shape + RLS + a stub Innere Stadt row. **B-3** is a separate migration `20260515000003_districts_seed.sql` that UPSERTs all 23 districts with real data.

```sql
-- =====================================================================
-- GrÃ¤tzl â€” districts table (Phase 1.5, Slice B)
-- Holds Vienna's 23 Bezirke with both rendering and ST_Contains data.
--
-- Two-tier GeoJSON pipeline (see ADR-04):
--   â€¢ boundary: full-fidelity polygon, used by ST_Contains in createPin
--   â€¢ simplified rendering polygons live in public/data/bezirke.geojson
-- =====================================================================

create table if not exists public.districts (
  id              smallint primary key check (id between 1 and 23),
  name            text not null,
  slug            text not null unique,
  boundary        geography(Polygon, 4326) not null,
  centroid        geography(Point, 4326) not null,
  bbox            geography(Polygon, 4326) not null,
  pin_count_cached integer not null default 0 check (pin_count_cached >= 0),
  created_at      timestamptz not null default now()
);

comment on table public.districts is
  'Vienna Bezirke (1..23). boundary = full-fidelity polygon for ST_Contains. Rendering uses a separate simplified GeoJSON.';
comment on column public.districts.pin_count_cached is
  'Denormalised count of non-hidden pins inside this district. Maintained by trigger on public.pins. Use refresh_district_pin_counts() to rebuild.';

create index if not exists districts_boundary_gix on public.districts using gist (boundary);
create index if not exists districts_bbox_gix     on public.districts using gist (bbox);

alter table public.districts enable row level security;

drop policy if exists "districts_select_public" on public.districts;
create policy "districts_select_public"
  on public.districts for select
  using (true);

-- No insert/update/delete policies â†’ only service_role (migrations) can write.
```

### Migration `20260515000002_pins_district_fk.sql` (task B-2)

```sql
-- Add nullable district_id FK to pins. Backfilled in 20260515000004.
alter table public.pins
  add column if not exists district_id smallint references public.districts(id);

comment on column public.pins.district_id is
  'Bezirk this pin falls into, computed at insert via ST_Contains. Nullable for out-of-Vienna pins.';

-- No new index on district_id yet â€” pin table is <200 rows, filter via
-- pins_in_bbox_filtered uses bbox + district_id; a future btree index
-- on (district_id, is_hidden) can be added if read-pattern justifies it.
```

### Migration `20260515000003_districts_seed.sql` (task B-3)

Full 23-row INSERT. Polygon WKT is read from `seed/districts-full.geojson` and emitted at seed time. Skeleton (the implementer fills the WKT/centroid/bbox from the seed pipeline output):

```sql
-- Seed all 23 Vienna districts. Idempotent (UPSERT on id).
-- Source: data.wien.gv.at "Bezirksgrenzen", projected to EPSG:4326.

insert into public.districts (id, name, slug, boundary, centroid, bbox, pin_count_cached)
values
  (1,  'Innere Stadt',    'innere-stadt',
       ST_GeogFromText('SRID=4326;POLYGON((...))'),
       ST_GeogFromText('SRID=4326;POINT(16.3691 48.2092)'),
       ST_GeogFromText('SRID=4326;POLYGON((...))'),
       (select count(*) from public.pins p
        where p.is_hidden = false
          and ST_Contains(
                (select boundary::geometry from public.districts d where d.id = 1),
                p.location::geometry))),
  (2,  'Leopoldstadt',    'leopoldstadt',  ..., ..., ..., 0),
  (3,  'LandstraÃŸe',      'landstrasse',   ..., ..., ..., 0),
  ...
  (23, 'Liesing',         'liesing',       ..., ..., ..., 0)
on conflict (id) do update
  set name             = excluded.name,
      slug             = excluded.slug,
      boundary         = excluded.boundary,
      centroid         = excluded.centroid,
      bbox             = excluded.bbox,
      pin_count_cached = excluded.pin_count_cached;
```

**Implementation note:** The `pin_count_cached` subquery on the first row would be slow if it ran on every row. Practical pattern: insert all 23 rows with `pin_count_cached = 0`, then run `select public.refresh_district_pin_counts()` at the end of the migration. Cleaner SQL.

### Migration `20260515000004_pins_district_backfill.sql` (task B-4)

```sql
-- Backfill pins.district_id from current pins.location.
-- Disables triggers to prevent double-counting pin_count_cached.
-- Re-runs refresh_district_pin_counts() at the end.

begin;
set local statement_timeout = '60s';
set local session_replication_role = 'replica';  -- disables user triggers

update public.pins p
   set district_id = d.id
  from public.districts d
 where p.district_id is null
   and ST_Contains(d.boundary::geometry, p.location::geometry);

-- Verification: how many pins remain unmatched?
do $$
declare
  unmatched int;
begin
  select count(*) into unmatched from public.pins where district_id is null;
  raise notice 'pins without district_id after backfill: %', unmatched;
end $$;

set local session_replication_role = 'origin';
select public.refresh_district_pin_counts();
commit;
```

### Migration `20260515000005_pin_count_triggers.sql` (task B-5) â€” FULL SPEC

This is the load-bearing file. The function handles all four edge cases the planner flagged.

```sql
-- =====================================================================
-- GrÃ¤tzl â€” pin_count_cached maintenance (Phase 1.5, Slice B, ADR-08)
--
-- Visibility matrix:
--   was_visible := (TG_OP <> 'INSERT' AND OLD.is_hidden = false)
--   is_visible  := (TG_OP <> 'DELETE' AND NEW.is_hidden = false)
--
-- Edge cases (all handled below by the same matrix):
--   (1) INSERT visible pin                  â†’ +1 on NEW.district_id
--   (2) INSERT hidden pin                   â†’ no-op
--   (3) UPDATE hiddenâ†’visible               â†’ +1 on NEW.district_id (was_visible=false)
--   (4) UPDATE visibleâ†’hidden               â†’ -1 on OLD.district_id (is_visible=false)
--   (5) UPDATE district_id change, visible  â†’ -1 OLD.district_id, +1 NEW.district_id
--   (6) UPDATE district_id change, hiddenâ†’hidden â†’ no-op
--   (7) UPDATE district_id change, hiddenâ†’visible â†’ +1 NEW.district_id
--   (8) UPDATE district_id change, visibleâ†’hidden â†’ -1 OLD.district_id
--   (9) DELETE visible                      â†’ -1 on OLD.district_id
--  (10) DELETE hidden                       â†’ no-op
--  (11) author_id â†’ null on user deletion: triggered as UPDATE (not DELETE),
--       district_id is unchanged, is_hidden unchanged â†’ no-op (correct).
-- =====================================================================

create or replace function public.bump_district_pin_count()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  was_visible boolean := (TG_OP <> 'INSERT' AND OLD.is_hidden = false);
  is_visible  boolean := (TG_OP <> 'DELETE' AND NEW.is_hidden = false);
  old_district smallint := case when TG_OP <> 'INSERT' then OLD.district_id else null end;
  new_district smallint := case when TG_OP <> 'DELETE' then NEW.district_id else null end;
begin
  -- Decrement the previous district if the pin used to count toward it.
  if was_visible
     and old_district is not null
     and (not is_visible or old_district is distinct from new_district)
  then
    update public.districts
       set pin_count_cached = greatest(0, pin_count_cached - 1)
     where id = old_district;
  end if;

  -- Increment the new district if the pin now counts toward it.
  if is_visible
     and new_district is not null
     and (not was_visible or old_district is distinct from new_district)
  then
    update public.districts
       set pin_count_cached = pin_count_cached + 1
     where id = new_district;
  end if;

  return coalesce(NEW, OLD);
end $$;

comment on function public.bump_district_pin_count is
  'Maintains districts.pin_count_cached. See ADR-08 for the visibility matrix. Use refresh_district_pin_counts() if drift is suspected.';

-- Three triggers, one function. AFTER so OLD/NEW reflect committed values.
drop trigger if exists pins_bump_count_ins on public.pins;
create trigger pins_bump_count_ins
  after insert on public.pins
  for each row execute function public.bump_district_pin_count();

drop trigger if exists pins_bump_count_upd on public.pins;
create trigger pins_bump_count_upd
  after update of district_id, is_hidden on public.pins
  for each row
  when (OLD.district_id is distinct from NEW.district_id
        or OLD.is_hidden is distinct from NEW.is_hidden)
  execute function public.bump_district_pin_count();

drop trigger if exists pins_bump_count_del on public.pins;
create trigger pins_bump_count_del
  after delete on public.pins
  for each row execute function public.bump_district_pin_count();

-- =====================================================================
-- Admin safety net: rebuild pin_count_cached from scratch.
-- Idempotent. Holds a brief lock on districts; runs in milliseconds.
-- =====================================================================
create or replace function public.refresh_district_pin_counts()
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  with counts as (
    select district_id, count(*)::int as n
      from public.pins
     where is_hidden = false
       and district_id is not null
     group by district_id
  )
  update public.districts d
     set pin_count_cached = coalesce(c.n, 0)
    from (select id from public.districts) ids
    left join counts c on c.district_id = ids.id
   where d.id = ids.id;
$$;

comment on function public.refresh_district_pin_counts is
  'Rebuilds districts.pin_count_cached from scratch. Operationally Manu runs this weekly via Supabase SQL editor.';

-- Lock down execute on refresh_district_pin_counts to service_role.
revoke execute on function public.refresh_district_pin_counts() from public;
revoke execute on function public.refresh_district_pin_counts() from anon;
revoke execute on function public.refresh_district_pin_counts() from authenticated;
```

**Trigger-spec verification plan** (handed to qa-engineer for B-5):

```sql
-- Each step asserts the count delta. Reset between scenarios.
-- Setup: pins table empty, all districts pin_count_cached = 0.

-- 1. Insert visible pin in district 6 â†’ 6.pin_count_cached = 1.
insert into pins (..., district_id, is_hidden) values (..., 6, false);
-- assert: districts where id=6 â†’ 1

-- 2. Hide it â†’ 6.pin_count_cached = 0.
update pins set is_hidden = true where ...;
-- assert: 0

-- 3. Unhide it â†’ 1.
update pins set is_hidden = false where ...;
-- assert: 1

-- 4. Move to district 7 â†’ 6: 0, 7: 1.
update pins set district_id = 7 where ...;
-- assert: 6=0, 7=1

-- 5. Delete it â†’ 7: 0.
delete from pins where ...;
-- assert: 7=0

-- 6. Author deletion (set author_id null) on visible pin â†’ no change.
-- (Already covered by `when (OLD.district_id is distinct from NEW.district_id ...)` guard.)
```

### Migration `20260515000006_pins_in_bbox_filtered.sql` (task B-6) â€” full RPC

```sql
-- =====================================================================
-- GrÃ¤tzl â€” pins_in_bbox_filtered (Phase 1.5, Slice B, ADR-05)
--
-- Drop-in superset of pins_in_bbox; adds optional p_bezirk filter.
-- Lives alongside pins_in_bbox (which is deprecated by this migration,
-- to be removed after Phase 2 client cutover).
-- =====================================================================

create or replace function public.pins_in_bbox_filtered(
  min_lng   double precision,
  min_lat   double precision,
  max_lng   double precision,
  max_lat   double precision,
  p_bezirk  smallint default null,
  max_rows  integer  default 500
)
returns setof public.pins_with_coords
language sql
stable
security invoker        -- RLS from pins_with_coords (which inherits pins) applies
as $$
  select v.*
    from public.pins_with_coords v
   where v.is_hidden = false
     and v.lng between min_lng and max_lng
     and v.lat between min_lat and max_lat
     and (p_bezirk is null
          or exists (
            select 1 from public.pins p
             where p.id = v.id
               and p.district_id = p_bezirk
          ))
   order by v.created_at desc
   limit greatest(1, least(coalesce(max_rows, 500), 2000));
$$;

comment on function public.pins_in_bbox_filtered is
  'Returns non-hidden pins inside bbox, optionally restricted to district p_bezirk. RLS via security_invoker on pins_with_coords. Capped at 2000 rows.';

-- Deprecate the predecessor. Keep the function callable; document the path forward.
comment on function public.pins_in_bbox(double precision, double precision, double precision, double precision, integer) is
  'DEPRECATED 2026-05. Use public.pins_in_bbox_filtered(min_lng,min_lat,max_lng,max_lat,p_bezirk:=null,max_rows). Will be dropped in Phase 2.';
```

**RLS guarantees explained:** `security invoker` means the function executes with the *caller's* permissions, so any RLS policy on `pins` and `profiles` (read via the `pins_with_coords` view's `security_invoker`) applies. A pin with `is_hidden = true` is filtered both by the explicit `where v.is_hidden = false` clause AND by the underlying `pins_select_visible` RLS policy (`supabase/migrations/20260512000002_rls_policies.sql:36â€“39`) â€” defence in depth. The `exists` subquery against `public.pins` inherits the same RLS, so an unauthenticated caller cannot read a hidden pin's `district_id` to deduce its existence.

### Deprecation note for `pins_in_bbox`

After B-14 ships and the client always calls `pins_in_bbox_filtered`, mark `pins_in_bbox` deprecated in two places: (1) the function's COMMENT (done above in the same migration); (2) `supabase/README.md` should grow a section "Deprecated RPCs" listing this function and its successor. Remove the function entirely in a follow-on migration â‰¥30 days after B-14 lands. No data migration needed; it's a function drop.

---

## Map architecture â€” Slice B

### File map (after S0-3 split)

`src/components/map/vienna-map.tsx` is **316 lines** today (verified by `wc -l`). After S0-3, it shrinks to ~140 lines (orchestration only), with three new files under `src/components/map/layers/`:

```
src/components/map/
â”œâ”€â”€ vienna-map.tsx                  ~140 lines (orchestrator; init map, wire layers, own callbacks)
â”œâ”€â”€ map-shell.tsx                   unchanged
â”œâ”€â”€ filter-bar.tsx                  unchanged in S0-3; refactored in C-6; Bezirk section added in B-13
â”œâ”€â”€ drop-pin-modal.tsx              unchanged
â””â”€â”€ layers/
    â”œâ”€â”€ style.ts                    ~50 lines (OSM_STYLE constant, VIENNA_CENTER, DEFAULT_ZOOM, etc.)
    â”œâ”€â”€ pins-layer.ts               ~110 lines (attachPinsLayer + cluster/symbol setup + click handlers)
    â””â”€â”€ districts-layer.ts          ~130 lines (attachDistrictsLayer + fill/line layers + hover/click)
```

Total post-split â‰ˆ 430 lines across 4 files, vs 316 today; the gain is bounded scope per file. `wc -l` confirms `filter-bar.tsx` at **289 lines**; that file changes scope (Slice C refactor + Slice B Bezirk section) but is sequenced (C-6 â†’ B-13) so the diffs never overlap.

### Layer order spec (bottom to top z-order)

```
[bottom]
  osm-tiles                  -- raster basemap (existing)
  districts-fill             -- NEW, B-10: 4% --accent fill
  districts-line             -- NEW, B-10: 50% --accent line, zoom-stepped weight
  clusters                   -- existing
  cluster-count              -- (still no labels; no font glyphs yet)
  pin-point                  -- existing
[top]
```

The districts layers are inserted with `map.addLayer(layerSpec, 'clusters')` â€” the second argument is the `beforeId`, forcing them below clusters. This is the canonical MapLibre pattern; verified by reading the MapLibre type definitions (`addLayer(layer, before?: string)`).

### Function signatures

```ts
// src/components/map/layers/style.ts
export const VIENNA_CENTER: [number, number]
export const DEFAULT_ZOOM: number
export const MAX_BOUNDS: maplibregl.LngLatBoundsLike
export const OSM_STYLE: maplibregl.StyleSpecification

// src/components/map/layers/pins-layer.ts
export const PINS_SOURCE_ID: string
export interface AttachPinsLayerOpts {
  onClusterClick?: (clusterId: number, coords: [number, number]) => void
  onPinClick?: (pinId: string) => void
}
export function attachPinsLayer(map: maplibregl.Map, opts?: AttachPinsLayerOpts): void
export function setPins(map: maplibregl.Map, pins: Pin[]): void

// src/components/map/layers/districts-layer.ts
export interface AttachDistrictsLayerOpts {
  geojsonUrl: string                // '/data/bezirke.geojson'
  onDistrictClick?: (districtId: number, bbox: [number, number, number, number]) => void
  onDistrictHover?: (districtId: number | null, point?: { x: number; y: number }) => void
  onPaintComplete?: (durationMs: number) => void  // for performance.mark + Plausible
}
export function attachDistrictsLayer(map: maplibregl.Map, opts: AttachDistrictsLayerOpts): void
export function setSelectedDistrict(map: maplibregl.Map, districtId: number | null): void
```

### Where the handlers live

- **Click handlers on the `districts-fill` layer** live inside `districts-layer.ts` (it owns layer-specific MapLibre listeners). The handler emits an `onDistrictClick(districtId, bbox)` callback that `vienna-map.tsx` passes in. `vienna-map.tsx` then translates that into URL writes (`router.replace(...?bezirk=<id>)`) and `map.fitBounds(bbox, { padding: 40 })` â€” the URL is the single source of truth (consistent with the existing filter pattern at `src/lib/pins/filters.ts:1â€“86`).
- **Hover handlers** also live in `districts-layer.ts`, with debouncing (50 ms) to avoid jitter. `vienna-map.tsx` receives the hover events and updates a separate React state used by the `<TooltipContent>` overlay (see Tooltip primitive note above).
- **Long-press handler** stays in `vienna-map.tsx` (`src/components/map/vienna-map.tsx:215â€“271`) â€” it's not layer-specific; it listens to map-wide gestures.
- **Hover/select coordination on touch devices** (B-AC5.2 "single tap shows label for 2s, second tap selects"): the touch state machine lives in `vienna-map.tsx` and reads from `districts-layer.ts` via the `onDistrictHover` callback that fires on `touchstart`. A 2-second timer + a "last-touched-district" ref decide whether the next tap is a label-show or a select.

### Performance instrumentation

Inserted at three points:

1. **Inside `attachDistrictsLayer`** â€” `performance.mark('districts-source-add-start')` immediately before `map.addSource(...)`, and `performance.mark('districts-source-loaded')` inside the `map.once('sourcedata', ...)` callback (gated on `e.sourceId === 'districts' && e.isSourceLoaded`). Then `performance.measure('districts-paint', 'districts-source-add-start', 'districts-source-loaded')` produces a `PerformanceMeasure`, whose `.duration` is passed to `opts.onPaintComplete(durationMs)`.

2. **`vienna-map.tsx`** receives `onPaintComplete(durationMs)` and calls `track('polygon_layer_painted', { duration_ms: Math.min(5000, Math.round(durationMs)) })` from `src/lib/analytics/plausible.ts`. Capped at 5000 to avoid extreme outliers skewing the Plausible histogram.

3. **District click**: `vienna-map.tsx`'s `onDistrictClick` handler calls `track('district_click', { bezirk: districtId })`. If this is the first time the user has set a Bezirk filter in this session (read from a `sessionStorage` flag), also fire `track('filter_bezirk_set', { bezirk: districtId })`. (Implementation in B-11.)

### Pin-fetch wiring (task B-14)

`src/lib/pins/fetch.ts` (already exists; not shown in this design but referenced by the intercepting route) gains a `fetchPinsInBboxFiltered(min, max, p_bezirk?)` function calling the new RPC. The map's pin loader switches from `pins_in_bbox` to `pins_in_bbox_filtered` unconditionally, passing `p_bezirk = bezirk` or `null`. ADR-05 deprecation path proceeds from there.

---

## GeoJSON pipeline â€” Slice B

### Source

Vienna Open Data â€” Bezirksgrenzen: `https://data.wien.gv.at/daten/geo?service=WFS&request=GetFeature&version=1.1.0&typeName=ogdwien:BEZIRKSGRENZEOGD&srsName=EPSG:31256&outputFormat=json`

This is the WFS GetFeature endpoint for the `BEZIRKSGRENZEOGD` layer in Austria's MGI / Lambert (EPSG:31256). It can also be downloaded as a one-shot file from the data.wien.gv.at catalogue page; the WFS URL is canonical and reproducible. **Path lookup if the URL changes:** open https://www.data.gv.at/katalog/dataset/stadt-wien_bezirksgrenzenwien and find the GeoJSON service. Document the URL and the access date in `docs/runbooks/bezirke-data-pipeline.md`.

### Pipeline â€” exact commands

These run from the repo root. They assume `ogr2ogr` (GDAL) and `mapshaper` (Node) are installed locally. On Windows-PowerShell, the same commands work via WSL or Git Bash; on macOS/Linux they run natively.

```bash
# 0. Prep: create working dir
mkdir -p tmp/bezirke
cd tmp/bezirke

# 1. Download in Austrian Lambert (EPSG:31256).
curl -sSL -o bezirke-31256.geojson \
  'https://data.wien.gv.at/daten/geo?service=WFS&request=GetFeature&version=1.1.0&typeName=ogdwien:BEZIRKSGRENZEOGD&srsName=EPSG:31256&outputFormat=json'

# 2. Re-project to EPSG:4326 (WGS84 lng/lat) so MapLibre and PostGIS agree.
ogr2ogr -f GeoJSON -t_srs EPSG:4326 bezirke-4326.geojson bezirke-31256.geojson

# 3a. Full-fidelity copy for the DB seed â€” copy verbatim, just rename for clarity.
#     This is what districts.boundary will hold.
cp bezirke-4326.geojson ../../seed/districts-full.geojson

# 3b. Simplified copy for the client.
#     -simplify 8%   : Visvalingam, retain 8% of vertices (â‰ˆ85% reduction)
#     keep-shapes    : never collapse a polygon to nothing (every Bezirk must survive)
#     precision      : 5 decimal places â‰ˆ 1.1m at Vienna's latitude â€” well within visual tolerance
#     -o format=geojson : explicit output format
mapshaper bezirke-4326.geojson \
  -simplify 8% keep-shapes \
  -o precision=0.00001 format=geojson \
     ../../public/data/bezirke.geojson

# 4. Verify gzipped size â‰¤ 80 KB (B-AC1.5).
gzip -c ../../public/data/bezirke.geojson | wc -c
# Expected output: a number â‰¤ 81920 (80 * 1024).
# If the number is over budget, drop -simplify to 6% and re-run from step 3b.

# 5. Verify all 23 districts survived.
jq '.features | length' ../../public/data/bezirke.geojson
# Expected: 23
jq '.features | length' ../../seed/districts-full.geojson
# Expected: 23
```

### On-disk layout

- `public/data/bezirke.geojson` â€” simplified, â‰¤80 KB gzipped, served from Vercel EU edge. Mounted on the map as a GeoJSON source by `attachDistrictsLayer`. Committed to git.
- `seed/districts-full.geojson` â€” full-fidelity, ~1.5 MB raw. Not served; used only by the seed migration `20260515000003_districts_seed.sql` to populate `districts.boundary`. Committed to git for reproducibility of the seed.

Both files commit. The intermediate `tmp/bezirke/` directory is git-ignored (`tmp/` is in `.gitignore`; if not, add it).

### Spot-check protocol (B-AC1.6, B-16)

The qa-engineer (B-16) compares the spatial-correctness of `ST_Contains` against wien.gv.at's "Mein Bezirk" finder (https://www.wien.gv.at/buergerinfo/bezirksvorstehung/index.html â€” enter address, get back the district). Pick 10 coordinate pairs spread across the city: 5 known landmarks plus 5 random street corners.

| # | Landmark / corner | Lng | Lat | Expected Bezirk |
|---|-------------------|-----|-----|-----------------|
| 1 | Stephansplatz (cathedral) | 16.3725 | 48.2086 | 1 (Innere Stadt) |
| 2 | Naschmarkt entrance Karlsplatz | 16.3650 | 48.2008 | 6 (Mariahilf) â€” at boundary with 4 |
| 3 | Prater Hauptallee Ã— Stadion-Allee | 16.4127 | 48.2104 | 2 (Leopoldstadt) |
| 4 | SchÃ¶nbrunn main entrance | 16.3119 | 48.1854 | 13 (Hietzing) â€” at boundary with 12 |
| 5 | Donauinsel, ReichsbrÃ¼cke midpoint | 16.4099 | 48.2348 | 22 (Donaustadt) at most longitudes; 2 at most westerly stretch |
| 6 | Mariahilfer StraÃŸe Ã— Andreasgasse | 16.3499 | 48.1979 | 7 (Neubau) |
| 7 | Heiligenstadt U4 exit | 16.3633 | 48.2511 | 19 (DÃ¶bling) |
| 8 | Hauptbahnhof main entrance | 16.3760 | 48.1855 | 10 (Favoriten) â€” close to 4 |
| 9 | BrigittabrÃ¼cke south end | 16.3725 | 48.2298 | 9 (Alsergrund) â€” at boundary with 20 |
| 10 | Liesing S-Bahn stop | 16.2880 | 48.1390 | 23 (Liesing) |

The qa-engineer runs `select id from districts where ST_Contains(boundary::geometry, ST_SetSRID(ST_MakePoint(<lng>,<lat>),4326));` for each row. Any mismatch â†’ re-run the pipeline with `-simplify 10%` (less aggressive) and recheck. Boundary cases (rows 2, 4, 5, 8, 9) are deliberately near edges; tolerance is "matches the wien.gv.at finder's answer."

### Attribution

`attachDistrictsLayer` appends a string to the MapLibre attribution control on init: `"Bezirksgrenzen: <a href='https://data.wien.gv.at'>Stadt Wien â€” data.wien.gv.at</a> (CC BY 4.0)"`. The map's existing `attributionControl: { compact: true }` (`src/components/map/vienna-map.tsx:97`) supports custom strings via `map.addControl(new maplibregl.AttributionControl({ customAttribution: 'â€¦' }))` â€” but since we already have the OSM attribution baked into the style, the cleaner pattern is to call `map.getMap().setStyle(...)` with attribution updated, or to use `attributionControl.options`. **Implementation pattern** (B-10):

```ts
// inside attachDistrictsLayer, right after map.addSource
const attrib = map._controls?.find((c: any) => c instanceof maplibregl.AttributionControl)
// Or simpler: pass customAttribution at map init in style.ts:
// attributionControl: { compact: true, customAttribution: 'Bezirksgrenzen: â€¦' }
```

The cleaner answer: move the `attributionControl` option from `vienna-map.tsx` into `style.ts` (S0-3) and bake the wien.gv.at credit into `customAttribution` from the start.

---

## Auth architecture â€” Slice A

### Supabase Auth client configuration changes (decision #7, ADR-06)

**File:** `src/lib/supabase/client.ts:11â€“16` (current state):
```ts
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
```

**After A-0 + S0-1 land** (PKCE config):
```ts
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { flowType: 'pkce' } },
  )
}
```

**File:** `src/lib/supabase/server.ts:19â€“45` â€” add the same `auth: { flowType: 'pkce' }` block to the third options argument of `createServerClient`.

The dashboard-side configuration (A-0) is documented in `docs/runbooks/supabase-auth-config.md`:
1. Authentication â†’ Providers â†’ Email â†’ enable "Confirm email" (required for signup).
2. Authentication â†’ Policies â†’ Password Strength â†’ set "minimum 10 characters", "at least one uppercase", "at least one lowercase", "at least one number", "check against HaveIBeenPwned: ON" (decision #1).
3. Authentication â†’ URL Configuration â†’ Site URL set per environment; Redirect URLs include `<origin>/auth/callback`, `<origin>/auth/reset-password`, and `https://*.vercel.app/auth/callback`, `https://*.vercel.app/auth/reset-password` for preview deploys.
4. Authentication â†’ Rate Limits â†’ confirm default `30 / minute / IP` (no change; already the project default).

### Sign-in tabs UI tree

After A-1 + A-2 + A-3 + A-5:

```
<SignInPage>                                  app/sign-in/page.tsx (server component, unchanged)
  <Card>
    <CardHeader>
      <CardTitle>Anmelden</CardTitle>
    </CardHeader>
    <CardContent>
      <SignInTabs />                          app/sign-in/sign-in-form.tsx â€” refactored in S0-6
        <Tabs defaultValue="magiclink">
          <TabsList>
            <TabsTrigger value="magiclink">Magic-Link</TabsTrigger>
            <TabsTrigger value="password">E-Mail + Passwort</TabsTrigger>
          </TabsList>
          <TabsContent value="magiclink">
            <MagicLinkForm />                 app/sign-in/magic-link-form.tsx â€” extracted in A-1
          </TabsContent>
          <TabsContent value="password">
            <PasswordForm />                  app/sign-in/password-form.tsx â€” new in A-2
              <Tabs defaultValue="signin">    -- inner tabs for "Konto erstellen" / "Anmelden"
                ...
              </Tabs>
              {forgotPasswordOpen && (
                <ResetPasswordPanel />        -- inline panel; rendered when "Passwort vergessen?" clicked
              )}
          </TabsContent>
        </Tabs>
    </CardContent>
  </Card>
</SignInPage>
```

`SignInTabs` (the file renamed from `sign-in-form.tsx`) is a thin Tabs container. The inner `<Tabs defaultValue="signin">` inside `PasswordForm` is a secondary segmented control (radix Tabs styled as pills) for signin/signup mode within the password tab â€” per A-AC1.2.

### Server vs client component split for `/auth/reset-password`

The route has a server entry that handles redirect/error states without rendering interactive UI when possible, and a client sub-component for the form.

```
src/app/auth/reset-password/
â”œâ”€â”€ page.tsx                       server component (default)
â”‚   â”œâ”€â”€ reads searchParams (code, error)
â”‚   â”œâ”€â”€ if error â†’ render <ResetPasswordError /> (server, static copy)
â”‚   â”œâ”€â”€ else â†’ render <ResetPasswordForm code={code} /> (client component)
â””â”€â”€ reset-password-form.tsx        client component ("use client")
    â”œâ”€â”€ controlled form with new + confirm password inputs
    â”œâ”€â”€ on submit: client supabase.auth.exchangeCodeForSession(code)
    â”‚              then supabase.auth.updateUser({ password })
    â”‚              then router.push('/')
    â””â”€â”€ on error: shows German error copy (mapping table below)
```

Why this split: the server component renders the static "expired link" / "missing code" copy without shipping JS for those branches. The form itself must be client-side because `supabase.auth.updateUser` is browser-side (the user is being signed in by the recovery code, the resulting session is set in cookies via the SSR client, but `updateUser` itself is a fetch call that's easier from the browser).

### Error code â†’ user message mapping

This table lives at `src/app/sign-in/error-messages.ts` (a new file, owned by A-3). The implementer uses it from `password-form.tsx` and `reset-password-form.tsx`. All messages are German-first per the PRD constraint.

| Supabase error (string match in `.message` or `.code`) | Surface | German user-facing message |
|---|---|---|
| `User already registered` | Inline field error on email | "Konto existiert bereits â€” setze ein Passwort Ã¼ber 'Passwort vergessen'." |
| `Email rate limit exceeded` | Toast | "Zu viele Versuche. Bitte in einer Minute erneut probieren." |
| `Invalid login credentials` | Inline form error (NOT field-level â€” enumeration defence) | "E-Mail oder Passwort ist falsch." |
| `Email not confirmed` | Inline form error | "Bitte zuerst die E-Mail bestÃ¤tigen. Mail nicht angekommen? Erneut anfordern." |
| `Password should be at least 10 characters` | Inline field on password | "Passwort muss mindestens 10 Zeichen lang sein." |
| `password_compromised` (HIBP) | Inline field on password | "Dieses Passwort ist in einem bekannten Datenleck enthalten. Bitte ein anderes wÃ¤hlen." |
| `password_too_weak` (missing class) | Inline field on password | "Passwort braucht GroÃŸ-/Kleinbuchstaben und Zahl." |
| `Token expired` / `Code expired` (reset flow) | Page-level for reset route | "Link ist abgelaufen. Fordere einen neuen an." + back-to-sign-in link |
| `Token invalid` (reset flow) | Page-level | "Link ist ungÃ¼ltig. Fordere einen neuen an." |
| `same_password` (updateUser equal to existing) | Inline | "Neues Passwort darf nicht dem alten entsprechen." |
| All others | Toast (fallback) | "Etwas lief schief. Bitte spÃ¤ter erneut probieren." |

The string-matching approach is brittle if Supabase changes error messages. Implementer (A-3): build the mapping as a function `mapAuthError(err: AuthError): { kind: 'field'|'form'|'toast'; field?: 'email'|'password'; message: string }` so the call site doesn't repeat the logic, and unit-test it against the exact strings Supabase returns today (capture them during A-3 development).

### Plausible event schema (decision per ADR-07)

| Event name | Properties | Where fired |
|---|---|---|
| `app_loaded` | (none) | `app/layout.tsx` on mount (client component); S0-1 |
| `auth_signup` | `method: 'password' \| 'magiclink'` | After successful `signUp` / `signInWithOtp` from sign-in form; A-3 |
| `auth_signin_attempt` | `method: 'password' \| 'magiclink'` | At submission of sign-in form; A-3 |
| `auth_signin_failed` | `method: 'password' \| 'magiclink'`, `reason: 'invalid_credentials' \| 'rate_limit' \| 'unconfirmed' \| 'other'` | When sign-in returns an error; A-3 |
| `auth_reset_requested` | (none â€” never include email) | After successful `resetPasswordForEmail` call; A-5 |
| `auth_reset_completed` | (none) | After successful `updateUser({ password })` on `/auth/reset-password`; A-6 |
| `filter_bezirk_set` | `bezirk: number /* 1..23 */` | First time per session a non-null `?bezirk=` lands in the URL; B-11 |
| `district_click` | `bezirk: number` | Every click on a district fill layer; B-11 |
| `polygon_layer_painted` | `duration_ms: number /* 0..5000 */` | Once per session after first paint; B-10 |
| `theme_resolved` | `theme: 'light' \| 'dark'` | On `<Toaster />`-equivalent root client component mount; C-11 |

No event property contains an email, user ID, IP, pin ID, pin coordinates, free-text content, or anything that could re-identify a session. Plausible's own session model is IP-hashed at the edge.

---

## Non-functional requirements addressed

| Concern | Target | How addressed |
|---|---|---|
| **Performance â€” polygon paint** | p95 â‰¤ 200ms on Moto G7 / 4G | Lazy GeoJSON load (â‰¤80 KB gzipped) from EU edge; `performance.mark` instrumentation; ADR-04 two-tier pipeline |
| **Performance â€” pin fetch** | Sub-300ms server response | `pins_in_bbox_filtered` uses GIST index on `pins.location` + B-tree on `pins.district_id` (added later if hot); RLS via `security_invoker` keeps it on the read replica path |
| **Performance â€” pin counts** | No client-side `count(*)` | Trigger-maintained `pin_count_cached` (ADR-08); UI reads denormalised column |
| **A11y â€” Lighthouse score** | â‰¥95 on `/`, `/sign-in`, `/pin/[id]` | Radix primitives (`Dialog`, `Tabs`, `Tooltip`, `Toast`, `Label`); `:focus-visible` rings (Button, Input); WCAG AA contrast pass on tokens in C-10 |
| **A11y â€” keyboard** | Every interactive primitive operable without mouse | Radix focus-trap on Sheet/Dialog; arrow-key listbox in filter-bar Bezirk section (B-13 via Radix RadioGroup); Escape closes everything |
| **A11y â€” reduced motion** | Animations â‰¤1ms when prefers-reduced-motion | `@media (prefers-reduced-motion: reduce) *,*::before,*::after { transition-duration: 1ms !important; animation-duration: 1ms !important; }` in `globals.css` (C-1) |
| **Bundle delta on `/`** | â‰¤30 KB gzipped vs pre-S0 baseline | Named Radix imports only; one primitive per dep (Dialog, Tabs, Toast, Tooltip, Slot, Label); Toast lazy-loaded only when first `toast()` is called (deferred â€” flagged in Open Questions if implementer wants to enforce) |
| **GDPR â€” analytics** | EU-only, cookieless, no PII | Plausible EU script tag; `track()` typed wrapper enforces enum-only props; no email/user/IP/coord property anywhere (ADR-07) |
| **GDPR â€” auth** | EU residency, no third-party identity | All auth via Supabase Frankfurt; HIBP via k-anonymity (decision #1, no full-password leakage); PKCE flow (ADR-06) |
| **GDPR â€” district association** | Pin coords stay private if approximate | `district_id` is computed from the *snapped* coord (B-7 reads `lng` / `lat` after `snapTo100mGrid`, identical to `createPin` today at `src/lib/pins/actions.ts:79â€“83`); district granularity is much coarser than 100m, so no additional privacy leak |
| **i18n-readiness** | DE-first strings as constants | All user-facing strings in new code go through a `src/lib/i18n/de.ts` module exporting named constants (e.g. `export const AUTH_PASSWORD_TOO_SHORT = "Passwort muss mindestens 10 Zeichen lang sein."`). Lets a future `next-intl` pass wrap them in a single PR rather than 40 grep-and-edit operations. |
| **Security â€” account enumeration** | No timing or response leak between known/unknown email | Generic `"E-Mail oder Passwort ist falsch."` on signin failure; generic `"Falls ein Konto mit dieser E-Mail existiertâ€¦"` on reset request (A-AC2.2, A-AC3.3); signup conflict surfaced only via `User already registered` mapping (A-AC1.7) |
| **Security â€” rate limit** | 5/15min client, 30/min/IP server | Client counter in `sessionStorage` (A-4); Supabase project rate limit (A-0) â€” defence in depth, real bound is server-side |
| **Observability â€” auth events** | All success/fail/reset events fire to Plausible | Schema in ADR-07; firing points enumerated in tasks A-3, A-5, A-6 |
| **Observability â€” map perf** | Paint duration captured | `performance.mark` â†’ `polygon_layer_painted` event (B-10) |
| **Cost** | Zero new infra in Slice B; Slice A no infra; Slice C no infra | All new code runs on existing Vercel + Supabase. Static GeoJSON adds 80 KB to the public bundle but is served from EU edge; no new CDN, no new queue, no new worker. |
| **Backward compatibility** | `pins_in_bbox` callers continue working | RPC is co-existed (ADR-05). Old function only deprecated in COMMENT until â‰¥30 days after B-14. |

---

## Open questions for Stage 4 implementers

A small list â€” the architect has decided everything that can be decided without seeing data or running a probe.

1. **Mapshaper `-simplify` percentage**: 8% is the architect's recommendation based on typical Visvalingam behaviour for civic boundary polygons (preserves visual character at zoom 10â€“13 while crushing vertex count). If the pipeline output exceeds 80 KB gzipped at 8%, drop to 6%; if it loses visible character at 8% (e.g. Inner Stadt looks blocky at zoom 16), raise to 10â€“12% and re-check the gzip budget. **Probe required:** the implementer (B-1, devops) runs the pipeline once and tells us the actual byte count and the visual result.

2. **Touch-device district hover/tap UX (B-AC5.2)**: the 2-second persistent-label-then-select pattern is unusual. Verify on real iOS Safari and Android Chrome that it doesn't conflict with the existing 450ms long-press pin-drop gesture. If it does, the implementer (B-12) escalates with a proposed alternative (single-tap = select, hover-label only on desktop).

3. **Toast lazy-load threshold**: do we lazy-import `@radix-ui/react-toast` only when `toast()` is first called (saves ~5 KB on cold load) or eagerly mount `<Toaster />` in `app/layout.tsx`? The architect's recommendation: lazy. The implementer (C-3) decides if the lazy boundary is acceptable for the toast latency requirement.

4. **`/auth/callback` route updates after PKCE switch**: the existing route already handles `?code=` via `@supabase/ssr`'s built-in helper, but the architect has not read that route's source. Implementer (A-3) verifies by reading `src/app/auth/callback/route.ts` and confirms either "no change needed" or surfaces a 5-minute fix. Flag if a deeper change is required.

5. **Background color of light-mode `--accent` at 4% on light tiles**: visually, Donau TÃ¼rkis at 4% may look invisible on the cool grays of Vienna's central streets. Implementer (B-10) does a 30-second visual check; if invisible, bump to 5â€“6% (still well below the "polygons obscure pins" threshold).

6. **Lighthouse threshold for `/sign-in`** with the new password tab: the form gains 2 inputs + a tabs control. The 95 a11y bar should hold (Radix is good at this), but the Performance bar might dip on slow connections because of the Tabs primitive's JS. Implementer (C-12) measures; if Performance < 85 on mobile, the implementer flags whether to defer-load the password form (`React.lazy`).

---
