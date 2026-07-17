"use client";

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { haptics } from "@/lib/haptics";
import {
  DETENT_FRACTION,
  DETENT_ORDER,
  inverseLerp,
  motion,
  nearestDetent,
  nextDetent,
  resistedSheetFraction,
  releaseSheetVelocity,
  resolveSheetCancellation,
  resolveSheetRelease,
  transition,
  type Detent,
  useReducedMotion,
} from "@/design-system/motion";

export type { Detent } from "@/design-system/motion";
export { DETENT_FRACTION } from "@/design-system/motion";

interface BottomSheetProps {
  children: React.ReactNode;
  detent: Detent;
  onDetentChange: (detent: Detent) => void;
}

/** The shared shape token is re-exported for ModalSheet. */
export const SHEET_RADIUS = motion.radius.sheet;

const ISLAND_INSET = 10;

type DragClaim = "sheet" | "scroll" | null;

interface DragState {
  startY: number;
  startDetent: Detent;
  startFraction: number;
  currentFraction: number;
  lastY: number;
  lastTime: number;
  velocityFractionPerMs: number;
  claim: DragClaim;
  scroller: HTMLElement | null;
  pointerId: number;
}

/**
 * Three-detent map sheet.
 *
 * Direct manipulation is intentionally outside React state: pointer moves write
 * the rendered transform/backdrop once per animation frame, while React only
 * receives drag start/end and committed detent changes. This keeps data-heavy
 * descendants out of the 60/120Hz drag path and gives the gesture sole
 * ownership of the transform.
 */
export function BottomSheet({ children, detent, onDetentChange }: BottomSheetProps) {
  const sheetRef = useRef<HTMLElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const liveFrameRef = useRef<number | null>(null);
  const settleFrameRef = useRef<number | null>(null);
  const liveFractionRef = useRef<number | null>(null);
  const scrollAnchor = useRef(new WeakMap<HTMLElement, number>());
  const scrollSpent = useRef(new WeakMap<HTMLElement, boolean>());

  const [viewportHeight, setViewportHeight] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [settlingFraction, setSettlingFraction] = useState<number | null>(null);
  const reducedMotion = useReducedMotion();

  const restingFraction = settlingFraction ?? DETENT_FRACTION[detent];
  /* The sheet keeps one horizontal/bottom geometry at every detent. Changing
     left, right, or bottom with a detent makes the medium→large handoff jump
     even when those layout properties are not transitioned. Stable chrome
     lets transform own the entire visible settle. */
  const sideInset = ISLAND_INSET;
  const bottomInset = ISLAND_INSET;
  const bottomRadius = SHEET_RADIUS;
  const isExpandedPresentation = restingFraction >= DETENT_FRACTION.large;
  const restingBackdropOpacity =
    inverseLerp(DETENT_FRACTION.medium, DETENT_FRACTION.large, restingFraction) *
    motion.opacity.scrim;

  const translateForFraction = useCallback(
    (fraction: number) => {
      const hiddenFraction = DETENT_FRACTION.large - fraction;
      if (viewportHeight > 0) return `${(hiddenFraction * viewportHeight).toFixed(2)}px`;
      return `${(hiddenFraction * 100).toFixed(3)}vh`;
    },
    [viewportHeight]
  );

  const cancelLiveFrame = useCallback(() => {
    if (liveFrameRef.current !== null) cancelAnimationFrame(liveFrameRef.current);
    liveFrameRef.current = null;
    liveFractionRef.current = null;
  }, []);

  const cancelSettlingFrame = useCallback(() => {
    if (settleFrameRef.current !== null) cancelAnimationFrame(settleFrameRef.current);
    settleFrameRef.current = null;
  }, []);

  const applyFraction = useCallback(
    (fraction: number) => {
      const sheet = sheetRef.current;
      const backdrop = backdropRef.current;
      if (!sheet || !backdrop) return;

      sheet.style.transform = `translate3d(0, ${translateForFraction(fraction)}, 0)`;
      const opacity =
        inverseLerp(DETENT_FRACTION.medium, DETENT_FRACTION.large, fraction) * motion.opacity.scrim;
      backdrop.style.opacity = String(opacity);
      backdrop.style.pointerEvents = opacity > 0.2 ? "auto" : "none";
    },
    [translateForFraction]
  );

  const renderLiveFraction = useCallback(() => {
    liveFrameRef.current = null;
    const fraction = liveFractionRef.current;
    if (fraction === null) return;
    applyFraction(fraction);
  }, [applyFraction]);

  const scheduleLiveFraction = useCallback(
    (fraction: number) => {
      liveFractionRef.current = fraction;
      if (liveFrameRef.current === null)
        liveFrameRef.current = requestAnimationFrame(renderLiveFraction);
    },
    [renderLiveFraction]
  );

  useLayoutEffect(() => {
    const measure = () =>
      setViewportHeight(Math.round(window.visualViewport?.height ?? window.innerHeight));
    measure();
    window.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("resize", measure);
    };
  }, []);

  useEffect(
    () => () => {
      cancelLiveFrame();
      cancelSettlingFrame();
    },
    [cancelLiveFrame, cancelSettlingFrame]
  );

  const initialDetent = useRef(true);
  useEffect(() => {
    if (initialDetent.current) {
      initialDetent.current = false;
      return;
    }
    haptics.selection();
  }, [detent]);

  useEffect(() => {
    if (settlingFraction === null) return;
    if (Math.abs(settlingFraction - DETENT_FRACTION[detent]) < 0.0001) setSettlingFraction(null);
  }, [detent, settlingFraction]);

  const stepDetent = useCallback(
    (direction: 1 | -1) => {
      const next = nextDetent(detent, direction);
      if (next !== detent) onDetentChange(next);
    },
    [detent, onDetentChange]
  );

  const settle = useCallback(
    (next: Detent) => {
      cancelLiveFrame();
      cancelSettlingFrame();
      setIsDragging(false);

      /* A direct drag leaves an inline transform that React does not know it
         owns. Waiting one frame gives the snap recipe its transition again,
         then writes the target even when the chosen detent equals the prior
         prop (the otherwise easy-to-miss "drag, release, never snap back"
         case). */
      settleFrameRef.current = requestAnimationFrame(() => {
        settleFrameRef.current = null;
        const sheet = sheetRef.current;
        const backdrop = backdropRef.current;
        if (!sheet || !backdrop) return;

        sheet.style.transition = "";
        backdrop.style.transition = "";
        applyFraction(DETENT_FRACTION[next]);
        setSettlingFraction(DETENT_FRACTION[next]);
        if (next !== detent) onDetentChange(next);
      });
    },
    [applyFraction, cancelLiveFrame, cancelSettlingFrame, detent, onDetentChange]
  );

  const scrollerFrom = useCallback((target: EventTarget | null): HTMLElement | null => {
    let element = target instanceof HTMLElement ? target : null;
    for (; element && element !== sheetRef.current; element = element.parentElement) {
      if (element.scrollHeight <= element.clientHeight) continue;
      const overflowY = getComputedStyle(element).overflowY;
      if (overflowY === "auto" || overflowY === "scroll") return element;
    }
    return null;
  }, []);

  /** Reads the composited transform so a new drag can interrupt a settling sheet
      from the pixel the person actually sees, not from the prior prop value. */
  const renderedFraction = useCallback(() => {
    const sheet = sheetRef.current;
    if (!sheet || viewportHeight === 0) return restingFraction;
    const transform = getComputedStyle(sheet).transform;
    const matrix = transform.match(/^matrix\([^,]+,[^,]+,[^,]+,[^,]+,[^,]+,\s*([^)]+)\)$/);
    const translateY = matrix ? Number.parseFloat(matrix[1]!) : Number.NaN;
    if (!Number.isFinite(translateY)) return restingFraction;
    return DETENT_FRACTION.large - translateY / viewportHeight;
  }, [restingFraction, viewportHeight]);

  const onPointerDown = (event: React.PointerEvent<HTMLElement>) => {
    if (viewportHeight === 0) return;
    cancelSettlingFrame();
    const startFraction = renderedFraction();
    dragRef.current = {
      startY: event.clientY,
      startDetent: nearestDetent(startFraction),
      startFraction,
      currentFraction: startFraction,
      lastY: event.clientY,
      lastTime: event.timeStamp,
      velocityFractionPerMs: 0,
      claim: null,
      scroller: scrollerFrom(event.target),
      pointerId: event.pointerId,
    };
  };

  const onPointerMove = (event: React.PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId || viewportHeight === 0) return;

    let travelPx = drag.startY - event.clientY;
    if (drag.claim === null) {
      if (Math.abs(travelPx) < 4) return;
      const atTop = !drag.scroller || drag.scroller.scrollTop < 1;
      const listCanConsume =
        Boolean(drag.scroller) && (!atTop || (travelPx > 0 && drag.startDetent === "large"));
      drag.claim = listCanConsume ? "scroll" : "sheet";
      if (drag.claim === "sheet") {
        /* Interrupt a CSS settle from its composited position. Leaving the
           target transform in place while removing its transition would make
           the sheet jump to its endpoint before the next drag frame. */
        const frozenFraction = renderedFraction();
        drag.startFraction = frozenFraction;
        drag.currentFraction = frozenFraction;
        drag.startY = event.clientY;
        drag.lastY = event.clientY;
        drag.lastTime = event.timeStamp;
        travelPx = 0;
        sheetRef.current!.style.transition = "none";
        backdropRef.current!.style.transition = "none";
        applyFraction(frozenFraction);
        setIsDragging(true);
        sheetRef.current?.setPointerCapture(event.pointerId);
      }
    }

    if (drag.claim !== "sheet") return;

    const elapsedMs = Math.max(1, event.timeStamp - drag.lastTime);
    const rawVelocity = (drag.lastY - event.clientY) / elapsedMs / viewportHeight;
    const maximumVelocity = motion.sheet.maximumVelocityPxPerSecond / 1000 / viewportHeight;
    drag.velocityFractionPerMs = Math.max(-maximumVelocity, Math.min(maximumVelocity, rawVelocity));
    drag.lastY = event.clientY;
    drag.lastTime = event.timeStamp;
    drag.currentFraction = resistedSheetFraction(drag.startFraction + travelPx / viewportHeight);
    scheduleLiveFraction(drag.currentFraction);
    event.preventDefault();
  };

  const endDrag = (event: React.PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag || drag.claim !== "sheet") return;
    sheetRef.current?.releasePointerCapture?.(event.pointerId);
    const travelPx = drag.startY - drag.lastY;
    const velocityAge = Math.max(0, event.timeStamp - drag.lastTime);
    const next = resolveSheetRelease({
      startDetent: drag.startDetent,
      currentFraction: drag.currentFraction,
      velocityFractionPerMs: reducedMotion
        ? 0
        : releaseSheetVelocity({
            velocityFractionPerMs: drag.velocityFractionPerMs,
            elapsedMs: velocityAge,
            viewportHeight,
          }),
      travelPx,
    });
    settle(next);
  };

  const cancelDrag = () => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag || drag.claim !== "sheet") return;
    const travelPx = drag.startY - drag.lastY;
    const next = resolveSheetCancellation({ startDetent: drag.startDetent, travelPx });
    settle(next);
  };

  const cycleDetent = () => {
    const index = DETENT_ORDER.indexOf(detent);
    onDetentChange(index === DETENT_ORDER.length - 1 ? DETENT_ORDER[0]! : DETENT_ORDER[index + 1]!);
  };

  useEffect(() => {
    const sheet = sheetRef.current;
    if (!sheet) return;

    const onScroll = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const top = Math.max(0, target.scrollTop);
      const anchor = scrollAnchor.current.get(target);
      if (anchor === undefined) {
        scrollAnchor.current.set(target, top);
        return;
      }

      if (top < anchor) {
        scrollAnchor.current.set(target, top);
        if (top <= motion.sheet.armPx) scrollSpent.current.set(target, false);
        return;
      }

      if (
        scrollSpent.current.get(target) ||
        dragRef.current?.claim === "sheet" ||
        detent === "large"
      ) {
        return;
      }

      if (top - anchor >= motion.sheet.stepPx) {
        scrollAnchor.current.set(target, top);
        scrollSpent.current.set(target, true);
        stepDetent(1);
      }
    };

    sheet.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => sheet.removeEventListener("scroll", onScroll, { capture: true });
  }, [detent, stepDetent]);

  return (
    <>
      <div
        ref={backdropRef}
        aria-hidden
        onClick={() => onDetentChange("medium")}
        className={`absolute inset-0 z-10 bg-dim ${
          isDragging ? transition.directManipulation : transition.reveal
        }`}
        style={{
          opacity: restingBackdropOpacity,
          pointerEvents: restingBackdropOpacity > 0.2 ? "auto" : "none",
        }}
      />

      <main
        ref={sheetRef}
        aria-label="Results"
        style={
          {
            height: `${DETENT_FRACTION.large * 100}dvh`,
            transform: `translate3d(0, ${translateForFraction(restingFraction)}, 0)`,
            left: sideInset,
            right: sideInset,
            bottom: bottomInset,
            borderTopLeftRadius: SHEET_RADIUS,
            borderTopRightRadius: SHEET_RADIUS,
            borderBottomLeftRadius: bottomRadius,
            borderBottomRightRadius: bottomRadius,
            boxShadow: isExpandedPresentation
              ? "var(--motion-elevation-sheet)"
              : "var(--motion-elevation-island)",
            willChange: isDragging ? "transform" : "auto",
            touchAction: "pan-y pinch-zoom",
            "--sheet-hidden": `${((DETENT_FRACTION.large - DETENT_FRACTION[detent]) * 100).toFixed(3)}dvh`,
          } as React.CSSProperties
        }
        className={`pointer-events-auto absolute z-20 flex flex-col overflow-hidden ${
          isExpandedPresentation ? "bg-surface-persistent" : "material-regular"
        } ${isDragging ? transition.directManipulation : transition.snapSheet}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={cancelDrag}
      >
        <h1 className="sr-only">WetinDey</h1>
        <button
          type="button"
          onClick={cycleDetent}
          aria-label={`Sheet position: ${detent}. Activate to change.`}
          className="flex w-full shrink-0 cursor-grab touch-none items-center justify-center pb-1.5 pt-2.5 active:cursor-grabbing"
        >
          <span className="h-[5px] w-9 rounded-full bg-text-tertiary" />
        </button>

        <div className="flex-1 overflow-y-auto overscroll-contain">{children}</div>
      </main>
    </>
  );
}
