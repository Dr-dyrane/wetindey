"use client";

import { useCurrencyPickerSheet } from "./hooks/useCurrencyPickerSheet";
import { CurrencyPickerSheetView } from "./views/CurrencyPickerSheetView";
import type {
  SupportedReferenceCurrencyCode,
  ReferenceCurrencyCatalogEntry,
} from "./imports/imports";

export interface CurrencyPickerSheetProps {
  available: readonly SupportedReferenceCurrencyCode[];
  value: SupportedReferenceCurrencyCode | null;
  onSelect: (currency: SupportedReferenceCurrencyCode) => void;
  previews?: readonly ReferenceCurrencyCatalogEntry[];
  disabled?: boolean;
}

export function CurrencyPickerSheet({
  available,
  value,
  onSelect,
  previews = [],
  disabled,
}: CurrencyPickerSheetProps) {
  const sheet = useCurrencyPickerSheet({
    available,
    value,
    onSelect,
    previews,
    disabled,
  });

  return (
    <CurrencyPickerSheetView
      available={available}
      value={value}
      onSelect={onSelect}
      previews={previews}
      disabled={disabled}
      sheet={sheet}
    />
  );
}
