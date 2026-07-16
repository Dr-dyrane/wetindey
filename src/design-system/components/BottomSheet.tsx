"use client";

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

export type Detent = "peek" | "medium" | "large";

interface BottomSheetProps {
  children: React.ReactNode;
  detent: Detent;
  onDetentChange: (d: Detent) => void;
}

/** Fraction of viewport height each detent shows. */
export const DETENT_FRACTION: Record<Detent, number> = {
  peek: 0.20,
  medium: 0.52,
  large: 0.94,
};

const ORDER: Detent[] = ["peek", "medium", "large"];

/** Island geometry at rest — floats inset from the edges... */
const ISLAND_INSET = 10;
export const SHEET_RADIUS = 28;
/** ...and docks flush when expanded. Top radius is held at SHEET_RADIUS so the
 *  sheet's roundness is one constant across every surface in the app. */

const DOCK_START = 0.62;
const DOCK_END = 0.88;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const invLerp = (a: number, b: number, v: number) => clamp((v - a) / (b - a), 0, 1);

/**
 * iOS-style sheet with three detents.
 *
 * MOTION MODEL — this is the thing that makes it feel native rather than
 * merely draggable. The sheet is a FIXED-SIZE surface (always the height of the
 * large detent) that is moved with `transform: translateY`. It is never
 * resized.
 *
 * The previous version animated `height`, which forced a full layout of every
 * card, image and text run inside the sheet on every single drag frame — layout
 * on the main thread at 60fps, which is exactly why dragging felt like the page
 * was reloading under your finger. A transform is composited: the content is
 * laid out once and the GPU slides it. Nothing inside the sheet reflows while
 * you drag.
 *
 * Two behaviours complete the feel:
 *
 * 1. Velocity projection — release position alone can't tell a flick from a
 *    slow drag, so we project where the sheet would land and snap to the
 *    nearest detent. A fast flick skips a detent, as on iOS.
 * 2. Scroll coordination — the list keeps the gesture unless it is already at
 *    its top and you are pulling down, which is the gesture that should
 *    collapse the sheet rather than do nothing.
 */
export function BottomSheet({ children, detent, onDetentChange }: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [vh, setVh] = useState(0);
  /** Live fraction while dragging; null when resting on a detent. */
  const [dragFraction, setDragFraction] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const drag = useRef<{
    startY: number;
    startFraction: number;
    lastY: number;
    lastT: number;
    velocity: number;
    claimed: "sheet" | "scroll" | null;
    pointerId: number;
  } | null>(null);

  useLayoutEffect(() => {
    const measure = () => setVh(window.innerHeight);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const fraction = dragFraction ?? DETENT_FRACTION[detent];

  /**
   * The surface is always LARGE-tall; translateY hides the surplus.
   * Expressed in vh so the resting transform is identical on server and client
   * — px would need window.innerHeight, which SSR does not have, and the
   * mismatch shows up as a jump on first paint.
   */
  const hiddenFraction = DETENT_FRACTION.large - fraction;
  const translate = `${(hiddenFraction * 100).toFixed(3)}vh`;

  // 0 = floating island, 1 = docked to the edges.
  const dock = invLerp(DOCK_START, DOCK_END, fraction);
  const sideInset = lerp(ISLAND_INSET, 0, dock);
  const bottomInset = lerp(ISLAND_INSET, 0, dock);
  const bottomRadius = lerp(SHEET_RADIUS, 0, dock);
  const backdropOpacity = invLerp(DETENT_FRACTION.medium, DETENT_FRACTION.large, fraction) * 0.28;

  const snapTo = useCallback((projected: number) => {
    let best: Detent = "medium";
    let bestDist = Infinity;
    for (const d of ORDER) {
      const dist = Math.abs(projected - DETENT_FRACTION[d]);
      if (dist < bestDist) {
        bestDist = dist;
        best = d;
      }
    }
    return best;
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    if (vh === 0) return;
    drag.current = {
      startY: e.clientY,
      startFraction: DETENT_FRACTION[detent],
      lastY: e.clientY,
      lastT: e.timeStamp,
      velocity: 0,
      claimed: null,
      pointerId: e.pointerId,
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointerId || vh === 0) return;

    const dy = d.startY - e.clientY; // positive = up = growing
    const scroller = scrollRef.current;

    if (d.claimed === null) {
      if (Math.abs(dy) < 4) return; // ignore jitter until direction is clear
      const atTop = !scroller || scroller.scrollTop <= 0;
      const down = dy < 0;
      d.claimed =
        atTop && down
          ? "sheet"
          : scroller && scroller.scrollHeight > scroller.clientHeight
            ? "scroll"
            : "sheet";
      if (!down && detent !== "large") d.claimed = "sheet";
      if (d.claimed === "sheet") {
        setIsDragging(true);
        (e.target as Element).setPointerCapture?.(e.pointerId);
      }
    }
    if (d.claimed !== "sheet") return;

    const dt = Math.max(1, e.timeStamp - d.lastT);
    d.velocity = (d.lastY - e.clientY) / dt / vh; // fraction per ms
    d.lastY = e.clientY;
    d.lastT = e.timeStamp;

    const raw = d.startFraction + dy / vh;
    const min = 0.12;
    const max = DETENT_FRACTION.large;
    // Rubber-band past the stops so the sheet resists rather than stopping dead.
    const next = raw > max ? max + (raw - max) * 0.18 : raw < min ? min - (min - raw) * 0.18 : raw;
    setDragFraction(next);
    e.preventDefault();
  };

  const endDrag = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.claimed !== "sheet" || dragFraction === null) {
      setIsDragging(false);
      setDragFraction(null);
      return;
    }
    // Project the throw: velocity decays over ~150ms of remaining travel.
    onDetentChange(snapTo(dragFraction + d.velocity * 150));
    setDragFraction(null);
    setIsDragging(false);
    (e.target as Element).releasePointerCapture?.(d.pointerId);
  };

  const cycleDetent = () => {
    const i = ORDER.indexOf(detent);
    onDetentChange(i === ORDER.length - 1 ? ORDER[0] : ORDER[i + 1]);
  };

  useEffect(() => {
    if (detent === "peek" && scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [detent]);

  return (
    <>
      <div
        aria-hidden
        onClick={() => onDetentChange("medium")}
        className="absolute inset-0 z-10 bg-dim transition-opacity duration-standard ease-decelerate"
        style={{ opacity: backdropOpacity, pointerEvents: backdropOpacity > 0.2 ? "auto" : "none" }}
      />

      <div
        ref={sheetRef}
        role="dialog"
        aria-label="Results"
        style={{
          height: `${DETENT_FRACTION.large * 100}vh`,
          transform: `translate3d(0, ${translate}, 0)`,
          left: sideInset,
          right: sideInset,
          bottom: bottomInset,
          borderTopLeftRadius: SHEET_RADIUS,
          borderTopRightRadius: SHEET_RADIUS,
          borderBottomLeftRadius: bottomRadius,
          borderBottomRightRadius: bottomRadius,
          boxShadow: dock < 0.5 ? "var(--shadow-island)" : "var(--shadow-sheet)",
          // Promote to its own layer so the drag never touches the main thread.
          willChange: isDragging ? "transform" : "auto",
        }}
        /**
         * Glass while it floats, solid once docked: HIG says "Don't use Liquid
         * Glass in the content layer", and a docked sheet IS the content layer.
         */
        className={`absolute z-20 flex flex-col overflow-hidden pointer-events-auto ${
          dock > 0.5 ? "bg-background" : "material-regular"
        } ${
          isDragging
            ? "transition-none"
            : "transition-[transform,left,right,bottom,border-radius] duration-sheet ease-spring"
        }`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <button
          type="button"
          onClick={cycleDetent}
          aria-label={`Sheet position: ${detent}. Activate to change.`}
          className="flex w-full shrink-0 touch-none cursor-grab items-center justify-center pt-2.5 pb-1.5 active:cursor-grabbing"
        >
          <span className="h-[5px] w-9 rounded-full bg-text-tertiary" />
        </button>

        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto overscroll-contain"
          style={{ paddingBottom: "calc(var(--safe-area-bottom) + 8px)" }}
        >
          {children}
        </div>
      </div>
    </>
  );
}
