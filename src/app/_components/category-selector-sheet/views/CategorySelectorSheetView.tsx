import {
  React,
  Bus,
  Check,
  CircleDollarSign,
  Fuel,
  HeartPulse,
  House,
  Sprout,
  Utensils,
  Users,
  type LucideIcon,
  ModalSheet,
  IconOrb,
} from "../imports/imports";
import type { CategorySelectorSheetProps, SelectorCategory } from "../CategorySelectorSheet";
import type { useCategorySelectorSheet } from "../hooks/useCategorySelectorSheet";
import { PILLAR_FLAGS } from "@/config/pillars";
import "../styles/CategorySelectorSheet.css";

export interface CategorySelectorSheetViewProps extends CategorySelectorSheetProps {
  sheet: ReturnType<typeof useCategorySelectorSheet>;
}

export function CategorySelectorSheetView(p: CategorySelectorSheetViewProps) {
  const { handleSelect } = p.sheet;

  const allCategories: {
    id: SelectorCategory;
    label: string;
    icon: LucideIcon;
    supported: boolean;
    tone: "neutral" | "domain-food" | "domain-money";
  }[] = [
    {
      id: "food",
      label: p.t.category_food,
      icon: Utensils,
      supported: true,
      tone: "domain-food",
    },
    { id: "fuel", label: "Fuel prices", icon: Fuel, supported: false, tone: "neutral" },
    {
      id: "home",
      label: p.t.category_home,
      icon: House,
      supported: false,
      tone: "neutral",
    },
    {
      id: "health",
      label: p.t.category_health,
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
      label: p.t.category_transport,
      icon: Bus,
      supported: false,
      tone: "neutral",
    },
    {
      id: "community",
      label: p.t.category_community,
      icon: Users,
      supported: false,
      tone: "neutral",
    },
    {
      id: "agri",
      label: p.t.category_agri,
      icon: Sprout,
      supported: false,
      tone: "neutral",
    },
  ];

  // PILLAR_FLAGS.agri (default-off, from @/config/pillars) is the sole runtime
  // gate: while the flag is false the agri entry is dropped before render and
  // never reaches the DOM. Flipping it on happens only at the credential-gated
  // activation, never as a code default.
  const categories = allCategories.filter(
    (category) => category.id !== "agri" || PILLAR_FLAGS.agri,
  );

  return (
    <ModalSheet open={p.open} onClose={p.onClose} title={p.t.select_category} size="form">
      <div className="py-2">
        <div
          className="squircle-card bg-fillTertiary p-1"
          role="group"
          aria-label={p.t.select_category}
        >
          {categories.map((category) => {
            const active = category.id === p.activeCategory;
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
                className={`category-selector-row squircle grid h-12 w-full items-center gap-3 px-2.5 text-left
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
