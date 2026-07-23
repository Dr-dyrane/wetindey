import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useT } from "@/core/i18n";
import {
  getReferenceCurrencyCatalog,
  getReferenceRate,
  getReferenceRateTrend,
  type ReferenceCurrencyCatalogEntry,
  type ReferenceRate,
  type ReferenceRatePoint,
} from "@/app/_actions/currency-actions";
import {
  SUPPORTED_REFERENCE_CURRENCY_META,
  isSupportedReferenceCurrencyCode,
  type SupportedReferenceCurrencyCode,
} from "@/app/_data/reference-currencies";
import type {
  ExchangeLocationKind,
  ExchangeLocation,
} from "@/integrations/maps/MapboxNearbyExchangeSearch";
import type { ExchangeLocationDiscoveryResult } from "@/app/_actions/exchange-location-actions";

export type ExchangeLocationFilter = "all" | ExchangeLocationKind;

export interface ExchangePanelProps {
  origin: { lat: number; lng: number };
  locations: readonly ExchangeLocation[];
  locationDiscoveryStatus:
    | ExchangeLocationDiscoveryResult["status"]
    | "loading"
    | "sample";
  filter: ExchangeLocationFilter;
  onFilterChange: (filter: ExchangeLocationFilter) => void;
  selectedLocationId: string | null;
  onSelectLocation: (location: ExchangeLocation) => void;
}

export interface CachedRate extends ReferenceRate {
  savedAt: number;
}

export type CatalogState =
  | { kind: "loading" }
  | { kind: "ready"; entries: ReferenceCurrencyCatalogEntry[] }
  | { kind: "empty" }
  | { kind: "error" };

export type RateState =
  | { kind: "idle" }
  | { kind: "loading"; cached: CachedRate | null }
  | { kind: "ready"; rate: ReferenceRate; saved: boolean; refreshFailed: boolean }
  | { kind: "unavailable" }
  | { kind: "error" };

export type RateTrendState =
  | { kind: "loading" }
  | { kind: "ready"; points: ReferenceRatePoint[] }
  | { kind: "unavailable" };

export type AmountField = "foreign" | "ngn";

export interface AmountState {
  foreign: string;
  ngn: string;
  lastEdited: AmountField;
}

const CACHE_PREFIX = "wetindey:reference-rate:v3:";
const LAST_PAIR_KEY = "wetindey:reference-rate:last-pair:v1";
const LEGACY_SESSION_AMOUNT_KEY = "wetindey:reference-amount:v1";
const SESSION_AMOUNT_KEY = "wetindey:reference-amounts:v2";
const MAX_SESSION_AMOUNT_CHARACTERS = 32;
const MAX_AMOUNT = 1_000_000_000;
const EMPTY_AMOUNTS: AmountState = { foreign: "", ngn: "", lastEdited: "foreign" };

export const RATE_FORMATTER = new Intl.NumberFormat("en-NG", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

export const EDITABLE_FOREIGN = new Intl.NumberFormat("en-NG", {
  useGrouping: false,
  maximumFractionDigits: 4,
});

export const EDITABLE_NGN = new Intl.NumberFormat("en-NG", {
  useGrouping: false,
  maximumFractionDigits: 2,
});

export const EFFECTIVE_DATE = new Intl.DateTimeFormat("en-NG", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export function isIsoCalendarDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function isCachedRate(
  value: unknown,
  base: SupportedReferenceCurrencyCode,
  quote: SupportedReferenceCurrencyCode
): value is CachedRate {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<CachedRate>;
  return (
    candidate.base === base &&
    candidate.quote === quote &&
    (candidate.provider === "CBN" || candidate.provider === "FRANKFURTER") &&
    typeof candidate.rate === "number" &&
    Number.isFinite(candidate.rate) &&
    candidate.rate > 0 &&
    isIsoCalendarDate(candidate.effectiveDate) &&
    typeof candidate.savedAt === "number" &&
    Number.isFinite(candidate.savedAt)
  );
}

function pairCacheKey(
  base: SupportedReferenceCurrencyCode,
  quote: SupportedReferenceCurrencyCode
) {
  return `${CACHE_PREFIX}${base}:${quote}`;
}

export function readCachedRate(
  base: SupportedReferenceCurrencyCode,
  quote: SupportedReferenceCurrencyCode
): CachedRate | null {
  try {
    const raw = window.localStorage.getItem(pairCacheKey(base, quote));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isCachedRate(parsed, base, quote) ? parsed : null;
  } catch {
    return null;
  }
}

export function readLastCachedRate(): CachedRate | null {
  try {
    const raw = window.localStorage.getItem(LAST_PAIR_KEY);
    if (!raw) return null;
    const pair: unknown = JSON.parse(raw);
    if (
      !isRecord(pair) ||
      typeof pair.base !== "string" ||
      typeof pair.quote !== "string" ||
      !isSupportedReferenceCurrencyCode(pair.base) ||
      !isSupportedReferenceCurrencyCode(pair.quote)
    ) {
      return null;
    }
    return readCachedRate(pair.base, pair.quote);
  } catch {
    return null;
  }
}

export function saveCachedRate(rate: ReferenceRate) {
  try {
    const cached: CachedRate = { ...rate, savedAt: Date.now() };
    window.localStorage.setItem(pairCacheKey(rate.base, rate.quote), JSON.stringify(cached));
    window.localStorage.setItem(
      LAST_PAIR_KEY,
      JSON.stringify({ base: rate.base, quote: rate.quote })
    );
  } catch {}
}

/**
 * The translated function returned by `useT()`. `formatEffectiveDate` is pure
 * and runs outside a component, so it takes `t` as a parameter for its one
 * user-facing fallback rather than calling the hook itself; the view stays the
 * single `useT()` caller. The provider label is resolved directly in the view
 * (get.provider_* keys), so no helper is needed for it.
 */
type TFn = ReturnType<typeof useT>;

export function formatEffectiveDate(date: string, t: TFn): string {
  if (!isIsoCalendarDate(date)) return t("exchange.date_unavailable");
  return EFFECTIVE_DATE.format(new Date(`${date}T12:00:00Z`));
}

export function parseAmount(value: string): { value: number | null; error: string | null } {
  const trimmed = value.trim();
  const normalized = trimmed.replaceAll(",", "");
  if (normalized === "") return { value: null, error: null };
  if (
    !/^(?:\d+|\d{1,3}(?:,\d{3})+|\d*\.\d+|\d{1,3}(?:,\d{3})+\.\d+)$/.test(
      trimmed
    )
  ) {
    return { value: null, error: "Numbers only." };
  }
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { value: null, error: "Enter more than zero." };
  }
  if (amount > MAX_AMOUNT) {
    return { value: null, error: "Amount is too large." };
  }
  return { value: amount, error: null };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function amountStateFrom(field: AmountField, value: string): AmountState {
  return field === "foreign"
    ? { foreign: value, ngn: "", lastEdited: field }
    : { foreign: "", ngn: value, lastEdited: field };
}

function readSessionAmounts(): AmountState {
  try {
    const raw = window.sessionStorage.getItem(SESSION_AMOUNT_KEY);
    if (raw) {
      const stored: unknown = JSON.parse(raw);
      if (
        isRecord(stored) &&
        (stored.lastEdited === "foreign" || stored.lastEdited === "ngn") &&
        typeof stored.value === "string" &&
        stored.value.length <= MAX_SESSION_AMOUNT_CHARACTERS
      ) {
        const parsed = parseAmount(stored.value);
        if (parsed.value !== null && parsed.error === null) {
          return amountStateFrom(stored.lastEdited, stored.value);
        }
      }
    }

    const legacy = window.sessionStorage.getItem(LEGACY_SESSION_AMOUNT_KEY);
    if (legacy && legacy.length <= MAX_SESSION_AMOUNT_CHARACTERS) {
      const parsed = parseAmount(legacy);
      if (parsed.value !== null && parsed.error === null) {
        return amountStateFrom("foreign", legacy);
      }
    }
    return EMPTY_AMOUNTS;
  } catch {
    return EMPTY_AMOUNTS;
  }
}

function writeSessionAmount(field: AmountField, value: string) {
  try {
    if (value.trim() === "") {
      window.sessionStorage.removeItem(SESSION_AMOUNT_KEY);
      window.sessionStorage.removeItem(LEGACY_SESSION_AMOUNT_KEY);
      return;
    }

    const parsed = parseAmount(value);
    if (
      value.length <= MAX_SESSION_AMOUNT_CHARACTERS &&
      parsed.value !== null &&
      parsed.error === null
    ) {
      window.sessionStorage.setItem(
        SESSION_AMOUNT_KEY,
        JSON.stringify({ lastEdited: field, value })
      );
      window.sessionStorage.removeItem(LEGACY_SESSION_AMOUNT_KEY);
      return;
    }

    window.sessionStorage.removeItem(SESSION_AMOUNT_KEY);
    window.sessionStorage.removeItem(LEGACY_SESSION_AMOUNT_KEY);
  } catch {}
}

export function getCrossRate(
  topCurrency: SupportedReferenceCurrencyCode | null,
  bottomCurrency: SupportedReferenceCurrencyCode | null,
  liveRate?: ReferenceRate | null
): number | null {
  if (!topCurrency || !bottomCurrency) return null;
  if (topCurrency === bottomCurrency) return 1;
  return liveRate?.base === topCurrency && liveRate.quote === bottomCurrency
    ? liveRate.rate
    : null;
}

export function deriveAmount(
  state: AmountState,
  rate: ReferenceRate | null,
  topCurrency?: SupportedReferenceCurrencyCode | null,
  bottomCurrency?: SupportedReferenceCurrencyCode | null
): AmountState {
  const edited = state[state.lastEdited];
  const parsed = parseAmount(edited);
  const other: AmountField = state.lastEdited === "foreign" ? "ngn" : "foreign";

  if (parsed.value === null || parsed.error !== null) {
    return { ...state, [other]: "" };
  }

  const crossRate = getCrossRate(topCurrency ?? "USD", bottomCurrency ?? "NGN", rate);
  if (crossRate === null) {
    return { ...state, [other]: "" };
  }
  const converted =
    state.lastEdited === "foreign" ? parsed.value * crossRate : parsed.value / crossRate;

  if (!Number.isFinite(converted) || converted <= 0 || converted > MAX_AMOUNT) {
    return { ...state, [other]: "" };
  }

  const formatted =
    other === "foreign"
      ? EDITABLE_FOREIGN.format(converted)
      : EDITABLE_NGN.format(converted);

  return {
    ...state,
    [other]: formatted,
  };
}

export function useExchangePanel({
  locations,
  selectedLocationId,
}: ExchangePanelProps) {
  const amountId = useId();
  const foreignErrorId = useId();
  const ngnAmountId = useId();
  const ngnErrorId = useId();
  const currencyRef = useRef<SupportedReferenceCurrencyCode | null>(null);
  const amountsRef = useRef<AmountState>(EMPTY_AMOUNTS);
  const [currency, setCurrency] = useState<SupportedReferenceCurrencyCode | null>(null);
  const [baseCurrency, setBaseCurrency] =
    useState<SupportedReferenceCurrencyCode>("NGN");
  const [amounts, setAmounts] = useState<AmountState>(EMPTY_AMOUNTS);
  const [catalogRetry, setCatalogRetry] = useState(0);
  const [rateRetry, setRateRetry] = useState(0);
  const [offline, setOffline] = useState(false);
  const [catalogState, setCatalogState] = useState<CatalogState>({ kind: "loading" });
  const [rateState, setRateState] = useState<RateState>({ kind: "idle" });
  const [rateTrendState, setRateTrendState] = useState<RateTrendState>({
    kind: "loading",
  });
  const [conversionReversed, setConversionReversed] = useState(false);

  const commitAmounts = useCallback((next: AmountState) => {
    amountsRef.current = next;
    setAmounts(next);
  }, []);

  const enterCurrency = useCallback(
    (nextCurrency: SupportedReferenceCurrencyCode) => {
      currencyRef.current = nextCurrency;
      setCurrency(nextCurrency);
      setRateState({ kind: "idle" });
      const current = amountsRef.current;
      const other: AmountField = current.lastEdited === "foreign" ? "ngn" : "foreign";
      commitAmounts({ ...current, [other]: "" });
    },
    [commitAmounts]
  );

  const enterBaseCurrency = useCallback(
    (nextBaseCurrency: SupportedReferenceCurrencyCode) => {
      if (nextBaseCurrency === currency) {
        setCurrency(baseCurrency);
      }
      setBaseCurrency(nextBaseCurrency);
      const current = amountsRef.current;
      const other: AmountField = current.lastEdited === "foreign" ? "ngn" : "foreign";
      commitAmounts({ ...current, [other]: "" });
    },
    [baseCurrency, currency, commitAmounts]
  );

  useEffect(() => {
    const savedAmounts = readSessionAmounts();
    commitAmounts(savedAmounts);
    const edited = savedAmounts[savedAmounts.lastEdited];
    if (edited) writeSessionAmount(savedAmounts.lastEdited, edited);
  }, [commitAmounts]);

  useEffect(() => {
    let cancelled = false;
    const saved = readLastCachedRate();
    setCatalogState({ kind: "loading" });
    if (saved) {
      currencyRef.current = saved.base;
      setCurrency(saved.base);
      setBaseCurrency(saved.quote);
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
          current && (current === "NGN" || entries.some((entry) => entry.code === current))
            ? current
            : (entries.find((entry) => entry.code === "USD")?.code ?? entries[0]!.code);
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
    if (currency === baseCurrency) {
      setRateState({ kind: "idle" });
      setRateTrendState({ kind: "unavailable" });
      return;
    }
    let cancelled = false;
    const cached = readCachedRate(currency, baseCurrency);
    setRateState({ kind: "loading", cached });
    setRateTrendState({ kind: "loading" });

    void getReferenceRate(currency, baseCurrency)
      .then((rate) => {
        if (cancelled) return;
        if (!rate) {
          setRateState({ kind: "unavailable" });
          setRateTrendState({ kind: "unavailable" });
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
    void getReferenceRateTrend(currency, baseCurrency)
      .then((points) => {
        if (cancelled) return;
        setRateTrendState(
          points.length >= 2 ? { kind: "ready", points } : { kind: "unavailable" }
        );
      })
      .catch(() => {
        if (!cancelled) setRateTrendState({ kind: "unavailable" });
      });

    return () => {
      cancelled = true;
    };
  }, [baseCurrency, catalogState.kind, currency, rateRetry]);

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

  const candidateVisibleRate =
    rateState.kind === "ready"
      ? rateState.rate
      : rateState.kind === "loading"
        ? rateState.cached
        : null;
  const visibleRate =
    candidateVisibleRate &&
    candidateVisibleRate.base === currency &&
    candidateVisibleRate.quote === baseCurrency
      ? candidateVisibleRate
      : null;
  const visibleRateBase = visibleRate?.base;
  const visibleRateValue = visibleRate?.rate;

  useEffect(() => {
    const current = amountsRef.current;
    const next = deriveAmount(current, visibleRate, currency, baseCurrency);
    if (next.foreign !== current.foreign || next.ngn !== current.ngn) {
      commitAmounts(next);
    }
  }, [
    commitAmounts,
    visibleRate,
    visibleRateBase,
    visibleRateValue,
    currency,
    baseCurrency,
  ]);

  const editAmount = (field: AmountField, value: string) => {
    const edited = amountStateFrom(field, value);
    const next = deriveAmount(edited, visibleRate, currency, baseCurrency);
    commitAmounts(next);
    writeSessionAmount(field, value);
  };

  const toggleConversionDirection = useCallback(() => {
    setConversionReversed((current) => !current);
  }, []);

  const foreignParsed = useMemo(() => parseAmount(amounts.foreign), [amounts.foreign]);
  const ngnParsed = useMemo(() => parseAmount(amounts.ngn), [amounts.ngn]);
  const foreignError = amounts.lastEdited === "foreign" ? foreignParsed.error : null;
  const ngnError = amounts.lastEdited === "ngn" ? ngnParsed.error : null;
  const usingSavedRate =
    (rateState.kind === "loading" && rateState.cached !== null) ||
    (rateState.kind === "ready" && rateState.saved) ||
    (offline && visibleRate !== null);
  const availableCurrencies: SupportedReferenceCurrencyCode[] =
    catalogState.kind === "ready"
      ? ["NGN", ...catalogState.entries.map((entry) => entry.code)]
      : [];
  const selectedMeta = currency ? SUPPORTED_REFERENCE_CURRENCY_META[currency] : null;
  const selectedLocation = locations.find((location) => location.id === selectedLocationId) ?? null;

  const [trendPeriod, setTrendPeriod] = useState<"7d" | "14d" | "30d">("7d");

  const trendInsight = useMemo(() => {
    const rawPoints = rateTrendState.kind === "ready" ? rateTrendState.points : [];
    const daysLimit = trendPeriod === "7d" ? 7 : trendPeriod === "14d" ? 14 : 30;

    if (rawPoints.length < 2) return null;
    const basePoints = rawPoints;

    const sorted = [...basePoints]
      .filter((p) => Number.isFinite(p.rate) && Number.isFinite(Date.parse(p.date)))
      .sort((a, b) => Date.parse(a.date) - Date.parse(b.date))
      .slice(-daysLimit);

    const rates = sorted.map((p) => p.rate);
    const first = rates[0]!;
    const last = rates[rates.length - 1]!;
    const high = Math.max(...rates);
    const low = Math.min(...rates);
    const netChange = last - first;
    const percentChange = first > 0 ? (netChange / first) * 100 : 0;
    const band = high - low;

    const unit = baseCurrency === "NGN" ? "₦" : "";

    const narrative =
      Math.abs(percentChange) < 0.05
        ? `Stable curve — rate stayed within a ${unit}${band.toFixed(2)} band over ${sorted.length} days`
        : Math.abs(percentChange) > 2
          ? `High movement — rate fluctuated ${unit}${band.toFixed(2)} over ${sorted.length} days`
          : `Gradual movement — rate shifted ${unit}${Math.abs(netChange).toFixed(2)} over ${sorted.length} days`;

    return {
      points: sorted,
      high,
      low,
      first,
      last,
      netChange,
      percentChange,
      narrative,
    };
  }, [rateTrendState, trendPeriod, baseCurrency]);

  return {
    amountId,
    foreignErrorId,
    ngnAmountId,
    ngnErrorId,
    currency,
    setCurrency,
    baseCurrency,
    setBaseCurrency,
    enterBaseCurrency,
    amounts,
    catalogState,
    rateState,
    rateTrendState,
    trendPeriod,
    setTrendPeriod,
    trendInsight,
    setCatalogRetry,
    setRateRetry,
    offline,
    enterCurrency,
    editAmount,
    foreignError,
    ngnError,
    usingSavedRate,
    availableCurrencies,
    selectedMeta,
    selectedLocation,
    visibleRate,
    conversionReversed,
    toggleConversionDirection,
  };
}
