import { REFERENCE_CURRENCY_META, type ReferenceCurrencyCode } from "../imports/imports";

export interface UseCurrencyFlagProps {
  code: ReferenceCurrencyCode | "NGN" | string;
}

export function useCurrencyFlag({ code }: UseCurrencyFlagProps) {
  const symbol =
    code === "NGN"
      ? "ng"
      : code in REFERENCE_CURRENCY_META
        ? REFERENCE_CURRENCY_META[code as ReferenceCurrencyCode].flag
        : "neutral";

  return {
    symbol,
  };
}
