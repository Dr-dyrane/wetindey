"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Building2, CircleDollarSign, MapPin, RefreshCw } from "lucide-react";
import { Button } from "@/design-system/components/Button";
import { Input } from "@/design-system/components/Input";
import { SheetPicker } from "@/design-system/components/SheetPicker";
import { Skeleton } from "@/design-system/components/Skeleton";
import {
  getCbnReferenceRate,
  type CbnReferenceCurrency,
  type CbnReferenceRate,
} from "@/app/currency-actions";
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

interface CachedRate extends CbnReferenceRate {
  savedAt: number;
}

type RateState =
  | { kind: "loading"; cached: CachedRate | null }
  | { kind: "ready"; rate: CbnReferenceRate; saved: boolean; refreshFailed: boolean }
  | { kind: "error" };

const CACHE_PREFIX = "wetindey:cbn-rate:";
const MAX_AMOUNT = 1_000_000_000;
const CBN_REFERENCE_CURRENCIES: readonly CbnReferenceCurrency[] = ["USD", "GBP", "EUR"];

const CURRENCY_META: Record<CbnReferenceCurrency, { label: string; symbol: string }> = {
  USD: { label: "USD — US dollar", symbol: "$" },
  GBP: { label: "GBP — British pound", symbol: "£" },
  EUR: { label: "EUR — Euro", symbol: "€" },
};

const NAIRA = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

const RATE = new Intl.NumberFormat("en-NG", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

const PUBLISHED_DATE = new Intl.DateTimeFormat("en-NG", {
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

function isCachedRate(value: unknown, currency: CbnReferenceCurrency): value is CachedRate {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<CachedRate>;
  return (
    candidate.base === currency &&
    candidate.quote === "NGN" &&
    candidate.provider === "CBN" &&
    typeof candidate.rate === "number" &&
    Number.isFinite(candidate.rate) &&
    candidate.rate > 0 &&
    isIsoCalendarDate(candidate.publishedDate) &&
    typeof candidate.savedAt === "number" &&
    Number.isFinite(candidate.savedAt)
  );
}

function readCachedRate(currency: CbnReferenceCurrency): CachedRate | null {
  try {
    const raw = window.localStorage.getItem(`${CACHE_PREFIX}${currency}`);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isCachedRate(parsed, currency) ? parsed : null;
  } catch {
    return null;
  }
}

function saveCachedRate(rate: CbnReferenceRate) {
  try {
    const cached: CachedRate = { ...rate, savedAt: Date.now() };
    window.localStorage.setItem(`${CACHE_PREFIX}${rate.base}`, JSON.stringify(cached));
  } catch {
    // The rate still works for this session when storage is unavailable.
  }
}

function formatPublishedDate(date: string): string {
  if (!isIsoCalendarDate(date)) return "date unavailable";
  return PUBLISHED_DATE.format(new Date(`${date}T12:00:00Z`));
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
  const [currency, setCurrency] = useState<CbnReferenceCurrency>("USD");
  const [amount, setAmount] = useState("");
  const [retrySequence, setRetrySequence] = useState(0);
  const [rateState, setRateState] = useState<RateState>({
    kind: "loading",
    cached: null,
  });

  useEffect(() => {
    let cancelled = false;
    const cached = readCachedRate(currency);
    setRateState({ kind: "loading", cached });

    void getCbnReferenceRate(currency)
      .then((rate) => {
        if (cancelled) return;
        saveCachedRate(rate);
        setRateState({ kind: "ready", rate, saved: false, refreshFailed: false });
      })
      .catch(() => {
        if (cancelled) return;
        if (cached) {
          setRateState({
            kind: "ready",
            rate: cached,
            saved: true,
            refreshFailed: true,
          });
          return;
        }
        setRateState({ kind: "error" });
      });

    return () => {
      cancelled = true;
    };
  }, [currency, retrySequence]);

  useEffect(() => {
    const retryWhenOnline = () => setRetrySequence((value) => value + 1);
    window.addEventListener("online", retryWhenOnline);
    return () => window.removeEventListener("online", retryWhenOnline);
  }, []);

  const parsedAmount = useMemo(() => parseAmount(amount), [amount]);
  const visibleRate =
    rateState.kind === "ready"
      ? rateState.rate
      : rateState.kind === "loading"
        ? rateState.cached
        : null;
  const converted =
    visibleRate && parsedAmount.value !== null ? visibleRate.rate * parsedAmount.value : null;
  const selectedLocation = locations.find((location) => location.id === selectedLocationId) ?? null;

  return (
    <div className="space-y-4 px-3 pb-[calc(max(var(--sheet-hidden,0px),var(--safe-area-bottom))+20px)]">
      <section className="space-y-2.5" aria-labelledby="cbn-reference-heading">
        <div className="px-1">
          <h2 id="cbn-reference-heading" className="text-title-2 font-semibold text-text-primary">
            How much in Naira?
          </h2>
        </div>

        <div className="squircle-card space-y-3 bg-surface-card p-3">
          <label className="block space-y-1.5">
            <span className="block text-footnote font-semibold text-text-secondary">You have</span>
            <Input
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              inputMode="decimal"
              autoComplete="off"
              placeholder="100"
              icon={
                <span aria-hidden className="text-body font-semibold">
                  {CURRENCY_META[currency].symbol}
                </span>
              }
              error={parsedAmount.error ?? undefined}
              aria-describedby="exchange-reference-note"
              data-autofocus
            />
          </label>

          <SheetPicker
            options={CBN_REFERENCE_CURRENCIES.map((code) => ({
              id: code,
              label: CURRENCY_META[code].label,
            }))}
            value={currency}
            onSelect={(value) => {
              if (CBN_REFERENCE_CURRENCIES.some((code) => code === value)) {
                setCurrency(value as CbnReferenceCurrency);
              }
            }}
            title="Choose currency"
            label="Currency you have"
          />

          <div
            className="squircle min-h-[112px] bg-fillTertiary p-3"
            aria-live="polite"
            aria-atomic="true"
          >
            {rateState.kind === "loading" && !rateState.cached ? (
              <div aria-label="Loading the latest CBN reference rate" className="space-y-3">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-9 w-3/4" />
                <Skeleton className="h-3 w-40" />
              </div>
            ) : rateState.kind === "error" ? (
              <div className="space-y-3">
                <div>
                  <p role="alert" className="text-body font-semibold text-text-primary">
                    Couldn’t load the latest rate
                  </p>
                  <p className="mt-1 text-footnote text-text-secondary">
                    Check your connection and try again.
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setRetrySequence((value) => value + 1)}
                >
                  <RefreshCw className="mr-1.5 h-4 w-4" aria-hidden />
                  Try again
                </Button>
              </div>
            ) : visibleRate ? (
              <div>
                <div className="flex items-start justify-between gap-3">
                  <p className="text-footnote font-semibold text-text-secondary">Naira estimate</p>
                  {(rateState.kind === "loading" ||
                    (rateState.kind === "ready" && rateState.saved)) && (
                    <span className="shrink-0 text-caption-1 font-medium text-status-caution-fg">
                      Saved rate
                    </span>
                  )}
                </div>
                <p className="mt-1 break-words text-title-1 font-semibold tabular-nums text-text-primary">
                  {converted === null ? "Enter an amount" : NAIRA.format(converted)}
                </p>
                <p className="mt-2 text-caption-1 leading-snug tabular-nums text-text-secondary">
                  CBN · {CURRENCY_META[currency].symbol}1 = ₦{RATE.format(visibleRate.rate)} ·
                  Published {formatPublishedDate(visibleRate.publishedDate)}
                </p>
                {rateState.kind === "ready" && rateState.refreshFailed && (
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <p role="status" className="text-caption-1 text-status-caution-fg">
                      Using the saved rate; latest refresh failed.
                    </p>
                    <button
                      type="button"
                      onClick={() => setRetrySequence((value) => value + 1)}
                      className="min-h-tap shrink-0 px-2 text-footnote font-semibold text-status-caution-fg active:opacity-60"
                    >
                      Refresh
                    </button>
                  </div>
                )}
              </div>
            ) : null}
          </div>

          <p id="exchange-reference-note" className="text-caption-1 leading-snug text-text-tertiary">
            WetinDey does not exchange money. This CBN reference estimate is relayed by
            Frankfurter; providers may quote differently.
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
            <MapPin className="h-4 w-4 shrink-0 text-text-secondary" aria-hidden />
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
                    <Building2 className="h-5 w-5" aria-hidden />
                  ) : (
                    <CircleDollarSign className="h-5 w-5" aria-hidden />
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
            <p className="text-body font-semibold text-text-primary">
              No places in this filter
            </p>
            <p className="mt-1 text-footnote text-text-secondary">Choose another place type.</p>
          </div>
        )}

      </section>
    </div>
  );
}
