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

/**
 * Travel, in px, that commits ONE detent — the same number for a carry up that
 * grows the sheet and a pull down that collapses it, because they are one
 * gesture mirrored and a user who has learned one has learned the other.
 *
 * TRAVEL, in both sensors. The drag measures `startY - lastY`; the scroll
 * measures movement since its anchor. They were not the same number before: the
 * scroll sensor tested absolute `scrollTop >= 64`, so a list parked at 60
 * promoted on a 5px wheel nudge — the same 5px the drag sensor discards as
 * tremor. A threshold only means something against a stated origin.
 *
 * There is no HIG constant for this; it is a feel decision. 64px is about one
 * list row: past anything a thumb tremor, a momentum jitter or a rubber-band
 * settle can reach, and still close enough that a deliberate gesture is
 * answered on its first try rather than its second.
 */
const DETENT_STEP_PX = 64;

/**
 * How close to its top a list must come back before it may spend another detent.
 * Not zero: a settled list rarely reads exactly 0, and a 3px resting offset that
 * silently withholds the re-arm is indistinguishable from the feature being
 * broken.
 */
const DETENT_ARM_PX = 16;

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
 * 2. Scroll-to-detent — at the top of a list, a carry up grows the sheet and a
 *    pull down collapses it, one detent per DETENT_STEP_PX. Both ends go
 *    through `stepDetent`, so there is one threshold and one commit to reason
 *    about; both then ride the same `ease-spring` transition below, because a
 *    detent change moves `translate` and every transform change that is not a
 *    live drag is transitioned. There is no separate curve for this.
 *
 * Two sensors feed `stepDetent`, because the platform offers a different one in
 * each direction. The drag (`onPointerMove`) is the direct one and carries the
 * collapse, which has no scroll signal at all — `scrollTop` does not go below
 * zero. The capture-phase `scroll` listener carries what the drag cannot see: a
 * trackpad, which fires no pointer events, and a touch the browser panned out
 * from under us. They share `DETENT_STEP_PX` and disagree about nothing.
 */
export function BottomSheet({ children, detent, onDetentChange }: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);

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
    /** The scroller under the finger at pointerdown, if the finger found one. */
    scroller: HTMLElement | null;
    pointerId: number;
  } | null>(null);

  /**
   * TWO LATCHES, because the two sensors fail in two different ways and one
   * latch cannot catch both. Every previous attempt here used a single one and
   * broke the other half; the symmetry is a trap.
   *
   *   `gestureSpent` — the FINGER's. A drag that spends a detent must silence
   *   the momentum it leaves behind: the browser pans the list out from under
   *   our claim, `pointercancel` steps once, and the pan goes on firing scroll
   *   events after the finger is gone. Those are the same gesture. Only a new
   *   pointerdown clears it.
   *
   *   `scrollSpent` — the LIST's, per scroller. One continuous carry must not
   *   climb detent after detent. Re-arms when the list is genuinely back near
   *   its top.
   *
   * WHY NOT ONE. The drag's latch cannot be position-based: the drag only ever
   * claims the sheet while the list IS at its top, so "disarm at the current
   * top" disarms at ~0 and any re-arm test reads that as back-at-the-top and
   * fires on the next momentum event — one flick at `peek` spent two detents and
   * landed on `large`, unreachable by construction.
   * And the scroll sensor's latch cannot be pointer-based: a trackpad fires no
   * pointerdown, so nothing would ever clear it and a wheel user would get
   * exactly one promotion for the lifetime of the page.
   */
  const scrollAnchor = useRef(new WeakMap<HTMLElement, number>());
  const scrollSpent = useRef(new WeakMap<HTMLElement, boolean>());
  const gestureSpent = useRef(false);

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

  /**
   * 0 = floating island, 1 = docked to the edges.
   *
   * TWO docks, and the split is the whole point. `dock` follows the live drag and
   * may only drive COMPOSITED properties — transform, border-radius, shadow.
   * `restDock` follows the RESTING detent and drives the geometric ones.
   *
   * `left`/`right` change the width of an absolutely-positioned box, so writing
   * them from `fraction` laid out every card, image and text run in the sheet on
   * every frame of every drag — while `transition-none` was in force, so it was
   * every frame, uncushioned. The transform model exists precisely to keep layout
   * off the drag path (see the motion note above); insets driven by `fraction`
   * quietly reopened the hole it was dug to close, on medium↔large, which is the
   * most common drag in the app.
   *
   * The cost of pinning them to the detent is that a 10px inset snaps at the
   * moment of commit instead of tracking the finger through the 0.62–0.88 band.
   * It rides `duration-sheet ease-spring` with everything else, and 10px arriving
   * on the spring is not a thing an eye tracks. A relayout per frame is.
   */
  const dock = invLerp(DOCK_START, DOCK_END, fraction);
  const restDock = invLerp(DOCK_START, DOCK_END, DETENT_FRACTION[detent]);
  const sideInset = lerp(ISLAND_INSET, 0, restDock);
  const bottomInset = lerp(ISLAND_INSET, 0, restDock);
  const bottomRadius = lerp(SHEET_RADIUS, 0, dock);
  const backdropOpacity = invLerp(DETENT_FRACTION.medium, DETENT_FRACTION.large, fraction) * 0.28;

  /**
   * One detent along, clamped at the ends — the single commit for every
   * DETENT_STEP_PX crossing, whichever sensor saw it and whichever way it went.
   * Clamped rather than wrapped: a carry up at `large` has nowhere to go and
   * must do nothing, where the grabber's `cycleDetent` deliberately wraps.
   */
  const stepDetent = useCallback(
    (dir: 1 | -1) => {
      const next = ORDER[clamp(ORDER.indexOf(detent) + dir, 0, ORDER.length - 1)];
      if (next !== detent) onDetentChange(next);
    },
    [detent, onDetentChange],
  );

  /**
   * The drag sensor's commit. Spends the gesture, so the momentum the browser is
   * still carrying on the list the finger was resting on cannot spend a second
   * detent through the other sensor. See `gestureSpent`.
   */
  const stepFromDrag = useCallback(
    (dir: 1 | -1) => {
      gestureSpent.current = true;
      stepDetent(dir);
    },
    [stepDetent],
  );

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

  /**
   * The nearest thing under `target` that can actually scroll vertically,
   * bounded by the sheet.
   *
   * Resolved from the event target, not from a ref: the scrollers are two levels
   * down, in files this component does not own — the level-0 list and the
   * level-1 detail. The box this component wraps `children` in is not one of
   * them and never will be: its only child is `h-full` against a definite
   * height, so `scrollHeight === clientHeight` there forever, and asking IT
   * whether the list has scrolled can only ever be told no.
   *
   * Runs once per gesture, at pointerdown — `getComputedStyle` is not a thing to
   * do at 60fps.
   */
  const scrollerFrom = (target: EventTarget | null): HTMLElement | null => {
    let el = target instanceof HTMLElement ? target : null;
    for (; el && el !== sheetRef.current; el = el.parentElement) {
      if (el.scrollHeight <= el.clientHeight) continue;
      const overflowY = getComputedStyle(el).overflowY;
      if (overflowY === "auto" || overflowY === "scroll") return el;
    }
    return null;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (vh === 0) return;
    // A new finger is a new intent. The only thing that re-arms either sensor —
    // see `gestureSpent`. Momentum from the last gesture cannot reach this.
    gestureSpent.current = false;
    drag.current = {
      startY: e.clientY,
      startFraction: DETENT_FRACTION[detent],
      lastY: e.clientY,
      lastT: e.timeStamp,
      velocity: 0,
      claimed: null,
      scroller: scrollerFrom(e.target),
      pointerId: e.pointerId,
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointerId || vh === 0) return;

    const dy = d.startY - e.clientY; // positive = up = growing

    /**
     * Arbitration, once per gesture, and the browser's rule before it is ours:
     * `touch-action: pan-y` leaves it free to pan a scroller under the finger,
     * and the frame it decides to, it takes the pointer away. So the sheet
     * claims only what no scroller can consume. Anything else runs both — the
     * list moving under the finger while the sheet throws a detent nobody aimed
     * at.
     *
     *   scrolled off its top     → the list's, either direction. Someone
     *                               reading the middle of the list must never
     *                               have the sheet moved out from under them.
     *   at its top, up, not large → the SHEET's. This is the whole affordance,
     *                               and it is what UIKit does at a non-largest
     *                               detent. Handing it to the list instead is
     *                               dead motion, and at `peek` it is a trap:
     *                               the list is scrollable there (it reserves
     *                               `--sheet-hidden` as padding), so the finger
     *                               scrolls content inside a 94vh box of which
     *                               20vh is on screen while the sheet sits
     *                               still, and the only way out is the grabber.
     *   at its top, up, large    → the list's. The sheet has nowhere to grow,
     *                               so scrolling is the only thing left to do.
     *   at its top, down         → the sheet's. Nothing left to scroll, so the
     *                               pull collapses it.
     *   no scroller at all       → the sheet's. The grabber, the header above
     *                               the list, a level whose content fits.
     */
    if (d.claimed === null) {
      if (Math.abs(dy) < 4) return; // ignore jitter until direction is clear
      // `< 1`, not `<= 0`: a rubber-band settle parks a scroller on a fraction
      // of a pixel, and reading that as "scrolled" is how a pull at what the
      // user can see is the top comes to do nothing.
      const atTop = !d.scroller || d.scroller.scrollTop < 1;
      const listCanTakeIt = !!d.scroller && (!atTop || (dy > 0 && detent === "large"));
      d.claimed = listCanTakeIt ? "scroll" : "sheet";
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

  /** Release — the gesture ended where the user meant it to, so commit. */
  const endDrag = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    setDragFraction(null);
    setIsDragging(false);
    if (d?.claimed !== "sheet") return;
    (e.target as Element).releasePointerCapture?.(d.pointerId);
    if (dragFraction === null) return;
    // Project the throw: velocity decays over ~150ms of remaining travel.
    const landed = snapTo(dragFraction + d.velocity * 150);
    /**
     * Nearest-snap alone is wrong at the ends of its own reach: from `peek` the
     * next detent is 27vh away, so a deliberate 80px carry projects nowhere
     * near it and rounds back onto `peek` — the sheet tells a user who moved it
     * on purpose that they did not. Past DETENT_STEP_PX, a projection that
     * lands back where the gesture started becomes a step in the direction of
     * travel. Under it, the round back IS the answer: that is the same drag
     * being told it was too small to mean anything, which is what keeps a
     * twitch from moving the sheet.
     */
    if (landed === detent && Math.abs(d.startY - d.lastY) >= DETENT_STEP_PX) {
      stepFromDrag(d.startY > d.lastY ? 1 : -1);
    } else {
      onDetentChange(landed);
    }
  };

  /**
   * `pointercancel` — the browser took the pointer, having decided the touch was
   * a pan after all. Everything the finger did after that belongs to whatever it
   * is panning, so there is no throw here to project: the couple of frames we
   * did see would snap a detent out of noise.
   *
   * Travel already past DETENT_STEP_PX is not noise, though, and dropping it is
   * what made pull-to-collapse fail on iOS — at the top of a list Safari can
   * start a contained bounce and take the pointer mid-pull, and the sheet would
   * spring back having been pulled a clear detent's worth. So the same rule as
   * `endDrag`, minus the projection a cancel cannot support.
   */
  const cancelDrag = () => {
    const d = drag.current;
    drag.current = null;
    setDragFraction(null);
    setIsDragging(false);
    if (d?.claimed !== "sheet") return;
    if (Math.abs(d.startY - d.lastY) >= DETENT_STEP_PX) stepFromDrag(d.startY > d.lastY ? 1 : -1);
  };

  const cycleDetent = () => {
    const i = ORDER.indexOf(detent);
    onDetentChange(i === ORDER.length - 1 ? ORDER[0] : ORDER[i + 1]);
  };

  /**
   * SCROLL-TO-EXPAND — the second sensor. `scroll` does not bubble, but it does
   * capture, so one listener here sees every descendant scroller (the level-0
   * list and the level-1 detail) without this component holding a ref to
   * either, which it cannot: both live in files it does not own.
   *
   * The arbitration above now claims the top-of-list carry for the sheet
   * directly, so this is no longer the main way up. It is the way up for what a
   * pointer cannot tell us: a trackpad or wheel, which fires no pointer events
   * at all, and a touch the browser panned out from under a claim we had
   * already made. Losing either is how "nothing happens when I scroll" comes
   * back, so it stays.
   *
   * Promotion only. There is no collapse here to write: `scrollTop` bottoms out
   * at zero, so a pull down at the top produces no scroll to read — the drag
   * sensor owns that half. Nor should there be: taking the sheet from someone
   * mid-list is not a scroll affordance, and arriving at the top by scrolling
   * is not a request to leave it.
   */
  useEffect(() => {
    const el = sheetRef.current;
    if (!el) return;
    const onScroll = (e: Event) => {
      const t = e.target;
      if (!(t instanceof HTMLElement)) return;
      // iOS reports a negative scrollTop while rubber-banding at the top. A
      // bounce is the top, not a gesture, and must not read as travel.
      const top = Math.max(0, t.scrollTop);
      const anchor = scrollAnchor.current.get(t);

      /**
       * A scroller we have not seen anchors here and spends nothing. Its first
       * event carries whatever `scrollTop` it was already parked at — a restored
       * position, a level that mounted mid-list — and that is history, not travel.
       */
      if (anchor === undefined) {
        scrollAnchor.current.set(t, top);
        return;
      }

      /**
       * Scrolling back DOWN re-anchors, and a return to the top re-arms. The
       * origin follows the low-water mark, so "carry it 64px" always means 64px
       * from wherever the user last settled — not from a top they left ten
       * screens ago. Coming to rest at the top is the one unambiguous "I am done
       * with this list" signal a scroller emits, which is why it is the re-arm.
       */
      if (top < anchor) {
        scrollAnchor.current.set(t, top);
        if (top <= DETENT_ARM_PX) scrollSpent.current.set(t, false);
        return;
      }

      /**
       * Three ways to be locked out, all live at once and none redundant:
       *   `gestureSpent`      — a finger already spent this gesture; what is
       *                         arriving now is its momentum, not a new intent.
       *   `scrollSpent`       — this list already spent a detent and has not
       *                         been back to its top since.
       *   `claimed === sheet` — the sheet is being dragged right now and owns
       *                         the frame; the drag sensor will commit.
       * Momentum outlives the pointer, which is why bailing only on a live drag
       * could never stop the double step.
       */
      if (gestureSpent.current || scrollSpent.current.get(t) || drag.current?.claimed === "sheet") return;

      if (top - anchor >= DETENT_STEP_PX) {
        scrollAnchor.current.set(t, top);
        scrollSpent.current.set(t, true);
        stepDetent(1);
      }
    };
    el.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => el.removeEventListener("scroll", onScroll, { capture: true });
  }, [stepDetent]);

  return (
    <>
      <div
        aria-hidden
        onClick={() => onDetentChange("medium")}
        className="absolute inset-0 z-10 bg-dim transition-opacity duration-standard ease-decelerate"
        style={{ opacity: backdropOpacity, pointerEvents: backdropOpacity > 0.2 ? "auto" : "none" }}
      />

      <main
        ref={sheetRef}
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
          /**
           * The one axis this surface has, stated to the browser rather than
           * hoped for. `pan-y` is what makes the arbitration in `onPointerMove`
           * true: the browser may pan a scroller it finds under the finger — the
           * list's native scroll, which scroll-to-expand rides on — and may do
           * nothing else with the gesture. `none` would take that scroll away
           * outright; `auto` leaves a horizontal pan on the table that this sheet
           * has no answer for. The grabber overrides with `touch-none`, so a drag
           * that starts there is never a candidate for panning at all.
           */
          /**
           * `pinch-zoom` is not decoration on the value above — it is the whole
           * of WCAG 1.4.4 for this app's text, and `pan-y` alone silently vetoes
           * it. `manipulation` is defined as `pan-x pan-y pinch-zoom`, which is
           * the proof: if `pan-y` implied zoom, that definition would be
           * redundant. So every price, badge and label inside this sheet — which
           * is nearly all the text in the product — could not be zoomed, no
           * matter what the viewport meta said.
           *
           * Removing `user-scalable=no` from `layout.tsx` was necessary and, on
           * its own, close to a no-op: the map canvas carries `touch-action:none`
           * from Mapbox's own stylesheet, and this sheet carried `pan-y`. Between
           * them they are the entire viewport. This line is where the fix
           * actually lands.
           *
           * It does not cost the drag. `onPointerMove` (:271) ignores any pointer
           * that is not the tracked `pointerId`, and a pinch is two — so the
           * second finger was never a drag candidate.
           */
          touchAction: "pan-y pinch-zoom",
          /**
           * How much of this 94vh box hangs below the viewport at rest. The
           * scrollers must reserve it as bottom padding or their last rows sit in
           * the clipped strip and can never be scrolled into view — 42vh of dead
           * zone at medium, which no constant `pb-*` can cover because the
           * shortfall is a function of the detent. Published rather than
           * described because those scrollers live in files this component does
           * not own; same move as `--shell-leading-inset` in AdaptiveShell.
           *
           * Bound to `detent`, NOT `fraction`: `fraction` changes every drag
           * frame, and padding bound to it would reflow the scroller at 60fps —
           * precisely the bug the transform model above exists to avoid.
           */
          "--sheet-hidden": `${((DETENT_FRACTION.large - DETENT_FRACTION[detent]) * 100).toFixed(3)}vh`,
        } as React.CSSProperties}
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
        onPointerCancel={cancelDrag}
      >
        <h1 className="sr-only">WetinDey</h1>
        <button
          type="button"
          onClick={cycleDetent}
          aria-label={`Sheet position: ${detent}. Activate to change.`}
          className="flex w-full shrink-0 touch-none cursor-grab items-center justify-center pt-2.5 pb-1.5 active:cursor-grabbing"
        >
          <span className="h-[5px] w-9 rounded-full bg-text-tertiary" />
        </button>

        {/* Gives the stack below a definite height, and nothing else. It holds no
            ref: the safe-area strip it used to reserve moved into the real
            scrollers, which compose it with `--sheet-hidden`, and the gesture
            finds those scrollers through `scrollerFrom` rather than through this
            box — which cannot scroll, since its only child is `h-full`. */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {children}
        </div>
      </main>
    </>
  );
}
