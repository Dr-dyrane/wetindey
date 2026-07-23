"use client";

import React from "react";
import { useCategorySelectorSheet } from "./hooks/useCategorySelectorSheet";
import { CategorySelectorSheetView } from "./views/CategorySelectorSheetView";

export type CategoryPillar = "food" | "home" | "health" | "money" | "transport" | "community" | "agri";
export type SelectorCategory = CategoryPillar | "fuel";

export interface CategorySelectorSheetProps {
  open: boolean;
  onClose: () => void;
  activeCategory: CategoryPillar;
  onCategoryChange: (category: CategoryPillar) => void;
  t: Record<string, string>;
}

export function CategorySelectorSheet(props: CategorySelectorSheetProps) {
  const sheet = useCategorySelectorSheet({
    activeCategory: props.activeCategory,
    onCategoryChange: props.onCategoryChange,
    onClose: props.onClose,
  });
  return <CategorySelectorSheetView {...props} sheet={sheet} />;
}
