"use client";

import React, { useCallback, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { SHEET_RADIUS } from "./BottomSheet";
import { useMediaQuery } from "@/core/hooks/useMediaQuery";

interface ModalSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Optional right-hand action, e.g. a Done button. */
  action?: React.ReactNode;
  /**
   * Full-bleed content for the panel's top edge, replacing the visible header.
   * `title` stays required and stays the dialog's accessible name, so the <h2>
   * is redundant here rather than lost.
   *
   * Two constraints the type cannot express. The hero must NOT declare a corner
   * radius: the panel clips it, and a second declaration drifts the moment
   * SHEET_RADIUS moves. And its top-trailing corner is overlaid by the floating
   * close control, so nothing interactive may sit there.
   */
  hero?: React.ReactNode;
  children: React.ReactNode;
  /** "page" fills the screen; "form" is the shorter card used for short tasks. */
  size?: "page" | "form";
}

/**
 * A presented sheet — the app's mechanism for progressive reveal.
 *
 * Drilling into a new task opens a NEW surface stacked over the current one,
 * rather than swapping the contents of the surface you are already looking at.
 * That is the HIG model, and it matters for orientation: the sheet slides in
 * from the edge it will leave by, keeps the previous context visible and dimmed
 * behind it, and hands back exactly where you were on dismiss. Replacing a
 * panel's contents in place gives none of those cues — the user loses the
 * thread of where they came from and how to get back.
 *
 * Dismissal follows the platform's three paths: the close control, the
 * backdrop, and Escape.
 */
export function ModalSheet({ open, onClose, title, action, hero, children, size = "page" }: ModalSheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const lastFocused = useRef<Element | null>(null);
  /** Regular width presents a floating card, so all four corners round. */
  const isRegular = useMediaQuery("(min-width: 768px)") === true;

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (!open) return;
    lastFocused.current = document.activeElement;
    document.addEventListener("keydown", onKeyDown);
    // Move focus into the sheet so screen readers and the keyboard follow the
    // presentation instead of staying stranded on the trigger behind it.
    const t = window.setTimeout(() => {
      panelRef.current?.querySelector<HTMLElement>("[data-autofocus], button, input, select, textarea")?.focus();
    }, 60);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      window.clearTimeout(t);
      (lastFocused.current as HTMLElement | null)?.focus?.();
    };
  }, [open, onKeyDown]);

  if (!open) return null;

  return (
    /**
     * Compact width  → edge-to-edge sheet rising from the bottom.
     * Regular width  → a centred, size-limited card, all corners rounded.
     *
     * This is the HIG's own split: at regular width a full-bleed bottom sheet
     * stretches a short form across 1400px of screen, which is unusable and
     * looks nothing like the platform. iPadOS presents the same content as a
     * centred form sheet, so that is what we do past `md`. It is still a sheet
     * — same component, same semantics, same dismissal — it just stops
     * pretending a desktop is a phone.
     */
    <div className="absolute inset-0 z-50 flex flex-col justify-end md:items-center md:justify-center md:p-6">
      <button
        aria-label="Dismiss"
        onClick={onClose}
        className="absolute inset-0 bg-scrim animate-in fade-in duration-standard"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        /**
         * Corner radius comes from SHEET_RADIUS, the same constant the bottom
         * sheet uses: a modal at 20px beside a sheet at 28px read as two
         * different systems. One constant, one shape language.
         *
         * SHAPE is what the two share, not surface. The bottom sheet docks
         * full-screen and IS the content layer; this floats over it, and in dark
         * that is one rung apart — see the panel's own note below.
         *
         * At compact width only the top corners are rounded (it meets the
         * bottom edge); at regular width all four are, because it floats.
         *
         * ease-spring, not ease-decelerate: iOS sheets settle, they don't
         * merely slow down.
         */
        style={{
          borderTopLeftRadius: SHEET_RADIUS,
          borderTopRightRadius: SHEET_RADIUS,
          borderBottomLeftRadius: isRegular ? SHEET_RADIUS : 0,
          borderBottomRightRadius: isRegular ? SHEET_RADIUS : 0,
        }}
        /**
         * `.sheet-panel` (globals.css) paints this surface AND publishes it to
         * the subtree as `--stack-surface`, in one declaration, so a
         * NavigationStack pushed inside a sheet lands on the sheet's own colour
         * instead of a colour it guessed. It resolves to #F2F2F7 in light and
         * #1C1C1E in dark.
         *
         * A card in here must ask for the rung above itself, by pairing
         * `bg-surface` with `dark:bg-surface-elevated`. The panel cannot hand it
         * over: bare `bg-surface` IS #1C1C1E in dark — this panel's own colour —
         * so a card that omits the dark half sinks into its background instead
         * of sitting on it. Light forgives the omission (#FFFFFF either way),
         * which is why dark is the only place the mistake shows.
         */
        className={`relative flex flex-col sheet-panel shadow-sheet overflow-hidden
          animate-in duration-sheet ease-spring
          slide-in-from-bottom md:slide-in-from-bottom-4 md:zoom-in-95
          md:w-full md:max-w-[440px] md:shadow-island
          ${size === "page" ? "h-[94%] md:h-[min(92%,720px)]" : "max-h-[88%] md:max-h-[min(88%,640px)]"}`}
      >
        {hero ? (
          /* The affordances precede {hero} in document order so the focus move
             above still lands on action-or-close exactly as it does in the
             header path — visual order comes from positioning, not the DOM.
             They float, so nothing pads the hero away from the top edge, and
             the panel's own overflow-hidden clips both to SHEET_RADIUS. */
          <div className="relative shrink-0">
            {/* A hero is a photograph of unknown luminance in both themes, so
                neither affordance below can rely on contrast against it. */}
            <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-16 bg-gradient-to-b from-scrim to-transparent" />

            {!isRegular && (
              <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center pt-2.5">
                <span className="h-[5px] w-9 rounded-full bg-text-tertiary" />
              </div>
            )}

            <div className="absolute right-0 top-0 z-10 flex items-center gap-1.5 p-1.5">
              {action}
              <button
                onClick={onClose}
                aria-label="Close"
                className="grid h-11 w-11 place-items-center text-text-secondary
                           hover:text-text-primary active:scale-90 transition-transform duration-instant"
              >
                {/* Material, not the header's bg-fillSecondary: a 16% grey fill
                    disappears over an arbitrary photo. Under Reduce Transparency
                    this collapses to an opaque surface, which still reads.
                    The 44px hit area is HIG's minimum; the chip stays 28px to
                    match the header's. */}
                <span className="grid h-7 w-7 place-items-center rounded-full material-thick">
                  <X className="h-4 w-4" strokeWidth={2.5} />
                </span>
              </button>
            </div>

            {hero}
          </div>
        ) : (
          <>
            {/* Grabber — signals "dismisses downward". Compact width only: a
                floating card at regular width does not dismiss by dragging down,
                so the affordance would be a lie. */}
            {!isRegular && (
              <div className="flex w-full shrink-0 justify-center pt-2.5 pb-1">
                <span className="h-[5px] w-9 rounded-full bg-text-tertiary" />
              </div>
            )}

            <header className="flex items-center justify-between gap-3 px-4 py-2.5 shrink-0">
              <h2 className="truncate text-headline text-text-primary">{title}</h2>
              <div className="flex items-center gap-1.5 shrink-0">
                {action}
                <button
                  onClick={onClose}
                  aria-label="Close"
                  className="grid place-items-center h-7 w-7 rounded-full bg-fillSecondary text-text-secondary
                             hover:text-text-primary active:scale-90 transition-transform duration-instant"
                >
                  <X className="h-4 w-4" strokeWidth={2.5} />
                </button>
              </div>
            </header>
          </>
        )}

        <div
          className="flex-1 overflow-y-auto overscroll-contain"
          style={{ paddingBottom: "calc(var(--safe-area-bottom) + 16px)" }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
