"use client";

// Compatibility path for existing home-page imports. The live implementation
// moved as one slice so callers keep the same component and public types.
export { ItemDetailSheet } from "./item-detail-sheet/ItemDetailSheet";
export type {
  ItemDetailSheetItem,
  ItemDetailSheetProps,
  OfferPresentation,
  PresentedOffer,
} from "./item-detail-sheet/hooks/useItemDetailSheet";
