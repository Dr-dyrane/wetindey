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
const POINTER_RETURN_WINDOW_MS = 1000;
let recentPointerTarget: { element: HTMLElement; capturedAt: number } | null = null;
const modalGlobal = globalThis as typeof globalThis & {
  __wetindeyModalPointerTracker?: (event: PointerEvent) => void;
  __wetindeyModalTriggerTracker?: {
    pointerdown: (event: PointerEvent) => void;
    keydown: () => void;
  };
};

const recordPointerTarget = (event: PointerEvent) => {
  if (!(event.target instanceof Element)) return;
  const element = event.target.closest<HTMLElement>(FOCUSABLE_SELECTOR);
  if (element && isEnabledVisible(element)) {
    recentPointerTarget = { element, capturedAt: Date.now() };
  }
};

const recordKeyboardIntent = () => {
  recentPointerTarget = null;
};

if (typeof document !== "undefined") {
  if (modalGlobal.__wetindeyModalPointerTracker) {
    document.removeEventListener(
      "pointerdown",
      modalGlobal.__wetindeyModalPointerTracker,
      true
    );
    delete modalGlobal.__wetindeyModalPointerTracker;
  }
  if (modalGlobal.__wetindeyModalTriggerTracker) {
    document.removeEventListener(
      "pointerdown",
      modalGlobal.__wetindeyModalTriggerTracker.pointerdown,
      true
    );
    document.removeEventListener(
      "keydown",
      modalGlobal.__wetindeyModalTriggerTracker.keydown,
      true
    );
  }
  document.addEventListener("pointerdown", recordPointerTarget, true);
  document.addEventListener("keydown", recordKeyboardIntent, true);
  modalGlobal.__wetindeyModalTriggerTracker = {
    pointerdown: recordPointerTarget,
    keydown: recordKeyboardIntent,
  };
}

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

function isEnabledVisible(element: HTMLElement): boolean {
  return (
    !element.matches("[disabled]") &&
    !element.matches("[aria-disabled='true']") &&
    !element.hidden &&
    !isDisabledByAncestorFieldset(element) &&
    !element.closest("[inert], [aria-hidden='true']") &&
    element.offsetParent !== null &&
    getComputedStyle(element).display !== "none" &&
    getComputedStyle(element).visibility !== "hidden"
  );
}

function focusableWithin(panel: HTMLElement): HTMLElement[] {
  return Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    isEnabledVisible
  );
}

export function resolveInitialFocusTarget(
  preferredIndex: number,
  focusableCount: number
): number | "panel" {
  if (preferredIndex >= 0 && preferredIndex < focusableCount) return preferredIndex;
  return focusableCount > 0 ? 0 : "panel";
}

export function resolveTabFocusBoundary({
  focusableCount,
  activeIndex,
  activeInsidePanel,
  shiftKey,
}: {
  focusableCount: number;
  activeIndex: number;
  activeInsidePanel: boolean;
  shiftKey: boolean;
}): number | "panel" {
  if (focusableCount === 0) return "panel";
  if (!activeInsidePanel || activeIndex < 0) return shiftKey ? focusableCount - 1 : 0;
  return shiftKey
    ? (activeIndex - 1 + focusableCount) % focusableCount
    : (activeIndex + 1) % focusableCount;
}

export function resolveReturnFocusSource({
  hasActiveElement,
  activeIsPageRoot,
  hasRecentPointerTarget,
}: {
  hasActiveElement: boolean;
  activeIsPageRoot: boolean;
  hasRecentPointerTarget: boolean;
}): "active" | "pointer" | null {
  if (hasRecentPointerTarget) return "pointer";
  if (hasActiveElement && !activeIsPageRoot) return "active";
  return null;
}

export function shouldMoveInitialFocus({
  childOpen,
  restoringChildFocus,
}: {
  childOpen: boolean;
  restoringChildFocus: boolean;
}): boolean {
  return childOpen || !restoringChildFocus;
}

export function resolveModalFocusOwnership({
  hasVisiblePanels,
  isLastVisiblePanel,
  isRegisteredTop,
}: {
  hasVisiblePanels: boolean;
  isLastVisiblePanel: boolean;
  isRegisteredTop: boolean;
}): boolean {
  return hasVisiblePanels ? isLastVisiblePanel : isRegisteredTop;
}

export function shouldActivateModalContainment({
  mounted,
  open,
  isFocusOwner,
}: {
  mounted: boolean;
  open: boolean;
  isFocusOwner: boolean;
}): boolean {
  return mounted && open && isFocusOwner;
}

export function resolveModalFocusScope<T>(panel: T, child: T | null): T {
  return child ?? panel;
}

function ownsModalFocus(modalId: string, panel: HTMLElement): boolean {
  const visiblePanels = Array.from(
    document.querySelectorAll<HTMLElement>(
      "[role='dialog'][aria-modal='true'][data-motion-state='visible']"
    )
  );
  return resolveModalFocusOwnership({
    hasVisiblePanels: visiblePanels.length > 0,
    isLastVisiblePanel: visiblePanels.at(-1) === panel,
    isRegisteredTop: presentedStack.at(-1) === modalId,
  });
}

function focusInitial(panel: HTMLElement | null) {
  if (!panel) return;

  const focusable = focusableWithin(panel);
  const preferredIndex = focusable.findIndex((element) =>
    element.hasAttribute("data-autofocus")
  );
  const target = resolveInitialFocusTarget(preferredIndex, focusable.length);
  (target === "panel" ? panel : focusable[target]!).focus();
}

function trapTab(panel: HTMLElement, event: KeyboardEvent) {
  const focusable = focusableWithin(panel);
  const current = document.activeElement;
  const target = resolveTabFocusBoundary({
    focusableCount: focusable.length,
    activeIndex: current instanceof HTMLElement ? focusable.indexOf(current) : -1,
    activeInsidePanel: current !== null && panel.contains(current),
    shiftKey: event.shiftKey,
  });

  event.preventDefault();
  if (target === "panel") panel.focus();
  if (target !== "panel") focusable[target]!.focus();
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
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const childPanelRef = useRef<HTMLElement>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const childSequence = useRef(0);
  const childHistoryRef = useRef(false);
  const childReturnFocusRef = useRef<HTMLElement | null>(null);
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
        childReturnFocusRef.current = current.returnFocus;
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
    if (child !== null || !childReturnFocusRef.current) return;
    let restoreFrame = 0;
    const settleFrame = requestAnimationFrame(() => {
      restoreFrame = requestAnimationFrame(() => {
        const returnFocus = childReturnFocusRef.current;
        childReturnFocusRef.current = null;
        if (returnFocus?.isConnected) {
          returnFocus.focus();
        } else {
          focusInitial(panelRef.current);
        }
      });
    });
    return () => {
      cancelAnimationFrame(settleFrame);
      if (restoreFrame !== 0) cancelAnimationFrame(restoreFrame);
    };
  }, [child]);

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
    const activeElement =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const activeIsPageRoot =
      activeElement === document.body || activeElement === document.documentElement;
    const pointerTarget =
      recentPointerTarget &&
      Date.now() - recentPointerTarget.capturedAt <= POINTER_RETURN_WINDOW_MS &&
      recentPointerTarget.element.isConnected
        ? recentPointerTarget.element
        : null;
    const returnFocusSource = resolveReturnFocusSource({
      hasActiveElement: activeElement !== null,
      activeIsPageRoot,
      hasRecentPointerTarget: pointerTarget !== null,
    });
    lastFocusedRef.current =
      returnFocusSource === "active"
        ? activeElement
        : returnFocusSource === "pointer"
          ? pointerTarget
          : null;
    return () => {
      const returnFocus = lastFocusedRef.current;
      requestAnimationFrame(() => {
        if (returnFocus?.isConnected) returnFocus.focus();
      });
    };
  }, [mounted]);

  useEffect(() => {
    if (!rootRef.current || !panelRef.current) return;
    if (
      !shouldActivateModalContainment({
        mounted,
        open,
        isFocusOwner: ownsModalFocus(modalId, panelRef.current),
      })
    ) {
      return;
    }

    const siblings = Array.from(document.body.children)
      .filter((element): element is HTMLElement => element instanceof HTMLElement)
      .filter((element) => element !== rootRef.current)
      .map((element) => ({ element, wasInert: element.inert }));
    siblings.forEach(({ element }) => {
      element.inert = true;
    });

    return () => {
      siblings.forEach(({ element, wasInert }) => {
        if (element.isConnected) element.inert = wasInert;
      });
    };
  }, [isTop, modalId, mounted, open]);

  useEffect(() => {
    if (!panelRef.current) return;
    if (
      !shouldActivateModalContainment({
        mounted,
        open,
        isFocusOwner: ownsModalFocus(modalId, panelRef.current),
      })
    ) {
      return;
    }
    if (
      !shouldMoveInitialFocus({
        childOpen: child !== null,
        restoringChildFocus: childReturnFocusRef.current !== null,
      })
    ) {
      return;
    }
    const focusTimer = window.setTimeout(
      () => {
        const panel = panelRef.current;
        if (panel && ownsModalFocus(modalId, panel)) {
          focusInitial(resolveModalFocusScope(panel, childPanelRef.current));
        }
      },
      reducedMotion ? 0 : motion.duration.instant
    );
    return () => window.clearTimeout(focusTimer);
  }, [child?.id, isTop, modalId, mounted, open, reducedMotion]);

  useEffect(() => {
    if (!mounted || !open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const panel = panelRef.current;
      if (!panel || !ownsModalFocus(modalId, panel)) return;
      const focusScope = resolveModalFocusScope(panel, childPanelRef.current);
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        requestCloseRef.current();
        return;
      }
      if (event.key === "Tab") {
        event.stopImmediatePropagation();
        trapTab(focusScope, event);
      }
    };
    const onFocusIn = (event: FocusEvent) => {
      const panel = panelRef.current;
      const focusScope = panel
        ? resolveModalFocusScope(panel, childPanelRef.current)
        : null;
      if (
        !panel ||
        !focusScope ||
        !ownsModalFocus(modalId, panel) ||
        !(event.target instanceof Node) ||
        focusScope.contains(event.target)
      ) {
        return;
      }
      focusInitial(focusScope);
    };
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("focusin", onFocusIn, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("focusin", onFocusIn, true);
    };
  }, [isTop, modalId, mounted, open]);

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
    <div
      ref={rootRef}
      className="fixed inset-0 z-50 flex flex-col justify-end md:items-center md:justify-center md:p-6"
    >
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
        className={`sheet-panel material-dense-glass motion-modal-panel relative flex flex-col overflow-hidden shadow-sheet ${
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
            ref={childPanelRef}
            aria-label={child.title}
            className={`stack-surface sheet-child-surface absolute inset-0 z-10 flex min-h-0 flex-col overflow-hidden ${transition.push}`}
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
