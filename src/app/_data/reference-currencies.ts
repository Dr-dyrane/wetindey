export const REFERENCE_CURRENCIES = [
  "USD",
  "GBP",
  "EUR",
  "CAD",
  "AUD",
  "GHS",
  "KES",
  "ZAR",
  "AED",
  "CNY",
  "INR",
  "BRL",
  "CHF",
  "JPY",
  "SAR",
] as const;

export type ReferenceCurrencyCode = (typeof REFERENCE_CURRENCIES)[number];
export type SupportedReferenceCurrencyCode = ReferenceCurrencyCode | "NGN";

export interface ReferenceCurrencyMeta {
  code: SupportedReferenceCurrencyCode;
  name: string;
  symbol: string;
  flag: string;
  searchAliases: readonly string[];
}

export const POPULAR_REFERENCE_CURRENCIES = ["USD", "GBP", "EUR", "CAD", "AUD"] as const;

export const REFERENCE_CURRENCY_META: Record<ReferenceCurrencyCode, ReferenceCurrencyMeta> = {
  USD: {
    code: "USD",
    name: "US dollar",
    symbol: "$",
    flag: "us",
    searchAliases: ["United States", "America", "dollar"],
  },
  GBP: {
    code: "GBP",
    name: "British pound",
    symbol: "£",
    flag: "gb",
    searchAliases: ["United Kingdom", "Britain", "sterling", "pound"],
  },
  EUR: {
    code: "EUR",
    name: "Euro",
    symbol: "€",
    flag: "eu",
    searchAliases: ["European Union", "Europe"],
  },
  CAD: {
    code: "CAD",
    name: "Canadian dollar",
    symbol: "C$",
    flag: "ca",
    searchAliases: ["Canada", "dollar"],
  },
  AUD: {
    code: "AUD",
    name: "Australian dollar",
    symbol: "A$",
    flag: "au",
    searchAliases: ["Australia", "dollar"],
  },
  GHS: {
    code: "GHS",
    name: "Ghanaian cedi",
    symbol: "GH₵",
    flag: "gh",
    searchAliases: ["Ghana", "cedi"],
  },
  KES: {
    code: "KES",
    name: "Kenyan shilling",
    symbol: "KSh",
    flag: "ke",
    searchAliases: ["Kenya", "shilling"],
  },
  ZAR: {
    code: "ZAR",
    name: "South African rand",
    symbol: "R",
    flag: "za",
    searchAliases: ["South Africa", "rand"],
  },
  AED: {
    code: "AED",
    name: "UAE dirham",
    symbol: "د.إ",
    flag: "ae",
    searchAliases: ["United Arab Emirates", "Emirates", "Dubai", "dirham"],
  },
  CNY: {
    code: "CNY",
    name: "Chinese yuan",
    symbol: "¥",
    flag: "cn",
    searchAliases: ["China", "yuan", "renminbi"],
  },
  INR: {
    code: "INR",
    name: "Indian rupee",
    symbol: "₹",
    flag: "in",
    searchAliases: ["India", "rupee"],
  },
  BRL: {
    code: "BRL",
    name: "Brazilian real",
    symbol: "R$",
    flag: "br",
    searchAliases: ["Brazil", "real"],
  },
  CHF: {
    code: "CHF",
    name: "Swiss franc",
    symbol: "CHF",
    flag: "ch",
    searchAliases: ["Switzerland", "Swiss", "franc"],
  },
  JPY: {
    code: "JPY",
    name: "Japanese yen",
    symbol: "¥",
    flag: "jp",
    searchAliases: ["Japan", "yen"],
  },
  SAR: {
    code: "SAR",
    name: "Saudi riyal",
    symbol: "SAR",
    flag: "sa",
    searchAliases: ["Saudi Arabia", "Saudi", "riyal"],
  },
};

export const SUPPORTED_REFERENCE_CURRENCY_META: Record<
  SupportedReferenceCurrencyCode,
  ReferenceCurrencyMeta
> = {
  NGN: {
    code: "NGN",
    name: "Nigerian naira",
    symbol: "₦",
    flag: "ng",
    searchAliases: ["Nigeria", "naira"],
  },
  ...REFERENCE_CURRENCY_META,
};

export function isReferenceCurrencyCode(value: string): value is ReferenceCurrencyCode {
  return REFERENCE_CURRENCIES.some((currency) => currency === value);
}

export function isSupportedReferenceCurrencyCode(
  value: string
): value is SupportedReferenceCurrencyCode {
  return value === "NGN" || isReferenceCurrencyCode(value);
}
