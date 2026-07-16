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
export function ModalSheet({ open, onClose, title, action, children, size = "page" }: ModalSheetProps) {
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
         * sheet uses. These are the same kind of object — a presented surface —
         * so a modal at 20px next to a sheet at 28px read as two different
         * systems. One constant, one language.
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
        className={`relative flex flex-col bg-background shadow-sheet overflow-hidden
          animate-in duration-sheet ease-spring
          slide-in-from-bottom md:slide-in-from-bottom-4 md:zoom-in-95
          md:w-full md:max-w-[440px] md:shadow-island
          ${size === "page" ? "h-[94%] md:h-[min(92%,720px)]" : "max-h-[88%] md:max-h-[min(88%,640px)]"}`}
      >
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
