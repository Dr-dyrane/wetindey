"use client";

import React from "react";
import { RefreshCw, WifiOff } from "lucide-react";

/**
 * Map placeholder.
 *
 * A spinner over a void is the wrong answer for a map: the map IS the page, so
 * an empty rectangle reads as "broken", not "loading". This draws a plausible
 * street grid instead — a skeleton in the shape of the thing arriving — so the
 * layout is stable and the eye has somewhere to rest while tiles fetch.
 *
 * The grid is deliberately abstract. It is NOT Festac, and it is not derived
 * from map data: a fake map that looked real would be a lie about where you
 * are, which on a wayfinding surface is worse than an empty box.
 */
function StreetSkeleton() {
  // Fixed, not random: a placeholder that reshuffles between renders reads as a
  // glitch, and Math.random() would also break SSR/client agreement.
  const vertical = [8, 23, 41, 58, 71, 88];
  const horizontal = [14, 31, 47, 63, 79, 92];
  const blocks = [
    [12, 18, 9, 10], [28, 18, 11, 10], [46, 18, 10, 10], [62, 18, 8, 10],
    [12, 35, 9, 10], [28, 35, 11, 10], [46, 35, 10, 10], [62, 35, 8, 10],
    [12, 51, 9, 10], [28, 51, 11, 10], [46, 51, 10, 10], [62, 51, 8, 10],
    [12, 67, 9, 10], [28, 67, 11, 10], [46, 67, 10, 10], [62, 67, 8, 10],
  ];

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 h-full w-full"
      aria-hidden
    >
      <rect width="100" height="100" className="fill-surface-sunken" />
      {blocks.map(([x, y, w, h], i) => (
        <rect key={i} x={x} y={y} width={w} height={h} rx="1" className="fill-fillQuaternary" />
      ))}
      {vertical.map((x) => (
        <rect key={`v${x}`} x={x} y="0" width="1.6" height="100" className="fill-fillTertiary" />
      ))}
      {horizontal.map((y) => (
        <rect key={`h${y}`} x="0" y={y} width="100" height="1.6" className="fill-fillTertiary" />
      ))}
      {/* One diagonal so it doesn't read as graph paper. */}
      <rect x="-10" y="55" width="130" height="2.4" transform="rotate(-18 50 56)" className="fill-fillTertiary" />
    </svg>
  );
}

export function MapLoading() {
  return (
    <div className="absolute inset-0 overflow-hidden" role="status" aria-label="Loading map">
      <StreetSkeleton />
      {/* Sheen sweeps across the grid — the standard skeleton cue that this is
          pending rather than final. Honours prefers-reduced-motion via the
          global rule that collapses animations. */}
      <div
        className="absolute inset-0 animate-pulse"
        style={{
          background:
            "linear-gradient(100deg, transparent 30%, var(--color-fill-quaternary) 50%, transparent 70%)",
        }}
      />
    </div>
  );
}

export function MapFailed({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <StreetSkeleton />
      {/* The old failure path logged "Falling back to static map canvas" and
          rendered nothing at all — a blank rectangle with no explanation and no
          way out. */}
      <div className="absolute inset-0 grid place-items-center p-6">
        <div className="flex max-w-[280px] flex-col items-center gap-3 squircle material-thick px-5 py-4 text-center shadow-raised">
          <span className="grid h-9 w-9 place-items-center squircle-full bg-status-caution-bg text-status-caution-fg">
            <WifiOff className="h-[18px] w-[18px]" />
          </span>
          <div>
            <p className="text-subhead font-semibold text-text-primary">Map no fit load</p>
            <p className="mt-0.5 text-footnote text-text-secondary">
              Check your network. Prices below still dey work.
            </p>
          </div>
          {onRetry && (
            <button
              onClick={onRetry}
              className="flex min-h-tap items-center gap-1.5 px-3 text-subhead font-semibold text-status-info-fg active:opacity-60"
            >
              <RefreshCw className="h-4 w-4" strokeWidth={2.5} />
              Try again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
