"use client";

import React from "react";
import {
  Bus,
  Check,
  CircleDollarSign,
  Fuel,
  HeartPulse,
  House,
  Utensils,
  Users,
  type LucideIcon,
} from "lucide-react";
import { ModalSheet } from "@/design-system/components/ModalSheet";
import { haptics } from "@/lib/haptics";

export type CategoryPillar = "food" | "home" | "health" | "money" | "transport" | "community";
type SelectorCategory = CategoryPillar | "fuel";

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
  const categories: {
    id: SelectorCategory;
    label: string;
    icon: LucideIcon;
    supported: boolean;
  }[] = [
    { id: "food", label: t.category_food || "Food", icon: Utensils, supported: true },
    { id: "fuel", label: "Fuel prices", icon: Fuel, supported: false },
    { id: "home", label: t.category_home || "Home & Living", icon: House, supported: false },
    {
      id: "health",
      label: t.category_health || "Health & Beauty",
      icon: HeartPulse,
      supported: false,
    },
    { id: "money", label: "Aboki FX", icon: CircleDollarSign, supported: true },
    { id: "transport", label: t.category_transport || "Transport", icon: Bus, supported: false },
    { id: "community", label: t.category_community || "Community", icon: Users, supported: false },
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
      <div className="py-2">
        <div
          className="squircle-card bg-fillTertiary p-1"
          role="group"
          aria-label={t.select_category || "Select Category"}
        >
          {categories.map((category) => {
            const active = category.id === activeCategory;
            const Icon = category.icon;

            return (
              <button
                key={category.id}
                type="button"
                aria-pressed={active}
                disabled={!category.supported}
                onClick={() => {
                  if (category.id === "food" || category.id === "money") {
                    handleSelect(category.id);
                  }
                }}
                className={`squircle grid h-12 w-full grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 px-2.5 text-left
                            transition-colors duration-instant focus-visible:outline-none focus-visible:ring-2
                            focus-visible:ring-accent focus-visible:ring-inset disabled:cursor-not-allowed disabled:opacity-100 ${
                              active
                                ? "bg-surface-card text-text-primary shadow-card"
                                : category.supported
                                  ? "text-text-primary active:bg-fillSecondary"
                                  : "text-text-tertiary"
                            }`}
              >
                <span
                  className={`grid h-8 w-8 place-items-center rounded-[14px] bg-fillSecondary ${
                    active ? "text-info" : "text-text-secondary"
                  }`}
                >
                  <Icon className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
                </span>
                <span className="truncate text-body font-semibold">{category.label}</span>
                {active ? (
                  <Check className="h-5 w-5 text-info" strokeWidth={2.5} aria-hidden />
                ) : !category.supported ? (
                  <span className="text-caption-1 font-medium text-text-tertiary">Soon</span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    </ModalSheet>
  );
}
