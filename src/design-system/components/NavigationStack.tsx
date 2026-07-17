"use client";

import React, { useEffect, useState } from "react";
import { ChevronLeft } from "lucide-react";

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
const POP_HOLD_MS = 330;

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

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Level 0 — the list. Parallaxes back rather than sitting still, so the
          push reads as depth instead of as a card sliding over a photo. */}
      <div
        inert={isOpen}
        aria-hidden={isOpen || undefined}
        className="absolute inset-0 transition-transform duration-sheet ease-spring"
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
      */}
      <div
        role="group"
        aria-label={detailLabel}
        inert={!isOpen}
        aria-hidden={!isOpen || undefined}
        className="absolute inset-0 flex flex-col overflow-hidden bg-background transition-transform duration-sheet ease-spring"
        style={{ transform: isOpen ? "translate3d(0, 0, 0)" : "translate3d(100%, 0, 0)" }}
      >
        {onDetailBack && content ? (
          <div className="shrink-0 px-3 pt-3 pb-1">
            {/* 44pt target; the chevron lands at 24px, flush with the leading
                edge of the detail content below it. No divider under the row —
                the level's own material and elevation already separate it. */}
            <button
              type="button"
              onClick={onDetailBack}
              className="squircle inline-flex h-tap items-center gap-1 px-3 text-body text-accent transition-opacity duration-micro ease-decelerate active:opacity-60"
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
          The shell owns this padding because the stack is one component, so
          there is exactly one place it is specified — and because `detailNode`
          brings none of its own. The right island used to supply `p-6` on
          regular only, which is precisely why handing the same node to a phone
          would otherwise ship it unpadded.

          Level 1 needs a scroller; level 0 does not, because `listNode` brings
          its own. That asymmetry is dictated by what the nodes arrive with.

          The bottom padding composes three terms: `--sheet-hidden` is the strip
          of the sheet hanging below the viewport at the current detent, which
          BottomSheet publishes because only it knows the number; the safe area
          clears the home indicator at `large`, where the sheet is docked and
          `--sheet-hidden` is 0; 24px is the breathing room. The `0px` fallback is
          load-bearing — the regular shell mounts this stack with no BottomSheet
          above it, so the variable is simply undefined there and this falls back
          to the padding it has always had, with no branch on size class.
        */}
        <div
          className={`flex-1 overflow-y-auto overscroll-contain px-6 pb-[calc(var(--sheet-hidden,0px)+var(--safe-area-bottom)+24px)] ${
            onDetailBack && content ? "pt-2" : "pt-6"
          }`}
        >
          {content}
        </div>
      </div>
    </div>
  );
}
