import { haptics } from "../imports/imports";
import type { CategoryPillar } from "../CategorySelectorSheet";

export interface UseCategorySelectorSheetProps {
  activeCategory: CategoryPillar;
  onCategoryChange: (category: CategoryPillar) => void;
  onClose: () => void;
}

export function useCategorySelectorSheet({
  activeCategory,
  onCategoryChange,
  onClose,
}: UseCategorySelectorSheetProps) {
  const handleSelect = (category: CategoryPillar) => {
    if (category !== activeCategory) {
      haptics.selection();
      onCategoryChange(category);
    }
    onClose();
  };

  return {
    handleSelect,
  };
}
