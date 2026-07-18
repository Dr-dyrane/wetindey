"use server";

const CBN_REFERENCE_CURRENCIES = ["USD", "GBP", "EUR"] as const;
export type CbnReferenceCurrency = (typeof CBN_REFERENCE_CURRENCIES)[number];

export interface CbnReferenceRate {
  base: CbnReferenceCurrency;
  quote: "NGN";
  rate: number;
  publishedDate: string;
  provider: "CBN";
}

function isSupportedCurrency(value: string): value is CbnReferenceCurrency {
  return CBN_REFERENCE_CURRENCIES.some((currency) => currency === value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isIsoCalendarDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function parseRatePayload(value: unknown, requested: CbnReferenceCurrency): CbnReferenceRate {
  if (
    !isRecord(value) ||
    value.base !== requested ||
    value.quote !== "NGN" ||
    typeof value.rate !== "number" ||
    !Number.isFinite(value.rate) ||
    value.rate <= 0 ||
    !isIsoCalendarDate(value.date)
  ) {
    throw new Error("The CBN reference-rate response was invalid.");
  }

  return {
    base: requested,
    quote: "NGN",
    rate: value.rate,
    publishedDate: value.date,
    provider: "CBN",
  };
}

/**
 * A fixed-pair server request. The amount being converted never reaches this
 * action or Frankfurter; multiplication stays in the browser.
 */
export async function getCbnReferenceRate(currency: string): Promise<CbnReferenceRate> {
  if (!isSupportedCurrency(currency)) {
    throw new Error("Unsupported reference currency.");
  }

  const response = await fetch(
    `https://api.frankfurter.dev/v2/rate/${currency}/NGN?providers=CBN`,
    {
      headers: { Accept: "application/json" },
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(8_000),
    }
  );

  if (!response.ok) {
    throw new Error("The latest CBN reference rate is unavailable.");
  }

  return parseRatePayload(await response.json(), currency);
}
