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
import { IconOrb, type IconOrbTone } from "@/design-system/components/IconOrb";
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
    tone: Extract<IconOrbTone, "neutral" | "domain-food" | "domain-money">;
  }[] = [
    {
      id: "food",
      label: t.category_food || "Food",
      icon: Utensils,
      supported: true,
      tone: "domain-food",
    },
    { id: "fuel", label: "Fuel prices", icon: Fuel, supported: false, tone: "neutral" },
    {
      id: "home",
      label: t.category_home || "Home & Living",
      icon: House,
      supported: false,
      tone: "neutral",
    },
    {
      id: "health",
      label: t.category_health || "Health & Beauty",
      icon: HeartPulse,
      supported: false,
      tone: "neutral",
    },
    {
      id: "money",
      label: "Aboki FX",
      icon: CircleDollarSign,
      supported: true,
      tone: "domain-money",
    },
    {
      id: "transport",
      label: t.category_transport || "Transport",
      icon: Bus,
      supported: false,
      tone: "neutral",
    },
    {
      id: "community",
      label: t.category_community || "Community",
      icon: Users,
      supported: false,
      tone: "neutral",
    },
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
                            transition-colors duration-instant focus-visible:outline-2
                            focus-visible:outline-offset-[-2px] focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-100 ${
                              active
                                ? "bg-surface-card text-text-primary shadow-card"
                                : category.supported
                                  ? "text-text-primary active:bg-fillSecondary"
                                  : "text-text-tertiary"
                            }`}
              >
                <IconOrb size={32} tone={category.supported ? category.tone : "neutral"}>
                  <Icon strokeWidth={2} />
                </IconOrb>
                <span className="truncate text-body font-semibold">{category.label}</span>
                {active ? (
                  <Check className="h-5 w-5 text-accent" strokeWidth={2.5} aria-hidden />
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
