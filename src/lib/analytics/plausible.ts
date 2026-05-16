/**
 * Plausible (EU) analytics — typed event helper.
 *
 * Single audit surface for GDPR review (ADR-07 in docs/design/redesign-auth-map.md).
 * Event names and property shapes are compile-checked: a misspelled event name
 * fails `pnpm typecheck`.
 *
 * Hard rule: no PII in any property. No email, no user ID, no IP, no pin ID,
 * no coordinates, no free-text. Property values are always primitive enums
 * or bounded numbers.
 *
 * The `<script>` tag itself is mounted in `app/layout.tsx`; this module is the
 * sole call site for `window.plausible(...)`.
 */

type EventProps = {
  app_loaded: undefined;
  auth_signup: { method: "password" | "magiclink" };
  auth_signin_attempt: { method: "password" | "magiclink" };
  auth_signin_failed: {
    method: "password" | "magiclink";
    reason: "invalid_credentials" | "rate_limit" | "unconfirmed" | "other";
  };
  auth_reset_requested: undefined;
  auth_reset_completed: undefined;
  auth_signup_completed: { method: "password" | "magiclink" };
  auth_password_reset_requested: undefined;
  district_click: { bezirk: number };
  polygon_layer_painted: { duration_ms: number };
  theme_resolved: { theme: "light" | "dark" };
};

export type EventName = keyof EventProps;

type PlausibleFn = (
  event: string,
  options?: { props?: Record<string, string | number | boolean> },
) => void;

declare global {
  interface Window {
    plausible?: PlausibleFn & { q?: unknown[] };
  }
}

/**
 * Fire a typed analytics event. Safe on the server (no-op) and before the
 * Plausible script has loaded (Plausible's stub queues calls).
 */
export function track<E extends EventName>(
  event: E,
  ...args: EventProps[E] extends undefined ? [] : [EventProps[E]]
): void {
  if (typeof window === "undefined") return;
  const props = args[0] as Record<string, string | number | boolean> | undefined;
  const fn = window.plausible;
  if (!fn) return;
  fn(event, props ? { props } : undefined);
}
