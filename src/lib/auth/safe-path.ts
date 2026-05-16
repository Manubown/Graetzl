/**
 * Sanitise a redirect target. Returns the input unchanged when it's a
 * safe same-origin relative path; otherwise returns "/".
 *
 * Rejects (CWE-601 open redirect):
 *   • non-string / empty / null / undefined
 *   • anything not starting with "/"
 *   • protocol-relative URLs ("//evil.tld/...")
 *   • backslash bypass ("/\\evil.tld", "/foo\\bar") — some browsers
 *     normalise backslashes into forward slashes during URL parsing
 *
 * Authoritative version: every caller that needs to accept a `next` /
 * `redirectTo` style parameter and then hand it to a redirect call MUST
 * route through this function. A previous duplicate copy in
 * `app/auth/callback/route.ts` was consolidated here so a future fix
 * stays in one place.
 */
export function safePath(value: string | null | undefined): string {
  const v = value ?? "";
  if (!v.startsWith("/")) return "/";
  if (v.startsWith("//") || v.startsWith("/\\")) return "/";
  if (v.includes("\\")) return "/";
  return v;
}
