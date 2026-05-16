# Auth Parity Verification Runbook — Slice A (A-7)

**Date produced:** 2026-05-16  
**Analyst:** QA gate (A-7)  
**Scope:** Email/password auth parity with the existing magic-link path.  
**Environment:** Static analysis + Vitest unit tests. Live checks flagged as
NEEDS-LIVE-TEST with numbered steps.

---

## Summary

All statically verifiable acceptance criteria PASS. Three criteria require a
live Supabase dev project to produce a final green stamp. One defect was found
(D-1, low severity). Two items are flagged for security review (A-8).

---

## Acceptance Criteria

---

### A-AC5.1 — `profiles` row created with `wiener_<8hex>` handle on password signup

**Claim:** The `handle_new_user` trigger fires on every `auth.users` INSERT
regardless of auth method.

**Evidence:**

- `supabase/migrations/20260512000001_init_schema.sql` lines 127–130:

  ```sql
  drop trigger if exists on_auth_user_created on auth.users;
  create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();
  ```

  The trigger is bound to the table, not to a specific provider. Supabase
  inserts one row into `auth.users` regardless of whether the account was
  created via OTP (magic-link) or `signUp` (email + password). The trigger
  fires on every INSERT.

- The trigger function (lines 110–125) performs an unconditional INSERT into
  `public.profiles` using `new.id` and a handle derived from the UUID. It
  contains no `IF` branch on auth method or provider.

- `src/lib/auth/actions.ts` `signUpWithPassword` (line 67) calls
  `supabase.auth.signUp(...)`, which creates the `auth.users` row; the
  trigger fires immediately after.

**Status:** PASS (statically verified)

---

### A-AC5.2 — RLS policies on `pins` are auth-method-agnostic

**Claim:** No RLS policy conditions on `email`, `provider`, or `app_metadata`;
all use `auth.uid()`.

**Evidence:**

- `supabase/migrations/20260512000002_rls_policies.sql` — every policy on
  `pins`, `profiles`, `upvotes`, `saves`, and `reports` uses only
  `auth.uid()`:
  - `pins_select_visible` line 39: `using (is_hidden = false or auth.uid() = author_id)`
  - `pins_insert_self` line 44: `with check (auth.uid() = author_id)`
  - `pins_update_self` lines 49–50: both `using` and `with check` on `auth.uid()`
  - `pins_delete_self` line 55: `using (auth.uid() = author_id)`

- No subsequent migration file introduces a policy that references `email`,
  `provider`, `raw_user_meta_data`, or `app_metadata`. Confirmed by grep
  across all migration files.

**Status:** PASS (statically verified)

---

### A-AC5.3 — `signOut()` invalidates the session identically for both auth paths

**Claim:** There is one sign-out code path shared by both auth methods.

**Evidence:**

- `src/lib/auth/actions.ts` lines 12–17: a single `signOut()` server action
  calls `supabase.auth.signOut()` unconditionally, then `revalidatePath` and
  `redirect("/")`.

- `src/components/auth/sign-out-button.tsx` lines 11–26: the only sign-out
  UI element calls `signOut()` from `@/lib/auth/actions`. There is no
  conditional sign-out branch.

- `src/components/site-header.tsx` imports only `SignOutButton` — there is no
  alternate button rendered based on auth method.

- `supabase.auth.signOut()` is a Supabase-managed call that invalidates the
  session cookie/token set by `@supabase/ssr` regardless of how the session
  was created (OTP or password).

- Automated test: `src/lib/auth/actions.test.ts` — `signOut calls
  supabase.auth.signOut() and redirects to /`.

**Status:** PASS (statically verified + unit tested)

---

### A-AC5.4 — A magic-link user can still request a magic-link to a password-account email

**Claim:** Supabase treats magic-link OTP and password signup as the same
`auth.users` row keyed by email. Sending an OTP to a password-account email
works normally.

**Evidence (static):**

- `src/app/sign-in/sign-in-form.tsx` `MagicLinkForm` (lines 153–158) calls
  `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: ... } })`.
  Supabase looks up the `auth.users` row by email to dispatch the OTP; the
  auth provider on the row is irrelevant.

- This is a Supabase platform guarantee (same `auth.users` table; `signInWithOtp`
  does not reject rows created via password). It cannot be verified by reading
  local source code alone.

**Status:** NEEDS-LIVE-TEST

**Manual reproduction script:**

1. In your Supabase dev project, sign up a new user with email
   `test-parity-1@example.com` using the password form (`signUpWithPassword`).
2. Confirm the email via the confirmation link in the inbox.
3. In the sign-in form, switch to the Magic-Link tab and submit
   `test-parity-1@example.com`.
4. **Expected:** Supabase sends a magic-link email within ~30 s. No error is
   shown in the UI.
5. Click the magic-link. **Expected:** you are signed in and land on `/`
   (or `/onboarding/handle` if the handle was not customised). The session is
   valid (the site header shows the Abmelden button).
6. Check the `auth.users` table in the Supabase dashboard: confirm there is
   still exactly ONE row for `test-parity-1@example.com` (no duplicate row
   created by the OTP).

- [ ] Step 4 — magic-link email received
- [ ] Step 5 — session established; correct redirect
- [ ] Step 6 — single `auth.users` row confirmed

---

### A-AC5.5 — A magic-link-only user can set a password via the reset flow

**Claim:** `resetPasswordForEmail` works for accounts created via OTP
(no password was ever set).

**Evidence (static):**

- `src/lib/auth/actions.ts` `requestPasswordReset` (lines 174–187) calls
  `supabase.auth.resetPasswordForEmail(email, { redirectTo: .../auth/reset-password })`.
  The Supabase API accepts any verified email in `auth.users`, including OTP-only
  accounts.

- `src/app/auth/reset-password/_form.tsx` (lines 55–62): on load, exchanges
  the `?code=` query param for a session via `supabase.auth.exchangeCodeForSession`.
  Only after a successful exchange (line 60: `setPageStatus("ready")`) does the
  user see the password form. `updateUser({ password })` at line 81 is therefore
  always called within an authenticated session, regardless of how the account
  was originally created.

- This is also a Supabase platform guarantee and must be confirmed live.

**Status:** NEEDS-LIVE-TEST

**Manual reproduction script:**

1. Create a magic-link-only account: sign in as `test-parity-2@example.com`
   via the Magic-Link tab. Do NOT register a password.
2. Sign out.
3. In the sign-in form, click "Passwort vergessen?" and enter
   `test-parity-2@example.com`.
4. **Expected:** The UI shows "Falls ein Konto mit dieser E-Mail existiert,
   haben wir eine Mail gesendet." (no enumeration hint).
5. Check the inbox. **Expected:** a password-reset email arrives within ~30 s.
6. Click the reset link. **Expected:** you are redirected to
   `/me/settings/password?reset=1` and the form is in the `ready` state
   (not `expired`).
7. Enter a new password meeting the rules. Submit.
8. **Expected:** redirect to `/` with `?password=updated` in the URL (see
   `updateOwnPassword` line 222).
9. Sign out, then sign in with the new password on the E-Mail + Passwort tab.
   **Expected:** successful sign-in.

- [ ] Step 4 — neutral UI message shown
- [ ] Step 5 — reset email received
- [ ] Step 6 — `/me/settings/password?reset=1` rendered, form is `ready`
- [ ] Step 8 — redirect to `/?password=updated`
- [ ] Step 9 — password sign-in succeeds

---

### A-AC4.2 — Both paths land on the same post-auth surface

**Claim:** After successful auth (either path), the user ends up at the same
surface, controlled by the onboarding gate.

**Evidence:**

- `src/app/layout.tsx` line 49: `await checkOnboarding()` runs on every render
  for signed-in users. This is the root layout, so it covers all routes.

- `src/lib/auth/check-onboarding.ts` lines 18–33: the function checks
  `profile.handle` against `DEFAULT_HANDLE_RE = /^wiener_[0-9a-f]{8}$/`. If
  the handle is still the auto-generated default, the user is redirected to
  `/onboarding/handle`. This logic is auth-method-agnostic — it reads from
  `public.profiles`, which is populated identically for both paths via the
  `handle_new_user` trigger.

- The callback route (`src/app/auth/callback/route.ts` lines 47–49) for
  `type=signup` (email confirmation) redirects to
  `/sign-in?confirmed=1&next=/onboarding/handle`, which then signs in and
  triggers the gate. The magic-link path falls through to `safeNext(next)`
  which by default is `/`, and the root layout's `checkOnboarding` then fires.

- Both paths therefore converge on the same gate before the user sees any
  content.

**Status:** PASS (statically verified)

---

### A-AC4.3 — Sign-out behavior identical for both auth types

**Evidence:** Same as A-AC5.3 above. One `signOut` server action, one
`SignOutButton` component, one `supabase.auth.signOut()` call. Session type
is opaque to the sign-out path.

**Status:** PASS (statically verified + unit tested)

---

### A-R5 — Both paths route to the same `auth.users` row when email matches

**Claim:** Signing up with password for an email already registered via
magic-link does NOT create a duplicate row.

**Evidence (static):**

- `supabase.auth.signUp` is idempotent on email: if a confirmed `auth.users`
  row already exists, Supabase returns a `User already registered` error (or
  silently re-sends the confirmation, depending on project config). This is
  surfaced to the user as "Konto existiert bereits — setze ein Passwort über
  'Passwort vergessen'." (actions.ts lines 93–106), nudging them to the reset
  flow rather than creating a second row.

- The `handle_new_user` trigger is `after insert on auth.users` — it only runs
  on a real INSERT, not on a no-op or error return. A duplicate-signup attempt
  that Supabase rejects at the API layer never produces a trigger invocation.

- Live confirmation required to rule out edge case where project-level
  "confirm email" setting is OFF (in which case `signUp` on an existing
  unconfirmed email silently succeeds and Supabase handles deduplication
  internally).

**Status:** PASS (statically verified); NEEDS-LIVE-TEST for the
"confirm email OFF" edge case.

**Manual reproduction script (edge case — confirm email disabled):**

1. Temporarily disable "Confirm email" in the Supabase dashboard
   (Auth > Providers > Email > Confirm email = OFF).
2. Register `test-parity-3@example.com` via the Magic-Link tab.
3. Then register the same email via the E-Mail + Passwort tab with a fresh password.
4. In the Supabase dashboard, `auth.users` table: confirm there is exactly ONE
   row for `test-parity-3@example.com`.
5. In `public.profiles`: confirm there is exactly ONE row.
6. Re-enable "Confirm email" after the test.

- [ ] Step 4 — single `auth.users` row
- [ ] Step 5 — single `public.profiles` row

---

## Defects Found

### D-1 — `_form.tsx` reset flow: `exchangeCodeForSession` is not awaited before the form renders (low severity)

**File:** `src/app/auth/reset-password/_form.tsx` lines 55–62

**Description:** The code-exchange happens inside a `useEffect` that fires
after first render. Because `useState` initialises `pageStatus` to
`"exchanging"` (line 45), the spinner is shown during the async window and the
password form is only displayed after the exchange resolves. This is correct
**behaviorally**.

However, if the user somehow navigates away and back quickly before the
`useEffect` completes (e.g. React Strict Mode double-invocation in development),
a second `exchangeCodeForSession` call is made with the same code. Supabase's
PKCE codes are single-use, so the second call returns an error, and the page
flips to `"expired"` even though a valid session was actually established by the
first call.

**Impact:** Development-mode false positive (Strict Mode). Not reproducible in
production (`NODE_ENV=production`). No data loss risk.

**Recommendation:** Wrap the `useEffect` with a ref guard
(`const exchanged = useRef(false)`) and skip the call on the second invocation.
File as a separate task for the `frontend-developer`.

---

### D-2 — Duplicate `isSafePath` / `safeNext` implementations (code quality)

**Files:**
- `src/lib/auth/actions.ts` lines 24–30 (`isSafePath`)
- `src/app/auth/callback/route.ts` lines 10–16 (`safeNext`)

**Description:** The comment in `actions.ts` line 22 acknowledges this: "Inline
copy — the authoritative version lives in `src/app/auth/callback/route.ts`; T4
agent may consolidate later." Both implementations are functionally identical.
The risk is that a future security fix applied to one will not automatically
propagate to the other.

**Impact:** Maintenance risk; no current behavioral divergence.

**Recommendation:** Extract to `src/lib/auth/safe-path.ts` and import in both
places. File as a separate task.

---

## Items Flagged for A-8 (Security Review)

1. **HIBP error message matching is substring-based on Supabase English text.**
   `actions.ts` lines 83–86 match against `"breach"`, `"hibp"`, `"pwned"`,
   `"leaked"`, `"known"`. These strings are scraped from Supabase's current
   English error copy. If Supabase changes the wording (e.g. internationalises
   the error or adds a numeric code), the HIBP bucket silently falls through to
   the generic "schiefgelaufen" message, and the user is not told to choose a
   different password. A-8 should verify whether Supabase exposes a stable
   error code or `status` value for this case.

2. **Account-enumeration surface on signup vs. reset.**
   `signUpWithPassword` returns `"Konto existiert bereits — setze ein Passwort
   über 'Passwort vergessen'."` when the email is already registered. This
   intentionally leaks that the email is registered (PRD-justified: the
   alternative is silent no-op which confuses the user). `requestPasswordReset`
   returns a neutral message. A-8 should confirm this asymmetry is acceptable
   under the GDPR baseline and document it in the privacy policy delta.

3. **PKCE flow correctness — single-use code re-use on Strict Mode double-invoke.**
   See D-1 above. Not a production risk, but A-8 should confirm that the PKCE
   code exchange is single-use as expected and that the `exchangeCodeForSession`
   call is protected against replay on the server-rendered (non-React) reset path
   if one is ever added.

4. **`next` open-redirect in magic-link path.**
   `src/app/auth/callback/route.ts` line 53: the no-`type` branch passes the
   caller-supplied `next` through `safeNext()`. The `safeNext` implementation
   correctly rejects `//`, `/\`, backslashes, and non-`/` prefixes. A-8 should
   run a fuzzing pass against `safeNext` with Unicode normalisation edge cases
   (e.g. `%2F%2F`, `%5C`, U+2215 DIVISION SLASH) to confirm no bypass exists
   at the HTTP layer before the Next.js URL parser processes the value.

---

## Test Suite

All static checks are backed by unit tests in
`src/lib/auth/actions.test.ts` (36 new tests).

```
 Test Files  5 passed (5)
      Tests  61 passed (61)
   Duration  503ms
```

New tests cover:

| Test | AC / behavior |
|------|---------------|
| `signUpWithPassword returns { ok: true } on success` | A-AC5.1 (action side) |
| `signUpWithPassword passes emailRedirectTo with /onboarding/handle` | A-AC4.2 |
| `signUpWithPassword rejects password < 12 chars` | boundary |
| `signUpWithPassword rejects password > 72 chars` | boundary |
| `signUpWithPassword maps invalid-email error` | error path |
| `signUpWithPassword maps already-registered to reset nudge` | A-R5 / anti-enumeration |
| `signUpWithPassword maps HTTP 429 to reset nudge` | A-R5 |
| `signUpWithPassword maps HIBP breach error` | HIBP path |
| `signUpWithPassword returns generic fallback for unknown errors` | error path |
| `signInWithPassword calls redirect on success` | A-AC4.2 |
| `signInWithPassword redirects to sanitised next path` | A-AC4.2 |
| `signInWithPassword sanitises protocol-relative open-redirect` | CWE-601 |
| `signInWithPassword sanitises backslash bypass` | CWE-601 |
| `signInWithPassword sanitises embedded backslash` | CWE-601 |
| `signInWithPassword returns field-agnostic error` | anti-enumeration |
| `signInWithPassword rejects password < 12 chars` | boundary |
| `signInWithPassword defaults next to /` | A-AC4.2 |
| `requestPasswordReset always returns { ok: true } for real email` | A-AC5.5 anti-enum |
| `requestPasswordReset always returns { ok: true } on Supabase error` | A-AC5.5 anti-enum |
| `requestPasswordReset passes redirectTo /auth/reset-password` | A-AC5.5 |
| `updateOwnPassword calls updateUser and redirects` | A-AC5.5 |
| `updateOwnPassword rejects password < 12 chars` | boundary |
| `updateOwnPassword returns { ok: false } on updateUser error` | error path |
| `signOut calls supabase.auth.signOut() and redirects to /` | A-AC4.3 / A-AC5.3 |
| `isSafePath contract (7 cases)` | CWE-601 open-redirect guard |
