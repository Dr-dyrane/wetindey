"use client";

import React from "react";
import { CompactShell } from "./CompactShell";
import { RegularShell, PANEL_LEADING_OCCLUSION } from "./RegularShell";
import { useMediaQuery } from "@/core/hooks/useMediaQuery";
import type { Detent } from "./BottomSheet";

interface AdaptiveShellProps {
  mapNode: React.ReactNode;
  sheetNode: React.ReactNode;
  detailNode?: React.ReactNode;
  /** Optional, additive: accessible name for the pushed detail level. */
  detailLabel?: string;
  /** Optional, additive: pops the detail level. `detailNode`'s own close
   *  control already pops, so omitting this costs a back row, not the feature. */
  onDetailBack?: () => void;
  /** Optional, additive: back row label, for the app's three languages. */
  backLabel?: string;
  activeDetent: Detent;
  setActiveDetent: (detent: Detent) => void;
}

/**
 * The app's ONLY width boundary, kept in one place so JS and CSS cannot drift.
 *
 * It is a VIEWPORT query, not a device test. `window.matchMedia` reports the
 * window, which is the whole point: an iPad in Split View reports ~320-507px and
 * lands in the compact branch for free, a desktop window dragged narrow becomes
 * compact mid-drag, and an iPhone Pro Max in landscape is regular. Device names
 * do not predict layout, so nothing here may ever consult one — no UA sniffing,
 * no `pointer: coarse`, no `screen.width`, no `navigator.maxTouchPoints`. Each
 * of those breaks on the first case above.
 *
 * 768 is where the geometry stops lying rather than where a tablet starts: below
 * it, a panel wide enough to hold the list permanently occludes a map that
 * cannot be dragged out of the way. A sheet can. That is the difference between
 * the two layouts, and it is the only difference — everything inside them is
 * one component.
 */
const REGULAR_QUERY = "(min-width: 768px)";

export function AdaptiveShell({
  mapNode,
  sheetNode,
  detailNode,
  detailLabel,
  onDetailBack,
  backLabel,
  activeDetent,
  setActiveDetent
}: AdaptiveShellProps) {
  /**
   * Exactly ONE shell is mounted.
   *
   * This used to render `sheetNode` into BOTH shells and hide one with
   * `hidden md:block`. CSS cannot unmount, so every list, every card and every
   * remote image existed twice in the DOM — 8 items produced 16 cards and 16
   * image requests. That duplicate fetch is part of what tripped Wikimedia's
   * rate limiter, and it doubled React's work on every keystroke of search.
   *
   * `null` means the media query has not resolved yet (SSR / first paint). We
   * render the map alone rather than guess a breakpoint, because guessing wrong
   * is a hydration mismatch. ThemeProvider keeps the tree invisible until mount,
   * so this frame is never seen.
   */
  const isRegular = useMediaQuery(REGULAR_QUERY);

  /** One set of stack props, one detail node, both size classes. */
  const stack = {
    listNode: sheetNode,
    detailNode,
    detailLabel,
    onDetailBack,
    backLabel
  };

  return (
    <div
      className="relative w-full h-full min-h-screen overflow-hidden bg-background"
      /**
       * The leading edge the shell occludes, published for the map layer:
       * camera padding so a selected pin never lands under the panel, and an
       * offset for the location pill, which sits at `left-4` inside the z-0 map
       * layer and is therefore covered by the panel at every regular width
       * today. Both consumers live in files owned elsewhere; this is the number
       * they need, made available rather than described.
       */
      style={{ "--shell-leading-inset": isRegular ? PANEL_LEADING_OCCLUSION : "0px" } as React.CSSProperties}
    >
      {/*
        Persistent Global Map Layer:
        Mounted once at the root (z-0), ABOVE the size-class branch, so the WebGL
        context survives crossing 768 — which an iPad Split View drag does live,
        mid-gesture.
      */}
      <div className="absolute inset-0 z-0">
        {mapNode}
      </div>

      {isRegular === null ? null : (
        /* Pointer-transparent down to the panel itself — a full-size
           pointer-events-auto layer here would swallow every map gesture. */
        <div className="absolute inset-0 z-10 pointer-events-none">
          {isRegular ? (
            <RegularShell {...stack} />
          ) : (
            <CompactShell
              {...stack}
              activeDetent={activeDetent}
              setActiveDetent={setActiveDetent}
            />
          )}
        </div>
      )}
    </div>
  );
}
