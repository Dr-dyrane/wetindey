import {
  REFERENCE_CURRENCIES,
  isReferenceCurrencyCode,
  type ReferenceCurrencyCode,
} from "@/app/_data/reference-currencies";

export type ReferenceProvider = "CBN" | "FRANKFURTER";

export interface ReferenceCurrencyCatalogEntry {
  code: ReferenceCurrencyCode;
  provider: ReferenceProvider;
  rate: number;
  effectiveDate: string;
  trendPercent: number | null;
}

export interface ReferenceRate {
  base: import("@/app/_data/reference-currencies").SupportedReferenceCurrencyCode;
  quote: import("@/app/_data/reference-currencies").SupportedReferenceCurrencyCode;
  rate: number;
  effectiveDate: string;
  provider: ReferenceProvider;
}

export interface ReferenceRatePoint {
  date: string;
  rate: number;
}

export interface UpstreamRate {
  date: string;
  base: "NGN";
  quote: ReferenceCurrencyCode;
  rate: number;
}

const API_ROOT = "https://api.frankfurter.dev/v2";
const QUOTES = REFERENCE_CURRENCIES.join(",");
const REQUEST_OPTIONS = {
  headers: { Accept: "application/json" },
  next: { revalidate: 3600 },
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isIsoCalendarDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function parseNgnRates(value: unknown): UpstreamRate[] {
  if (!Array.isArray(value)) {
    throw new Error("The reference currency catalog was invalid.");
  }

  const byCurrency = new Map<ReferenceCurrencyCode, UpstreamRate>();
  for (const row of value) {
    if (
      !isRecord(row) ||
      row.base !== "NGN" ||
      typeof row.quote !== "string" ||
      !isReferenceCurrencyCode(row.quote) ||
      typeof row.rate !== "number" ||
      !Number.isFinite(row.rate) ||
      row.rate <= 0 ||
      !isIsoCalendarDate(row.date)
    ) {
      continue;
    }

    if (byCurrency.has(row.quote)) {
      throw new Error("The reference currency catalog contained duplicate rates.");
    }
    byCurrency.set(row.quote, {
      date: row.date,
      base: "NGN",
      quote: row.quote,
      rate: row.rate,
    });
  }

  return REFERENCE_CURRENCIES.flatMap((code) => {
    const rate = byCurrency.get(code);
    return rate ? [rate] : [];
  });
}

function parseNgnRateHistory(
  value: unknown,
  currency: ReferenceCurrencyCode
): UpstreamRate[] {
  if (!Array.isArray(value)) {
    throw new Error("The reference rate history was invalid.");
  }

  const seenDates = new Set<string>();
  return value.flatMap((row) => {
    if (
      !isRecord(row) ||
      row.base !== "NGN" ||
      row.quote !== currency ||
      typeof row.rate !== "number" ||
      !Number.isFinite(row.rate) ||
      row.rate <= 0 ||
      !isIsoCalendarDate(row.date)
    ) {
      return [];
    }
    if (seenDates.has(row.date)) {
      throw new Error("The reference rate history contained duplicate dates.");
    }
    seenDates.add(row.date);
    return [{ date: row.date, base: "NGN" as const, quote: currency, rate: row.rate }];
  });
}

function parseNgnCatalogHistory(value: unknown): UpstreamRate[] {
  if (!Array.isArray(value)) {
    throw new Error("The reference catalog history was invalid.");
  }
  const seen = new Set<string>();
  return value.flatMap((row) => {
    if (
      !isRecord(row) ||
      row.base !== "NGN" ||
      typeof row.quote !== "string" ||
      !isReferenceCurrencyCode(row.quote) ||
      typeof row.rate !== "number" ||
      !Number.isFinite(row.rate) ||
      row.rate <= 0 ||
      !isIsoCalendarDate(row.date)
    ) {
      return [];
    }
    const key = `${row.quote}:${row.date}`;
    if (seen.has(key)) {
      throw new Error("The reference catalog history contained duplicate rates.");
    }
    seen.add(key);
    return [{ date: row.date, base: "NGN" as const, quote: row.quote, rate: row.rate }];
  });
}

export async function fetchNgnRates(
  provider: ReferenceProvider,
  quotes: readonly ReferenceCurrencyCode[] = REFERENCE_CURRENCIES
): Promise<UpstreamRate[]> {
  if (quotes.length === 0 || new Set(quotes).size !== quotes.length) {
    throw new Error("The reference currency request was invalid.");
  }
  const providerQuery = provider === "CBN" ? "&providers=CBN" : "";
  const response = await fetch(
    `${API_ROOT}/rates?base=NGN&quotes=${quotes.join(",")}${providerQuery}`,
    {
      ...REQUEST_OPTIONS,
      signal: AbortSignal.timeout(8_000),
    }
  );

  if (!response.ok) {
    throw new Error(
      provider === "CBN"
        ? "The CBN reference catalog is unavailable."
        : "The Frankfurter reference catalog is unavailable."
    );
  }

  return parseNgnRates(await response.json());
}

export async function fetchNgnCatalogHistory(
  provider: ReferenceProvider
): Promise<UpstreamRate[]> {
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 8);
  const providerQuery = provider === "CBN" ? "&providers=CBN" : "";
  const response = await fetch(
    `${API_ROOT}/rates?base=NGN&quotes=${QUOTES}&from=${start
      .toISOString()
      .slice(0, 10)}&to=${end.toISOString().slice(0, 10)}${providerQuery}`,
    {
      ...REQUEST_OPTIONS,
      signal: AbortSignal.timeout(8_000),
    }
  );
  if (!response.ok) return [];
  return parseNgnCatalogHistory(await response.json());
}

export async function fetchNgnRateHistory(
  currency: ReferenceCurrencyCode,
  provider: ReferenceProvider
): Promise<UpstreamRate[]> {
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 35);
  const from = start.toISOString().slice(0, 10);
  const to = end.toISOString().slice(0, 10);
  const providerQuery = provider === "CBN" ? "&providers=CBN" : "";
  const response = await fetch(
    `${API_ROOT}/rates?base=NGN&quotes=${currency}&from=${from}&to=${to}${providerQuery}`,
    {
      ...REQUEST_OPTIONS,
      signal: AbortSignal.timeout(8_000),
    }
  );

  if (!response.ok) {
    throw new Error("The reference rate history is unavailable.");
  }

  return parseNgnRateHistory(await response.json(), currency);
}
