import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import { headers } from "next/headers";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { TrackAppLoaded } from "@/lib/analytics/track-app-loaded";
import { Toaster } from "@/components/ui/toast";

const PLAUSIBLE_DOMAIN = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

/**
 * Resolve the canonical site origin for absolute metadata URLs (og:url,
 * canonical, etc). Precedence: explicit NEXT_PUBLIC_SITE_URL → Vercel's
 * auto-injected VERCEL_URL → localhost for dev. Setting this here means
 * page-level metadata can pass relative paths and Next.js resolves them.
 */
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Grätzl — locals' city map",
    template: "%s · Grätzl",
  },
  description:
    "Grätzl is the anti-TripAdvisor: a non-commercial, locally-curated map of cities. Discover the places only locals know.",
  applicationName: "Grätzl",
  authors: [{ name: "Grätzl" }],
  keywords: ["Vienna", "Wien", "city map", "local", "non-commercial", "Grätzl"],
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    siteName: "Grätzl",
    locale: "de_AT",
    title: "Grätzl — locals' city map",
    description:
      "The anti-TripAdvisor: a non-commercial, locally-curated map of Vienna.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Grätzl",
    description:
      "The anti-TripAdvisor: a non-commercial, locally-curated map of Vienna.",
  },
};

/**
 * Root layout. Receives both the regular `children` slot and the
 * `@modal` parallel slot used for intercepting routes (pin detail
 * modal). When no intercept is active, the modal slot renders its
 * default (null) so nothing visual changes.
 *
 * Async because we read the per-request CSP nonce from `headers()` —
 * set by `src/proxy.ts` — and stamp it on every inline/external
 * <script> tag so they pass our nonce-based CSP.
 */
export default async function RootLayout({
  children,
  modal,
}: Readonly<{
  children: React.ReactNode;
  modal: React.ReactNode;
}>) {
  const nonce = (await headers()).get("x-nonce") ?? "";
  return (
    <html
      lang="de"
      className={`${inter.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Blocking inline script (C-R4): resolves the theme from
            localStorage BEFORE first paint so reloads don't FOUC.

            We deliberately use a raw <script> rather than next/script.
            next/script's beforeInteractive defers execution behind
            Next.js's own bootstrap loader — too late to prevent the
            flash. A raw script in <head> runs synchronously when the
            HTML parser hits it, which is what we need.

            suppressHydrationWarning: the browser strips the `nonce`
            attribute from the DOM after parsing (HTML spec, to prevent
            CSP bypass via DOM read-back), so React's hydration sees
            the attribute on the server tree but not on the client tree.
            The script has already executed correctly — the mismatch is
            purely cosmetic.

            React 19's "scripts inside components are never executed
            when rendering on the client" warning may also appear in
            dev — it's a false positive for SSR <head> scripts and
            cannot be suppressed; the script does run server-rendered. */}
        <script
          nonce={nonce}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html:
              "try{var s=localStorage.getItem('graetzl:theme');var t=(s==='light'||s==='dark')?s:(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.setAttribute('data-theme',t);}catch(e){}",
          }}
        />
        {PLAUSIBLE_DOMAIN && (
          <Script
            defer
            data-domain={PLAUSIBLE_DOMAIN}
            src="https://plausible.io/js/script.tagged-events.js"
            strategy="afterInteractive"
            nonce={nonce}
          />
        )}
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <SiteHeader />
        <main className="flex flex-1 flex-col">{children}</main>
        {modal}
        <Toaster />
        <TrackAppLoaded />
      </body>
    </html>
  );
}
