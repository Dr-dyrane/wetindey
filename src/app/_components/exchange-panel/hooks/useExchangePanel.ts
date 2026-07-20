import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  getReferenceCurrencyCatalog,
  getReferenceRate,
  getReferenceRateTrend,
  type ReferenceCurrencyCatalogEntry,
  type ReferenceRate,
  type ReferenceRatePoint,
} from "@/app/_actions/currency-actions";
import {
  REFERENCE_CURRENCY_META,
  isReferenceCurrencyCode,
  type ReferenceCurrencyCode,
} from "@/app/_data/reference-currencies";
import type {
  ExchangeLocationKind,
  ExchangeSampleLocation,
} from "@/app/_data/exchange-sample-locations";

export type ExchangeLocationFilter = "all" | ExchangeLocationKind;

export interface ExchangePanelProps {
  origin: { lat: number; lng: number };
  locations: readonly ExchangeSampleLocation[];
  filter: ExchangeLocationFilter;
  onFilterChange: (filter: ExchangeLocationFilter) => void;
  selectedLocationId: string | null;
  onSelectLocation: (location: ExchangeSampleLocation) => void;
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

const CACHE_PREFIX = "wetindey:reference-rate:v2:";
const LAST_CURRENCY_KEY = "wetindey:reference-rate:last-currency:v1";
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

export function isCachedRate(value: unknown, currency: ReferenceCurrencyCode): value is CachedRate {
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

export function readCachedRate(currency: ReferenceCurrencyCode): CachedRate | null {
  try {
    const raw = window.localStorage.getItem(`${CACHE_PREFIX}${currency}`);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isCachedRate(parsed, currency) ? parsed : null;
  } catch {
    return null;
  }
}

export function readLastCachedRate(): CachedRate | null {
  try {
    const currency = window.localStorage.getItem(LAST_CURRENCY_KEY);
    return currency && isReferenceCurrencyCode(currency) ? readCachedRate(currency) : null;
  } catch {
    return null;
  }
}

export function saveCachedRate(rate: ReferenceRate) {
  try {
    const cached: CachedRate = { ...rate, savedAt: Date.now() };
    window.localStorage.setItem(`${CACHE_PREFIX}${rate.base}`, JSON.stringify(cached));
    window.localStorage.setItem(LAST_CURRENCY_KEY, rate.base);
  } catch {}
}

export function formatEffectiveDate(date: string): string {
  if (!isIsoCalendarDate(date)) return "date unavailable";
  return EFFECTIVE_DATE.format(new Date(`${date}T12:00:00Z`));
}

export function providerLabel(rate: ReferenceRate): string {
  return rate.provider === "CBN" ? "CBN reference" : "Frankfurter reference";
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

export function deriveAmount(
  state: AmountState,
  rate: ReferenceRate | null,
  topCurrency?: string | null,
  bottomCurrency?: string | null
): AmountState {
  const edited = state[state.lastEdited];
  const parsed = parseAmount(edited);
  const other: AmountField = state.lastEdited === "foreign" ? "ngn" : "foreign";

  if (parsed.value === null || parsed.error !== null) {
    return { ...state, [other]: "" };
  }

  if (topCurrency && bottomCurrency && topCurrency === bottomCurrency) {
    return {
      ...state,
      [other]: edited,
    };
  }

  if (!rate || !rate.rate) {
    return state;
  }

  const converted =
    state.lastEdited === "foreign" ? parsed.value * rate.rate : parsed.value / rate.rate;
  if (!Number.isFinite(converted) || converted <= 0 || converted > MAX_AMOUNT) {
    return { ...state, [other]: "" };
  }

  const formatted =
    state.lastEdited === "foreign"
      ? EDITABLE_NGN.format(converted)
      : EDITABLE_FOREIGN.format(converted);
  const formattedParsed = parseAmount(formatted);
  if (formattedParsed.value === null || formattedParsed.error !== null) {
    return { ...state, [other]: "" };
  }

  return {
    ...state,
    [other]: formatted,
  };
}

export function useExchangePanel(props: ExchangePanelProps) {
  const { locations, selectedLocationId } = props;
  const amountId = useId();
  const foreignErrorId = useId();
  const ngnAmountId = useId();
  const ngnErrorId = useId();
  const currencyRef = useRef<ReferenceCurrencyCode | null>(null);
  const amountsRef = useRef<AmountState>(EMPTY_AMOUNTS);
  const [currency, setCurrency] = useState<ReferenceCurrencyCode | null>(null);
  const [baseCurrency, setBaseCurrency] = useState<string>("NGN");
  const [amounts, setAmounts] = useState<AmountState>(EMPTY_AMOUNTS);
  const [catalogRetry, setCatalogRetry] = useState(0);
  const [rateRetry, setRateRetry] = useState(0);
  const [offline, setOffline] = useState(false);
  const [catalogState, setCatalogState] = useState<CatalogState>({ kind: "loading" });
  const [rateState, setRateState] = useState<RateState>({ kind: "idle" });
  const [rateTrendState, setRateTrendState] = useState<RateTrendState>({
    kind: "loading",
  });
  const [viewMode, setViewMode] = useState<"answer" | "nearby" | "evidence">(
    "answer"
  );
  const [conversionReversed, setConversionReversed] = useState(false);

  const commitAmounts = useCallback((next: AmountState) => {
    amountsRef.current = next;
    setAmounts(next);
  }, []);

  const enterCurrency = useCallback(
    (nextCurrency: ReferenceCurrencyCode) => {
      currencyRef.current = nextCurrency;
      setCurrency(nextCurrency);
      setRateState({ kind: "loading", cached: readCachedRate(nextCurrency) });
      const current = amountsRef.current;
      const other: AmountField = current.lastEdited === "foreign" ? "ngn" : "foreign";
      commitAmounts({ ...current, [other]: "" });
    },
    [commitAmounts]
  );

  const enterBaseCurrency = useCallback(
    (nextBaseCurrency: string) => {
      if (nextBaseCurrency === currency) {
        setCurrency(baseCurrency as ReferenceCurrencyCode);
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
    let cancelled = false;
    const cached = readCachedRate(currency);
    setRateState({ kind: "loading", cached });
    setRateTrendState({ kind: "loading" });

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
    void getReferenceRateTrend(currency)
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

  const candidateVisibleRate =
    rateState.kind === "ready"
      ? rateState.rate
      : rateState.kind === "loading"
        ? rateState.cached
        : null;
  const visibleRate =
    candidateVisibleRate && candidateVisibleRate.base === currency ? candidateVisibleRate : null;
  const visibleRateBase = visibleRate?.base;
  const visibleRateValue = visibleRate?.rate;
  useEffect(() => {
    const current = amountsRef.current;
    const next = deriveAmount(current, visibleRate, currency, baseCurrency);
    if (next.foreign !== current.foreign || next.ngn !== current.ngn) {
      commitAmounts(next);
    }
  }, [commitAmounts, visibleRateBase, visibleRateValue, currency, baseCurrency]);

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
  const availableCurrencies =
    catalogState.kind === "ready" ? catalogState.entries.map((entry) => entry.code) : [];
  const selectedMeta = currency ? REFERENCE_CURRENCY_META[currency] : null;
  const selectedLocation = locations.find((location) => location.id === selectedLocationId) ?? null;

  const [trendPeriod, setTrendPeriod] = useState<"7d" | "14d" | "30d">("7d");

  const trendInsight = useMemo(() => {
    if (rateTrendState.kind !== "ready" || rateTrendState.points.length < 2) {
      return null;
    }
    const daysLimit = trendPeriod === "7d" ? 7 : trendPeriod === "14d" ? 14 : 30;
    const sorted = [...rateTrendState.points]
      .filter((p) => Number.isFinite(p.rate) && Number.isFinite(Date.parse(p.date)))
      .sort((a, b) => Date.parse(a.date) - Date.parse(b.date))
      .slice(-daysLimit);

    if (sorted.length < 2) return null;

    const rates = sorted.map((p) => p.rate);
    const first = rates[0]!;
    const last = rates[rates.length - 1]!;
    const high = Math.max(...rates);
    const low = Math.min(...rates);
    const netChange = last - first;
    const percentChange = (netChange / first) * 100;
    const band = high - low;

    const narrative =
      Math.abs(percentChange) < 0.05
        ? `Stable curve — rate stayed within a ₦${band.toFixed(0)} band over ${sorted.length} days`
        : Math.abs(percentChange) > 2
          ? `High movement — rate fluctuated ₦${band.toFixed(0)} over ${sorted.length} days`
          : `Gradual movement — rate shifted ₦${Math.abs(netChange).toFixed(0)} over ${sorted.length} days`;

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
  }, [rateTrendState, trendPeriod]);

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
