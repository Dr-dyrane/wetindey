"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, X } from "lucide-react";
import { SHEET_RADIUS } from "./BottomSheet";
import { useMediaQuery } from "@/core/hooks/useMediaQuery";
import { motion, transition, useReducedMotion } from "@/design-system/motion";

interface PresentedChild {
  id: string;
  title: string;
  content: React.ReactNode;
  returnFocus: HTMLElement | null;
}

interface ModalSheetNavigation {
  pushChild: (child: Omit<PresentedChild, "id">) => string;
  popChild: () => void;
  childOpen: boolean;
  childId: string | null;
}

const ModalSheetNavigationContext = createContext<ModalSheetNavigation | null>(null);

/**
 * Allows controls such as SheetPicker to push contextual content inside the
 * existing modal shell instead of mounting a nested modal.
 */
export function useModalSheetNavigation(): ModalSheetNavigation | null {
  return useContext(ModalSheetNavigationContext);
}

let presentedStack: string[] = [];
const presentationListeners = new Set<() => void>();
const notifyPresentation = () => presentationListeners.forEach((listener) => listener());

function registerPresentation(id: string) {
  presentedStack = [...presentedStack.filter((entry) => entry !== id), id];
  notifyPresentation();
}

function unregisterPresentation(id: string) {
  presentedStack = presentedStack.filter((entry) => entry !== id);
  notifyPresentation();
}

const subscribePresentation = (listener: () => void) => {
  presentationListeners.add(listener);
  return () => presentationListeners.delete(listener);
};

const presentationSnapshot = () => presentedStack.length > 0;
const presentationServerSnapshot = () => false;

/** Is any modal surface visible or exiting over the app? */
export function useModalPresented(): boolean {
  return useSyncExternalStore(
    subscribePresentation,
    presentationSnapshot,
    presentationServerSnapshot
  );
}

function useModalIsTop(id: string): boolean {
  return useSyncExternalStore(
    subscribePresentation,
    () => presentedStack.at(-1) === id,
    () => false
  );
}

interface ModalSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  action?: React.ReactNode;
  hero?: React.ReactNode;
  children: React.ReactNode;
  size?: "page" | "form";
}

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function isDisabledByAncestorFieldset(element: HTMLElement): boolean {
  return element.closest("fieldset[disabled]") !== null;
}

function focusInitial(panel: HTMLElement | null) {
  if (!panel) return;

  const isEnabledVisible = (element: HTMLElement) =>
    !element.matches("[disabled]") &&
    !element.matches("[aria-disabled='true']") &&
    !element.hidden &&
    !isDisabledByAncestorFieldset(element) &&
    !element.closest("[inert], [aria-hidden='true']") &&
    element.offsetParent !== null &&
    getComputedStyle(element).display !== "none" &&
    getComputedStyle(element).visibility !== "hidden";
  const preferred = Array.from(panel.querySelectorAll<HTMLElement>("[data-autofocus]"))
    .filter((element) => element.matches(FOCUSABLE_SELECTOR) && isEnabledVisible(element))[0];
  const fallback = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).find(
    isEnabledVisible
  );
  (preferred ?? fallback ?? panel).focus();
}

function trapTab(panel: HTMLElement, event: KeyboardEvent) {
  const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) =>
      !isDisabledByAncestorFieldset(element) &&
      !element.closest("[inert], [aria-hidden='true']") &&
      element.offsetParent !== null
  );
  if (focusable.length === 0) {
    event.preventDefault();
    panel.focus();
    return;
  }

  const first = focusable[0]!;
  const last = focusable[focusable.length - 1]!;
  const current = document.activeElement;
  if (event.shiftKey) {
    if (current === first || !panel.contains(current)) {
      event.preventDefault();
      last.focus();
    }
    return;
  }

  if (current === last || !panel.contains(current)) {
    event.preventDefault();
    first.focus();
  }
}

/**
 * The one presentation shell for a modal task. It portals to `document.body`,
 * has one active Escape/focus owner, retains itself through exit, and exposes a
 * contextual child push for SheetPicker.
 */
export function ModalSheet({
  open,
  onClose,
  title,
  action,
  hero,
  children,
  size = "page",
}: ModalSheetProps) {
  const modalId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const childSequence = useRef(0);
  const childHistoryRef = useRef(false);
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);
  const [child, setChild] = useState<PresentedChild | null>(null);
  const isRegular = useMediaQuery("(min-width: 768px)") === true;
  const reducedMotion = useReducedMotion();
  const isTop = useModalIsTop(modalId);

  onCloseRef.current = onClose;

  const clearChild = useCallback(() => {
    setChild((current) => {
      if (current?.returnFocus) {
        requestAnimationFrame(() => current.returnFocus?.focus());
      }
      return null;
    });
  }, []);

  const popChild = useCallback(() => {
    const rewindHistory = childHistoryRef.current;
    childHistoryRef.current = false;
    clearChild();
    if (rewindHistory && typeof window !== "undefined") window.history.back();
  }, [clearChild]);

  const pushChild = useCallback(
    (next: Omit<PresentedChild, "id">) => {
      childSequence.current += 1;
      const id = `child-${childSequence.current}`;
      setChild({ ...next, id });
      if (typeof window !== "undefined") {
        childHistoryRef.current = true;
        const currentState =
          typeof window.history.state === "object" && window.history.state !== null
            ? window.history.state
            : {};
        window.history.pushState(
          { ...currentState, wetindeyModalChild: modalId },
          "",
          window.location.href
        );
      }
      return id;
    },
    [modalId]
  );

  const requestCloseRef = useRef<() => void>(() => undefined);
  requestCloseRef.current = () => {
    if (child) {
      popChild();
      return;
    }
    onCloseRef.current();
  };

  useEffect(() => {
    let frame: number | null = null;
    let timeout: number | null = null;

    if (open) {
      setMounted(true);
      frame = requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
      timeout = window.setTimeout(
        () => {
          setMounted(false);
          setChild(null);
        },
        reducedMotion ? 1 : Math.max(motion.duration.fast, motion.duration.standard)
      );
    }

    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      if (timeout !== null) window.clearTimeout(timeout);
    };
  }, [open, reducedMotion]);

  useEffect(() => {
    if (!mounted) return;
    registerPresentation(modalId);
    return () => unregisterPresentation(modalId);
  }, [modalId, mounted]);

  useEffect(() => {
    if (!mounted) return;
    lastFocusedRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return () => lastFocusedRef.current?.focus();
  }, [mounted]);

  useEffect(() => {
    if (!mounted || !visible || !isTop) return;
    const focusTimer = window.setTimeout(
      () => focusInitial(panelRef.current),
      reducedMotion ? 0 : motion.duration.instant
    );
    return () => window.clearTimeout(focusTimer);
  }, [child?.id, isTop, mounted, reducedMotion, visible]);

  useEffect(() => {
    if (!mounted || !visible || !isTop) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        requestCloseRef.current();
        return;
      }
      if (event.key === "Tab" && panelRef.current) trapTab(panelRef.current, event);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isTop, mounted, visible]);

  useEffect(() => {
    const onPopState = () => {
      if (!childHistoryRef.current) return;
      childHistoryRef.current = false;
      clearChild();
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [clearChild]);

  /* A parent can close the modal directly (for example after a successful
     form submission). Do not leave a child-only history entry behind in that
     path, or the next browser Back would appear to navigate without changing
     the page. */
  useEffect(() => {
    if (open || !childHistoryRef.current || typeof window === "undefined") return;
    childHistoryRef.current = false;
    window.history.back();
  }, [open]);

  const navigation = useMemo<ModalSheetNavigation>(
    () => ({ pushChild, popChild, childOpen: child !== null, childId: child?.id ?? null }),
    [child, popChild, pushChild]
  );

  if (!mounted || typeof document === "undefined") return null;

  const state = visible ? "visible" : "hidden";
  const closeRoot = () => {
    if (childHistoryRef.current && typeof window !== "undefined") {
      childHistoryRef.current = false;
      window.history.back();
    }
    onCloseRef.current();
  };

  const panel = (
    <div className="fixed inset-0 z-50 flex flex-col justify-end md:items-center md:justify-center md:p-6">
      <button
        type="button"
        aria-label={child ? "Back to previous step" : "Dismiss"}
        onClick={() => requestCloseRef.current()}
        data-motion-state={state}
        className={`absolute inset-0 ${transition.reveal} motion-modal-backdrop`}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={child?.title ?? title}
        tabIndex={-1}
        data-motion-state={state}
        style={{
          borderTopLeftRadius: SHEET_RADIUS,
          borderTopRightRadius: SHEET_RADIUS,
          borderBottomLeftRadius: isRegular ? SHEET_RADIUS : 0,
          borderBottomRightRadius: isRegular ? SHEET_RADIUS : 0,
        }}
        className={`sheet-panel motion-modal-panel relative flex flex-col overflow-hidden shadow-sheet ${
          visible ? transition.presentSheet : transition.dismissSheet
        } md:w-full md:max-w-[440px] md:shadow-island ${size === "page" ? "h-[94%] md:h-[min(92%,720px)]" : "max-h-[88%] md:max-h-[min(88%,640px)]"}`}
      >
        <div
          inert={child ? true : undefined}
          aria-hidden={child ? true : undefined}
          className="flex min-h-0 flex-1 flex-col"
        >
          {hero ? (
            <div className="relative shrink-0">
              <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-16 bg-gradient-to-b from-scrim to-transparent" />
              {!isRegular && (
                <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center pt-2.5">
                  <span className="h-[5px] w-9 rounded-full bg-text-tertiary" />
                </div>
              )}
              <div className="absolute right-0 top-0 z-10 flex items-center gap-1.5 p-1.5">
                {action}
                <button
                  type="button"
                  onClick={() => requestCloseRef.current()}
                  aria-label="Close"
                  className={`grid h-11 w-11 place-items-center text-text-secondary hover:text-text-primary ${transition.press}`}
                >
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-controlFill">
                    <X className="h-4 w-4" strokeWidth={2.5} />
                  </span>
                </button>
              </div>
              {hero}
            </div>
          ) : (
            <>
              {!isRegular && (
                <div className="flex w-full shrink-0 justify-center pb-1 pt-2.5">
                  <span className="h-[5px] w-9 rounded-full bg-text-tertiary" />
                </div>
              )}
              <header className="flex shrink-0 items-center justify-between gap-3 px-4 py-2.5">
                <h2 className="truncate text-headline text-text-primary">{title}</h2>
                <div className="flex shrink-0 items-center gap-1.5">
                  {action}
                  <button
                    type="button"
                    onClick={() => requestCloseRef.current()}
                    aria-label="Close"
                    className={`grid h-11 w-11 place-items-center text-text-secondary ${transition.press}`}
                  >
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-controlFill">
                      <X className="h-4 w-4" strokeWidth={2.5} />
                    </span>
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

        {child && (
          <section
            aria-label={child.title}
            className={`stack-surface absolute inset-0 z-10 flex min-h-0 flex-col overflow-hidden ${transition.push}`}
          >
            <header className="flex shrink-0 items-center gap-2 px-3 py-2.5">
              <button
                type="button"
                onClick={popChild}
                data-autofocus
                className={`squircle inline-flex h-tap items-center gap-1 px-2 text-body text-accent ${transition.press}`}
              >
                <ChevronLeft aria-hidden className="h-4 w-4" strokeWidth={2.5} />
                Back
              </button>
              <h2 className="min-w-0 flex-1 truncate text-headline text-text-primary">
                {child.title}
              </h2>
              <button
                type="button"
                onClick={closeRoot}
                aria-label="Close"
                className={`grid h-11 w-11 shrink-0 place-items-center text-text-secondary ${transition.press}`}
              >
                <span className="grid h-7 w-7 place-items-center rounded-full bg-controlFill">
                  <X className="h-4 w-4" strokeWidth={2.5} />
                </span>
              </button>
            </header>
            <div
              className="flex-1 overflow-y-auto overscroll-contain"
              style={{ paddingBottom: "calc(var(--safe-area-bottom) + 16px)" }}
            >
              {child.content}
            </div>
          </section>
        )}
      </div>
    </div>
  );

  return createPortal(
    <ModalSheetNavigationContext.Provider value={navigation}>
      {panel}
    </ModalSheetNavigationContext.Provider>,
    document.body
  );
}
