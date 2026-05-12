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

#### Week 2 — Core loop
- [ ] Drop-pin UX: long-press on map → modal with title / body / category / language / precision toggle
- [ ] Photo upload to Supabase Storage
- [ ] Sharp EXIF strip on upload (server-side function)
- [ ] Pin detail view (modal or `/pin/[id]` page)
- [ ] Render existing pins as markers, clustered when zoomed out
- [ ] Approximate precision: snap coords to 100m grid before write
- [ ] **Done when:** you can create, view, and read pins on the map

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

- [ ] Final mascot direction (pigeon vs. abstract character vs. user-selected base)
- [ ] Domain availability check
- [ ] Trademark search for "Grätzl"
- [ ] Logo / brand identity design
- [ ] Who illustrates the chest-drop artwork? (Commission a Viennese illustrator?)
- [ ] Pricing model long-term? (Currently planning: free forever, donation-supported, never ads)
- [ ] Should we federate with anything? (Mastodon-style ActivityPub? Probably not Phase 1.)
- [ ] iOS/Android native apps later, or stay PWA?

---

## 9. Resume notes

**Where we left off (session 2, 2026-05-12):**

- Week 1 complete. Production app live on Vercel; Supabase Frankfurt active.
- Auth verified end-to-end: magic link → callback → session → auto-profile via `handle_new_user` trigger.
- Mascot direction locked: Viennese pigeon (currently a stylised SVG placeholder).
- Repo on GitHub (public). Vercel auto-deploys on push to `main`.

**Two strict-build fixes that landed in session 2 (worth remembering for future code):**

- MapLibre's `GeolocateControl` does not accept Mapbox's `showUserHeading`.
- `noImplicitAny` requires explicit types on `@supabase/ssr` co
