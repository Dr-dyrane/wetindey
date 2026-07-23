/**
 * User-facing copy for the Get-it sheet now lives in the shared, typed i18n
 * dictionary at src/core/i18n/strings.ts (the `get.*` keys), read via `useT()`
 * in the views. That is where translation, per-locale completeness and
 * placeholder parity are enforced.
 *
 * Nothing imports this module. It once held a private, English-only record whose
 * title had already drifted from what the sheet actually rendered (a longer
 * "Market Directions" heading versus the live "Get it"), the exact fork the i18n
 * merge exists to end. It is retained, emptied, only because the 6-file MVC slice
 * contract (scripts/modularization-structure-contract.test.ts) requires a copy.ts
 * to be present. Add strings to strings.ts, not here.
 */
export const copy = {} as const;
