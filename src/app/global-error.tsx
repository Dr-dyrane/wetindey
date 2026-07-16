"use client";

import { useEffect, useState } from "react";
import { reportError } from "@/lib/report-error";
import "./globals.css";

/**
 * Root error boundary — the last one there is.
 *
 * This only renders when the failure is in the root layout itself, or in
 * `error.tsx`. It therefore REPLACES the root layout, which is why it renders
 * its own <html> and <body>: nothing above it survived, including ThemeProvider,
 * the theme script, the font stack and the service-worker registration. Next
 * only mounts this in production; in dev the error overlay wins.
 *
 * Everything the layout would have provided has to be re-established here, or
 * not relied on:
 *   · globals.css is imported directly — without it the tokens below resolve to
 *     nothing and this renders as unstyled black-on-white.
 *   · The theme is re-resolved in React state, NOT by copying the layout's
 *     blocking <head> script (layout.tsx:41). That copy was tried first and is
 *     inert here: a <script dangerouslySetInnerHTML> that React inserts on the
 *     client never executes — the HTML spec does not run scripts added via
 *     innerHTML. The layout's copy only works because the layout is streamed as
 *     HTML and parsed by the browser. This boundary usually renders client-side,
 *     so the identical script silently did nothing and a dark-mode user got a
 *     white page. Verified: html carried `class="h-full"` with no `dark` while
 *     localStorage said dark. Every token below inverts on `.dark`, so this is
 *     the difference between an error page and a flashbang, at the exact moment
 *     the user is least inclined to forgive the app.
 *   · No ThemeContext, no Analytics, no imports from _components. Anything this
 *     file pulls in is code that can throw inside the handler for a throw, and
 *     there is no boundary under this one.
 */

/**
 * The layout's theme rule, in a form that works without the layout.
 *
 * Same precedence as the script at layout.tsx:41 — an explicit choice in
 * localStorage wins, otherwise the OS preference. try/catch because
 * localStorage THROWS outright in some privacy modes, and a theme is not worth
 * turning the error page into a second error.
 */
function resolveTheme(): "dark" | "light" {
  // The server has no localStorage and no matchMedia. This branch is only
  // reachable if the root layout threw during SSR.
  if (typeof window === "undefined") return "light";
  try {
    const stored = window.localStorage.getItem("theme");
    if (stored === "dark" || stored === "light") return stored;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch {
    return "light";
  }
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // A lazy initialiser, not an effect: this runs during the first client render,
  // so `dark` is on <html> before the browser paints. An effect would apply it
  // one frame late — which is a white flash, i.e. the bug this replaced.
  const [theme] = useState(resolveTheme);
  const [eventId, setEventId] = useState<string | null>(null);

  // colorScheme tells the browser to paint ITS OWN chrome — scrollbars, form
  // controls — to match. The layout script sets it; nothing else here would.
  useEffect(() => {
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  useEffect(() => {
    setEventId(
      reportError(error, {
        scope: "app/global-error-boundary",
        digest: error.digest,
        // Worth knowing: this fired instead of error.tsx, so the failure is in
        // the layout or in the boundary itself, not in a page.
        extra: { boundary: "root" },
      }),
    );
  }, [error]);

  return (
    /* suppressHydrationWarning: if this boundary IS server-rendered, the server
       has no localStorage and resolves light, while the client may resolve dark.
       The client render wins and is correct; the warning would be noise about a
       mismatch that is intended. */
    <html lang="en" className={theme === "dark" ? "dark h-full" : "h-full"} suppressHydrationWarning>
      <body className="h-full min-h-screen">
        <div className="grid min-h-screen place-items-center bg-background p-6">
          <div className="flex w-full max-w-[360px] flex-col items-center gap-4 squircle-lg bg-surface px-6 py-7 text-center shadow-card">
            {/* Inline SVG, not lucide-react: one less module between the crash
                and the page that explains it. */}
            <span className="grid h-11 w-11 place-items-center squircle-full bg-status-caution-bg text-status-caution-fg">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
                aria-hidden
              >
                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
                <path d="M12 9v4" />
                <path d="M12 17h.01" />
              </svg>
            </span>

            <div>
              <h1 className="text-title-3 font-semibold text-text-primary">WetinDey don crash</h1>
              <p className="mt-1.5 text-subhead text-text-secondary">
                No be your fault, and no be your data. Start am again — if e do the same thing, the
                ref below go help us find am.
              </p>
            </div>

            <div className="flex w-full flex-col gap-2">
              <button
                onClick={() => reset()}
                className="flex min-h-tap w-full items-center justify-center squircle bg-accent px-4 text-headline text-accent-contrast transition-opacity duration-micro ease-decelerate active:opacity-80"
              >
                Start again
              </button>
              <button
                onClick={() => window.location.reload()}
                className="flex min-h-tap w-full items-center justify-center squircle bg-fillTertiary px-4 text-headline text-text-primary transition-opacity duration-micro ease-decelerate active:opacity-60"
              >
                Reload the app
              </button>
            </div>

            {(eventId || error.digest) && (
              <p className="select-text text-caption-2 text-text-tertiary">
                Ref {error.digest ?? eventId?.slice(0, 8)}
              </p>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}
