"use client";

import { useEffect, useState } from "react";
import { RefreshCw, TriangleAlert } from "lucide-react";
import { reportError } from "@/lib/report-error";

/**
 * Route-level error boundary.
 *
 * Until this file existed, ANY throw below the root layout took the user to
 * Next's default error page — a white screen reading "Application error: a
 * client-side exception has occurred", with no way back except the browser's
 * reload button. That matters more here than in most apps, because
 * `geographyPoint.fromDriver` (src/lib/geospatial.ts) now THROWS by design on a
 * point it cannot decode. That is the right call — the silent {lng:0,lat:0}
 * fallback it replaced put every place in the Gulf of Guinea for months — but a
 * decision to fail loudly is only complete once something is listening. This is
 * the thing listening.
 *
 * Scope: replaces the page, keeps the root layout. `global-error.tsx` covers the
 * layout itself.
 *
 * VOICE: the same register as the rest of the failure copy — "Map no fit load"
 * (src/design-system/components/MapLoader.tsx), "We no fit reach the price data
 * right now." (`home.err_prices_unreachable` in src/core/i18n/strings.ts).
 * A failure is not the moment to switch into a different accent.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [eventId, setEventId] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    setEventId(
      reportError(error, {
        scope: "app/error-boundary",
        digest: error.digest,
      }),
    );
  }, [error]);

  /**
   * `reset()` re-renders the segment. It genuinely recovers a transient failure
   * (a fetch that lost the network, a query that timed out) and genuinely does
   * NOT recover a deterministic one — the same render throws again and lands
   * straight back here, which reads to the user as a dead button.
   *
   * So the second offer is a real reload: it discards the client state that may
   * itself be the bad input. Both are shown from the start rather than after a
   * failed attempt, because the user knows whether their network just dropped
   * and we do not.
   */
  const handleRetry = () => {
    setRetrying(true);
    reset();
  };

  return (
    <div className="grid min-h-screen place-items-center bg-background p-6">
      <div className="flex w-full max-w-[360px] flex-col items-center gap-4 squircle-lg bg-surface px-6 py-7 text-center shadow-card">
        <span className="grid h-11 w-11 place-items-center squircle-full bg-status-caution-bg text-status-caution-fg">
          <TriangleAlert className="h-5 w-5" />
        </span>

        <div>
          <h1 className="text-title-3 font-semibold text-text-primary">Something scatter</h1>
          <p className="mt-1.5 text-subhead text-text-secondary">
            This part of WetinDey no fit load. The problem na for our side, no be yours — we don hear
            about am.
          </p>
        </div>

        <div className="flex w-full flex-col gap-2">
          <button
            onClick={handleRetry}
            disabled={retrying}
            className="flex min-h-tap w-full items-center justify-center gap-2 squircle bg-accent px-4 text-headline text-accent-contrast transition-opacity duration-micro ease-decelerate active:opacity-80 disabled:opacity-50"
          >
            <RefreshCw className={retrying ? "h-4 w-4 animate-spin" : "h-4 w-4"} strokeWidth={2.5} />
            Try again
          </button>
          <button
            onClick={() => window.location.reload()}
            className="flex min-h-tap w-full items-center justify-center squircle bg-fillTertiary px-4 text-headline text-text-primary transition-opacity duration-micro ease-decelerate active:opacity-60"
          >
            Reload the app
          </button>
        </div>

        {/**
         * The id, quietly, at the bottom.
         *
         * `error.digest` is the only thing that crosses the wire when a SERVER
         * error is serialised to the client — Next strips the message on
         * purpose — so it is the single join between this screen and the log
         * line. The event id joins it to Sentry. Neither means anything to the
         * user; both mean everything to whoever they tell about it, so they are
         * present, selectable and visually last.
         */}
        {(eventId || error.digest) && (
          <p className="select-text text-caption-2 text-text-tertiary">
            Ref {error.digest ?? eventId?.slice(0, 8)}
          </p>
        )}
      </div>
    </div>
  );
}
