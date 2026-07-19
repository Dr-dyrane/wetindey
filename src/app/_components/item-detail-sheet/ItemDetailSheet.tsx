"use client";

import { useItemDetailSheet, type ItemDetailSheetProps } from "./hooks/useItemDetailSheet";
import { ItemDetailSheetView } from "./views/ItemDetailSheetView";

export type {
  ItemDetailSheetItem,
  ItemDetailSheetProps,
  OfferPresentation,
  PresentedOffer,
} from "./hooks/useItemDetailSheet";

/**
 * The controller deliberately has no presentation or request logic. Keeping
 * this live entry point thin makes the compatibility export safe while the
 * hook and view remain independently readable.
 */
export function ItemDetailSheet(props: ItemDetailSheetProps) {
  const sheet = useItemDetailSheet(props);
  return <ItemDetailSheetView {...props} sheet={sheet} />;
}
