"use client";

import React from "react";
import { SolidIcon, type SolidIconName } from "@/design-system/icons/SolidIcon";

export type StatusKind = "confirmed" | "caution" | "unavailable" | "info";

/**
 * Semantic status treatments.
 *
 * The chrome is neutral by design, so these are the only saturated colours in
 * the product and they must carry meaning on their own. Each maps to an Apple
 * system colour whose light/dark pair is defined in globals.css.
 *
 * Colour is never the only signal: every status also has a label, so the
 * meaning survives greyscale, colour-blindness, and a glance too quick to
 * register hue.
 */
const STYLES: Record<StatusKind, { dot: string; bg: string; fg: string }> = {
  confirmed: { dot: "bg-status-confirmed", bg: "bg-status-confirmed-bg", fg: "text-status-confirmed-fg" },
  caution: { dot: "bg-status-caution", bg: "bg-status-caution-bg", fg: "text-status-caution-fg" },
  unavailable: { dot: "bg-status-unavailable", bg: "bg-status-unavailable-bg", fg: "text-status-unavailable-fg" },
  info: { dot: "bg-status-info", bg: "bg-status-info-bg", fg: "text-status-info-fg" },
};

const ICONS: Record<StatusKind, SolidIconName | null> = {
  confirmed: "check",
  caution: "warning",
  unavailable: "close",
  info: null,
};

export function StatusDot({ kind }: { kind: StatusKind }) {
  return (
    <span className="relative flex h-2 w-2 shrink-0">
      <span
        className={`relative inline-flex h-2 w-2 rounded-full
                    forced-colors:bg-[CanvasText] ${STYLES[kind].dot}`}
      />
    </span>
  );
}

export function StatusBadge({
  kind,
  children,
  className = "",
}: {
  kind: StatusKind;
  children: React.ReactNode;
  className?: string;
}) {
  const s = STYLES[kind];
  const icon = ICONS[kind];
  return (
    <span
      /**
       * NORMAL WEIGHT, deliberately. This used to carry a semibold utility.
       *
       * (Written without the class name: Tailwind's scanner reads comments, so
       * spelling it here would re-emit the rule this removes — dead CSS conjured
       * by a comment about deleting it. Same trap as `Button.tsx`.)
       *
       * The badge already carries three signals — a coloured dot, a tinted pill,
       * and saturated ink — and it is the only saturated colour in the row. Weight
       * was a fourth shout on top of three, and it cost more than it bought: the
       * app leaned on that one weight 28 times, so it had stopped meaning "this one
       * matters" and started meaning "this is text".
       *
       * Owner's call, 2026-07-17: status reads normal; bold and demibold are for
       * the few places that genuinely peak, and they cannot be everywhere at once
       * or the UI stops being calm.
       *
       * The colour still carries it. `-fg` was retuned to pass 4.5:1 on both real
       * backings (docs/ACCESSIBILITY.md P0-6), and that floor does not move with
       * weight — 11px is small text at 400 or 600 alike, so nothing here trades
       * legibility for quiet.
       */
      data-status-kind={kind}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]
                  forced-colors:bg-[Canvas] forced-colors:text-[CanvasText]
                  forced-colors:outline forced-colors:outline-1
                  forced-colors:outline-offset-[-1px] ${s.bg} ${s.fg} ${className}`}
    >
      {icon ? (
        <SolidIcon name={icon} size={16} />
      ) : (
        <span className={`h-1.5 w-1.5 rounded-full forced-colors:bg-[CanvasText] ${s.dot}`} />
      )}
      {children}
    </span>
  );
}
