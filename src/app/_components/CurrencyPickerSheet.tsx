"use client";

import React, { useMemo, useRef, useState } from "react";
import { IconOrb } from "@/design-system/components/IconOrb";
import { ModalSheet, useModalSheetNavigation } from "@/design-system/components/ModalSheet";
import { SolidIcon } from "@/design-system/icons/SolidIcon";
import { transition } from "@/design-system/motion";
import {
  POPULAR_REFERENCE_CURRENCIES,
  REFERENCE_CURRENCY_META,
  isReferenceCurrencyCode,
  type ReferenceCurrencyCode,
} from "@/app/_data/reference-currencies";
import { CurrencyFlag } from "@/app/_components/CurrencyFlag";

const RECENTS_KEY = "wetindey:reference-currency-recents:v1";
const MAX_RECENTS = 3;

interface CurrencyPickerSheetProps {
  available: readonly ReferenceCurrencyCode[];
  value: ReferenceCurrencyCode | null;
  onSelect: (currency: ReferenceCurrencyCode) => void;
  disabled?: boolean;
}

function CurrencySearchField({
  value,
  onChange,
  onClear,
}: {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
}) {
  return (
    <div
      className={`squircle-full relative flex h-11 w-full items-center overflow-hidden bg-controlFill ${transition.focus} focus-within:bg-surface-card focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focusRing`}
    >
      <span className="pointer-events-none absolute left-3 text-text-tertiary">
        <SolidIcon name="search" size={16} />
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search currencies"
        aria-label="Search currencies"
        enterKeyHint="search"
        className="h-full w-full bg-transparent pl-9 pr-11 text-body text-text-primary placeholder:text-text-tertiary"
      />
      {value && (
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear currency search"
          className={`absolute right-0 grid h-11 w-11 place-items-center text-text-tertiary ${transition.press}`}
        >
          <IconOrb tone="neutral">
            <SolidIcon name="close" size={16} />
          </IconOrb>
        </button>
      )}
    </div>
  );
}

function readRecents(available: ReadonlySet<ReferenceCurrencyCode>): ReferenceCurrencyCode[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(RECENTS_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (value): value is ReferenceCurrencyCode =>
          typeof value === "string" && isReferenceCurrencyCode(value) && available.has(value)
      )
      .filter((value, index, values) => values.indexOf(value) === index)
      .slice(0, MAX_RECENTS);
  } catch {
    return [];
  }
}

function rememberCurrency(
  currency: ReferenceCurrencyCode,
  previous: readonly ReferenceCurrencyCode[]
): ReferenceCurrencyCode[] {
  const next = [currency, ...previous.filter((value) => value !== currency)].slice(0, MAX_RECENTS);
  try {
    window.localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  } catch {
    // Selection still succeeds when device-local storage is unavailable.
  }
  return next;
}

function searchScore(code: ReferenceCurrencyCode, query: string): number {
  const meta = REFERENCE_CURRENCY_META[code];
  if (code.toLowerCase() === query) return 0;
  if (code.toLowerCase().startsWith(query)) return 1;
  if (meta.name.toLowerCase().startsWith(query)) return 2;
  return 3;
}

const REFERENCE_RATE_PREVIEWS: Record<string, { rate: string; trend: string; isPositive: boolean }> = {
  USD: { rate: "₦1,485.50", trend: "+1.2%", isPositive: true },
  GBP: { rate: "₦1,892.10", trend: "+0.8%", isPositive: true },
  EUR: { rate: "₦1,615.40", trend: "-0.4%", isPositive: false },
  CAD: { rate: "₦1,090.25", trend: "+0.5%", isPositive: true },
  AUD: { rate: "₦978.80", trend: "-0.2%", isPositive: false },
  GHS: { rate: "₦95.50", trend: "+0.1%", isPositive: true },
  KES: { rate: "₦11.40", trend: "+0.3%", isPositive: true },
  ZAR: { rate: "₦82.60", trend: "-0.6%", isPositive: false },
  AED: { rate: "₦404.50", trend: "+0.2%", isPositive: true },
  CNY: { rate: "₦205.10", trend: "+0.4%", isPositive: true },
  INR: { rate: "₦17.75", trend: "+0.1%", isPositive: true },
  BRL: { rate: "₦268.30", trend: "-0.3%", isPositive: false },
  CHF: { rate: "₦1,720.00", trend: "+0.9%", isPositive: true },
  JPY: { rate: "₦9.45", trend: "-0.5%", isPositive: false },
  SAR: { rate: "₦396.10", trend: "+0.2%", isPositive: true },
  NGN: { rate: "₦1.00", trend: "Base", isPositive: true },
};

function CurrencyRow({
  code,
  selected,
  onSelect,
}: {
  code: string;
  selected: boolean;
  onSelect: (currency: ReferenceCurrencyCode) => void;
}) {
  const meta =
    code === "NGN"
      ? { code: "NGN", name: "Nigerian naira", symbol: "₦", flag: "ng", searchAliases: ["Nigeria", "naira"] }
      : isReferenceCurrencyCode(code)
        ? REFERENCE_CURRENCY_META[code]
        : null;

  if (!meta) return null;
  const preview = REFERENCE_RATE_PREVIEWS[code];

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => {
        onSelect(code as ReferenceCurrencyCode);
      }}
      className={`flex min-h-tap w-full items-center justify-between gap-3 px-4 py-2.5 text-left active:bg-fillTertiary ${transition.feedback}`}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <CurrencyFlag code={code} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-body font-medium text-text-primary">{meta.name}</span>
          <span className="mt-0.5 block text-footnote font-semibold text-text-secondary">{code}</span>
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0 text-right">
        {preview && (
          <div className="text-right">
            <span className="block text-footnote font-semibold text-text-primary tabular-nums">
              {preview.rate}
            </span>
            <span
              className={`inline-block squircle px-1.5 py-0.5 text-caption-2 font-bold tabular-nums ${
                preview.trend === "Base"
                  ? "bg-fillSecondary text-text-tertiary"
                  : preview.isPositive
                    ? "bg-status-confirmed-bg text-status-confirmed-fg"
                    : "bg-status-caution-bg text-status-caution-fg"
              }`}
            >
              {preview.trend === "Base" ? "Base" : `${preview.isPositive ? "▲ " : "▼ "}${preview.trend}`}
            </span>
          </div>
        )}
        {selected && (
          <IconOrb tone="neutral">
            <SolidIcon name="check" size={16} />
          </IconOrb>
        )}
      </div>
    </button>
  );
}

function CurrencyGroup({
  title,
  currencies,
  value,
  onSelect,
}: {
  title: string;
  currencies: readonly string[];
  value: ReferenceCurrencyCode | null;
  onSelect: (currency: ReferenceCurrencyCode) => void;
}) {
  if (currencies.length === 0) return null;
  return (
    <section aria-labelledby={`currency-group-${title.toLowerCase().replaceAll(" ", "-")}`}>
      <h3
        id={`currency-group-${title.toLowerCase().replaceAll(" ", "-")}`}
        className="px-1 pb-1 text-footnote font-semibold text-text-secondary"
      >
        {title}
      </h3>
      <div className="squircle-card overflow-hidden bg-surface-card">
        {currencies.map((code) => (
          <CurrencyRow
            key={code}
            code={code}
            selected={code === value}
            onSelect={onSelect}
          />
        ))}
      </div>
    </section>
  );
}

function CurrencyPickerContent({
  available,
  value,
  onSelect,
}: {
  available: readonly ReferenceCurrencyCode[];
  value: ReferenceCurrencyCode | null;
  onSelect: (currency: ReferenceCurrencyCode) => void;
}) {
  const availableSet = useMemo(() => new Set(available), [available]);
  const [query, setQuery] = useState("");
  const [recents, setRecents] = useState<ReferenceCurrencyCode[]>(() =>
    readRecents(availableSet)
  );
  const normalizedQuery = query.trim().toLowerCase();

  const recentCurrencies = recents.filter((code) => availableSet.has(code));
  const used = new Set<ReferenceCurrencyCode>(recentCurrencies);
  const popularCurrencies = POPULAR_REFERENCE_CURRENCIES.filter(
    (code) => availableSet.has(code) && !used.has(code)
  );
  popularCurrencies.forEach((code) => used.add(code));
  const allCurrencies = available.filter((code) => !used.has(code));

  const ngnMeta = { code: "NGN", name: "Nigerian naira", symbol: "₦", flag: "ng", searchAliases: ["Nigeria", "naira"] };
  const matchesNgn = normalizedQuery
    ? ["ngn", ngnMeta.name, ...ngnMeta.searchAliases].join(" ").toLowerCase().includes(normalizedQuery)
    : false;

  const searchResults = normalizedQuery
    ? [
        ...(matchesNgn ? (["NGN"] as const) : []),
        ...[...available]
          .filter((code) => {
            const meta = REFERENCE_CURRENCY_META[code];
            return [code, meta.name, ...meta.searchAliases]
              .join(" ")
              .toLowerCase()
              .includes(normalizedQuery);
          })
          .sort(
            (left, right) =>
              searchScore(left, normalizedQuery) - searchScore(right, normalizedQuery)
          ),
      ]
    : [];

  const commit = (currency: ReferenceCurrencyCode) => {
    setRecents(rememberCurrency(currency, recents));
    onSelect(currency);
  };

  return (
    <div className="space-y-4 px-4 py-2">
      <CurrencySearchField
        value={query}
        onChange={setQuery}
        onClear={() => setQuery("")}
      />

      {normalizedQuery ? (
        searchResults.length > 0 ? (
          <CurrencyGroup
            title="Search results"
            currencies={searchResults}
            value={value}
            onSelect={commit}
          />
        ) : (
          <p role="status" className="py-8 text-center text-body text-text-secondary">
            No currencies found
          </p>
        )
      ) : available.length > 0 ? (
        <>
          <CurrencyGroup
            title="Base currency"
            currencies={["NGN" as ReferenceCurrencyCode]}
            value={value}
            onSelect={commit}
          />
          <CurrencyGroup
            title="Recent"
            currencies={recentCurrencies}
            value={value}
            onSelect={commit}
          />
          <CurrencyGroup
            title="Popular"
            currencies={popularCurrencies}
            value={value}
            onSelect={commit}
          />
          <CurrencyGroup
            title="All currencies"
            currencies={allCurrencies}
            value={value}
            onSelect={commit}
          />
        </>
      ) : (
        <p role="status" className="py-8 text-center text-body text-text-secondary">
          No currencies available
        </p>
      )}
    </div>
  );
}

export function CurrencyPickerSheet({
  available,
  value,
  onSelect,
  disabled,
}: CurrencyPickerSheetProps) {
  const navigation = useModalSheetNavigation();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [fallbackOpen, setFallbackOpen] = useState(false);
  const [childId, setChildId] = useState<string | null>(null);
  const selectedMeta = value ? REFERENCE_CURRENCY_META[value] : null;
  const isOpen = navigation ? navigation.childOpen && navigation.childId === childId : fallbackOpen;

  const commit = (currency: ReferenceCurrencyCode) => {
    onSelect(currency);
    if (navigation) {
      setChildId(null);
      navigation.popChild();
    } else {
      setFallbackOpen(false);
    }
  };

  const openPicker = () => {
    if (!navigation) {
      setFallbackOpen(true);
      return;
    }

    const nextChildId = navigation.pushChild({
      title: "Choose currency",
      returnFocus: triggerRef.current,
      content: (
        <CurrencyPickerContent available={available} value={value} onSelect={commit} />
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
          selectedMeta ? `Choose currency, ${selectedMeta.name} selected` : "Choose currency"
        }
        className={`squircle flex h-11 shrink-0 items-center gap-2 bg-surface-card px-3 text-text-primary disabled:opacity-40 ${transition.press}`}
      >
        {value && <CurrencyFlag code={value} />}
        <span className="text-body font-semibold">{value ?? "—"}</span>
        <span className="text-text-tertiary">
          <SolidIcon name="chevron-down" size={16} />
        </span>
      </button>

      {!navigation && (
        <ModalSheet
          open={fallbackOpen}
          onClose={() => setFallbackOpen(false)}
          title="Choose currency"
          size="form"
        >
          <CurrencyPickerContent available={available} value={value} onSelect={commit} />
        </ModalSheet>
      )}
    </>
  );
}
