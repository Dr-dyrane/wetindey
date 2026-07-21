import {
  React,
  ModalSheet,
  SolidIcon,
  CurrencyFlag,
  type SupportedReferenceCurrencyCode,
  type ReferenceCurrencyCatalogEntry,
} from "../imports/imports";
import { type useCurrencyPickerSheet } from "../hooks/useCurrencyPickerSheet";
import { copy } from "../copy/copy";
import "../styles/CurrencyPickerSheet.css";
import { CurrencyPickerSheetContent } from "./CurrencyPickerSheetContent";

export interface CurrencyPickerSheetViewProps {
  available: readonly SupportedReferenceCurrencyCode[];
  value: SupportedReferenceCurrencyCode | null;
  onSelect: (currency: SupportedReferenceCurrencyCode) => void;
  previews?: readonly ReferenceCurrencyCatalogEntry[];
  disabled?: boolean;
  sheet: ReturnType<typeof useCurrencyPickerSheet>;
}

export function CurrencyPickerSheetView({
  available,
  value,
  onSelect: _onSelect,
  previews = [],
  disabled,
  sheet,
}: CurrencyPickerSheetViewProps) {
  const {
    navigation,
    triggerRef,
    fallbackOpen,
    setFallbackOpen,
    setChildId,
    selectedMeta,
    isOpen,
    commitSelect,
  } = sheet;

  const openPicker = () => {
    if (!navigation) {
      setFallbackOpen(true);
      return;
    }

    const nextChildId = navigation.pushChild({
      title: copy.title,
      returnFocus: triggerRef.current,
      content: (
        <CurrencyPickerSheetContent
          available={available}
          value={value}
          onSelect={commitSelect}
          previews={previews}
          sheet={sheet}
        />
      ),
    });
    setChildId(nextChildId);
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled || !value}
        onClick={openPicker}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label={
          selectedMeta ? `Choose currency, ${selectedMeta.name} selected` : copy.title
        }
        className="flex h-[36px] shrink-0 items-center gap-1 rounded-[18px] bg-surface-card px-2 text-text-primary shadow-sm disabled:opacity-40 active:scale-[0.96] transition-all"
      >
        {value && <CurrencyFlag code={value} />}
        <span className="text-subhead font-bold tracking-tight">{selectedMeta?.code ?? value ?? "—"}</span>
        <span className="text-text-tertiary">
          <SolidIcon name="chevron-down" size={16} />
        </span>
      </button>

      {!navigation && (
        <ModalSheet
          open={fallbackOpen}
          onClose={() => setFallbackOpen(false)}
          title={copy.title}
          size="form"
        >
          <CurrencyPickerSheetContent
            available={available}
            value={value}
            onSelect={commitSelect}
            previews={previews}
            sheet={sheet}
          />
        </ModalSheet>
      )}
    </>
  );
}
