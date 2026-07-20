"use client";

import { useEffect, useState } from "react";
import { Utensils, ChevronRight } from "lucide-react";

import { CurrencyFlag } from "@/app/_components/CurrencyFlag";
import type { CategoryPillar } from "@/app/_components/CategorySelectorSheet";

export interface CrossCategorySignal {
  id: string;
  category: Extract<CategoryPillar, "food" | "money">;
  shortLabel: string;
  compactLabel: string;
  accessibleLabel: string;
  visual: "food" | "usd";
  trendTone?: "positive" | "negative" | "neutral";
}

interface CrossCategorySignalRailProps {
  signals: readonly CrossCategorySignal[];
  onActivate: (category: CrossCategorySignal["category"]) => void;
}

const ROTATION_MS = 7_000;

export function CrossCategorySignalRail({
  signals,
  onActivate,
}: CrossCategorySignalRailProps) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    setIndex((current) => (signals.length === 0 ? 0 : current % signals.length));
  }, [signals.length]);

  useEffect(() => {
    if (paused || signals.length < 2) return;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % signals.length);
    }, ROTATION_MS);
    return () => window.clearInterval(timer);
  }, [paused, signals.length]);

  const signal = signals[index];
  if (!signal) return <span className="min-w-0 flex-1" aria-hidden />;

  const trendColorClass =
    signal.trendTone === "positive"
      ? "text-status-confirmed-fg font-bold"
      : signal.trendTone === "negative"
        ? "text-status-caution-fg font-bold"
        : "text-text-primary font-semibold";

  return (
    <button
      type="button"
      className="group grid h-9 min-w-0 flex-1 place-items-center px-0.5 text-left active:scale-[0.96] transition-transform duration-150"
      aria-label={signal.accessibleLabel}
      onClick={() => onActivate(signal.category)}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <span className="relative flex h-[30px] w-full min-w-0 max-w-[210px] items-center justify-between overflow-hidden rounded-[12px] bg-fillSecondary px-2 shadow-sm transition-all hover:bg-fillTertiary">
        <span
          key={signal.id}
          className="cross-category-signal-enter flex min-w-0 items-center gap-1.5"
        >
          {/* Live pulse indicator */}
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-status-confirmed-fg animate-pulse" aria-hidden />

          {signal.visual === "usd" ? (
            <CurrencyFlag code="USD" className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <Utensils
              className="h-3.5 w-3.5 shrink-0 text-domain-food"
              strokeWidth={2.4}
              aria-hidden
            />
          )}
          <span className={`hidden min-w-0 truncate text-caption-1 tracking-tight min-[370px]:block ${trendColorClass}`}>
            {signal.shortLabel}
          </span>
          <span className={`min-w-0 truncate text-caption-1 tracking-tight min-[370px]:hidden ${trendColorClass}`}>
            {signal.compactLabel}
          </span>
        </span>

        <ChevronRight className="h-3 w-3 shrink-0 text-text-tertiary transition-transform group-hover:translate-x-0.5" aria-hidden />
      </span>
    </button>
  );
}
