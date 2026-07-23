/**
 * User-facing copy for the Report-price sheet lives in the shared, typed i18n
 * dictionary at src/core/i18n/strings.ts (the `report.*` and `contribution.*`
 * keys) and reaches the views as the `t` prop (a Record<string, string>). That
 * is where translation, per-locale completeness and placeholder parity are
 * enforced.
 *
 * Nothing imports this module. It holds no private, English-only record: every
 * label the sheet renders is resolved from `t`, so a second source of truth
 * here would only drift. It is retained, emptied, only because the 6-file MVC
 * slice contract (scripts/modularization-structure-contract.test.ts) requires a
 * copy.ts to be present. Add strings to strings.ts, not here.
 */
export const copy = {} as const;
