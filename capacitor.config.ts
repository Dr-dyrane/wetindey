/**
 * INERT Capacitor configuration. Present as readiness scaffolding only.
 *
 * This file installs nothing, imports nothing, and is imported by nothing. It
 * does not touch the Next.js build: `next build` never reads it, no npm
 * dependency backs it, and no native project consumes it today. WetinDey stays
 * a PWA (Founder decision, see docs/operations/decisions/native-readiness.md).
 *
 * It exists so a future native-incorporation lane inherits a decided starting
 * shape instead of an empty field. Until that lane is authorized, nothing here
 * runs.
 *
 * WHY IT IS NOT TYPED AGAINST `@capacitor/cli`:
 *   The real `CapacitorConfig` type ships inside the Capacitor CLI, which is
 *   deliberately NOT installed. Importing it would fail `tsc --noEmit` and would
 *   pull a dependency this decision forbids. The shape below is instead pinned by
 *   a local structural interface, so the file type-checks standalone under this
 *   repo's strict, isolatedModules tsconfig with zero install.
 *
 * WHAT A FUTURE LANE CHANGES (not now):
 *   - installs `@capacitor/core` and `@capacitor/cli` and swaps this local
 *     interface for `import type { CapacitorConfig } from "@capacitor/cli"`;
 *   - resolves the `webDir` / `server` decision below against how the app is
 *     actually served (WetinDey uses SSR + Server Actions, so it cannot cleanly
 *     static-export; the realistic pattern is a shell pointed at the hosted
 *     origin via `server.url`, not a bundled `out/` directory);
 *   - must not expose any store build until ADR-021 account deletion reaches P3
 *     (Apple 5.1.1(v) / Play deletion), per the readiness doc.
 */

interface InertCapacitorConfig {
  /** Reverse-DNS bundle identifier. Reserved shape only; not yet registered. */
  appId: string;
  /** Display name; mirrors `name` in src/app/manifest.ts. */
  appName: string;
  /**
   * Directory of a static web build a wrapper would bundle. WetinDey does not
   * produce one today (SSR + Server Actions). Kept as the conventional Next
   * export dir purely as a placeholder; a future lane replaces this with a
   * hosted-origin `server.url` if the app stays server-rendered.
   */
  webDir: string;
  server?: {
    /** Safe default so Android never downgrades the webview to cleartext. */
    androidScheme?: string;
    /**
     * When set, the webview loads this remote origin instead of `webDir`.
     * This is the realistic WetinDey pattern given SSR. Left undefined here so
     * the inert config asserts no live target. A future lane sets it to the
     * value already declared as NEXT_PUBLIC_APP_URL (e.g. https://wetindey.app).
     */
    url?: string;
    cleartext?: boolean;
  };
}

const config: InertCapacitorConfig = {
  appId: "app.wetindey.mobile",
  appName: "WetinDey",
  webDir: "out",
  server: {
    androidScheme: "https",
    cleartext: false,
  },
};

export default config;
