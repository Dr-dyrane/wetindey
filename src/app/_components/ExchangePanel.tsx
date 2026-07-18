"use client";

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Building2, CircleDollarSign, MapPin, RefreshCw } from "lucide-react";
import { Skeleton } from "@/design-system/components/Skeleton";
import { transition } from "@/design-system/motion";
import {
  getReferenceCurrencyCatalog,
  getReferenceRate,
  type ReferenceCurrencyCatalogEntry,
  type ReferenceRate,
} from "@/app/currency-actions";
import {
  REFERENCE_CURRENCY_META,
  isReferenceCurrencyCode,
  type ReferenceCurrencyCode,
} from "@/app/_data/reference-currencies";
import { CurrencyFlag } from "@/app/_components/CurrencyFlag";
import { CurrencyPickerSheet } from "@/app/_components/CurrencyPickerSheet";
import type {
  ExchangeLocationKind,
  ExchangeSampleLocation,
} from "@/app/_data/exchange-sample-locations";
import { formatDistance, getHaversineDistance } from "@/lib/geospatial";

export type ExchangeLocationFilter = "all" | ExchangeLocationKind;

interface ExchangePanelProps {
  origin: { lat: number; lng: number };
  locations: readonly ExchangeSampleLocation[];
  filter: ExchangeLocationFilter;
  onFilterChange: (filter: ExchangeLocationFilter) => void;
  selectedLocationId: string | null;
  onSelectLocation: (location: ExchangeSampleLocation) => void;
}

interface CachedRate extends ReferenceRate {
  savedAt: number;
}

type CatalogState =
  | { kind: "loading" }
  | { kind: "ready"; entries: ReferenceCurrencyCatalogEntry[] }
  | { kind: "empty" }
  | { kind: "error" };

type RateState =
  | { kind: "idle" }
  | { kind: "loading"; cached: CachedRate | null }
  | { kind: "ready"; rate: ReferenceRate; saved: boolean; refreshFailed: boolean }
  | { kind: "unavailable" }
  | { kind: "error" };

const CACHE_PREFIX = "wetindey:reference-rate:v2:";
const LAST_CURRENCY_KEY = "wetindey:reference-rate:last-currency:v1";
const MAX_AMOUNT = 1_000_000_000;

const NAIRA = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

const RATE = new Intl.NumberFormat("en-NG", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

const EFFECTIVE_DATE = new Intl.DateTimeFormat("en-NG", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function isIsoCalendarDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function isCachedRate(value: unknown, currency: ReferenceCurrencyCode): value is CachedRate {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<CachedRate>;
  return (
    candidate.base === currency &&
    candidate.quote === "NGN" &&
    (candidate.provider === "CBN" || candidate.provider === "FRANKFURTER") &&
    typeof candidate.rate === "number" &&
    Number.isFinite(candidate.rate) &&
    candidate.rate > 0 &&
    isIsoCalendarDate(candidate.effectiveDate) &&
    typeof candidate.savedAt === "number" &&
    Number.isFinite(candidate.savedAt)
  );
}

function readCachedRate(currency: ReferenceCurrencyCode): CachedRate | null {
  try {
    const raw = window.localStorage.getItem(`${CACHE_PREFIX}${currency}`);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isCachedRate(parsed, currency) ? parsed : null;
  } catch {
    return null;
  }
}

function readLastCachedRate(): CachedRate | null {
  try {
    const currency = window.localStorage.getItem(LAST_CURRENCY_KEY);
    return currency && isReferenceCurrencyCode(currency) ? readCachedRate(currency) : null;
  } catch {
    return null;
  }
}

function saveCachedRate(rate: ReferenceRate) {
  try {
    const cached: CachedRate = { ...rate, savedAt: Date.now() };
    window.localStorage.setItem(`${CACHE_PREFIX}${rate.base}`, JSON.stringify(cached));
    window.localStorage.setItem(LAST_CURRENCY_KEY, rate.base);
  } catch {
    // The validated rate still works for this session when storage is unavailable.
  }
}

function formatEffectiveDate(date: string): string {
  if (!isIsoCalendarDate(date)) return "date unavailable";
  return EFFECTIVE_DATE.format(new Date(`${date}T12:00:00Z`));
}

function providerLabel(rate: ReferenceRate): string {
  return rate.provider === "CBN" ? "CBN reference" : "Frankfurter reference";
}

function parseAmount(value: string): { value: number | null; error: string | null } {
  const normalized = value.replaceAll(",", "").trim();
  if (normalized === "") return { value: null, error: null };
  if (!/^(?:\d+|\d*\.\d+)$/.test(normalized)) {
    return { value: null, error: "Enter numbers only." };
  }
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { value: null, error: "Enter an amount greater than zero." };
  }
  if (amount > MAX_AMOUNT) {
    return { value: null, error: "Enter a smaller amount." };
  }
  return { value: amount, error: null };
}

export function ExchangePanel({
  origin,
  locations,
  filter,
  onFilterChange,
  selectedLocationId,
  onSelectLocation,
}: ExchangePanelProps) {
  const amountId = useId();
  const amountErrorId = useId();
  const currencyRef = useRef<ReferenceCurrencyCode | null>(null);
  const [currency, setCurrency] = useState<ReferenceCurrencyCode | null>(null);
  const [amount, setAmount] = useState("");
  const [catalogRetry, setCatalogRetry] = useState(0);
  const [rateRetry, setRateRetry] = useState(0);
  const [offline, setOffline] = useState(false);
  const [catalogState, setCatalogState] = useState<CatalogState>({ kind: "loading" });
  const [rateState, setRateState] = useState<RateState>({ kind: "idle" });
  const enterCurrency = useCallback((nextCurrency: ReferenceCurrencyCode) => {
    currencyRef.current = nextCurrency;
    setCurrency(nextCurrency);
    setRateState({ kind: "loading", cached: readCachedRate(nextCurrency) });
  }, []);

  useEffect(() => {
    let cancelled = false;
    const saved = readLastCachedRate();
    setCatalogState({ kind: "loading" });
    if (saved) {
      currencyRef.current = saved.base;
      setCurrency(saved.base);
      setRateState({ kind: "ready", rate: saved, saved: true, refreshFailed: false });
    } else {
      setRateState({ kind: "idle" });
    }

    void getReferenceCurrencyCatalog()
      .then((entries) => {
        if (cancelled) return;
        if (entries.length === 0) {
          setCatalogState({ kind: "empty" });
          currencyRef.current = null;
          setCurrency(null);
          setRateState({ kind: "idle" });
          return;
        }

        setCatalogState({ kind: "ready", entries });
        const current = currencyRef.current;
        const nextCurrency =
          current && entries.some((entry) => entry.code === current)
            ? current
            : entries.find((entry) => entry.code === "USD")?.code ?? entries[0]!.code;
        enterCurrency(nextCurrency);
      })
      .catch(() => {
        if (cancelled) return;
        setCatalogState({ kind: "error" });
        if (saved) {
          currencyRef.current = saved.base;
          setCurrency(saved.base);
          setRateState({ kind: "ready", rate: saved, saved: true, refreshFailed: true });
        } else {
          currencyRef.current = null;
          setCurrency(null);
          setRateState({ kind: "idle" });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [catalogRetry, enterCurrency]);

  useEffect(() => {
    if (!currency || catalogState.kind !== "ready") return;
    let cancelled = false;
    const cached = readCachedRate(currency);
    setRateState({ kind: "loading", cached });

    void getReferenceRate(currency)
      .then((rate) => {
        if (cancelled) return;
        if (!rate) {
          setRateState({ kind: "unavailable" });
          return;
        }
        saveCachedRate(rate);
        setRateState({ kind: "ready", rate, saved: false, refreshFailed: false });
      })
      .catch(() => {
        if (cancelled) return;
        if (cached) {
          setRateState({ kind: "ready", rate: cached, saved: true, refreshFailed: true });
          return;
        }
        setRateState({ kind: "error" });
      });

    return () => {
      cancelled = true;
    };
  }, [catalogState.kind, currency, rateRetry]);

  useEffect(() => {
    const syncOnlineState = () => setOffline(!window.navigator.onLine);
    const retryWhenOnline = () => {
      setOffline(false);
      setCatalogRetry((value) => value + 1);
      setRateRetry((value) => value + 1);
    };
    syncOnlineState();
    window.addEventListener("offline", syncOnlineState);
    window.addEventListener("online", retryWhenOnline);
    return () => {
      window.removeEventListener("offline", syncOnlineState);
      window.removeEventListener("online", retryWhenOnline);
    };
  }, []);

  const parsedAmount = useMemo(() => parseAmount(amount), [amount]);
  const candidateVisibleRate =
    rateState.kind === "ready"
      ? rateState.rate
      : rateState.kind === "loading"
        ? rateState.cached
        : null;
  const visibleRate =
    candidateVisibleRate && candidateVisibleRate.base === currency ? candidateVisibleRate : null;
  const usingSavedRate =
    (rateState.kind === "loading" && rateState.cached !== null) ||
    (rateState.kind === "ready" && rateState.saved) ||
    (offline && visibleRate !== null);
  const converted =
    visibleRate && parsedAmount.value !== null ? visibleRate.rate * parsedAmount.value : null;
  const availableCurrencies =
    catalogState.kind === "ready" ? catalogState.entries.map((entry) => entry.code) : [];
  const selectedMeta = currency ? REFERENCE_CURRENCY_META[currency] : null;
  const selectedLocation = locations.find((location) => location.id === selectedLocationId) ?? null;
  const retryCatalog = () => setCatalogRetry((value) => value + 1);
  const retryRate = () => setRateRetry((value) => value + 1);

  return (
    <div className="space-y-4 px-3 pb-[calc(max(var(--sheet-hidden,0px),var(--safe-area-bottom))+20px)]">
      <section className="space-y-2.5" aria-labelledby="exchange-reference-heading">
        <div className="px-1">
          <h2
            id="exchange-reference-heading"
            className="text-title-2 font-semibold text-text-primary"
          >
            How much in Naira?
          </h2>
        </div>

        <div className="squircle-card space-y-3 bg-surface-card p-3">
          <div>
            <label
              htmlFor={amountId}
              className="mb-1.5 block text-footnote font-semibold text-text-secondary"
            >
              Foreign amount
            </label>
            <div
              className={`squircle flex min-h-[64px] items-center gap-2 bg-controlFill px-3 ${transition.focus} focus-within:bg-surface-card focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focusRing`}
            >
              <input
                id={amountId}
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                inputMode="decimal"
                autoComplete="off"
                placeholder="100"
                aria-invalid={parsedAmount.error ? true : undefined}
                aria-describedby={
                  parsedAmount.error
                    ? `${amountErrorId} exchange-reference-note`
                    : "exchange-reference-note"
                }
                data-autofocus
                className="min-w-0 flex-1 bg-transparent text-title-1 font-semibold tabular-nums text-text-primary placeholder:text-text-tertiary"
              />
              {catalogState.kind === "loading" && !currency ? (
                <Skeleton className="h-11 w-24 rounded-[14px]" />
              ) : (
                <CurrencyPickerSheet
                  available={availableCurrencies}
                  value={currency}
                  onSelect={enterCurrency}
                  disabled={catalogState.kind !== "ready"}
                />
              )}
            </div>
            {parsedAmount.error && (
              <p
                id={amountErrorId}
                role="alert"
                className="mt-1.5 px-1 text-footnote text-status-danger-fg"
              >
                {parsedAmount.error}
              </p>
            )}
          </div>

          <div
            className="squircle min-h-[132px] bg-fillTertiary p-3"
            aria-live="polite"
            aria-atomic="true"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-footnote font-semibold text-text-secondary">Naira estimate</p>
              <span className="flex items-center gap-1.5 text-footnote font-semibold text-text-secondary">
                <CurrencyFlag code="NGN" />
                NGN
              </span>
            </div>

            {catalogState.kind === "loading" && !visibleRate ? (
              <div aria-label="Loading available reference currencies" className="mt-3 space-y-3">
                <Skeleton className="h-9 w-3/4" />
                <Skeleton className="h-3 w-44" />
              </div>
            ) : catalogState.kind === "empty" ? (
              <div className="mt-3 space-y-3">
                <div>
                  <p role="status" className="text-body font-semibold text-text-primary">
                    No reference currencies available
                  </p>
                  <p className="mt-1 text-footnote text-text-secondary">
                    The current catalog returned no supported Naira pairs.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={retryCatalog}
                  className={`squircle min-h-tap bg-controlFill px-3 text-footnote font-semibold text-text-primary ${transition.press}`}
                >
                  <RefreshCw className="mr-1.5 inline h-4 w-4" aria-hidden="true" />
                  Try again
                </button>
              </div>
            ) : catalogState.kind === "error" && !visibleRate ? (
              <div className="mt-3 space-y-3">
                <div>
                  <p role="alert" className="text-body font-semibold text-text-primary">
                    Couldn’t load reference currencies
                  </p>
                  <p className="mt-1 text-footnote text-text-secondary">
                    {offline ? "You’re offline. Reconnect and try again." : "Try again shortly."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={retryCatalog}
                  className={`squircle min-h-tap bg-controlFill px-3 text-footnote font-semibold text-text-primary ${transition.press}`}
                >
                  <RefreshCw className="mr-1.5 inline h-4 w-4" aria-hidden="true" />
                  Try again
                </button>
              </div>
            ) : rateState.kind === "loading" && !rateState.cached ? (
              <div aria-label="Loading the reference rate" className="mt-3 space-y-3">
                <Skeleton className="h-9 w-3/4" />
                <Skeleton className="h-3 w-44" />
              </div>
            ) : rateState.kind === "unavailable" ? (
              <div className="mt-3">
                <p role="status" className="text-body font-semibold text-text-primary">
                  Pair unavailable
                </p>
                <p className="mt-1 text-footnote text-text-secondary">
                  Choose another available currency.
                </p>
              </div>
            ) : rateState.kind === "error" ? (
              <div className="mt-3 space-y-3">
                <div>
                  <p role="alert" className="text-body font-semibold text-text-primary">
                    Couldn’t load this reference rate
                  </p>
                  <p className="mt-1 text-footnote text-text-secondary">
                    {offline ? "You’re offline. Reconnect and try again." : "Try again shortly."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={retryRate}
                  className={`squircle min-h-tap bg-controlFill px-3 text-footnote font-semibold text-text-primary ${transition.press}`}
                >
                  <RefreshCw className="mr-1.5 inline h-4 w-4" aria-hidden="true" />
                  Try again
                </button>
              </div>
            ) : visibleRate && selectedMeta ? (
              <div className="mt-1">
                <div className="flex items-start justify-between gap-3">
                  <p className="break-words text-title-1 font-semibold tabular-nums text-text-primary">
                    {converted === null ? "Enter an amount" : NAIRA.format(converted)}
                  </p>
                  {usingSavedRate && (
                    <span className="shrink-0 text-caption-1 font-semibold text-status-caution-fg">
                      {offline ? "Offline · Saved" : "Saved rate"}
                    </span>
                  )}
                </div>
                <p className="mt-2 text-caption-1 leading-snug tabular-nums text-text-secondary">
                  {providerLabel(visibleRate)} · {selectedMeta.symbol}1 = ₦
                  {RATE.format(visibleRate.rate)} · Effective{" "}
                  {formatEffectiveDate(visibleRate.effectiveDate)}
                </p>
                {(rateState.kind === "loading" ||
                  (rateState.kind === "ready" && rateState.refreshFailed) ||
                  offline ||
                  catalogState.kind === "loading" ||
                  catalogState.kind === "error") && (
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <p role="status" className="text-caption-1 text-status-caution-fg">
                      {offline
                        ? "Using the saved reference while offline."
                        : catalogState.kind === "error"
                          ? "Using the saved reference; the currency list is unavailable."
                          : catalogState.kind === "loading"
                            ? "Using the saved reference while currencies refresh."
                          : "Using the saved reference while the latest rate refreshes."}
                    </p>
                    {!offline && catalogState.kind !== "loading" && (
                      <button
                        type="button"
                        onClick={catalogState.kind === "error" ? retryCatalog : retryRate}
                        className={`min-h-tap shrink-0 px-2 text-footnote font-semibold text-status-caution-fg ${transition.press}`}
                      >
                        Refresh
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : null}
          </div>

          <p id="exchange-reference-note" className="text-caption-1 leading-snug text-text-tertiary">
            WetinDey does not exchange money. This is a reference estimate; banks and
            currency exchangers may offer different rates.
          </p>
        </div>
      </section>

      <section className="space-y-2.5" aria-labelledby="sample-nearby-heading">
        <div className="px-1">
          <div className="flex items-center justify-between gap-3">
            <h2
              id="sample-nearby-heading"
              className="text-title-3 font-semibold text-text-primary"
            >
              Nearby locations
            </h2>
            <span className="shrink-0 text-caption-1 font-semibold text-text-tertiary">
              Sample
            </span>
          </div>
          <p className="mt-0.5 text-caption-1 leading-snug text-text-tertiary">
            Map pins and places are demonstration data, not verified businesses or live rates.
          </p>
        </div>

        <div
          className="squircle grid grid-cols-3 gap-1 bg-fillTertiary p-1"
          aria-label="Filter Sample locations"
        >
          {(
            [
              ["all", "All"],
              ["bank", "Banks"],
              ["bdc", "BDCs"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              onClick={() => onFilterChange(value)}
              className={`squircle min-h-tap px-2 text-footnote font-semibold transition-colors duration-instant active:opacity-60 ${
                filter === value
                  ? "bg-surface-card text-text-primary shadow-card"
                  : "text-text-secondary"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {selectedLocation && (
          <div
            role="status"
            className="squircle flex min-h-tap items-center gap-2.5 bg-fillTertiary px-3 py-2"
          >
            <MapPin className="h-4 w-4 shrink-0 text-text-secondary" aria-hidden="true" />
            <p className="truncate text-footnote font-semibold text-text-secondary">
              {selectedLocation.name} selected
            </p>
          </div>
        )}

        <div className="space-y-2">
          {locations.map((location) => {
            const selected = location.id === selectedLocationId;
            const distance = formatDistance(
              getHaversineDistance(origin.lat, origin.lng, location.lat, location.lng)
            );
            return (
              <button
                key={location.id}
                type="button"
                aria-pressed={selected}
                onClick={() => onSelectLocation(location)}
                className={`squircle-card grid min-h-[64px] w-full grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-3 p-3 text-left transition-colors duration-instant active:opacity-60 ${
                  selected ? "bg-fillSecondary" : "bg-surface-card"
                }`}
              >
                <span className="squircle grid h-9 w-9 shrink-0 place-items-center bg-fillTertiary text-text-secondary">
                  {location.kind === "bank" ? (
                    <Building2 className="h-5 w-5" aria-hidden="true" />
                  ) : (
                    <CircleDollarSign className="h-5 w-5" aria-hidden="true" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body font-semibold text-text-primary">
                    {location.name}
                  </span>
                  <span className="mt-0.5 block truncate text-footnote text-text-secondary">
                    {location.description}
                  </span>
                </span>
                <span className="shrink-0 whitespace-nowrap text-caption-1 tabular-nums text-text-tertiary">
                  {distance}
                </span>
              </button>
            );
          })}
        </div>

        {locations.length === 0 && (
          <div className="squircle-card bg-fillTertiary px-4 py-6 text-center">
            <p className="text-body font-semibold text-text-primary">No places in this filter</p>
            <p className="mt-1 text-footnote text-text-secondary">Choose another place type.</p>
          </div>
        )}
      </section>
    </div>
  );
}
