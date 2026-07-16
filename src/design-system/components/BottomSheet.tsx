"use client";

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

export type Detent = "peek" | "medium" | "large";

interface BottomSheetProps {
  children: React.ReactNode;
  detent: Detent;
  onDetentChange: (d: Detent) => void;
  /** Rendered above the sheet, dimmed as the sheet approaches `large`. */
  backdropTarget?: React.ReactNode;
}

/** Fraction of viewport height each detent occupies. */
const DETENT_FRACTION: Record<Detent, number> = {
  peek: 0.20,
  medium: 0.52,
  large: 0.94,
};

const ORDER: Detent[] = ["peek", "medium", "large"];

/** Island geometry at rest. The sheet floats inset from the screen edges... */
const ISLAND_INSET = 10;
const ISLAND_RADIUS = 28;
/** ...and docks flush once it expands. */
const DOCKED_RADIUS = 20;

/**
 * How far past `medium` the sheet must travel before it starts docking.
 * Docking is driven by height rather than by the committed detent so the island
 * dissolves *under your finger* during the drag, not in a jump on release.
 */
const DOCK_START = 0.62;
const DOCK_END = 0.88;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const invLerp = (a: number, b: number, v: number) => clamp((v - a) / (b - a), 0, 1);

/**
 * iOS-style sheet with three detents.
 *
 * Two behaviours make it feel native rather than merely draggable:
 *
 * 1. Velocity projection. Release position alone can't tell a flick from a
 *    slow drag, so we project where the sheet *would* land if the current
 *    velocity decayed, and snap to whatever detent is nearest that point. A
 *    fast flick therefore skips a detent the way it does on iOS.
 *
 * 2. Scroll coordination. The sheet and its content compete for the same
 *    vertical drag. The content wins unless it is already scrolled to the top
 *    and the drag is downward — which is exactly the gesture that should
 *    collapse the sheet instead of doing nothing.
 */
export function BottomSheet({ children, detent, onDetentChange, backdropTarget }: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [vh, setVh] = useState(0);
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Pointer bookkeeping. Refs, not state: these change every pointermove and
  // must not trigger a render.
  const drag = useRef<{
    startY: number;
    startHeight: number;
    lastY: number;
    lastT: number;
    velocity: number;
    /** null until we decide whether this gesture belongs to the sheet or the list. */
    claimed: "sheet" | "scroll" | null;
    pointerId: number;
  } | null>(null);

  useLayoutEffect(() => {
    const measure = () => setVh(window.innerHeight);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const heightFor = useCallback((d: Detent) => vh * DETENT_FRACTION[d], [vh]);

  /**
   * At rest the height is expressed in `vh`, not pixels.
   *
   * Pixels would need window.innerHeight, which does not exist during SSR — the
   * server would emit height:0 and the client would immediately correct it,
   * producing a hydration mismatch and a visible jump on first paint. A `vh`
   * string is identical on both sides and tracks viewport changes for free.
   * Pixels are only used mid-drag, which is client-only by definition.
   */
  const fraction = dragHeight !== null && vh > 0 ? dragHeight / vh : DETENT_FRACTION[detent];
  const heightStyle = dragHeight !== null ? `${dragHeight}px` : `${DETENT_FRACTION[detent] * 100}vh`;

  // 0 = floating island, 1 = fully docked to the edges.
  const dock = invLerp(DOCK_START, DOCK_END, fraction);
  const sideInset = lerp(ISLAND_INSET, 0, dock);
  const bottomInset = lerp(ISLAND_INSET, 0, dock);
  const bottomRadius = lerp(ISLAND_RADIUS, 0, dock);
  const topRadius = lerp(ISLAND_RADIUS, DOCKED_RADIUS, dock);
  // Only dim the map once the sheet is genuinely taking over the screen.
  const backdropOpacity = invLerp(DETENT_FRACTION.medium, DETENT_FRACTION.large, fraction) * 0.28;

  const snapTo = useCallback(
    (projectedHeight: number) => {
      let best: Detent = "medium";
      let bestDist = Infinity;
      for (const d of ORDER) {
        const dist = Math.abs(projectedHeight - heightFor(d));
        if (dist < bestDist) {
          bestDist = dist;
          best = d;
        }
      }
      return best;
    },
    [heightFor]
  );

  const onPointerDown = (e: React.PointerEvent) => {
    if (vh === 0) return;
    const el = sheetRef.current;
    if (!el) return;
    drag.current = {
      startY: e.clientY,
      startHeight: el.getBoundingClientRect().height,
      lastY: e.clientY,
      lastT: e.timeStamp,
      velocity: 0,
      claimed: null,
      pointerId: e.pointerId,
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointerId) return;

    const dy = d.startY - e.clientY; // positive = dragging up = growing
    const scroller = scrollRef.current;

    if (d.claimed === null) {
      // Ignore sub-pixel jitter until the gesture has a clear direction.
      if (Math.abs(dy) < 4) return;
      const atTop = !scroller || scroller.scrollTop <= 0;
      const draggingDown = dy < 0;
      // The list keeps the gesture unless we're pulling down from its top.
      d.claimed = atTop && draggingDown ? "sheet" : scroller && scroller.scrollHeight > scroller.clientHeight ? "scroll" : "sheet";
      // Growing the sheet from a non-large detent is always the sheet's gesture.
      if (!draggingDown && detent !== "large") d.claimed = "sheet";
      if (d.claimed === "sheet") {
        setIsDragging(true);
        (e.target as Element).setPointerCapture?.(e.pointerId);
      }
    }

    if (d.claimed !== "sheet") return;

    const dt = Math.max(1, e.timeStamp - d.lastT);
    d.velocity = (d.lastY - e.clientY) / dt; // px per ms, positive = growing
    d.lastY = e.clientY;
    d.lastT = e.timeStamp;

    const raw = d.startHeight + dy;
    const min = vh * 0.12;
    const max = vh * DETENT_FRACTION.large;
    // Rubber-band past the top stop rather than hard-clamping, so the sheet
    // resists instead of stopping dead.
    const next = raw > max ? max + (raw - max) * 0.18 : raw < min ? min - (min - raw) * 0.18 : raw;
    setDragHeight(next);
    e.preventDefault();
  };

  const endDrag = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.claimed !== "sheet" || dragHeight === null) {
      setIsDragging(false);
      setDragHeight(null);
      return;
    }
    // Project the throw: velocity decays over ~150ms of remaining travel.
    const projected = dragHeight + d.velocity * 150;
    const target = snapTo(projected);
    onDetentChange(target);
    setDragHeight(null);
    setIsDragging(false);
    (e.target as Element).releasePointerCapture?.(d.pointerId);
  };

  // Tapping the grabber steps up a detent, and back to the bottom once expanded.
  // This is the keyboard-reachable equivalent of the drag, so the sheet is not
  // gesture-only.
  const cycleDetent = () => {
    const i = ORDER.indexOf(detent);
    onDetentChange(i === ORDER.length - 1 ? ORDER[0] : ORDER[i + 1]);
  };

  // A sheet that grows should always show its content from the top.
  useEffect(() => {
    if (detent === "peek" && scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [detent]);

  return (
    <>
      {backdropTarget}
      {/* Scrim: dims and disables the map as the sheet takes over. */}
      <div
        aria-hidden
        onClick={() => onDetentChange("medium")}
        className="absolute inset-0 z-10 bg-black transition-opacity duration-standard ease-decelerate"
        style={{
          opacity: backdropOpacity,
          pointerEvents: backdropOpacity > 0.2 ? "auto" : "none",
        }}
      />

      <div
        ref={sheetRef}
        role="dialog"
        aria-label="Results"
        style={{
          height: heightStyle,
          left: sideInset,
          right: sideInset,
          bottom: bottomInset,
          borderTopLeftRadius: topRadius,
          borderTopRightRadius: topRadius,
          borderBottomLeftRadius: bottomRadius,
          borderBottomRightRadius: bottomRadius,
          // Below the island threshold the sheet is a distinct object over the
          // map and needs a full drop shadow; docked, it only needs to lift off
          // its top edge.
          boxShadow: dock < 0.5 ? "var(--shadow-island)" : "var(--shadow-sheet)",
        }}
        className={`absolute z-20 flex flex-col overflow-hidden bg-background pointer-events-auto ${
          isDragging ? "transition-none" : "transition-[height,left,right,bottom,border-radius] duration-sheet ease-decelerate"
        }`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {/* Grabber */}
        <button
          type="button"
          onClick={cycleDetent}
          aria-label={`Sheet position: ${detent}. Activate to change.`}
          className="w-full pt-2.5 pb-1.5 flex items-center justify-center shrink-0 touch-none cursor-grab active:cursor-grabbing"
        >
          <span className="w-9 h-[5px] rounded-full bg-text-tertiary" />
        </button>

        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto overscroll-contain"
          style={{ paddingBottom: `calc(var(--safe-area-bottom) + 8px)` }}
        >
          {children}
        </div>
      </div>
    </>
  );
}
