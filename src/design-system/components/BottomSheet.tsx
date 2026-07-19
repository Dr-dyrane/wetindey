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

export interface MapRetryCapability {
  onRetry: () => void;
}

interface BottomSheetProps {
  children: React.ReactNode;
  detent: Detent;
  onDetentChange: (detent: Detent) => void;
  /** Rendered compact-sheet geometry for map controls in the sibling layer. */
  onLiveInsetChange?: (inset: LiveSheetInset | null) => void;
  mapRetryCapability?: MapRetryCapability | null;
}

export interface LiveSheetInset {
  fraction: number;
  /** Layout-viewport coordinate; AdaptiveShell derives the sibling inset. */
  sheetTop: number;
}

export function liveSheetInset(fraction: number, sheetTop: number): LiveSheetInset {
  return { fraction, sheetTop };
}

export function translateYFromTransform(transform: string): number | null {
  const values = transform.match(/^matrix(?:3d)?\((.*)\)$/)?.[1]?.split(",");
  if (!values) return null;
  const is3d = transform.startsWith("matrix3d(");
  if (values.length !== (is3d ? 16 : 6)) return null;
  const translateY = Number.parseFloat(values[is3d ? 13 : 5]!);
  return Number.isFinite(translateY) ? translateY : null;
}

export function nextInsetPublicationGeneration(previous: number): number {
  return previous + 1;
}

export function isCurrentInsetPublication(generation: number, current: number): boolean {
  return generation === current;
}

export function shouldTrackSettlingInset(
  viewportHeight: number,
  dragOwnsInset: boolean
): boolean {
  return viewportHeight > 0 && !dragOwnsInset;
}

export type InsetPublicationPath =
  | "guard"
  | "tap"
  | "horizontal"
  | "scroll"
  | "pointercancel"
  | "release"
  | "vertical-drag";

export function insetPublicationOwnerAfter(path: InsetPublicationPath): "snap" | "drag" {
  return path === "vertical-drag" ? "drag" : "snap";
}

export function shouldCommitViewportHeightToReact(dragOwnsInset: boolean): boolean {
  return !dragOwnsInset;
}

export function snapPublicationStarter(
  nextDetent: Detent,
  currentDetent: Detent
): "settle" | "detent-effect" {
  return nextDetent === currentDetent ? "settle" : "detent-effect";
}

export function pointerDownPublicationAction(
  activePointerId: number | null,
  pointerId: number
): "ignore-active-owner" | "invalidate-prior-publication" {
  return activePointerId !== null && !isActiveDragPointer(activePointerId, pointerId)
    ? "ignore-active-owner"
    : "invalidate-prior-publication";
}

export function isActiveDragPointer(
  activePointerId: number | null,
  pointerId: number
): boolean {
  return activePointerId === pointerId;
}

export function shouldHandlePointerCancellation(
  activePointerId: number | null,
  pointerId: number
): boolean {
  return isActiveDragPointer(activePointerId, pointerId);
}

export function shouldHandleTouchCancellation(
  activePointerId: number | null,
  remainingTouchCount: number
): boolean {
  return activePointerId !== null && remainingTouchCount === 0;
}

/** The shared shape token is re-exported for ModalSheet. */
export const SHEET_RADIUS = motion.radius.sheet;

const ISLAND_INSET = 10;

export interface CompactSheetPresentation {
  dockingProgress: number;
  sideInset: number;
  bottomGap: number;
  surfaceBottom: string;
  bottomRadius: number;
}

/**
 * Keep the transform owner at one fixed size while its visible surface moves
 * from an island to a dock. The local bottom inset cancels the outer
 * translate, so peek and medium retain a real map-visible gap below them
 * without re-laying out NavigationStack on every drag frame.
 */
export function compactSheetPresentation(
  fraction: number,
  viewportHeight: number,
  islandSideInset = ISLAND_INSET,
  islandBottomInset = ISLAND_INSET
): CompactSheetPresentation {
  const dockingProgress = inverseLerp(
    DETENT_FRACTION.medium,
    DETENT_FRACTION.large,
    fraction
  );
  const islandProgress = 1 - dockingProgress;
  const sideInset = islandSideInset * islandProgress;
  const bottomGap = islandBottomInset * islandProgress;
  const hiddenFraction = DETENT_FRACTION.large - fraction;
  const surfaceBottom =
    viewportHeight > 0
      ? `${(hiddenFraction * viewportHeight + bottomGap).toFixed(2)}px`
      : `calc(${(hiddenFraction * 100).toFixed(3)}dvh + ${bottomGap.toFixed(2)}px)`;

  return {
    dockingProgress,
    sideInset,
    bottomGap,
    surfaceBottom,
    bottomRadius: SHEET_RADIUS * islandProgress,
  };
}

interface BottomSheetStyle extends React.CSSProperties {
  "--sheet-hidden": string;
  "--sheet-side-inset": string;
  "--sheet-surface-bottom": string;
  "--sheet-bottom-radius": string;
  "--sheet-docking-progress": string;
}

type DragClaim = "horizontal" | "sheet" | "scroll" | null;
type ScrollDirection = -1 | 1;

const EDITABLE_SELECTOR =
  "input, textarea, select, [contenteditable]:not([contenteditable='false'])";
export const WHEEL_GESTURE_GAP_MS = motion.sheet.velocityMemoryMs * 2;

interface ScrollMetrics {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
}

export function scrollerForDirection<T extends ScrollMetrics>(
  scrollers: readonly T[],
  direction: ScrollDirection
): T | null {
  return (
    scrollers.find((scroller) => {
      const top = Math.max(0, scroller.scrollTop);
      const maximum = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
      return direction < 0 ? top > 0 : top < maximum;
    }) ?? null
  );
}

export function continuesWheelGesture(previousTime: number, currentTime: number): boolean {
  const elapsed = currentTime - previousTime;
  return elapsed >= 0 && elapsed <= WHEEL_GESTURE_GAP_MS;
}

export interface WheelDetentGesture {
  lastTime: number;
  distance: number;
  spent: boolean;
  direction: ScrollDirection | null;
}

export function advanceWheelDetentGesture(
  previous: WheelDetentGesture | null,
  eventTime: number,
  direction: ScrollDirection | null,
  travelPx: number
): { gesture: WheelDetentGesture; step: ScrollDirection | null } {
  const gesture =
    previous && continuesWheelGesture(previous.lastTime, eventTime)
      ? previous
      : { lastTime: eventTime, distance: 0, spent: false, direction: null };

  gesture.lastTime = eventTime;
  if (gesture.spent) return { gesture, step: null };
  if (direction !== null && gesture.direction !== direction) {
    gesture.direction = direction;
    gesture.distance = 0;
  }
  if (direction === null || travelPx <= 0) return { gesture, step: null };

  gesture.distance += travelPx;
  if (gesture.distance < motion.sheet.stepPx) return { gesture, step: null };

  gesture.spent = true;
  return { gesture, step: direction };
}

export interface ScrollExpansionGesture {
  distance: number;
  spent: boolean;
}

export function startScrollExpansionGesture(): ScrollExpansionGesture {
  return { distance: 0, spent: false };
}

export function advanceScrollExpansionGesture(
  gesture: ScrollExpansionGesture,
  scrollDeltaPx: number
): { gesture: ScrollExpansionGesture; shouldStep: boolean } {
  if (gesture.spent) return { gesture, shouldStep: false };
  if (scrollDeltaPx < 0) {
    gesture.distance = 0;
    return { gesture, shouldStep: false };
  }
  if (scrollDeltaPx === 0) return { gesture, shouldStep: false };

  gesture.distance += scrollDeltaPx;
  if (gesture.distance < motion.sheet.stepPx) return { gesture, shouldStep: false };

  gesture.spent = true;
  return { gesture, shouldStep: true };
}

export function permitsScrollChaining(overscrollBehaviorY: string): boolean {
  return overscrollBehaviorY !== "contain" && overscrollBehaviorY !== "none";
}

export function remainingDownwardTravel(
  startY: number,
  currentY: number,
  scrollDistanceToTop: number
): number {
  return Math.min(0, startY - currentY + Math.max(0, scrollDistanceToTop));
}

/**
 * Wheel deltas are usually pixels, but classic mice may report lines or pages.
 * Convert those modes before comparing them with the shared pixel snap threshold.
 */
function wheelDeltaYInPixels(event: WheelEvent, scroller: HTMLElement): number {
  if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) {
    const style = getComputedStyle(scroller);
    const lineHeight = Number.parseFloat(style.lineHeight);
    const fontSize = Number.parseFloat(style.fontSize);
    return event.deltaY * (Number.isFinite(lineHeight) ? lineHeight : fontSize || 16);
  }

  if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
    return event.deltaY * scroller.clientHeight;
  }

  return event.deltaY;
}

interface DragState {
  gestureStartX: number;
  downwardStartY: number;
  downwardScrollDistanceToTop: number;
  lastScrollDirection: ScrollDirection | null;
  startY: number;
  startDetent: Detent;
  startFraction: number;
  currentFraction: number;
  lastY: number;
  lastTime: number;
  velocityFractionPerMs: number;
  claim: DragClaim;
  scrollers: HTMLElement[];
  pointerId: number;
  pointerType: string;
  pointerCancelled: boolean;
  pointerEnded: boolean;
  scrollExpansion: ScrollExpansionGesture;
  scrollAnchors: Map<HTMLElement, number>;
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
export function BottomSheet({
  children,
  detent,
  onDetentChange,
  onLiveInsetChange,
  mapRetryCapability,
}: BottomSheetProps) {
  const sideInset = ISLAND_INSET;
  const bottomInset = ISLAND_INSET;
  const sheetRef = useRef<HTMLElement>(null);
  const handleRef = useRef<HTMLButtonElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const initialPresentationRef = useRef(
    compactSheetPresentation(DETENT_FRACTION[detent], 0, sideInset, bottomInset)
  );
  const detentRef = useRef(detent);
  detentRef.current = detent;
  const liveInsetCallbackRef = useRef(onLiveInsetChange);
  liveInsetCallbackRef.current = onLiveInsetChange;
  const activeTouchCountRef = useRef(0);
  const dragRef = useRef<DragState | null>(null);
  const liveFrameRef = useRef<number | null>(null);
  const settleFrameRef = useRef<number | null>(null);
  const insetFrameRef = useRef<number | null>(null);
  const insetGenerationRef = useRef(0);
  const viewportHeightRef = useRef(0);
  const deferredViewportHeightRef = useRef<number | null>(null);
  const pendingDetentPublicationRef = useRef<Detent | null>(null);
  const scrollEndFrameRef = useRef<number | null>(null);
  const liveFractionRef = useRef<number | null>(null);
  const wheelDetentGesture = useRef<WheelDetentGesture | null>(null);

  const [viewportHeight, setViewportHeight] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [settlingFraction, setSettlingFraction] = useState<number | null>(null);
  const reducedMotion = useReducedMotion();

  const restingFraction = settlingFraction ?? DETENT_FRACTION[detent];
  /* The outer transform box keeps one geometry at every detent. Only its
     empty visual layers resize; NavigationStack remains fixed and clipped, so
     the medium-to-large handoff does not re-layout content while it settles. */
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

  const applyPresentation = useCallback(
    (fraction: number) => {
      const sheet = sheetRef.current;
      if (!sheet) return;
      const presentation = compactSheetPresentation(
        fraction,
        viewportHeightRef.current,
        sideInset,
        bottomInset
      );
      sheet.style.setProperty("--sheet-side-inset", `${presentation.sideInset.toFixed(2)}px`);
      sheet.style.setProperty("--sheet-surface-bottom", presentation.surfaceBottom);
      sheet.style.setProperty(
        "--sheet-bottom-radius",
        `${presentation.bottomRadius.toFixed(2)}px`
      );
      sheet.style.setProperty(
        "--sheet-docking-progress",
        presentation.dockingProgress.toFixed(4)
      );
    },
    [bottomInset, sideInset]
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

  const cancelInsetFrame = useCallback(() => {
    insetGenerationRef.current = nextInsetPublicationGeneration(insetGenerationRef.current);
    if (insetFrameRef.current !== null) cancelAnimationFrame(insetFrameRef.current);
    insetFrameRef.current = null;
  }, []);

  const cancelScrollEndFrame = useCallback(() => {
    if (scrollEndFrameRef.current !== null) cancelAnimationFrame(scrollEndFrameRef.current);
    scrollEndFrameRef.current = null;
  }, []);

  const applyFraction = useCallback(
    (fraction: number, synchronizePresentation = true) => {
      const sheet = sheetRef.current;
      const backdrop = backdropRef.current;
      if (!sheet || !backdrop) return;

      sheet.style.transform = `translate3d(0, ${translateForFraction(fraction)}, 0)`;
      if (synchronizePresentation) applyPresentation(fraction);
      const opacity =
        inverseLerp(DETENT_FRACTION.medium, DETENT_FRACTION.large, fraction) * motion.opacity.scrim;
      backdrop.style.opacity = String(opacity);
      backdrop.style.pointerEvents = opacity > 0.2 ? "auto" : "none";
    },
    [applyPresentation, translateForFraction]
  );

  const publishLiveInset = useCallback((fraction: number) => {
    const sheet = sheetRef.current;
    const callback = liveInsetCallbackRef.current;
    if (!sheet || !callback) return;
    callback(liveSheetInset(fraction, sheet.getBoundingClientRect().top));
  }, []);

  const reconcileDeferredViewportHeight = useCallback((): boolean => {
    const deferred = deferredViewportHeightRef.current;
    if (deferred === null) return false;
    deferredViewportHeightRef.current = null;
    viewportHeightRef.current = deferred;
    if (viewportHeight === deferred) return false;
    setViewportHeight((current) => (current === deferred ? current : deferred));
    return true;
  }, [viewportHeight]);

  const renderLiveFraction = useCallback(() => {
    liveFrameRef.current = null;
    const fraction = liveFractionRef.current;
    if (fraction === null) return;
    applyFraction(fraction);
    publishLiveInset(fraction);
  }, [applyFraction, publishLiveInset]);

  const scheduleLiveFraction = useCallback(
    (fraction: number) => {
      liveFractionRef.current = fraction;
      if (liveFrameRef.current === null)
        liveFrameRef.current = requestAnimationFrame(renderLiveFraction);
    },
    [renderLiveFraction]
  );

  useLayoutEffect(() => {
    const measure = () => {
      const nextHeight = Math.round(window.visualViewport?.height ?? window.innerHeight);
      if (!shouldCommitViewportHeightToReact(dragRef.current?.claim === "sheet")) {
        deferredViewportHeightRef.current = nextHeight;
        return;
      }
      viewportHeightRef.current = nextHeight;
      setViewportHeight((current) => (current === nextHeight ? current : nextHeight));
    };
    measure();
    window.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("resize", measure);
      cancelLiveFrame();
      cancelSettlingFrame();
      cancelInsetFrame();
      cancelScrollEndFrame();
      liveInsetCallbackRef.current?.(null);
    };
  }, [cancelInsetFrame, cancelLiveFrame, cancelScrollEndFrame, cancelSettlingFrame]);

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

  const scrollersFrom = useCallback((target: EventTarget | null): HTMLElement[] => {
    const scrollers: HTMLElement[] = [];
    let element =
      target instanceof HTMLElement
        ? target
        : target instanceof Element
          ? target.parentElement
          : null;
    for (; element && element !== sheetRef.current; element = element.parentElement) {
      const style = getComputedStyle(element);
      const overflowY = style.overflowY;
      const isScrollContainer = overflowY === "auto" || overflowY === "scroll";
      if (isScrollContainer && element.scrollHeight > element.clientHeight) {
        scrollers.push(element);
      }
      if (isScrollContainer && !permitsScrollChaining(style.overscrollBehaviorY)) break;
    }
    return scrollers;
  }, []);

  const scrollDistanceToTop = useCallback(
    (scrollers: readonly HTMLElement[]) =>
      scrollers.reduce((distance, scroller) => distance + Math.max(0, scroller.scrollTop), 0),
    []
  );

  const updateScrollDirection = useCallback(
    (drag: DragState, clientY: number) => {
      const movement = clientY - drag.lastY;
      if (movement === 0) return;

      const direction: ScrollDirection = movement > 0 ? -1 : 1;
      if (direction < 0 && drag.lastScrollDirection !== direction) {
        drag.downwardStartY = drag.lastY;
        drag.downwardScrollDistanceToTop = scrollDistanceToTop(drag.scrollers);
      }
      drag.lastScrollDirection = direction;
    },
    [scrollDistanceToTop]
  );

  /** Reads the composited transform so a new drag can interrupt a settling sheet
      from the pixel the person actually sees, not from the prior prop value. */
  const renderedFraction = useCallback(() => {
    const sheet = sheetRef.current;
    if (!sheet || viewportHeight === 0) return restingFraction;
    const translateY = translateYFromTransform(getComputedStyle(sheet).transform);
    if (translateY === null) return restingFraction;
    return DETENT_FRACTION.large - translateY / viewportHeight;
  }, [restingFraction, viewportHeight]);

  const renderSettlingInset = useCallback(
    function renderSettlingInset(targetFraction: number, generation: number) {
      if (!isCurrentInsetPublication(generation, insetGenerationRef.current)) return;
      const fraction = renderedFraction();
      applyPresentation(fraction);
      publishLiveInset(fraction);
      if (Math.abs(fraction - targetFraction) < 0.0001) {
        insetFrameRef.current = null;
        return;
      }
      insetFrameRef.current = requestAnimationFrame(() =>
        renderSettlingInset(targetFraction, generation)
      );
    },
    [applyPresentation, publishLiveInset, renderedFraction]
  );

  const scheduleSettlingInset = useCallback(
    (targetFraction: number) => {
      cancelInsetFrame();
      const generation = insetGenerationRef.current;
      insetFrameRef.current = requestAnimationFrame(() =>
        renderSettlingInset(targetFraction, generation)
      );
    },
    [cancelInsetFrame, renderSettlingInset]
  );
  const scheduleSettlingInsetRef = useRef(scheduleSettlingInset);
  scheduleSettlingInsetRef.current = scheduleSettlingInset;

  const transferInsetPublication = useCallback(
    (path: InsetPublicationPath) => {
      if (insetPublicationOwnerAfter(path) === "drag") {
        cancelInsetFrame();
        return;
      }
      scheduleSettlingInset(DETENT_FRACTION[detentRef.current]);
    },
    [cancelInsetFrame, scheduleSettlingInset]
  );

  useLayoutEffect(() => {
    if (!shouldTrackSettlingInset(viewportHeight, dragRef.current?.claim === "sheet")) return;
    const pendingDetent = pendingDetentPublicationRef.current;
    if (pendingDetent !== null) {
      if (detent !== pendingDetent) return;
      pendingDetentPublicationRef.current = null;
      scheduleSettlingInsetRef.current(DETENT_FRACTION[detent]);
      return;
    }
    scheduleSettlingInsetRef.current(DETENT_FRACTION[detent]);
  }, [detent, viewportHeight]);

  const settle = useCallback(
    (next: Detent) => {
      cancelLiveFrame();
      cancelSettlingFrame();
      cancelInsetFrame();
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
        applyFraction(DETENT_FRACTION[next], false);
        setSettlingFraction(DETENT_FRACTION[next]);
        const reconciledViewport = reconcileDeferredViewportHeight();
        if (snapPublicationStarter(next, detentRef.current) === "detent-effect") {
          pendingDetentPublicationRef.current = next;
          onDetentChange(next);
        } else if (!reconciledViewport) {
          scheduleSettlingInset(DETENT_FRACTION[next]);
        }
      });
    },
    [
      applyFraction,
      cancelInsetFrame,
      cancelLiveFrame,
      cancelSettlingFrame,
      onDetentChange,
      reconcileDeferredViewportHeight,
      scheduleSettlingInset,
    ]
  );

  const handoffToSheet = useCallback(
    (drag: DragState, clientY: number, timeStamp: number, carriedTravelPx = 0) => {
      /* Interrupt a CSS settle from its composited position. Leaving the
         target transform in place while removing its transition would make
         the sheet jump to its endpoint before the next drag frame. */
      const frozenFraction = renderedFraction();
      drag.claim = "sheet";
      drag.startDetent = nearestDetent(frozenFraction);
      drag.startFraction = frozenFraction;
      drag.currentFraction = resistedSheetFraction(
        frozenFraction + carriedTravelPx / viewportHeight
      );
      drag.startY = clientY + carriedTravelPx;
      drag.lastY = clientY;
      drag.lastTime = timeStamp;
      transferInsetPublication("vertical-drag");
      sheetRef.current!.style.transition = "none";
      backdropRef.current!.style.transition = "none";
      applyFraction(drag.currentFraction);
      publishLiveInset(drag.currentFraction);
      setIsDragging(true);
      sheetRef.current?.setPointerCapture(drag.pointerId);
    },
    [
      applyFraction,
      publishLiveInset,
      renderedFraction,
      transferInsetPublication,
      viewportHeight,
    ]
  );

  const onPointerDown = (event: React.PointerEvent<HTMLElement>) => {
    if (
      pointerDownPublicationAction(
        dragRef.current?.pointerId ?? null,
        event.pointerId
      ) === "ignore-active-owner"
    ) {
      return;
    }

    cancelInsetFrame();
    const target = event.target;
    if (viewportHeight === 0 || !event.isPrimary) {
      transferInsetPublication("guard");
      return;
    }
    if (target instanceof Element && target.closest(EDITABLE_SELECTOR)) {
      cancelScrollEndFrame();
      dragRef.current = null;
      transferInsetPublication("guard");
      return;
    }
    cancelSettlingFrame();
    cancelScrollEndFrame();
    const startFraction = renderedFraction();
    const scrollers = scrollersFrom(target);
    const distanceToTop = scrollDistanceToTop(scrollers);
    const scrollAnchors = new Map(
      scrollers.map((scroller) => [scroller, Math.max(0, scroller.scrollTop)])
    );
    dragRef.current = {
      gestureStartX: event.clientX,
      downwardStartY: event.clientY,
      downwardScrollDistanceToTop: distanceToTop,
      lastScrollDirection: null,
      startY: event.clientY,
      startDetent: nearestDetent(startFraction),
      startFraction,
      currentFraction: startFraction,
      lastY: event.clientY,
      lastTime: event.timeStamp,
      velocityFractionPerMs: 0,
      claim: null,
      scrollers,
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      pointerCancelled: false,
      pointerEnded: false,
      scrollExpansion: startScrollExpansionGesture(),
      scrollAnchors,
    };
  };

  const onPointerMove = (event: React.PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (
      !drag ||
      drag.pointerEnded ||
      drag.pointerId !== event.pointerId ||
      viewportHeight === 0
    ) {
      return;
    }

    if (drag.claim !== "sheet") updateScrollDirection(drag, event.clientY);
    let travelPx = drag.startY - event.clientY;

    if (drag.claim === null) {
      const horizontalTravel = Math.abs(event.clientX - drag.gestureStartX);
      if (Math.max(Math.abs(travelPx), horizontalTravel) < 4) return;
      if (horizontalTravel > Math.abs(travelPx)) {
        drag.claim = "horizontal";
        drag.lastY = event.clientY;
        drag.lastTime = event.timeStamp;
        transferInsetPublication("horizontal");
        return;
      }
      const direction: ScrollDirection = travelPx > 0 ? 1 : -1;
      const scrollOwner = scrollerForDirection(drag.scrollers, direction);
      const listCanConsume =
        scrollOwner !== null ||
        (direction > 0 && drag.startDetent === "large" && drag.scrollers.length > 0);
      drag.claim = listCanConsume ? "scroll" : "sheet";
      if (drag.claim === "sheet") {
        handoffToSheet(drag, event.clientY, event.timeStamp);
        travelPx = 0;
      } else {
        transferInsetPublication("scroll");
      }
    }

    /* A list owns the drag while it has content above it. Once that content
       reaches its top, a continued downward gesture transfers to the sheet
       without requiring a lift and second drag. */
    if (
      drag.claim === "scroll" &&
      drag.lastScrollDirection === -1 &&
      travelPx < 0 &&
      scrollerForDirection(drag.scrollers, -1) === null
    ) {
      const carriedTravelPx = remainingDownwardTravel(
        drag.downwardStartY,
        event.clientY,
        drag.downwardScrollDistanceToTop
      );
      handoffToSheet(drag, event.clientY, event.timeStamp, carriedTravelPx);
      travelPx = carriedTravelPx;
    }

    if (drag.claim !== "sheet") {
      drag.lastY = event.clientY;
      drag.lastTime = event.timeStamp;
      return;
    }

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

  const finishScrolledDrag = useCallback(
    (drag: DragState) => {
      cancelScrollEndFrame();
      if (dragRef.current !== drag) return;
      dragRef.current = null;

      const travelPx = remainingDownwardTravel(
        drag.downwardStartY,
        drag.lastY,
        drag.downwardScrollDistanceToTop
      );
      if (
        drag.lastScrollDirection !== -1 ||
        travelPx >= 0 ||
        scrollerForDirection(drag.scrollers, -1) !== null
      ) {
        transferInsetPublication("scroll");
        return;
      }

      const currentFraction = renderedFraction();
      settle(
        resolveSheetRelease({
          startDetent: nearestDetent(currentFraction),
          currentFraction,
          velocityFractionPerMs: 0,
          travelPx,
        })
      );
    },
    [cancelScrollEndFrame, renderedFraction, settle, transferInsetPublication]
  );

  const scheduleScrolledDragEnd = useCallback(
    (drag: DragState) => {
      cancelScrollEndFrame();
      scrollEndFrameRef.current = requestAnimationFrame(() => {
        scrollEndFrameRef.current = null;
        if (
          dragRef.current === drag &&
          scrollerForDirection(drag.scrollers, -1) === null
        ) {
          finishScrolledDrag(drag);
        }
      });
    },
    [cancelScrollEndFrame, finishScrolledDrag]
  );

  const endDrag = (event: React.PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    /* WebKit can commit the final scroll-to-zero after the last pointermove.
       Keep the gesture through the browser's final scroll events, then resolve
       from the actual top edge instead of forcing a second gesture. */
    if (drag.claim === "scroll") {
      updateScrollDirection(drag, event.clientY);
      drag.pointerEnded = true;
      drag.lastY = event.clientY;
      drag.lastTime = event.timeStamp;
      if (drag.pointerType !== "touch") {
        if (scrollerForDirection(drag.scrollers, -1) === null) finishScrolledDrag(drag);
        else {
          dragRef.current = null;
          transferInsetPublication("release");
        }
        return;
      }
      transferInsetPublication("release");
      scheduleScrolledDragEnd(drag);
      return;
    }

    dragRef.current = null;
    if (drag.claim !== "sheet") {
      transferInsetPublication("tap");
      return;
    }
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

  const cancelDrag = (event: React.PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!shouldHandlePointerCancellation(drag?.pointerId ?? null, event.pointerId)) return;
    if (drag?.pointerType === "touch" && activeTouchCountRef.current > 1) {
      cancelScrollEndFrame();
      dragRef.current = null;
      if (drag.claim === "sheet") settle(drag.startDetent);
      else transferInsetPublication("pointercancel");
      return;
    }

    if (
      drag?.pointerType === "touch" &&
      drag.claim === null &&
      drag.scrollers.length > 0
    ) {
      /* WebKit may award native pan-y before React receives a decisive
         pointermove. The known scroll ancestors still make ownership
         deterministic, so retain the same gesture session for scroll events. */
      drag.claim = "scroll";
    }

    if (drag?.claim === "scroll") {
      const clientY = Number.isFinite(event.clientY) ? event.clientY : drag.lastY;
      updateScrollDirection(drag, clientY);
      drag.lastY = clientY;
      drag.lastTime = event.timeStamp;
      if (drag.pointerType === "touch") {
        /* Native pan-y cancels the pointer stream but touch coordinates keep
           arriving. Retain the gesture until touchend so travel beyond the
           list's top is not lost. */
        drag.pointerCancelled = true;
        transferInsetPublication("pointercancel");
        return;
      }

      cancelScrollEndFrame();
      dragRef.current = null;
      transferInsetPublication("pointercancel");
      return;
    }

    cancelScrollEndFrame();
    dragRef.current = null;
    if (!drag || drag.claim !== "sheet") {
      transferInsetPublication("pointercancel");
      return;
    }
    const travelPx = drag.startY - drag.lastY;
    const next = resolveSheetCancellation({ startDetent: drag.startDetent, travelPx });
    settle(next);
  };

  const onTouchStart = (event: React.TouchEvent<HTMLElement>) => {
    activeTouchCountRef.current = event.touches.length;
  };

  const onTouchMove = (event: React.TouchEvent<HTMLElement>) => {
    activeTouchCountRef.current = event.touches.length;
    const drag = dragRef.current;
    if (
      !drag ||
      drag.claim !== "scroll" ||
      !drag.pointerCancelled ||
      event.touches.length !== 1
    ) {
      return;
    }

    const clientY = event.touches[0]!.clientY;
    updateScrollDirection(drag, clientY);
    drag.lastY = clientY;
    drag.lastTime = event.timeStamp;
  };

  const endCancelledTouch = (event: React.TouchEvent<HTMLElement>) => {
    activeTouchCountRef.current = event.touches.length;
    const drag = dragRef.current;
    if (
      event.touches.length !== 0 ||
      !drag ||
      drag.claim !== "scroll" ||
      !drag.pointerCancelled
    ) {
      return;
    }

    const finalTouch = event.changedTouches[0];
    if (finalTouch) {
      updateScrollDirection(drag, finalTouch.clientY);
      drag.lastY = finalTouch.clientY;
    }
    drag.lastTime = event.timeStamp;
    drag.pointerEnded = true;
    scheduleScrolledDragEnd(drag);
  };

  const cancelCancelledTouch = (event: React.TouchEvent<HTMLElement>) => {
    activeTouchCountRef.current = event.touches.length;
    const drag = dragRef.current;
    if (
      !drag ||
      drag.pointerType !== "touch" ||
      !shouldHandleTouchCancellation(drag.pointerId, event.touches.length)
    ) {
      return;
    }
    cancelScrollEndFrame();
    dragRef.current = null;
    if (drag.claim === "sheet") settle(drag.startDetent);
    else transferInsetPublication("pointercancel");
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

      const drag = dragRef.current;
      if (drag?.claim === "scroll") {
        const reachedSharedTop = scrollerForDirection(drag.scrollers, -1) === null;
        if (drag.pointerEnded) {
          if (reachedSharedTop) finishScrolledDrag(drag);
          else scheduleScrolledDragEnd(drag);
        } else if (
          !drag.pointerCancelled &&
          drag.lastScrollDirection === -1 &&
          drag.lastY > drag.downwardStartY &&
          reachedSharedTop
        ) {
          const carriedTravelPx = remainingDownwardTravel(
            drag.downwardStartY,
            drag.lastY,
            drag.downwardScrollDistanceToTop
          );
          handoffToSheet(drag, drag.lastY, drag.lastTime, carriedTravelPx);
        }

        if (drag.claim === "scroll") {
          const anchor = drag.scrollAnchors.get(target);
          drag.scrollAnchors.set(target, top);
          if (anchor === undefined) return;

          const scrollDelta = top - anchor;
          const expansionDelta =
            drag.lastScrollDirection === -1 ? -Math.abs(scrollDelta) : scrollDelta;
          const advanced = advanceScrollExpansionGesture(drag.scrollExpansion, expansionDelta);
          drag.scrollExpansion = advanced.gesture;
          if (advanced.shouldStep && detentRef.current !== "large") stepDetent(1);
        }
      }
    };

    const onScrollEnd = (event: Event) => {
      const drag = dragRef.current;
      if (drag?.claim !== "scroll" || !drag.pointerEnded) return;

      const owner = scrollerForDirection(drag.scrollers, -1);
      if (owner === null || event.target === owner) finishScrolledDrag(drag);
    };

    sheet.addEventListener("scroll", onScroll, { capture: true, passive: true });
    sheet.addEventListener("scrollend", onScrollEnd, { capture: true, passive: true });
    return () => {
      sheet.removeEventListener("scroll", onScroll, { capture: true });
      sheet.removeEventListener("scrollend", onScrollEnd, { capture: true });
    };
  }, [
    finishScrolledDrag,
    handoffToSheet,
    scheduleScrolledDragEnd,
    stepDetent,
  ]);

  useEffect(() => {
    const sheet = sheetRef.current;
    if (!sheet) return;

    const onWheel = (event: WheelEvent) => {
      const pointerGesture = dragRef.current;
      if (event.ctrlKey || (pointerGesture && !pointerGesture.pointerEnded)) return;
      if (pointerGesture?.pointerEnded) {
        /* A new wheel gesture supersedes a retained touch-scroll tail. Without
           this boundary, its resulting scroll event could spend both the old
           touch session and the new wheel session. */
        cancelScrollEndFrame();
        dragRef.current = null;
      }

      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) {
        wheelDetentGesture.current = advanceWheelDetentGesture(
          wheelDetentGesture.current,
          event.timeStamp,
          null,
          0
        ).gesture;
        return;
      }

      const target = event.target;
      const editable = target instanceof Element && target.closest(EDITABLE_SELECTOR);
      const scrollers = scrollersFrom(target);
      const scroller = scrollers[0] ?? null;
      const atSharedTop = scrollerForDirection(scrollers, -1) === null;
      const canCollapse =
        !editable && scroller !== null && event.deltaY < 0 && atSharedTop && detent !== "peek";
      const canExpand =
        !editable &&
        scroller !== null &&
        event.deltaY > 0 &&
        scrollerForDirection(scrollers, 1) !== null &&
        detent !== "large";
      const wheelTravelPx = scroller === null ? 0 : Math.abs(wheelDeltaYInPixels(event, scroller));
      const inputDirection: ScrollDirection | null =
        event.deltaY < 0 ? -1 : event.deltaY > 0 ? 1 : null;
      const canStep = canCollapse || canExpand;
      const advanced = advanceWheelDetentGesture(
        wheelDetentGesture.current,
        event.timeStamp,
        inputDirection,
        canStep ? wheelTravelPx : 0
      );
      wheelDetentGesture.current = advanced.gesture;

      if (canCollapse && wheelTravelPx > 0) event.preventDefault();

      /* Wheel expansion and top-edge collapse share one gesture spend. A
         reversal can change intent before the threshold, but can never buy a
         second detent from the same physical gesture. */
      if (advanced.step !== null) stepDetent(advanced.step);
    };

    sheet.addEventListener("wheel", onWheel, { capture: true, passive: false });
    return () => sheet.removeEventListener("wheel", onWheel, true);
  }, [cancelScrollEndFrame, detent, scrollersFrom, stepDetent]);

  const initialPresentation = initialPresentationRef.current;
  const surfaceGeometry: React.CSSProperties = {
    left: "var(--sheet-side-inset)",
    right: "var(--sheet-side-inset)",
    bottom: "var(--sheet-surface-bottom)",
    borderTopLeftRadius: SHEET_RADIUS,
    borderTopRightRadius: SHEET_RADIUS,
    borderBottomLeftRadius: "var(--sheet-bottom-radius)",
    borderBottomRightRadius: "var(--sheet-bottom-radius)",
  };
  const interactionClip = `inset(0 var(--sheet-side-inset) var(--sheet-surface-bottom) var(--sheet-side-inset) round ${SHEET_RADIUS}px ${SHEET_RADIUS}px var(--sheet-bottom-radius) var(--sheet-bottom-radius))`;

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
            willChange: isDragging ? "transform" : "auto",
            touchAction: "pan-y pinch-zoom",
            "--sheet-hidden": `${((DETENT_FRACTION.large - DETENT_FRACTION[detent]) * 100).toFixed(3)}dvh`,
            "--sheet-side-inset": `${initialPresentation.sideInset.toFixed(2)}px`,
            "--sheet-surface-bottom": initialPresentation.surfaceBottom,
            "--sheet-bottom-radius": `${initialPresentation.bottomRadius.toFixed(2)}px`,
            "--sheet-docking-progress": initialPresentation.dockingProgress.toFixed(4),
          } as BottomSheetStyle
        }
        className={`pointer-events-none absolute inset-x-0 bottom-0 z-20 ${
          isDragging ? transition.directManipulation : transition.snapSheet
        }`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={cancelDrag}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={endCancelledTouch}
        onTouchCancel={cancelCancelledTouch}
      >
        {/* Shadow cross-fades between semantic elevation rungs while the empty
            geometry layers resize. No content participates in that layout. */}
        <div
          aria-hidden
          className="absolute top-0"
          style={{
            ...surfaceGeometry,
            boxShadow: "var(--motion-elevation-island)",
            opacity: "calc(1 - var(--sheet-docking-progress))",
          }}
        />
        <div
          aria-hidden
          className="absolute top-0"
          style={{
            ...surfaceGeometry,
            boxShadow: "var(--motion-elevation-sheet)",
            opacity: "var(--sheet-docking-progress)",
          }}
        />

        {/* Material remains translucent at the map-context detents. The
            persistent surface fades in only as the sheet reaches its dock. */}
        <div
          aria-hidden
          className="material-regular absolute top-0 overflow-hidden"
          style={surfaceGeometry}
        >
          <div
            className="absolute inset-0 bg-surface-persistent"
            style={{ opacity: "var(--sheet-docking-progress)" }}
          />
        </div>

        {/* clip-path also clips hit testing, so the map-visible rails and
            bottom gap remain genuine map interaction space. */}
        <div
          className="pointer-events-auto absolute inset-0 flex flex-col overflow-hidden"
          style={{ clipPath: interactionClip }}
        >
          <h1 className="sr-only">WetinDey</h1>
          <button
            ref={handleRef}
            type="button"
            onClick={cycleDetent}
            aria-label={`Sheet position: ${detent}. Activate to change.`}
            className={`flex min-h-11 w-full shrink-0 cursor-grab touch-none items-center justify-center active:cursor-grabbing active:opacity-70 ${transition.press}`}
          >
            <span className="h-[5px] w-9 rounded-full bg-text-tertiary" />
          </button>

          {mapRetryCapability ? (
            <div className="flex min-h-11 shrink-0 items-center justify-between gap-3 px-4 pb-2">
              <span role="status" className="text-footnote font-medium text-text-secondary">
                Map unavailable
              </span>
              <button
                type="button"
                aria-label="Try loading map again"
                onClick={() => {
                  mapRetryCapability.onRetry();
                  handleRef.current?.focus({ preventScroll: true });
                }}
                className={`flex min-h-tap min-w-tap shrink-0 items-center justify-center squircle px-3 text-footnote font-semibold text-accent ${transition.press}`}
              >
                Try again
              </button>
            </div>
          ) : null}

          <div className="flex-1 overflow-y-auto overscroll-contain">{children}</div>
        </div>
      </main>
    </>
  );
}
