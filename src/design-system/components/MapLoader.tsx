"use client";

import React from "react";
import { RefreshCw, WifiOff } from "lucide-react";

/**
 * Map placeholder.
 *
 * A spinner over a void is the wrong answer for a map: the map IS the page, so
 * an empty rectangle reads as "broken", not "loading". This stands in for what
 * the real basemap looks like at t=0 — Mapbox paints a flat background colour,
 * then landuse and water polygons, then roads, and only then any detail. So that
 * is what this paints. The layout stays stable and the swap into live tiles is a
 * gain of detail rather than a change of scene.
 *
 * ABSTRACT, AND BLURRED TO SAY SO. It is not Festac, not derived from map data,
 * and nothing in it is a road. A placeholder that looked like real geography
 * would be a lie about where you are, told at the one moment the user has no map
 * to check it against — which on a wayfinding surface is worse than an empty box.
 * The blur is the honest register: it keeps the *structure* of a map (regions,
 * roads, a horizon of streets) while making sure nobody can read a street off it
 * or believe a road exists. Detail is exactly the thing it must not have.
 *
 * THEME-SENSITIVE THROUGH THE CASCADE, WITHOUT JS. Every colour here is a
 * semantic token, so `.dark` on <html> re-resolves the whole drawing with no
 * render and no read. That is not a preference: the theme is set by a blocking
 * script in layout.tsx, and reading it in JS here would race that script and
 * flash the wrong basemap under the one the user chose — the same trap
 * MapboxCanvas documents at its own init.
 *
 * The token mapping is what makes it resemble both basemaps at once:
 *   land  → surface-sunken
 *   roads → surface-elevated, which is LIGHTER than the land in BOTH themes.
 *           That is what streets-v12 (white roads on warm grey) and dark-v11
 *           (grey roads on near-black) each do, so one pair of tokens tracks the
 *           real basemap through a runtime theme toggle.
 */

/**
 * Hand-authored geometry. Two properties, both load-bearing.
 *
 * IRREGULAR. Evenly-spaced lines on a shared pitch read as graph paper, which is
 * a diagram of a city rather than a city — and Lagos is not one either way. This
 * sits exactly where the real map is about to appear, so the eye compares the two
 * directly and any regularity is the first thing it catches.
 *
 * FIXED, never generated. Math.random() would reshuffle between renders, which
 * reads as a glitch, and would disagree between server and client, which is a
 * hydration mismatch.
 */

/** The big tonal regions Mapbox lays down under the roads. Two weights, so the
 *  ground is not one flat sheet; deliberately not colour-coded as water or park,
 *  because at this blur they are shapes, not claims about terrain. */
const REGIONS: readonly (readonly [string, string])[] = [
  ["M 104 40 C 94 45, 85 52, 78 61 C 71 70, 66 81, 64 104 L 104 104 Z", "fill-fillTertiary"],
  ["M -4 10 C 7 4, 21 8, 27 18 C 31 25, 25 35, 14 37 C 4 39, -4 31, -4 21 Z", "fill-fillQuaternary"],
  ["M -4 74 C 7 70, 18 76, 20 86 C 22 96, 11 104, -4 102 Z", "fill-fillQuaternary"],
  ["M 80 6 C 92 1, 104 8, 104 18 C 104 27, 91 31, 83 25 C 76 20, 74 9, 80 6 Z", "fill-fillQuaternary"],
  ["M 44 66 C 52 63, 60 68, 59 76 C 58 84, 48 87, 43 81 C 39 76, 39 68, 44 66 Z", "fill-fillQuaternary"],
];

/** [path, width]. Widths and spacing vary by an order of magnitude because a real
 *  network does: one expressway, two arterials that bend, and side streets that
 *  meet them at the junctions rather than ruling the field into squares. */
const ROADS: readonly (readonly [string, number])[] = [
  ["M -4 72 C 18 68, 36 63, 54 59 C 72 55, 88 50, 104 44", 2.8],
  ["M 30 -4 C 28 12, 26 28, 31 44 C 36 60, 41 78, 37 104", 1.9],
  ["M 70 -4 C 73 10, 68 24, 70 40 C 72 54, 78 70, 82 104", 1.7],
  ["M -4 32 C 14 34, 32 29, 50 33 C 68 37, 86 34, 104 29", 1.5],
  ["M 2 104 C 18 82, 34 64, 52 50 C 66 39, 85 30, 104 17", 1.1],
  ["M 31 44 C 42 42, 54 41, 70 40", 0.8],
  ["M 54 59 C 55 70, 57 82, 56 96", 0.7],
  ["M 8 47 C 17 46, 24 45, 31 44", 0.6],
  ["M 82 47 C 90 47, 97 48, 104 49", 0.6],
  ["M 13 63 C 14 74, 16 84, 15 96", 0.6],
  ["M 37 22 C 48 24, 58 21, 68 23", 0.6],
];

/** Static: only one map layer exists, and both placeholders are mutually
 *  exclusive, so this id can never collide with a second live copy. */
const BLUR_ID = "map-placeholder-blur";

function BasemapSkeleton() {
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 h-full w-full"
      aria-hidden
    >
      <defs>
        {/* In viewBox units, so the blur scales with the drawing instead of
            sharpening into legible geography on a large screen. */}
        <filter id={BLUR_ID} filterUnits="userSpaceOnUse" x="-12" y="-12" width="124" height="124">
          <feGaussianBlur stdDeviation="0.8" />
        </filter>
      </defs>

      {/* The flat background colour, which is genuinely the first thing the real
          basemap paints. Left unblurred: it is a solid field, and blurring it
          would only bleed the edges of the canvas. */}
      <rect width="100" height="100" className="fill-surface-sunken" />

      <g filter={`url(#${BLUR_ID})`}>
        {REGIONS.map(([d, className]) => (
          <path key={d} d={d} className={className} />
        ))}
        {ROADS.map(([d, width]) => (
          <path
            key={d}
            d={d}
            className="fill-none stroke-surface-elevated"
            strokeWidth={width}
            strokeLinecap="round"
          />
        ))}
      </g>
    </svg>
  );
}

export function MapLoading() {
  return (
    <div className="absolute inset-0 overflow-hidden" role="status" aria-label="Loading map">
      <BasemapSkeleton />
      {/* Sheen sweeps across the basemap — the standard skeleton cue that this is
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
      <BasemapSkeleton />
      {/* The old failure path logged "Falling back to static map canvas" and
          rendered nothing at all — a blank rectangle with no explanation and no
          way out. */}
      {/* Centred in the band the sheet LEAVES, not in the viewport. Centred in
          the viewport, this card landed under the sheet at `medium` — the
          default — so the only way out of a failed map was to first drag away
          the sheet that was hiding it. AdaptiveShell publishes the occlusion;
          the `0px` fallback keeps RegularShell (which mounts no sheet) centred
          in the full viewport, which is correct there. */}
      <div
        className="absolute inset-x-0 top-0 grid place-items-center p-6"
        style={{ bottom: "var(--shell-bottom-inset, 0px)" }}
      >
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
