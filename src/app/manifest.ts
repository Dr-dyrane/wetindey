import type { MetadataRoute } from "next";

/**
 * Served at /manifest.webmanifest (not /manifest.json) — layout.tsx links it
 * there and public/sw.js precaches it under that path.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    /**
     * The install identity. Absent, browsers derive it from start_url, which
     * means any later change to start_url silently orphans every installed
     * copy: the old icon stays on the home screen pointing at an app the
     * browser no longer recognises as this one. Pinning it to "/" is what
     * start_url resolves to today, so declaring it now costs nothing and buys
     * the freedom to change start_url later.
     */
    id: "/",
    name: "WetinDey",
    short_name: "WetinDey",
    description: "Check reported food prices and availability nearby.",
    start_url: "/",
    /**
     * Without an explicit scope, a link out of the app opens inside the
     * standalone window with no address bar and no way back. "/" is the whole
     * origin, so the Wikimedia attribution links leave to the browser properly.
     */
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "en-NG",
    dir: "ltr",
    categories: ["food", "shopping", "navigation"],
    /**
     * These paint the splash screen and the Android task switcher, before any
     * stylesheet exists — so, like the theme-color meta in layout.tsx, they
     * cannot be var(). A manifest has no media queries either: this is the
     * light value, and a dark-mode user sees one light splash frame. Keep in
     * step with --color-background in globals.css by hand.
     */
    background_color: "#F2F2F7",
    theme_color: "#F2F2F7",
    icons: [
      // "any" icons are shown as authored, so they carry their own rounded corners.
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // "maskable" icons get cropped to a platform shape, so the mark sits inside
      // the 80% safe zone on a full-bleed square.
      { src: "/icons/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
