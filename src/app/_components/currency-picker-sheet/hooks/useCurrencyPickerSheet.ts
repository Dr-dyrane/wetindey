import {
  useMemo,
  useRef,
  useState,
  useModalSheetNavigation,
  SUPPORTED_REFERENCE_CURRENCY_META,
  isSupportedReferenceCurrencyCode,
  type SupportedReferenceCurrencyCode,
  type ReferenceCurrencyCatalogEntry,
} from "../imports/imports";
import { RECENTS_KEY, MAX_RECENTS } from "../copy/copy";

export function readRecents(
  available: ReadonlySet<SupportedReferenceCurrencyCode>
): SupportedReferenceCurrencyCode[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(RECENTS_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (value): value is SupportedReferenceCurrencyCode =>
          typeof value === "string" &&
          isSupportedReferenceCurrencyCode(value) &&
          available.has(value)
      )
      .filter((value, index, values) => values.indexOf(value) === index)
      .slice(0, MAX_RECENTS);
  } catch {
    return [];
  }
}

export function rememberCurrency(
  currency: SupportedReferenceCurrencyCode,
  previous: readonly SupportedReferenceCurrencyCode[]
): SupportedReferenceCurrencyCode[] {
  const next = [currency, ...previous.filter((value) => value !== currency)].slice(0, MAX_RECENTS);
  try {
    window.localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  } catch {
    // Selection still succeeds when device-local storage is unavailable.
  }
  return next;
}

export function searchScore(code: SupportedReferenceCurrencyCode, query: string): number {
  const meta = SUPPORTED_REFERENCE_CURRENCY_META[code];
  if (code.toLowerCase() === query) return 0;
  if (code.toLowerCase().startsWith(query)) return 1;
  if (meta.name.toLowerCase().startsWith(query)) return 2;
  return 3;
}

export function getMeta(code: string | null) {
  if (!code) return null;
  return isSupportedReferenceCurrencyCode(code) ? SUPPORTED_REFERENCE_CURRENCY_META[code] : null;
}

export interface UseCurrencyPickerSheetOptions {
  available: readonly SupportedReferenceCurrencyCode[];
  value: SupportedReferenceCurrencyCode | null;
  onSelect: (currency: SupportedReferenceCurrencyCode) => void;
  previews?: readonly ReferenceCurrencyCatalogEntry[];
  disabled?: boolean;
}

export function useCurrencyPickerSheet({
  available,
  value,
  onSelect,
}: UseCurrencyPickerSheetOptions) {
  const navigation = useModalSheetNavigation();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [fallbackOpen, setFallbackOpen] = useState(false);
  const [childId, setChildId] = useState<string | null>(null);
  const selectedMeta = getMeta(value);
  const isOpen = navigation ? navigation.childOpen && navigation.childId === childId : fallbackOpen;

  const availableSet = useMemo(() => new Set(available), [available]);
  const [query, setQuery] = useState("");
  const [recents, setRecents] = useState<SupportedReferenceCurrencyCode[]>(() =>
    readRecents(availableSet)
  );

  const commitSelect = (currency: SupportedReferenceCurrencyCode) => {
    setRecents(rememberCurrency(currency, recents));
    onSelect(currency);
    if (navigation) {
      setChildId(null);
      navigation.popChild();
    } else {
      setFallbackOpen(false);
    }
  };

  return {
    navigation,
    triggerRef,
    fallbackOpen,
    setFallbackOpen,
    childId,
    setChildId,
    selectedMeta,
    isOpen,
    availableSet,
    query,
    setQuery,
    recents,
    commitSelect,
  };
}
