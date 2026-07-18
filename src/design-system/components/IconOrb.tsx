"use client";

import React from "react";

export type IconOrbSize = 28 | 32 | 48;

export type IconOrbTone =
  | "neutral"
  | "domain-food"
  | "domain-money"
  | "status-confirmed"
  | "status-caution"
  | "status-unavailable"
  | "status-info"
  | "rating";

const SIZE_STYLES: Record<IconOrbSize, string> = {
  28: "h-7 w-7 [&>svg]:h-icon-compact [&>svg]:w-icon-compact",
  32: "h-8 w-8 [&>svg]:h-icon-standard [&>svg]:w-icon-standard",
  48: "h-12 w-12 [&>svg]:h-icon-prominent [&>svg]:w-icon-prominent",
};

const TONE_STYLES: Record<IconOrbTone, string> = {
  neutral: "bg-fillTertiary text-text-secondary",
  "domain-food": "bg-domain-food-bg text-domain-food",
  "domain-money": "bg-domain-money-bg text-domain-money",
  "status-confirmed": "bg-status-confirmed-bg text-status-confirmed-fg",
  "status-caution": "bg-status-caution-bg text-status-caution-fg",
  "status-unavailable": "bg-status-unavailable-bg text-status-unavailable-fg",
  "status-info": "bg-status-info-bg text-status-info-fg",
  rating: "bg-rating-bg text-rating",
};

/**
 * A visual icon container, never an interaction target.
 *
 * ADR-018 requires the enclosing row, button, or link to own the accessible
 * name, focus treatment, and 44px hit target. Every current use has adjacent
 * visible text, so the orb and its glyph are decorative and hidden as one
 * subtree from assistive technology.
 */
export function IconOrb({
  children,
  size = 28,
  tone = "neutral",
}: {
  children: React.ReactNode;
  size?: IconOrbSize;
  tone?: IconOrbTone;
}) {
  return (
    <span
      aria-hidden="true"
      data-icon-orb=""
      data-icon-orb-size={size}
      data-icon-orb-tone={tone}
      className={`icon-orb grid shrink-0 place-items-center squircle-full ${SIZE_STYLES[size]} ${TONE_STYLES[tone]}`}
    >
      {children}
    </span>
  );
}
