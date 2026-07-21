"use server";

import {
  REFERENCE_CURRENCIES,
  isReferenceCurrencyCode,
  isSupportedReferenceCurrencyCode,
  type ReferenceCurrencyCode,
  type SupportedReferenceCurrencyCode,
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
  base: SupportedReferenceCurrencyCode;
  quote: SupportedReferenceCurrencyCode;
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

async function fetchNgnRates(
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

async function fetchNgnCatalogHistory(
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

async function fetchNgnRateHistory(
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

async function buildReferenceCurrencyCatalog(): Promise<ReferenceCurrencyCatalogEntry[]> {
  const [frankfurterRates, cbnRates, frankfurterHistory, cbnHistory] = await Promise.all([
    fetchNgnRates("FRANKFURTER"),
    fetchNgnRates("CBN").catch(() => []),
    fetchNgnCatalogHistory("FRANKFURTER").catch(() => []),
    fetchNgnCatalogHistory("CBN").catch(() => []),
  ]);
  const frankfurterCodes = new Set(frankfurterRates.map((rate) => rate.quote));
  const cbnCodes = new Set(cbnRates.map((rate) => rate.quote));

  return REFERENCE_CURRENCIES.flatMap((code) => {
    if (!frankfurterCodes.has(code)) return [];
    const provider = cbnCodes.has(code) ? ("CBN" as const) : ("FRANKFURTER" as const);
    const source =
      provider === "CBN"
        ? cbnRates.find((candidate) => candidate.quote === code)
        : frankfurterRates.find((candidate) => candidate.quote === code);
    if (!source) return [];
    const rate = 1 / source.rate;
    const history = (provider === "CBN" ? cbnHistory : frankfurterHistory)
      .filter((candidate) => candidate.quote === code)
      .sort((left, right) => left.date.localeCompare(right.date));
    const first = history[0];
    const last = history.at(-1);
    const firstRate = first ? 1 / first.rate : Number.NaN;
    const lastRate = last ? 1 / last.rate : Number.NaN;
    const trendPercent =
      history.length >= 2 &&
      Number.isFinite(firstRate) &&
      Number.isFinite(lastRate) &&
      firstRate > 0
        ? ((lastRate - firstRate) / firstRate) * 100
        : null;
    return Number.isFinite(rate) && rate > 0
      ? [{ code, provider, rate, effectiveDate: source.date, trendPercent }]
      : [];
  });
}

function selectPairProvider(
  catalog: readonly ReferenceCurrencyCatalogEntry[],
  base: SupportedReferenceCurrencyCode,
  quote: SupportedReferenceCurrencyCode
): ReferenceProvider | null {
  const foreignCodes = [base, quote].filter(
    (code): code is ReferenceCurrencyCode => code !== "NGN"
  );
  const entries = foreignCodes.map((code) =>
    catalog.find((candidate) => candidate.code === code)
  );
  if (entries.some((entry) => !entry)) return null;
  return entries.every((entry) => entry?.provider === "CBN") ? "CBN" : "FRANKFURTER";
}

function pairRateFrom(
  rows: readonly UpstreamRate[],
  base: SupportedReferenceCurrencyCode,
  quote: SupportedReferenceCurrencyCode
): { rate: number; effectiveDate: string } | null {
  const foreignCodes = [base, quote].filter(
    (code): code is ReferenceCurrencyCode => code !== "NGN"
  );
  const required = foreignCodes.map((code) =>
    rows.find((candidate) => candidate.quote === code)
  );
  if (required.some((row) => !row)) return null;
  const dates = new Set(required.map((row) => row!.date));
  if (dates.size !== 1) return null;

  const ngnPer = (code: SupportedReferenceCurrencyCode) => {
    if (code === "NGN") return 1;
    const row = required.find((candidate) => candidate?.quote === code);
    return row ? 1 / row.rate : Number.NaN;
  };
  const rate = ngnPer(base) / ngnPer(quote);
  const effectiveDate = required[0]?.date;
  return Number.isFinite(rate) && rate > 0 && effectiveDate
    ? { rate, effectiveDate }
    : null;
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
export async function getReferenceRate(
  base: string,
  quote: string = "NGN"
): Promise<ReferenceRate | null> {
  if (
    !isSupportedReferenceCurrencyCode(base) ||
    !isSupportedReferenceCurrencyCode(quote)
  ) {
    throw new Error("Unsupported reference currency.");
  }
  if (base === quote) return null;

  const catalog = await buildReferenceCurrencyCatalog();
  const provider = selectPairProvider(catalog, base, quote);
  if (!provider) return null;
  const orderedForeignCodes = [base, quote].filter(
    (code): code is ReferenceCurrencyCode => code !== "NGN"
  );
  const pair = pairRateFrom(
    await fetchNgnRates(provider, orderedForeignCodes),
    base,
    quote
  );
  if (!pair) return null;

  return {
    base,
    quote,
    rate: pair.rate,
    effectiveDate: pair.effectiveDate,
    provider,
  };
}

export async function getReferenceRateTrend(
  base: string,
  quote: string = "NGN"
): Promise<ReferenceRatePoint[]> {
  if (
    !isSupportedReferenceCurrencyCode(base) ||
    !isSupportedReferenceCurrencyCode(quote)
  ) {
    throw new Error("Unsupported reference currency.");
  }
  if (base === quote) return [];

  const catalog = await buildReferenceCurrencyCatalog();
  const provider = selectPairProvider(catalog, base, quote);
  if (!provider) return [];
  const foreignCodes = [base, quote].filter(
    (code): code is ReferenceCurrencyCode => code !== "NGN"
  );
  const histories = await Promise.all(
    foreignCodes.map((code) => fetchNgnRateHistory(code, provider))
  );
  const byCurrency = new Map(
    foreignCodes.map((code, index) => [
      code,
      new Map(histories[index]!.map((point) => [point.date, point])),
    ])
  );
  const dates = histories[0]?.map((point) => point.date) ?? [];

  return dates
    .filter((date) =>
      foreignCodes.every((code) => byCurrency.get(code)?.has(date))
    )
    .map((date) => {
      const ngnPer = (code: SupportedReferenceCurrencyCode) => {
        if (code === "NGN") return 1;
        const point = byCurrency.get(code)?.get(date);
        return point ? 1 / point.rate : Number.NaN;
      };
      return { date, rate: ngnPer(base) / ngnPer(quote) };
    })
    .filter((point) => Number.isFinite(point.rate) && point.rate > 0)
    .sort((left, right) => left.date.localeCompare(right.date));
}
