import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { ThemeProvider } from "@/core/context/ThemeContext";
import "./globals.css";

export const metadata: Metadata = {
  title: "WetinDey - Food Availability & Price Map",
  description: "Know before you go. Confirm food availability and prices in your neighborhood.",
  // app/manifest.ts is served at /manifest.webmanifest, not /manifest.json.
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "WetinDey",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  /**
   * The only colour literals in the app, and they cannot be tokens.
   *
   * These become <meta name="theme-color">, which the browser reads to paint
   * its own chrome before any stylesheet is parsed — a var() would resolve to
   * nothing. So they are duplicated by necessity and MUST be kept in step with
   * --color-background in globals.css by hand.
   */
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F2F2F7" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <head>
        <link href="https://api.mapbox.com/mapbox-gl-js/v3.1.2/mapbox-gl.css" rel="stylesheet" />
        <script src="https://api.mapbox.com/mapbox-gl-js/v3.1.2/mapbox-gl.js" defer />
      </head>
      <body className="h-full min-h-screen selection:bg-accent selection:text-accent-contrast">
        <ThemeProvider>
          {children}
        </ThemeProvider>
        {/* Vercel Web Analytics. Cookieless and no cross-site tracking, so it
            needs no consent banner. Only reports once deployed to Vercel; it
            no-ops locally. */}
        <Analytics />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').then(function(reg) {
                    console.log('SW registered on scope:', reg.scope);
                  }).catch(function(err) {
                    console.log('SW registration failed:', err);
                  });
                });
              }
            `
          }}
        />
      </body>
    </html>
  );
}
