# Grätzl — Implementation Plan

> Living document. Update at the end of every working session. Last updated: 2026-05-12 (session 2).

---

## 1. Vision

**Grätzl** is the anti-TripAdvisor — a non-commercial, locally-curated map of cities, where residents drop pins about the places only locals know, and visitors discover the city through their eyes. Named after the Viennese word for one's neighborhood, the few-blocks bubble you call home.

- **Primary audience:** local city dwellers who want to share and discover their city, and connect with other curators.
- **Secondary audience:** travelers and tourists who want insider tips instead of TripAdvisor noise.
- **Soul of the app:** non-commercial, vibe-based, locally-curated knowledge. The constraint on what's pin-worthy is what gives Grätzl its character.
- **Differentiator:** European-hosted, GDPR-native, no tracking, no business directory, no ads.

---

## 2. Decisions log

- [x] Name: **Grätzl**
- [x] Launch city: **Vienna**
- [x] Commercial stance: **strictly non-commercial** — no business pins, ever
- [x] Identity model: **pseudonymous handles** with reputation badges
- [x] Hosting (MVP): Vercel + Supabase Frankfurt (Next.js + Postgres/PostGIS) — **live**
- [x] Mascot direction: **Viennese pigeon** (placeholder SVG in `pigeon-mark.tsx`; final illustration TBD)
- [x] Maps: MapLibre GL JS + OpenStreetMap tiles
- [x] Gamification: yes, planned for Phase 2; chest-drop collectibles in Phase 3
- [ ] Domain: check `graetzl.app` / `graetzl.eu` / `getgraetzl.com`
- [ ] Trademark search: TBD

---

## 3. Tech stack

- **Frontend:** Next.js 15 (App Router) + React + TypeScript
- **Styling:** Tailwind CSS + shadcn/ui
- **Maps:** MapLibre GL JS + OpenStreetMap raster tiles (migrate to self-hosted Protomaps if scale requires)
- **Backend:** Supabase (Frankfurt region) — Postgres + PostGIS + Auth + Storage
- **Hosting:** Vercel (MVP) → Hetzner / Scaleway (later, if "fully European stack" becomes a priority)
- **Analytics:** Plausible (EU, cookieless)
- **Error tracking:** Sentry EU region
- **Image processing:** Sharp (EXIF stripping on upload)

---

## 4. Data model (v1)

```sql
profiles            -- extends auth.users
  id uuid PK (= auth.users.id)
  handle citext UNIQUE
  bio text
  home_city text
  created_at timestamptz
  -- gamification fields added in Phase 2:
  -- xp int default 0
  -- level int default 1
  -- avatar_config jsonb

pins
  id uuid PK
  author_id uuid FK profiles
  title text (max 80)
  body text (max 500)
  category text       -- food_drink | view | art_history | nightlife | hidden_gem | warning | other
  language text       -- 'de', 'en', etc.
  location geography(Point, 4326)   -- PostGIS
  precision text      -- 'exact' | 'approximate' (snapped to ~100m grid)
  city text           -- denormalized: 'Vienna'
  photo_url text
  is_hidden bool default false
  created_at timestamptz

upvotes  (user_id, pin_id, created_at)   -- PK (user_id, pin_id)
saves    (user_id, pin_id, created_at)
reports  (id, pin_id, reporter_id, reason, notes, status, created_at)
```

**Critical index:** `CREATE INDEX pins_location_gix ON pins USING GIST (location);`

**Row-Level Security on every table from day one.**

---

## 5. GDPR principles (non-negotiable)

- [ ] User's live location never leaves the device — only used client-side for centering the map.
- [ ] Pin locations are public content, posted with explicit consent.
- [ ] Per-pin precision toggle: *exact* or *approximate* (~100m grid snap).
- [ ] EXIF stripped from all uploaded photos server-side via Sharp.
- [ ] No third-party tracking. Plausible + Sentry EU only.
- [ ] No cookie banner needed (only essential auth-session cookie, which is exempt).
- [ ] Account deletion anonymizes pins (`author → "Former local"`) rather than nuking content. Documented in ToS.
- [ ] Data export endpoint returns JSON dump of all user-tied data.
- [ ] Privacy policy + ToS in plain language, in German and English, live on launch.

---

## 6. Roadmap

### Phase 1 — MVP (Weeks 1–4)

The thing that has to exist before anyone sees it.

#### Week 1 — Foundation ✅ DONE (session 2)
- [x] Initialize Next.js 16 project, deploy "hello world" to Vercel
- [x] Create Supabase project in **Frankfurt region**
- [x] Enable PostGIS extension (+ citext for case-insensitive handles)
- [x] Write initial schema migration (`profiles`, `pins`, `upvotes`, `saves`, `reports`)
- [x] Write RLS policies for all tables
- [x] Set up magic-link auth via Supabase Auth
- [x] Render MapLibre with Vienna as default center, OSM tile provider
- [x] Basic layout shell (Tailwind v4; shadcn primitives added on-demand)
- [x] **Done when:** you can log in and see an empty map of Vienna ← achieved

#### Week 2 — Core loop ✅ DONE (session 3)
- [x] Drop-pin UX: long-press on map (450ms + 6px tolerance) → modal with title / body / category / language / precision toggle. Right-click as desktop shortcut.
- [x] Photo upload to Supabase Storage (public `pin-photos` bucket, `<uid>/<uuid>.webp` paths, RLS-gated inserts)
- [x] Sharp EXIF strip on upload — `/api/upload` route handler strips ALL metadata, resizes to ≤2000px, re-encodes as WebP @ q82
- [x] Pin detail view — full `/pin/[id]` page **and** intercepting modal via parallel `@modal` slot. Deep links fall through to the full page with OG metadata.
- [x] Render existing pins as MapLibre cluster + symbol layers. (Cluster counts use circle size + colour ramp, no text labels — we deliberately don't pull glyphs from a third-party font CDN; Phase 2's self-hosted Protomaps will bring labels back.)
- [x] Approximate precision: snap coords to ~100m grid before write. `snapTo100mGrid` snaps lat first, then derives lng step from snapped lat so points in the same band always collide. Verified with random sampling: ≥70% of <30m-apart points collide, 100% of >200m-apart points separate.
- [x] **Done when:** you can create, view, and read pins on the map ← achieved

#### Week 3 — Social + moderation
- [ ] Upvote a pin (toggle)
- [ ] Save a pin (toggle, separate list)
- [ ] Public profile pages at `/u/[handle]` — bio, pin count, recent pins
- [ ] Map filters: category, language
- [ ] Report-pin flow (modal with reason + notes)
- [ ] Admin page at `/admin` gated to your user ID — list reports, hide pins, ban users
- [ ] Mobile responsiveness pass — most users will be on phones in the wild
- [ ] **Done when:** the social loop works and you can moderate

#### Week 4 — Launch prep
- [ ] Privacy policy + ToS (DE + EN)
- [ ] GDPR data export endpoint
- [ ] Account deletion flow with pin anonymization
- [ ] Onboarding: 3-screen intro ("This is your Grätzl / Drop a pin / Explore")
- [ ] Empty states, error states, loading states
- [ ] Plausible analytics integration
- [ ] Sentry EU integration
- [ ] **Seed 150–200 personal pins across Vienna** — non-negotiable; map must feel alive on day one
- [ ] Soft launch: r/wien, Mastodon (mastodon.social, mastodon.at), personal network
- [ ] **Done when:** real users can sign up and the map isn't empty

**Out of v1 (explicitly):** comments, following users, push notifications, multi-language translation, trails/walks, in-app messaging, gamification.

---

### Phase 2 — Social + gamification core (Weeks 5–8)

Adds retention. Hooks users into a progress loop without compromising the non-commercial soul.

#### Week 5 — Social depth
- [ ] Follow users
- [ ] "Following" feed: recent pins by people you follow
- [ ] Comments on pins (with rate limits to discourage chatter)
- [ ] Notifications: someone upvoted your pin, someone followed you, your pin was reported (in-app only; email opt-in later)

#### Week 6 — Gamification foundation
- [ ] Add gamification fields to `profiles`: `xp`, `level`, `avatar_config jsonb`
- [ ] Create `xp_events` table (audit log of every XP grant)
- [ ] Create `badges` and `user_badges` tables
- [ ] Implement XP grant logic (see Gamification design in §7)
- [ ] Implement level thresholds
- [ ] Anti-farming guardrails (see §7)

#### Week 7 — Avatars + badges
- [ ] Avatar system: base mascot + slots for customization (hat, accessory, color)
- [ ] Avatar editor screen
- [ ] Badge gallery on profile
- [ ] Badge unlock notifications
- [ ] First batch of cosmetics (level-locked + achievement-locked)

#### Week 8 — Polish + launch v2
- [ ] Progress bars and level-up animations
- [ ] Weekly leaderboard (per city, per district) — opt-in display
- [ ] Communicate the new system to existing users (in-app announcement)

---

### Phase 3 — Chest drops & city collection (Weeks 9–12)

The "rare items in the city" loop. Reason to physically explore.

- [ ] Curate landmark list for Vienna (~50–100 monuments / pieces of architecture)
- [ ] Tier them: Common / Rare / Epic / Legendary (Stephansdom, Schönbrunn, Belvedere = Legendary)
- [ ] Commission/generate illustrated artwork for each landmark
- [ ] Client-side proximity detection (landmark coords shipped with app, ~50KB JSON) - Maybe therefor we need to think about a other solution, and maybe get the permission from the user to track there location if they want to receive a Chest drop or Landmarkt batch, because we need some location validation, so it doesn't get gamed in the wrong way
- [ ] "Claim drop" action when within 50m of a landmark (rate-limited, sanity-checked server-side)
- [ ] Collection book on profile — show owned, silhouette unowned
- [ ] Privacy guarantee: server only learns *which* drop was claimed, not user coordinates
- [ ] Optional: photo-verification mode ("snap the monument to confirm")
- [ ] Seasonal/event chests (Christmas Markets, Donauinselfest, etc.)

---

### Phase 4 — Multi-city expansion

Only after Vienna proves out (target: 2,000+ weekly active users, 5,000+ pins).

- [ ] Refactor for multi-city: city as first-class entity
- [ ] City picker / detection
- [ ] Translate UI to additional languages
- [ ] Per-city localized terms (Kiez in Berlin, čtvrť in Prague, etc.)
- [ ] Launch order: **Berlin → Prague → Budapest → Munich** (neighbors first, word-of-mouth advantage)
- [ ] Per-city landmark sets for chest drops
- [ ] City-specific cosmetics

---

## 7. Gamification design

### Guiding principle

**Reward quality, not quantity.** Pin farming destroys the app. XP must be heavily weighted toward signals of value (upvotes, saves) rather than raw activity (pin count).

### XP sources

| Action | XP |
|---|---|
| Create a pin | +10 |
| Your pin is upvoted | +5 per upvote |
| Your pin is saved | +8 per save (saves = higher intent than upvotes) |
| First pin in a district (Grätzl) | +50 one-time bonus |
| Your pin stays popular after 90 days | +25 "evergreen" bonus |
| Validated report (you flagged actual spam/abuse) | +20 |
| Daily login streak (max 7-day bonus) | +2/day |

### Anti-farming guardrails

- Daily pin cap: 5 at L1–5, 10 at L6–15, 20 at L16+
- Pins with <3 upvotes after 30 days don't count toward badge progress
- A pin removed for spam/abuse forfeits all XP earned from it (and costs the author -50 XP)
- Self-upvoting is impossible (technical constraint via RLS)
- Sock-puppet detection: same-IP or rapid-coordinated upvotes flagged for review

### Levels

| Level | XP Required | Title |
|---|---|---|
| 1 | 0 | Newcomer |
| 5 | 300 | Wanderer |
| 10 | 1,500 | Local |
| 20 | 5,000 | Connoisseur |
| 35 | 15,000 | Grätzl Master |
| 50 | 40,000 | City Sage |

### Character / avatar

- Single mascot (proposed: **Viennese pigeon** — urban, friendly, ubiquitous across European cities)
- Customization slots: hat, accessory (scarf/glasses/etc.), color palette, background
- Cosmetics unlocked via: level milestones, badge achievements, seasonal events, chest drops (Phase 3)

### Badges (initial set for Vienna launch)

- **Erstes Pin** — your first pin
- **Grätzl-Hopper** — pinned in 5 different districts
- **Bezirks-König** — pinned in all 23 Viennese districts
- **Sunset-Jäger** — 10 view-category pins with 3+ upvotes each
- **Schatzfinder** — 10 hidden-gem pins with 3+ upvotes each
- **Verlässlich** — 50 validated reports (community moderator)
- **Stamm-Wiener** — active 100+ days
- **Pioniergeist** — joined in launch month
- *(seasonal/event badges as needed)*

### Game loop (intended user journey)

1. Open app → see XP and activity gained while away (your pins got upvotes overnight)
2. Map shows nearby pins from people you follow or trending in your Grätzl
3. Drop a new pin → instant XP and progress bar update
4. Explore → in Phase 3, getting close to a monument can trigger a chest drop
5. Check progress → next badge progress bar, next level XP needed
6. Customize → spend unlocked items, share avatar on profile

---

## 8. Open questions

- [ ] Domain availability check (graetzl.app / graetzl.eu / getgraetzl.com)
- [ ] Trademark search for "Grätzl"
- [ ] Logo / brand identity design
- [ ] Final pigeon mascot illustration (placeholder SVG is in `pigeon-mark.tsx`)
- [ ] Who illustrates the chest-drop artwork? (Commission a Viennese illustrator?)
- [ ] Pricing model long-term? (Currently planning: free forever, donation-supported, never ads)
- [ ] Should we federate with anything? (Mastodon-style ActivityPub? Probably not Phase 1.)
- [ ] iOS/Android native apps later, or stay PWA?
- [ ] Self-host glyph fonts (for cluster labels) — currently no labels because of unreliable third-party font CDNs. Bundle with Protomaps move.

---

## 9. Resume notes

### Session 1 — 2026-05-12
- Concept, branding, stack chosen. 4-week MVP plan written. Gamification + chest-drop design captured. **No code yet.**

### Session 2 — 2026-05-12
- **Week 1 complete.** Next.js 16 + TypeScript + Tailwind v4 scaffolded, Supabase Frankfurt project provisioned, PostGIS + citext enabled, schema + RLS migrations applied, magic-link auth working end-to-end, MapLibre rendering Vienna, repo pushed to public GitHub, Vercel auto-deploying on push to `main`.
- Build fixes that landed: MapLibre's `GeolocateControl` does not accept Mapbox's `showUserHeading`; `noImplicitAny` requires explicit types on `@supabase/ssr` cookie callbacks (`{ name: string; value: string; options: CookieOptions }[]`).

### Session 3 — 2026-05-12
- **Week 2 complete.** Core loop is live.
- New migrations: `_storage_pin_photos.sql` (public bucket with RLS), `_pins_view_and_rpc.sql` (`pins_with_coords` view + `pins_in_bbox` RPC).
- New code surfaces:
  - `src/lib/geo/snap.ts` — `snapTo100mGrid` (snap lat first, then derive lng step from snapped lat for band-consistent grid) + `haversineMeters`.
  - `src/lib/pins/{types,fetch,constants,actions}.ts` — types, server-side fetchers, dropdown constants, `createPin` Server Action with input validation + Vienna-bbox guard + grid snap.
  - `src/app/api/upload/route.ts` — Sharp pipeline strips all metadata, rotates by EXIF first, resizes ≤2000px, re-encodes as WebP @ q82. Uploads to `pin-photos/<uid>/<uuid>.webp`.
  - `src/components/map/{vienna-map,map-shell,drop-pin-modal}.tsx` — long-press detection (450 ms / 6 px tolerance, right-click shortcut for desktop), clustered markers, modal state owned by MapShell.
  - `src/components/pin/{pin-detail,pin-detail-modal}.tsx` — shared visual + client wrapper that closes via `router.back()`.
  - `src/app/pin/[id]/{page,not-found}.tsx` — standalone full page with OG metadata.
  - `src/app/@modal/default.tsx` + `src/app/@modal/(.)pin/[id]/page.tsx` — parallel slot + intercepting route; modal opens on marker-click navigation, full page opens on direct visit.
  - `src/components/ui/dialog.tsx` — minimal accessible `<dialog>` wrapper (no Radix dep).
- Lessons / footguns we hit:
  - Don't pull glyphs from `fonts.openmaptiles.org`; bad responses crash MapLibre's protobuf parser with `Unimplemented type: 4`. Dropped text labels on clusters; size + colour ramp instead.
  - **Don't `router.push('/pin/<new-id>')` after pin creation** — it pollutes history so the detail modal's `router.back()` lands on a previously-visited pin. Just `router.refresh()` and let the new marker appear on the map; users click it for the detail view.
  - The Windows ↔ Linux-sandbox cross-filesystem mount silently truncates some `Write` tool calls. Workaround: rewrite via bash heredoc and strip trailing null padding before commit.

**Open items carried into session 4:**

- [ ] Update Supabase Auth Site URL + Redirect URLs to include the Vercel production URL (so prod magic-links don't redirect to localhost). Add `https://*.vercel.app/auth/callback` for preview deploys too.
- [ ] Self-host glyph fonts OR find a reliable CDN before re-introducing cluster labels.

### Next session should: begin Week 3 — Social + moderation

In rough dependency order:
1. **Upvote a pin** (toggle). Adds an `upvotes` row via Server Action; map markers can grow with vote count later.
2. **Save a pin** (toggle, private list). Similar shape to upvote but RLS-private.
3. **Public profile page** at `/u/[handle]` — bio, pin count, recent pins. SSR'd.
4. **Map filters: category, language.** Client-side filtering on the loaded GeoJSON; cheap and instant.
5. **Report-pin flow** — modal with reason + notes (already have the `reports` table + RLS).
6. **`/admin` page gated to my UID** — list `reports.status='open'`, soft-hide pins (`is_hidden=true`), ban users.
7. **Mobile responsiveness pass** — most users will be on phones in the wild. Audit the modal, the form, the header.

**To continue in a new session, paste this document or its key sections back into the conversation.**
