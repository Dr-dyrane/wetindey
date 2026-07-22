"use server";

import {
  REFERENCE_CURRENCIES,
  isSupportedReferenceCurrencyCode,
  type SupportedReferenceCurrencyCode,
} from "@/app/_data/reference-currencies";
import {
  fetchNgnCatalogHistory,
  fetchNgnRateHistory,
  fetchNgnRates,
  type ReferenceCurrencyCatalogEntry,
  type ReferenceProvider,
  type ReferenceRate,
  type ReferenceRatePoint,
  type UpstreamRate,
} from "@/app/_actions/currency-provider";

export type {
  ReferenceCurrencyCatalogEntry,
  ReferenceProvider,
  ReferenceRate,
  ReferenceRatePoint,
} from "@/app/_actions/currency-provider";

import type { ReferenceCurrencyCode } from "@/app/_data/reference-currencies";

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
