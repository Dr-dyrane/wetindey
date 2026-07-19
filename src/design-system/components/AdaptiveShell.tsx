"use client";

import React, { useCallback, useLayoutEffect, useRef } from "react";
import { CompactShell } from "./CompactShell";
import { RegularShell, PANEL_LEADING_OCCLUSION } from "./RegularShell";
import { useMediaQuery } from "@/core/hooks/useMediaQuery";
import { type Detent, type LiveSheetInset } from "./BottomSheet";

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

export function shellBottomInset(
  isRegular: boolean,
  shellBottom: number,
  inset: LiveSheetInset | null
): string {
  if (isRegular || inset === null) return "0px";
  return `${Math.max(0, shellBottom - inset.sheetTop).toFixed(2)}px`;
}

export function AdaptiveShell({
  mapNode,
  sheetNode,
  detailNode,
  detailLabel,
  onDetailBack,
  backLabel,
  activeDetent,
  setActiveDetent,
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
  const shellRef = useRef<HTMLDivElement>(null);
  const isRegularRef = useRef(isRegular === true);
  isRegularRef.current = isRegular === true;

  /** Keep drag-rate geometry outside React state and its detent feedback loop. */
  const publishLiveInset = useCallback((inset: LiveSheetInset | null) => {
    const shell = shellRef.current;
    if (!shell) return;
    shell.style.setProperty(
      "--shell-bottom-inset",
      shellBottomInset(isRegularRef.current, shell.getBoundingClientRect().bottom, inset)
    );
  }, []);

  useLayoutEffect(() => {
    if (isRegular !== false) publishLiveInset(null);
  }, [isRegular, publishLiveInset]);

  /** One set of stack props, one detail node, both size classes. */
  const stack = {
    listNode: sheetNode,
    detailNode,
    detailLabel,
    onDetailBack,
    backLabel,
  };

  return (
    <div
      ref={shellRef}
      className="relative h-full min-h-screen w-full overflow-hidden bg-page"
      /**
       * The edges the shell occludes, published for the map layer.
       *
       * LEADING — camera padding so a selected pin never lands under the panel,
       * and an offset for the location pill, which sits at `left-4` inside the
       * z-0 map layer and is therefore covered by the panel at every regular
       * width today.
       *
       * BOTTOM — how much of the viewport the sheet covers, so anything the map
       * layer must keep REACHABLE can sit above it. The map's "Try again" was
       * centred in the full viewport and therefore landed under the sheet at the
       * default detent — a recovery control you cannot reach is not a recovery.
       *
       * This root is the only common ancestor of the z-0 map layer and the z-10
       * sheet, which is why the number has to be published from here.
       * `--sheet-hidden` cannot serve: it is an inline style on the sheet
       * ELEMENT, so it inherits down its own subtree and resolves to nothing on
       * the map layer — they are siblings, and custom properties do not travel
       * sideways. It is also the wrong quantity (the part hanging BELOW the
       * viewport, not the part covering it).
       *
       * BottomSheet publishes the rendered compact geometry directly here.
       * This keeps drag-rate updates outside React while map controls inherit
       * the actual layout-coordinate pixel inset through the shared shell
       * variable. Safe-area padding has one owner: its map-control consumer.
       *
       * Both consumers live in files owned elsewhere; these are the numbers they
       * need, made available rather than described.
       */
      style={
        {
          "--shell-leading-inset": isRegular ? PANEL_LEADING_OCCLUSION : "0px",
          // BottomSheet replaces this after it measures its rendered rect.
          "--shell-bottom-inset": "0px",
        } as React.CSSProperties
      }
    >
      {/*
        Persistent Global Map Layer:
        Mounted once at the root (z-0), ABOVE the size-class branch, so the WebGL
        context survives crossing 768 — which an iPad Split View drag does live,
        mid-gesture.
      */}
      <div className="absolute inset-0 z-0">{mapNode}</div>

      {isRegular === null ? null : (
        /* Pointer-transparent down to the panel itself — a full-size
           pointer-events-auto layer here would swallow every map gesture. */
        <div className="pointer-events-none absolute inset-0 z-10">
          {isRegular ? (
            <RegularShell {...stack} />
          ) : (
            <CompactShell
              {...stack}
              activeDetent={activeDetent}
              setActiveDetent={setActiveDetent}
              onLiveInsetChange={publishLiveInset}
            />
          )}
        </div>
      )}
    </div>
  );
}
