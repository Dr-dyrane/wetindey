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
  neutral: "bg-iconOrb text-iconOrb-ink",
  "domain-food": "bg-domain-food-orb text-domain-food-orb-ink",
  "domain-money": "bg-domain-money-orb text-domain-money-orb-ink",
  "status-confirmed": "bg-status-confirmed-orb text-status-confirmed-orb-ink",
  "status-caution": "bg-status-caution-orb text-status-caution-orb-ink",
  "status-unavailable": "bg-status-unavailable-orb text-status-unavailable-orb-ink",
  "status-info": "bg-status-info-orb text-status-info-orb-ink",
  rating: "bg-rating-orb text-rating-orb-ink",
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
