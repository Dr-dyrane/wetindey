"use client";

import React from "react";
import { ModalSheet } from "@/design-system/components/ModalSheet";
import { ListGroup, ListRow } from "@/design-system/components/ListRow";
import { haptics } from "@/lib/haptics";

export type CategoryPillar = "food" | "home" | "health" | "money" | "transport" | "community";

interface CategorySelectorSheetProps {
  open: boolean;
  onClose: () => void;
  activeCategory: CategoryPillar;
  onCategoryChange: (category: CategoryPillar) => void;
  t: Record<string, string>;
}

export function CategorySelectorSheet({
  open,
  onClose,
  activeCategory,
  onCategoryChange,
  t,
}: CategorySelectorSheetProps) {
  const categories: { id: CategoryPillar; emoji: string; label: string; detail: string }[] = [
    { id: "food", emoji: "🛒", label: t.category_food || "Food", detail: t.category_food_desc || "Prices, availability, markets" },
    { id: "home", emoji: "🏠", label: t.category_home || "Home & Living", detail: t.category_home_desc || "Building materials, charcoal" },
    { id: "health", emoji: "💊", label: t.category_health || "Health & Beauty", detail: t.category_health_desc || "Medicine, pharmacy, beauty" },
    { id: "money", emoji: "💱", label: t.category_money || "Money & Exchange", detail: t.category_money_desc || "Parallel USD/GBP rates" },
    { id: "transport", emoji: "🚗", label: t.category_transport || "Transport", detail: t.category_transport_desc || "Bus fares, ride prices, ferry" },
    { id: "community", emoji: "📍", label: t.category_community || "Community", detail: t.category_community_desc || "Outages, services, happenings" },
  ];

  const handleSelect = (category: CategoryPillar) => {
    if (category !== activeCategory) {
      haptics.selection();
      onCategoryChange(category);
    }
    onClose();
  };

  return (
    <ModalSheet open={open} onClose={onClose} title={t.select_category || "Select Category"} size="form">
      <div className="py-4">
        <ListGroup header={t.categories_header || "Pillars of Daily Uncertainty"}>
          {categories.map((c) => {
            const active = c.id === activeCategory;
            return (
              <ListRow
                key={c.id}
                icon={<span className="text-lg">{c.emoji}</span>}
                iconTint="bg-fillTertiary"
                label={c.label}
                detail={active ? "✓" : c.detail}
                chevron={false}
                onClick={() => handleSelect(c.id)}
              />
            );
          })}
        </ListGroup>
      </div>
    </ModalSheet>
  );
}
