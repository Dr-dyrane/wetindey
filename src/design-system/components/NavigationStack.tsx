"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { motion, transition } from "@/design-system/motion";

interface NavigationStackProps {
  /**
   * Level 0 — the results list. Always mounted, so `scrollTop` survives a
   * drill-down and a return. Swapping the list out in place would land you at
   * the top of it after tapping the ninth offer and coming back.
   */
  listNode: React.ReactNode;
  /**
   * Level 1 — place/offer detail. PRESENCE is the stack depth. There is no
   * depth state, so there is nothing to keep in sync with the selection.
   */
  detailNode?: React.ReactNode;
  /** Accessible name for the pushed level. */
  detailLabel?: string;
  /**
   * Pops the stack. OPTIONAL on purpose: `detailNode` already ships its own
   * close control, which clears the selection and therefore already pops. Pass
   * this to add the HIG-correct back row — chevron.left plus a label — above the
   * detail; omit it and the push still works, just without a back affordance of
   * its own.
   */
  onDetailBack?: () => void;
  /** Back row label. A prop, not a literal — the app speaks three languages. */
  backLabel?: string;
}

/**
 * Held-node lifetime across a pop. Must track `duration-sheet`
 * (tailwind.config.ts) — it is how long the outgoing level needs to exist in
 * order to have something to animate out.
 */
const POP_HOLD_MS = motion.duration.slow;

interface ScrollMetrics {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
}

interface MutableScrollPosition {
  scrollTop: number;
  scrollLeft: number;
}

export function shouldResetDetailScroll(previousOpen: boolean, currentOpen: boolean): boolean {
  return currentOpen && !previousOpen;
}

export function resolveDetailScrollLifecycle(previousOpen: boolean, currentOpen: boolean) {
  return {
    shouldReset: shouldResetDetailScroll(previousOpen, currentOpen),
    committedOpen: currentOpen,
    cleanupOpen: previousOpen,
  };
}

export function shouldContainTerminalScroll(
  metrics: ScrollMetrics,
  deltaY: number
): boolean {
  return terminalScrollBoundary(metrics, deltaY) !== null;
}

export function terminalScrollBoundary(
  metrics: ScrollMetrics,
  deltaY: number
): number | null {
  const top = Math.max(0, metrics.scrollTop);
  const maximum = Math.max(0, metrics.scrollHeight - metrics.clientHeight);
  if (deltaY < 0 && top + deltaY <= 0) return 0;
  if (deltaY > 0 && top + deltaY >= maximum) return maximum;
  return null;
}

export function restoreLockedScrollPosition(
  target: MutableScrollPosition,
  lockedTop: number,
  lockedLeft: number
): boolean {
  if (target.scrollTop === lockedTop && target.scrollLeft === lockedLeft) return false;
  target.scrollTop = lockedTop;
  target.scrollLeft = lockedLeft;
  return true;
}

export function resetDetailScrollPosition(target: MutableScrollPosition | null): boolean {
  return target ? restoreLockedScrollPosition(target, 0, 0) : false;
}

const DETAIL_SCROLL_SELECTOR = "[data-navigation-detail-scroller]";
const BOUNDED_DETAIL_SELECTOR = "[data-navigation-detail-bounded]";

interface BoundedDetailProps {
  "data-navigation-detail-bounded"?: true;
}

function isBoundedDetailNode(node: React.ReactNode): boolean {
  return (
    React.isValidElement<BoundedDetailProps>(node) &&
    node.props["data-navigation-detail-bounded"] === true
  );
}

/**
 * A two-level navigation stack on one surface.
 *
 * This is the ONE component both size classes use for detail. The compact shell
 * puts it inside the bottom sheet; the regular shell puts it inside the sidebar
 * card. Same node, same axis, same tokens, same push — because the size class
 * changes where the container is, not what the hierarchy is.
 *
 * WHY A PUSH, not a second sheet and not a swap:
 *   · A second stacked sheet needs a second detent, a second pointer
 *     arbitration competing for the same vertical drag, and a second backdrop
 *     compounding on the first. Two draggable surfaces on one axis have no
 *     correct arbitration. Sheets are for TASKS over a context (Settings,
 *     Report). Offer detail is the next level of the same hierarchy, and that
 *     is navigation.
 *   · A swap in place destroys the list's scroll position and contradicts
 *     "progressive reveal = a new surface, never a swap in place".
 *
 * MOTION: both levels move by `translateX` on absolutely-positioned layers of a
 * fixed-size host — the same discipline as the sheet's own `translateY`. No
 * width or height is ever animated, so nothing inside either level re-lays-out
 * while the push runs.
 */
export function NavigationStack({
  listNode,
  detailNode,
  detailLabel,
  onDetailBack,
  backLabel = "Back",
}: NavigationStackProps) {
  const [heldDetail, setHeldDetail] = useState<React.ReactNode>(null);
  const detailScrollerRef = useRef<HTMLDivElement>(null);
  const wasDetailOpenRef = useRef(false);

  /**
   * Latch the newest detail while the level is open. This is React's documented
   * "adjusting state during render" pattern: the render is thrown away and
   * re-run before commit, so the push costs no extra frame — an effect-driven
   * latch would render level 1 empty for one frame on the way in.
   *
   * `detailNode`'s identity is unstable BY DESIGN: page.tsx rebuilds it when the
   * place-offers fetch resolves, so it flips mid-flight while the user is
   * looking at level 1. Everything that drives the animation below keys off
   * PRESENCE (`!= null`), never identity — keying on identity would re-run the
   * push when the offers land. Silent on fast networks, ugly on Lagos 3G.
   */
  if (detailNode != null && detailNode !== heldDetail) setHeldDetail(detailNode);

  const isOpen = detailNode != null;
  const content = detailNode ?? heldDetail;
  const isBoundedDetail = isBoundedDetailNode(content);

  useLayoutEffect(() => {
    const resetVisibleDetailScroll = () => {
      const shellScroller = detailScrollerRef.current;
      resetDetailScrollPosition(shellScroller);
      resetDetailScrollPosition(
        shellScroller?.querySelector<HTMLElement>(DETAIL_SCROLL_SELECTOR) ?? null
      );
    };
    const lifecycle = resolveDetailScrollLifecycle(wasDetailOpenRef.current, isOpen);
    let settleFrame = 0;
    let restoreFrame = 0;
    if (lifecycle.shouldReset) {
      resetVisibleDetailScroll();
      settleFrame = requestAnimationFrame(() => {
        resetVisibleDetailScroll();
        restoreFrame = requestAnimationFrame(() => {
          resetVisibleDetailScroll();
        });
      });
    }
    wasDetailOpenRef.current = lifecycle.committedOpen;
    return () => {
      if (settleFrame !== 0) cancelAnimationFrame(settleFrame);
      if (restoreFrame !== 0) cancelAnimationFrame(restoreFrame);
      wasDetailOpenRef.current = lifecycle.cleanupOpen;
    };
  }, [isOpen]);

  useLayoutEffect(() => {
    if (!isOpen || !isBoundedDetail) return;
    const shellScroller = detailScrollerRef.current;
    if (!shellScroller) return;
    const boundedDetail =
      shellScroller.querySelector<HTMLElement>(BOUNDED_DETAIL_SELECTOR);
    if (!boundedDetail) return;

    let geometryFrame = 0;
    let sampleUntil = performance.now() + motion.duration.slow + 50;

    const measureVisibleHeight = () => {
      /*
       * The terminal edge is the visible intersection of this level and the
       * layout viewport. `visualViewport` can end above Safari's rendered sheet
       * bottom, manufacturing blank space after the real Prices scrollport.
       */
      const shellBottom = shellScroller.getBoundingClientRect().bottom;
      const visibleBottom = Math.min(window.innerHeight, shellBottom);
      const visibleHeight = Math.max(
        0,
        visibleBottom - boundedDetail.getBoundingClientRect().top
      );
      boundedDetail.style.setProperty(
        "--navigation-detail-visible-height",
        `${visibleHeight}px`
      );
    };

    const sampleGeometry = (timestamp: number) => {
      measureVisibleHeight();
      if (timestamp < sampleUntil) {
        geometryFrame = requestAnimationFrame(sampleGeometry);
      } else {
        geometryFrame = 0;
      }
    };

    const restartGeometrySampling = () => {
      sampleUntil = performance.now() + motion.duration.slow + 50;
      measureVisibleHeight();
      if (geometryFrame === 0) {
        geometryFrame = requestAnimationFrame(sampleGeometry);
      }
    };

    const viewport = window.visualViewport;
    restartGeometrySampling();
    window.addEventListener("resize", restartGeometrySampling);
    window.addEventListener("pointermove", measureVisibleHeight, { passive: true });
    window.addEventListener("touchmove", measureVisibleHeight, { passive: true });
    viewport?.addEventListener("resize", restartGeometrySampling);
    viewport?.addEventListener("scroll", restartGeometrySampling);

    return () => {
      if (geometryFrame !== 0) cancelAnimationFrame(geometryFrame);
      window.removeEventListener("resize", restartGeometrySampling);
      window.removeEventListener("pointermove", measureVisibleHeight);
      window.removeEventListener("touchmove", measureVisibleHeight);
      viewport?.removeEventListener("resize", restartGeometrySampling);
      viewport?.removeEventListener("scroll", restartGeometrySampling);
    };
  }, [content, isBoundedDetail, isOpen]);

  useEffect(() => {
    if (!isOpen || !isBoundedDetail) return;
    const shellScroller = detailScrollerRef.current;
    if (!shellScroller) return;

    let lastTouchY: number | null = null;

    const nestedScrollerFor = (target: EventTarget | null) =>
      target instanceof Element
        ? target.closest<HTMLElement>(DETAIL_SCROLL_SELECTOR)
        : null;

    const containWheel = (event: WheelEvent) => {
      const nestedScroller = nestedScrollerFor(event.target);
      if (!nestedScroller) return;
      event.stopPropagation();

      const multiplier =
        event.deltaMode === WheelEvent.DOM_DELTA_LINE
          ? 16
          : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
            ? nestedScroller.clientHeight
            : 1;
      const boundary = terminalScrollBoundary(
        nestedScroller,
        event.deltaY * multiplier
      );
      if (boundary === null) return;

      event.preventDefault();
      nestedScroller.scrollTop = boundary;
    };

    const containTouchStart = (event: TouchEvent) => {
      if (!nestedScrollerFor(event.target)) return;
      lastTouchY = event.touches[0]?.clientY ?? null;
      event.stopPropagation();
    };

    const containTouchMove = (event: TouchEvent) => {
      const nestedScroller = nestedScrollerFor(event.target);
      const currentY = event.touches[0]?.clientY;
      if (!nestedScroller || currentY == null) return;
      event.stopPropagation();

      const deltaY = lastTouchY == null ? 0 : lastTouchY - currentY;
      lastTouchY = currentY;
      const boundary = terminalScrollBoundary(nestedScroller, deltaY);
      if (boundary === null) return;

      event.preventDefault();
      nestedScroller.scrollTop = boundary;
    };

    const containTouchEnd = (event: TouchEvent) => {
      if (!nestedScrollerFor(event.target)) return;
      lastTouchY = null;
      event.stopPropagation();
    };

    shellScroller.addEventListener("wheel", containWheel, { passive: false });
    shellScroller.addEventListener("touchstart", containTouchStart, {
      passive: true,
    });
    shellScroller.addEventListener("touchmove", containTouchMove, {
      passive: false,
    });
    shellScroller.addEventListener("touchend", containTouchEnd);
    shellScroller.addEventListener("touchcancel", containTouchEnd);

    return () => {
      shellScroller.removeEventListener("wheel", containWheel);
      shellScroller.removeEventListener("touchstart", containTouchStart);
      shellScroller.removeEventListener("touchmove", containTouchMove);
      shellScroller.removeEventListener("touchend", containTouchEnd);
      shellScroller.removeEventListener("touchcancel", containTouchEnd);
    };
  }, [isBoundedDetail, isOpen]);

  /**
   * The pop has no exit animation for free: React unmounts `detailNode` the
   * frame the selection clears, and level 0 would slide back over nothing. So
   * the last node is held for exactly one transition, inert throughout, then
   * dropped.
   *
   * This is NOT the render-both-and-hide bug this app already paid to fix: one
   * node, bounded to the pop, torn down deterministically, never a steady state.
   */
  useEffect(() => {
    if (detailNode != null || heldDetail == null) return;
    const t = window.setTimeout(() => setHeldDetail(null), POP_HOLD_MS);
    return () => window.clearTimeout(t);
  }, [detailNode, heldDetail]);

  useEffect(() => {
    if (!isOpen) return;
    const scrollingElement = document.scrollingElement;
    if (!scrollingElement) return;
    const lockedTop = scrollingElement.scrollTop;
    const lockedLeft = scrollingElement.scrollLeft;
    const containDocumentScroll = () => {
      restoreLockedScrollPosition(scrollingElement, lockedTop, lockedLeft);
    };

    document.addEventListener("scroll", containDocumentScroll, {
      capture: true,
      passive: true,
    });
    return () => {
      document.removeEventListener("scroll", containDocumentScroll, true);
      containDocumentScroll();
    };
  }, [isOpen]);

  const containTerminalWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    const nestedScroller =
      event.target instanceof Element
        ? event.target.closest<HTMLElement>(DETAIL_SCROLL_SELECTOR)
        : null;
    if (nestedScroller) event.stopPropagation();
    const scrollTarget = nestedScroller ?? event.currentTarget;
    const boundary = terminalScrollBoundary(scrollTarget, event.deltaY);
    if (boundary !== null) {
      event.preventDefault();
      scrollTarget.scrollTop = boundary;
    }
  };

  const containNestedDetailGesture = (
    event: React.SyntheticEvent<HTMLDivElement>
  ) => {
    if (
      event.target instanceof Element &&
      event.target.closest(DETAIL_SCROLL_SELECTOR)
    ) {
      event.stopPropagation();
    }
  };

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Level 0 — the list. Parallaxes back rather than sitting still, so the
          push reads as depth instead of as a card sliding over a photo. */}
      <div
        inert={isOpen}
        aria-hidden={isOpen || undefined}
        className={`absolute inset-0 ${transition.push}`}
        style={{ transform: isOpen ? "translate3d(-25%, 0, 0)" : "translate3d(0, 0, 0)" }}
      >
        {listNode}
      </div>

      {/*
        Level 1 — the detail.

        The HOST is always mounted and parked off the trailing edge, because a
        host that mounts already at its final transform has nothing to animate
        FROM — it would appear rather than push. Empty, it holds no cards, no
        text and no image requests; it is a positioned rectangle. The rule it
        might look like it breaks ("never render both and hide one") is about
        mounting the same CONTENT twice, which is why 8 items produced 16 cards
        and 16 image fetches. Nothing here is duplicated: one list, one detail.

        Opaque, not glass: it is the content layer once it arrives, and glass
        does not belong in the content layer. Nested material would sample its
        blurred parent rather than the map anyway.

        WHICH opaque is the host's to say, not this component's — the stack has
        more than one host and they are not the same surface. `.stack-surface`
        reads `--stack-surface` and falls back to the base background, so the
        bottom sheet and the sidebar card declare nothing and get what they have
        always had, while a presented ModalSheet panel — a rung up in dark —
        hands down its own. A colour hardcoded here would flip the sheet's whole
        background on push inside any host that is not the base.
      */}
      <div
        role="group"
        aria-label={detailLabel}
        inert={!isOpen}
        aria-hidden={!isOpen || undefined}
        className={`stack-surface absolute inset-0 flex flex-col overflow-hidden ${transition.push}`}
        style={{ transform: isOpen ? "translate3d(0, 0, 0)" : "translate3d(100%, 0, 0)" }}
      >
        {onDetailBack && content ? (
          <div className="shrink-0 px-3 pb-1 pt-3">
            {/* 44pt target; the chevron lands at 24px, flush with the leading
                edge of the detail content below it. No divider under the row:
                it is the same surface as the content it sits above, so there is
                nothing to separate. */}
            <button
              type="button"
              onClick={onDetailBack}
              className={`squircle inline-flex h-tap items-center gap-1 px-3 text-body text-accent active:opacity-60 ${transition.press}`}
            >
              {/* strokeWidth matches the disclosure chevrons (ListRow,
                  SheetPicker); at the default weight this reads lighter than
                  the carets it sits beside. */}
              <ChevronLeft aria-hidden strokeWidth={2.5} className="h-4 w-4" />
              {backLabel}
            </button>
          </div>
        ) : null}

        {/*
          Compact market detail uses a bounded viewport inside `detailNode`: its
          action stays outside the marked Prices scroller, and its height
          subtracts the part of BottomSheet translated below the viewport. That
          bounded node does not overflow this shell or reserve a compact tail.

          Other NavigationStack callers retain the established level-1 scroller.
          The marked nested scroller is an opt-in contract for content with a
          persistent in-flow region above its scrolling body.

          At regular size there is no BottomSheet or hidden translated tail.
          Preserve the established safe-area reservation plus 24px breathing
          room without making the compact scroller own a second reservation.
        */}
        <div
          ref={detailScrollerRef}
          onWheel={containTerminalWheel}
          onPointerDown={containNestedDetailGesture}
          onPointerMove={containNestedDetailGesture}
          onPointerUp={containNestedDetailGesture}
          onPointerCancel={containNestedDetailGesture}
          onTouchStart={containNestedDetailGesture}
          onTouchMove={containNestedDetailGesture}
          onTouchEnd={containNestedDetailGesture}
          onTouchCancel={containNestedDetailGesture}
          className={`flex-1 ${
            isBoundedDetail
              ? "overflow-clip md:overflow-y-auto"
              : "overflow-y-auto"
          } overscroll-y-none [overflow-anchor:none] px-6 pb-0 md:pb-[calc(var(--safe-area-bottom)+24px)] ${
            onDetailBack && content ? "pt-2" : "pt-6"
          }`}
        >
          {content}
        </div>
      </div>
    </div>
  );
}
