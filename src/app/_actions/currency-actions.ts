"use server";

import {
  REFERENCE_CURRENCIES,
  isReferenceCurrencyCode,
  type ReferenceCurrencyCode,
} from "@/app/_data/reference-currencies";

export type ReferenceProvider = "CBN" | "FRANKFURTER";

export interface ReferenceCurrencyCatalogEntry {
  code: ReferenceCurrencyCode;
  provider: ReferenceProvider;
}

export interface ReferenceRate {
  base: ReferenceCurrencyCode;
  quote: "NGN";
  rate: number;
  effectiveDate: string;
  provider: ReferenceProvider;
}

export interface ReferenceRatePoint {
  date: string;
  rate: number;
}

interface UpstreamRate {
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

  return value.flatMap((row) =>
    isRecord(row) &&
    row.base === "NGN" &&
    row.quote === currency &&
    typeof row.rate === "number" &&
    Number.isFinite(row.rate) &&
    row.rate > 0 &&
    isIsoCalendarDate(row.date)
      ? [
          {
            date: row.date,
            base: "NGN" as const,
            quote: currency,
            rate: row.rate,
          },
        ]
      : []
  );
}

async function fetchNgnRates(provider: ReferenceProvider): Promise<UpstreamRate[]> {
  const providerQuery = provider === "CBN" ? "&providers=CBN" : "";
  const response = await fetch(
    `${API_ROOT}/rates?base=NGN&quotes=${QUOTES}${providerQuery}`,
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

async function fetchNgnRateHistory(
  currency: ReferenceCurrencyCode,
  provider: ReferenceProvider
): Promise<UpstreamRate[]> {
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 14);
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

async function buildReferenceCurrencyCatalog(): Promise<ReferenceCurrencyCatalogEntry[]> {
  const [frankfurterRates, cbnRates] = await Promise.all([
    fetchNgnRates("FRANKFURTER"),
    fetchNgnRates("CBN").catch(() => []),
  ]);
  const frankfurterCodes = new Set(frankfurterRates.map((rate) => rate.quote));
  const cbnCodes = new Set(cbnRates.map((rate) => rate.quote));

  return REFERENCE_CURRENCIES.flatMap((code) =>
    frankfurterCodes.has(code)
      ? [{ code, provider: cbnCodes.has(code) ? ("CBN" as const) : ("FRANKFURTER" as const) }]
      : []
  );
}

/**
 * The live product catalog is an intersection, never the curated list alone.
 * A failed CBN catalog quietly removes CBN attribution while the independently
 * validated Frankfurter catalog can remain useful; it never leaves a CBN label
 * behind on a blended result.
 */
export async function getReferenceCurrencyCatalog(): Promise<
  ReferenceCurrencyCatalogEntry[]
> {
  return buildReferenceCurrencyCatalog();
}

/**
 * Fetch one validated foreign-currency-to-NGN reference. The client sends only
 * the currency code: the amount stays in the browser and is multiplied there.
 *
 * `null` means the curated pair is not in the current validated catalog. An
 * upstream failure still throws so the client can distinguish unavailable from
 * a refresh error and decide whether a visibly saved rate is honest to show.
 */
export async function getReferenceRate(currency: string): Promise<ReferenceRate | null> {
  if (!isReferenceCurrencyCode(currency)) {
    throw new Error("Unsupported reference currency.");
  }

  const catalog = await buildReferenceCurrencyCatalog();
  const entry = catalog.find((candidate) => candidate.code === currency);
  if (!entry) return null;

  const rates = await fetchNgnRates(entry.provider);
  const upstream = rates.find((candidate) => candidate.quote === currency);
  if (!upstream) return null;

  const rate = 1 / upstream.rate;
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error("The reference currency rate was invalid.");
  }

  return {
    base: currency,
    quote: "NGN",
    rate,
    effectiveDate: upstream.date,
    provider: entry.provider,
  };
}

export async function getReferenceRateTrend(
  currency: string
): Promise<ReferenceRatePoint[]> {
  if (!isReferenceCurrencyCode(currency)) {
    throw new Error("Unsupported reference currency.");
  }

  const catalog = await buildReferenceCurrencyCatalog();
  const entry = catalog.find((candidate) => candidate.code === currency);
  if (!entry) return [];

  const history = await fetchNgnRateHistory(currency, entry.provider);
  return history
    .map((point) => ({ date: point.date, rate: 1 / point.rate }))
    .filter((point) => Number.isFinite(point.rate) && point.rate > 0)
    .sort((left, right) => left.date.localeCompare(right.date))
    .slice(-7);
}
