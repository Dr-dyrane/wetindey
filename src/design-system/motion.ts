"use client";

import { useSyncExternalStore } from "react";

/** Semantic transition recipes. Components import these names instead of
 * spelling CSS classes, durations, or property lists independently. */
export const transition = {
  press: "motion-press",
  focus: "motion-focus",
  reveal: "motion-reveal",
  presentSheet: "motion-present-sheet",
  dismissSheet: "motion-dismiss-sheet",
  snapSheet: "motion-snap-sheet",
  push: "motion-push",
  replace: "motion-replace",
  feedback: "motion-feedback",
  directManipulation: "motion-direct-manipulation",
} as const;

/**
 * WetinDey's shared motion vocabulary.
 *
 * Values mirror docs/design-system/MOTION-SYSTEM.md. Components consume the
 * semantic recipes below; CSS owns the matching variables and reduced-motion
 * alternatives. Do not add a private duration to a component when a recipe
 * already describes the transition.
 */
export const motion = {
  duration: {
    instant: 80,
    ultraFast: 120,
    fast: 160,
    standard: 230,
    slow: 320,
    deliberate: 420,
    continuous: 0,
  },
  ease: {
    decelerate: "cubic-bezier(0, 0, 0.2, 1)",
    accelerate: "cubic-bezier(0.4, 0, 1, 1)",
    standard: "cubic-bezier(0.2, 0, 0, 1)",
    emphasized: "cubic-bezier(0.32, 0.72, 0, 1)",
    inOut: "cubic-bezier(0.4, 0, 0.2, 1)",
    linear: "linear",
  },
  spring: {
    gentle: { stiffness: 260, damping: 30, mass: 1, bounce: 0 },
    standard: { stiffness: 420, damping: 34, mass: 1, bounce: 0 },
    responsive: { stiffness: 560, damping: 38, mass: 1, bounce: 0 },
    snappy: { stiffness: 700, damping: 44, mass: 1, bounce: 0 },
    heavy: { stiffness: 360, damping: 42, mass: 1.2, bounce: 0 },
  },
  sheet: {
    projectionMs: 150,
    stepPx: 64,
    armPx: 16,
    minimumFraction: 0.12,
    resistance: 0.35,
    flickVelocityPxPerSecond: 900,
    maximumVelocityPxPerSecond: 2400,
    velocityMemoryMs: 80,
  },
  opacity: {
    scrim: 0.28,
    disabled: 0.4,
  },
  scale: {
    press: 0.985,
    modalStart: 0.98,
  },
  blur: {
    /** ADR-026 backdrop-blur-sm target; never use this as content filter blur. */
    backdrop: 8,
    reduced: 0,
  },
  elevation: {
    card: "var(--shadow-card)",
    raised: "var(--shadow-raised)",
    sheet: "var(--shadow-sheet)",
    island: "var(--shadow-island)",
  },
  radius: {
    sheet: 28,
    controlMinimum: 14,
    controlMaximum: 16,
  },
  border: {
    transition: "none",
  },
  origin: {
    sheet: "50% 100%",
    modal: "50% 50%",
  },
} as const;

export type Detent = "peek" | "medium" | "large";

export const DETENT_ORDER: readonly Detent[] = ["peek", "medium", "large"];

export const DETENT_FRACTION: Readonly<Record<Detent, number>> = {
  peek: 0.2,
  medium: 0.52,
  large: 0.94,
};

export const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value));

export const lerp = (from: number, to: number, progress: number): number =>
  from + (to - from) * progress;

export const inverseLerp = (from: number, to: number, value: number): number =>
  clamp((value - from) / (to - from), 0, 1);

export function nextDetent(detent: Detent, direction: 1 | -1): Detent {
  const currentIndex = DETENT_ORDER.indexOf(detent);
  return DETENT_ORDER[clamp(currentIndex + direction, 0, DETENT_ORDER.length - 1)]!;
}

export function nearestDetent(fraction: number): Detent {
  let candidate: Detent = "medium";
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const detent of DETENT_ORDER) {
    const distance = Math.abs(fraction - DETENT_FRACTION[detent]);
    if (distance < nearestDistance) {
      candidate = detent;
      nearestDistance = distance;
    }
  }

  return candidate;
}

/**
 * Resolve a release from the current rendered sheet position.
 *
 * Velocity is a fraction of viewport height per millisecond. The returned
 * detent is always at most one step away from the release's starting detent.
 */
export function resolveSheetRelease({
  startDetent,
  currentFraction,
  velocityFractionPerMs,
  travelPx,
}: {
  startDetent: Detent;
  currentFraction: number;
  velocityFractionPerMs: number;
  travelPx: number;
}): Detent {
  const projected = currentFraction + velocityFractionPerMs * motion.sheet.projectionMs;
  const nearest = nearestDetent(projected);
  const direction: 1 | -1 = travelPx >= 0 ? 1 : -1;

  const deliberateFallback =
    nearest === startDetent && Math.abs(travelPx) >= motion.sheet.stepPx
      ? nextDetent(startDetent, direction)
      : nearest;

  const startIndex = DETENT_ORDER.indexOf(startDetent);
  const candidateIndex = DETENT_ORDER.indexOf(deliberateFallback);
  return DETENT_ORDER[clamp(candidateIndex, startIndex - 1, startIndex + 1)]!;
}

/** Pointer cancellation has no trustworthy throw velocity. */
export function resolveSheetCancellation({
  startDetent,
  travelPx,
}: {
  startDetent: Detent;
  travelPx: number;
}): Detent {
  if (Math.abs(travelPx) < motion.sheet.stepPx) return startDetent;
  return nextDetent(startDetent, travelPx >= 0 ? 1 : -1);
}

export function resistedSheetFraction(rawFraction: number): number {
  const minimum = motion.sheet.minimumFraction;
  const maximum = DETENT_FRACTION.large;

  if (rawFraction > maximum) return maximum + (rawFraction - maximum) * motion.sheet.resistance;
  if (rawFraction < minimum) return minimum - (minimum - rawFraction) * motion.sheet.resistance;
  return rawFraction;
}

/**
 * A release only carries the velocity of a recent movement. A finger that has
 * stopped on the glass should settle by its position, not fling based on an
 * old pointer sample. The linear decay keeps the handoff continuous without
 * preserving a stale throw indefinitely.
 */
export function decaySheetVelocity(velocityFractionPerMs: number, elapsedMs: number): number {
  const freshness = clamp(1 - Math.max(0, elapsedMs) / motion.sheet.velocityMemoryMs, 0, 1);
  return velocityFractionPerMs * freshness;
}

/** Applies the component's calibrated flick threshold after velocity freshness. */
export function releaseSheetVelocity({
  velocityFractionPerMs,
  elapsedMs,
  viewportHeight,
}: {
  velocityFractionPerMs: number;
  elapsedMs: number;
  viewportHeight: number;
}): number {
  const velocity = decaySheetVelocity(velocityFractionPerMs, elapsedMs);
  const velocityPxPerSecond = Math.abs(velocity) * Math.max(0, viewportHeight) * 1000;
  return velocityPxPerSecond >= motion.sheet.flickVelocityPxPerSecond ? velocity : 0;
}

function reducedMotionSnapshot(): boolean {
  return (
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function subscribeReducedMotion(onStoreChange: () => void): () => void {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", onStoreChange);
  return () => media.removeEventListener("change", onStoreChange);
}

/** React-safe OS preference hook for component-level motion alternatives. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribeReducedMotion, reducedMotionSnapshot, () => false);
}

function reducedTransparencySnapshot(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-transparency: reduce)").matches
  );
}

function subscribeReducedTransparency(onStoreChange: () => void): () => void {
  const media = window.matchMedia("(prefers-reduced-transparency: reduce)");
  media.addEventListener("change", onStoreChange);
  return () => media.removeEventListener("change", onStoreChange);
}

/** React-safe OS preference hook for component-level material alternatives. */
export function useReducedTransparency(): boolean {
  return useSyncExternalStore(
    subscribeReducedTransparency,
    reducedTransparencySnapshot,
    () => false
  );
}
