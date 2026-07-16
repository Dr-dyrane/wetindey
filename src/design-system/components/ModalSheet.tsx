"use client";

import React, { useCallback, useEffect, useRef } from "react";
import { X } from "lucide-react";

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
    <div className="absolute inset-0 z-50 flex flex-col justify-end">
      <button
        aria-label="Dismiss"
        onClick={onClose}
        className="absolute inset-0 bg-black/35 animate-in fade-in duration-standard"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative flex flex-col bg-background shadow-sheet
          rounded-t-[20px] overflow-hidden
          animate-in slide-in-from-bottom duration-sheet ease-decelerate
          ${size === "page" ? "h-[94%]" : "max-h-[88%]"}`}
      >
        {/* Grabber — signals "this sheet dismisses downward" even though the
            drag itself is handled by the backdrop/close affordances. */}
        <div className="w-full pt-2.5 pb-1 flex justify-center shrink-0">
          <span className="w-9 h-[5px] rounded-full bg-text-tertiary" />
        </div>

        <header className="flex items-center justify-between gap-3 px-4 py-2.5 shrink-0">
          <h2 className="text-[17px] font-semibold tracking-tight text-text-primary truncate">{title}</h2>
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
