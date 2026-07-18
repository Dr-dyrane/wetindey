"use client";

import React from "react";
import {
  REFERENCE_CURRENCY_META,
  type ReferenceCurrencyCode,
} from "@/app/_data/reference-currencies";

interface CurrencyFlagProps {
  code: ReferenceCurrencyCode | "NGN" | string;
  className?: string;
}

export function CurrencyFlag({ code, className = "" }: CurrencyFlagProps) {
  const symbol =
    code === "NGN"
      ? "ng"
      : code in REFERENCE_CURRENCY_META
        ? REFERENCE_CURRENCY_META[code as ReferenceCurrencyCode].flag
        : "neutral";

  return (
    <span
      aria-hidden="true"
      className={`inline-flex h-7 w-7 shrink-0 overflow-hidden rounded-full bg-fillTertiary ${className}`}
    >
      <svg
        className="h-full w-full"
        viewBox="0 0 24 16"
        preserveAspectRatio="xMidYMid slice"
        focusable="false"
      >
        <use href={`/icons/currency-flags.svg#flag-${symbol}`} />
      </svg>
    </span>
  );
}
