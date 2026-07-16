"use client";

import React from "react";
import { MobileShell } from "./MobileShell";
import { DesktopTabletShell } from "./DesktopTabletShell";
import { useMediaQuery } from "@/core/hooks/useMediaQuery";
import type { Detent } from "./BottomSheet";

interface AdaptiveShellProps {
  mapNode: React.ReactNode;
  sheetNode: React.ReactNode;
  detailNode?: React.ReactNode;
  activeDetent: Detent;
  setActiveDetent: (detent: Detent) => void;
}

/** Tailwind's `md` breakpoint, kept in one place so JS and CSS cannot drift. */
const DESKTOP_QUERY = "(min-width: 768px)";

export function AdaptiveShell({
  mapNode,
  sheetNode,
  detailNode,
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
  const isDesktop = useMediaQuery(DESKTOP_QUERY);

  return (
    <div className="relative w-full h-full min-h-screen overflow-hidden bg-background">
      {/*
        Persistent Global Map Layer:
        Mounted once at the root (z-0) so the WebGL context survives switching
        between the mobile sheet and the desktop sidebar.
      */}
      <div className="absolute inset-0 z-0">
        {mapNode}
      </div>

      {isDesktop === null ? null : isDesktop ? (
        <div className="absolute inset-0 z-10 pointer-events-none">
          <DesktopTabletShell
            mapNode={null} // Map is rendered globally at base layer
            sheetNode={sheetNode}
            detailNode={detailNode}
          />
        </div>
      ) : (
        /* Pointer-transparent down to the sheet itself — a full-size
           pointer-events-auto layer here would swallow every map gesture. */
        <div className="absolute inset-0 z-10 pointer-events-none">
          <MobileShell
            mapNode={null} // Map is rendered globally at base layer
            sheetNode={sheetNode}
            activeDetent={activeDetent}
            setActiveDetent={setActiveDetent}
          />
        </div>
      )}
    </div>
  );
}
