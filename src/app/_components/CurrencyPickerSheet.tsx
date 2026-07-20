"use client";

import React, { useMemo, useRef, useState } from "react";
import { IconOrb } from "@/design-system/components/IconOrb";
import { ModalSheet, useModalSheetNavigation } from "@/design-system/components/ModalSheet";
import { SolidIcon } from "@/design-system/icons/SolidIcon";
import { transition } from "@/design-system/motion";
import {
  POPULAR_REFERENCE_CURRENCIES,
  SUPPORTED_REFERENCE_CURRENCY_META,
  isSupportedReferenceCurrencyCode,
  type SupportedReferenceCurrencyCode,
} from "@/app/_data/reference-currencies";
import { CurrencyFlag } from "@/app/_components/CurrencyFlag";
import type { ReferenceCurrencyCatalogEntry } from "@/app/_actions/currency-actions";

const RECENTS_KEY = "wetindey:reference-currency-recents:v1";
const MAX_RECENTS = 3;

interface CurrencyPickerSheetProps {
  available: readonly SupportedReferenceCurrencyCode[];
  value: SupportedReferenceCurrencyCode | null;
  onSelect: (currency: SupportedReferenceCurrencyCode) => void;
  previews?: readonly ReferenceCurrencyCatalogEntry[];
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

function readRecents(
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

function rememberCurrency(
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

function searchScore(code: SupportedReferenceCurrencyCode, query: string): number {
  const meta = SUPPORTED_REFERENCE_CURRENCY_META[code];
  if (code.toLowerCase() === query) return 0;
  if (code.toLowerCase().startsWith(query)) return 1;
  if (meta.name.toLowerCase().startsWith(query)) return 2;
  return 3;
}

function getMeta(code: string | null) {
  if (!code) return null;
  return isSupportedReferenceCurrencyCode(code) ? SUPPORTED_REFERENCE_CURRENCY_META[code] : null;
}

function CurrencyRow({
  code,
  selected,
  onSelect,
  preview,
}: {
  code: string;
  selected: boolean;
  onSelect: (currency: SupportedReferenceCurrencyCode) => void;
  preview?: ReferenceCurrencyCatalogEntry;
}) {
  const meta = getMeta(code);
  if (!meta) return null;

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => {
        onSelect(meta.code);
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
        {(preview || code === "NGN") && (
          <div className="text-right">
            <span className="block text-footnote font-semibold text-text-primary tabular-nums">
              ₦{(code === "NGN" ? 1 : preview!.rate).toLocaleString("en-NG", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
            <span
              className={`inline-block squircle px-1.5 py-0.5 text-caption-2 font-bold ${
                code === "NGN" || preview!.trendPercent === null
                  ? "bg-fillSecondary text-text-tertiary"
                  : preview!.trendPercent >= 0
                    ? "bg-status-confirmed-bg text-status-confirmed-fg"
                    : "bg-status-caution-bg text-status-caution-fg"
              }`}
            >
              {code === "NGN"
                ? "Base"
                : preview!.trendPercent === null
                  ? "No trend"
                  : `${preview!.trendPercent >= 0 ? "▲ +" : "▼ -"}${Math.abs(
                      preview!.trendPercent
                    ).toFixed(1)}%`}
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
  previews,
}: {
  title: string;
  currencies: readonly SupportedReferenceCurrencyCode[];
  value: SupportedReferenceCurrencyCode | null;
  onSelect: (currency: SupportedReferenceCurrencyCode) => void;
  previews: readonly ReferenceCurrencyCatalogEntry[];
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
            preview={previews.find((entry) => entry.code === code)}
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
  previews,
}: {
  available: readonly SupportedReferenceCurrencyCode[];
  value: SupportedReferenceCurrencyCode | null;
  onSelect: (currency: SupportedReferenceCurrencyCode) => void;
  previews: readonly ReferenceCurrencyCatalogEntry[];
}) {
  const availableSet = useMemo(() => new Set(available), [available]);
  const [query, setQuery] = useState("");
  const [recents, setRecents] = useState<SupportedReferenceCurrencyCode[]>(() =>
    readRecents(availableSet)
  );
  const normalizedQuery = query.trim().toLowerCase();

  const recentCurrencies = recents.filter(
    (code) => code !== "NGN" && availableSet.has(code)
  );
  const used = new Set<SupportedReferenceCurrencyCode>(recentCurrencies);
  const popularCurrencies = POPULAR_REFERENCE_CURRENCIES.filter(
    (code) => availableSet.has(code) && !used.has(code)
  );
  popularCurrencies.forEach((code) => used.add(code));
  const allCurrencies = available.filter((code) => !used.has(code));

  const ngnMeta = SUPPORTED_REFERENCE_CURRENCY_META.NGN;
  const matchesNgn = normalizedQuery
    ? ["ngn", ngnMeta.name, ...ngnMeta.searchAliases].join(" ").toLowerCase().includes(normalizedQuery)
    : false;

  const searchResults = normalizedQuery
    ? [
        ...(matchesNgn ? (["NGN"] as const) : []),
        ...[...available]
          .filter((code) => code !== "NGN")
          .filter((code) => {
            const meta = SUPPORTED_REFERENCE_CURRENCY_META[code];
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

  const commit = (currency: SupportedReferenceCurrencyCode) => {
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
            previews={previews}
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
            currencies={["NGN"]}
            value={value}
            onSelect={commit}
            previews={previews}
          />
          <CurrencyGroup
            title="Recent"
            currencies={recentCurrencies}
            value={value}
            onSelect={commit}
            previews={previews}
          />
          <CurrencyGroup
            title="Popular"
            currencies={popularCurrencies}
            value={value}
            onSelect={commit}
            previews={previews}
          />
          <CurrencyGroup
            title="All currencies"
            currencies={allCurrencies}
            value={value}
            onSelect={commit}
            previews={previews}
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
  previews = [],
  disabled,
}: CurrencyPickerSheetProps) {
  const navigation = useModalSheetNavigation();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [fallbackOpen, setFallbackOpen] = useState(false);
  const [childId, setChildId] = useState<string | null>(null);
  const selectedMeta = getMeta(value);
  const isOpen = navigation ? navigation.childOpen && navigation.childId === childId : fallbackOpen;

  const commit = (currency: SupportedReferenceCurrencyCode) => {
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
        <CurrencyPickerContent
          available={available}
          value={value}
          onSelect={commit}
          previews={previews}
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
          selectedMeta ? `Choose currency, ${selectedMeta.name} selected` : "Choose currency"
        }
        className={`flex h-[36px] shrink-0 items-center gap-1 rounded-[18px] bg-surface-card px-2 text-text-primary shadow-sm disabled:opacity-40 active:scale-[0.96] transition-all`}
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
          title="Choose currency"
          size="form"
        >
          <CurrencyPickerContent
            available={available}
            value={value}
            onSelect={commit}
            previews={previews}
          />
        </ModalSheet>
      )}
    </>
  );
}
