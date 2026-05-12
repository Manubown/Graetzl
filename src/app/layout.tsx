import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
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
};

/**
 * Root layout. Receives both the regular `children` slot and the
 * `@modal` parallel slot used for intercepting routes (pin detail
 * modal). When no intercept is active, the modal slot renders its
 * default (null) so nothing visual changes.
 */
export default function RootLayout({
  children,
  modal,
}: Readonly<{
  children: React.ReactNode;
  modal: React.ReactNode;
}>) {
  return (
    <html
      lang="de"
      className={`${inter.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <SiteHeader />
        <main className="flex flex-1 flex-col">{children}</main>
        {modal}
      </body>
    </html>
  );
}
