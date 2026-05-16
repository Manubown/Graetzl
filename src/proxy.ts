import { type NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

/**
 * Per-request nonce for CSP `script-src`. Edge runtime has Web Crypto;
 * we encode 16 random bytes (128 bits) as base64.
 */
function generateNonce(): string {
  const buf = new Uint8Array(16);
  crypto.getRandomValues(buf);
  return btoa(String.fromCharCode(...buf));
}

/**
 * Content Security Policy.
 *
 *   script-src — 'self', the per-request nonce (for the inline theme
 *                bootstrap + Plausible), and plausible.io. In dev we
 *                also allow 'unsafe-eval' — React dev mode uses eval()
 *                for stack reconstruction and the error overlay. React
 *                never uses eval() in production builds.
 *   style-src  — 'unsafe-inline' is required by Tailwind v4's CSS
 *                injection. We accept it as the standard trade-off.
 *   img-src    — Supabase Storage (pin photos) + protomaps.github.io
 *                (sprite PNGs) + Wikimedia Commons (curated POI photos:
 *                Special:FilePath on commons.wikimedia.org redirects to
 *                upload.wikimedia.org, so both hosts must be allowed).
 *   connect-src — Supabase REST/Realtime + Plausible + Protomaps assets.
 *   worker-src — MapLibre spawns a worker via blob: URL.
 *   frame-ancestors 'none' — blocks clickjacking.
 */
function buildCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV !== "production";
  const scriptSrc = isDev
    ? `script-src 'self' 'nonce-${nonce}' 'unsafe-eval' https://plausible.io`
    : `script-src 'self' 'nonce-${nonce}' https://plausible.io`;

  return [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.supabase.co https://protomaps.github.io https://commons.wikimedia.org https://upload.wikimedia.org",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://plausible.io https://protomaps.github.io",
    "worker-src 'self' blob:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

function applySecurityHeaders(
  response: NextResponse,
  nonce: string,
  csp: string,
) {
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("x-nonce", nonce);
}

export async function proxy(request: NextRequest) {
  const nonce = generateNonce();
  const csp = buildCsp(nonce);

  // Forward the nonce to the React tree via a request header; layout.tsx
  // reads it from `headers()` and stamps it on the inline + Plausible
  // <script> tags so they pass the CSP check.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);

  let response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  applySecurityHeaders(response, nonce, csp);

  // Allow the app to boot even if env vars are missing (e.g. before
  // the Supabase project exists). We just skip session refresh.
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return response;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: { name: string; value: string; options: CookieOptions }[],
        ) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({
            request: { headers: requestHeaders },
          });
          applySecurityHeaders(response, nonce, csp);
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Touch the user so the session is refreshed if needed.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static and _next/image
     * - favicon.ico, robots.txt, sitemap.xml
     * - public files with extensions
     */
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
