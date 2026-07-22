"use client";

import React from "react";
import { useCrossCategorySignalRail } from "./hooks/useCrossCategorySignalRail";
import { CrossCategorySignalRailView } from "./views/CrossCategorySignalRailView";
import type { CategoryPillar } from "@/app/_components/category-selector-sheet/CategorySelectorSheet";

export interface CrossCategorySignal {
  id: string;
  category: Extract<CategoryPillar, "food" | "money">;
  code?: string;
  amount: string;
  trendText?: string | null;
  accessibleLabel: string;
  visual: "food" | "usd";
  trendTone?: "positive" | "negative" | "neutral";
}

export interface CrossCategorySignalRailProps {
  signals: readonly CrossCategorySignal[];
  onActivate: (category: CrossCategorySignal["category"]) => void;
}

const ROTATION_MS = 7_000;

export function CrossCategorySignalRail(props: CrossCategorySignalRailProps) {
  const sheet = useCrossCategorySignalRail({
    signals: props.signals,
    rotationMs: ROTATION_MS,
  });
  return <CrossCategorySignalRailView {...props} sheet={sheet} />;
}
