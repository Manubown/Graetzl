/**
 * Shared password complexity policy. Single source of truth for the
 * three forms that validate passwords:
 *   • sign-up (`src/components/auth/password-form.tsx`)
 *   • reset (`src/app/auth/reset-password/_form.tsx`)
 *   • change (`src/app/me/settings/password/_form.tsx`)
 *
 * Server side: `signUpWithPassword` and `updateOwnPassword` re-run
 * `checkPassword()` defensively. Client side: `<PasswordRequirements>`
 * renders a live checklist of which rules are satisfied as the user
 * types.
 *
 * Policy: 12–72 chars, at least one uppercase letter, one lowercase
 * letter, and one digit. Symbols are allowed but not required —
 * forcing symbols hurts UX more than it helps entropy at this length.
 * HIBP "Pwned Passwords" is enforced by Supabase Auth at the API
 * layer (project setting) and is orthogonal to these checks.
 */

export const PASSWORD_MIN = 12;
export const PASSWORD_MAX = 72;

export interface PasswordRules {
  length: boolean;
  upper: boolean;
  lower: boolean;
  digit: boolean;
}

export interface PasswordCheck {
  /** True only when every rule is satisfied. */
  ok: boolean;
  /** Per-rule pass/fail — drives the live checklist UI. */
  rules: PasswordRules;
  /** First-failing rule's German error message, suitable for inline display. */
  error: string | null;
}

export function checkPassword(value: string): PasswordCheck {
  const length = value.length >= PASSWORD_MIN && value.length <= PASSWORD_MAX;
  const upper = /[A-Z]/.test(value);
  const lower = /[a-z]/.test(value);
  const digit = /[0-9]/.test(value);
  const ok = length && upper && lower && digit;

  let error: string | null = null;
  if (!length) {
    error =
      value.length > PASSWORD_MAX
        ? "Passwort ist zu lang (max. 72 Zeichen)."
        : `Passwort muss mindestens ${PASSWORD_MIN} Zeichen lang sein.`;
  } else if (!upper) {
    error = "Passwort muss mindestens einen Großbuchstaben enthalten.";
  } else if (!lower) {
    error = "Passwort muss mindestens einen Kleinbuchstaben enthalten.";
  } else if (!digit) {
    error = "Passwort muss mindestens eine Zahl enthalten.";
  }

  return { ok, rules: { length, upper, lower, digit }, error };
}

/** Label per rule, German, for the live checklist. */
export const PASSWORD_RULE_LABELS: { key: keyof PasswordRules; label: string }[] = [
  { key: "length", label: `Mindestens ${PASSWORD_MIN} Zeichen` },
  { key: "upper", label: "Mindestens ein Großbuchstabe" },
  { key: "lower", label: "Mindestens ein Kleinbuchstabe" },
  { key: "digit", label: "Mindestens eine Zahl" },
];
