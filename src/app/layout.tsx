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
        {/**
         * Resolve the theme BEFORE first paint.
         *
         * This is blocking and inline on purpose. Everything downstream reads
         * `documentElement.classList` to decide what it is: the CSS variables,
         * and — critically — the map, which must choose streets-v12 vs dark-v11
         * at construction. ThemeContext applies that class in an effect, so
         * anything else reading it from an effect is racing the provider, and
         * effect order between sibling components is not guaranteed. The map
         * only picked the right basemap because its CDN await happened to push
         * init later. That is luck.
         *
         * Running here makes the class true from the first byte of paint: no
         * flash, and every consumer — including a map that reloads — reads a
         * settled value. Wrapped in try/catch because localStorage throws
         * outright in some privacy modes, and a theme is not worth a blank page.
         */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{
              var t=localStorage.getItem('theme');
              if(t!=='dark'&&t!=='light'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}
              var r=document.documentElement;
              r.classList.toggle('dark',t==='dark');
              r.style.colorScheme=t;
            }catch(e){}})();`
          }}
        />
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
