/**
 * User-facing copy for the category selector sheet lives in the shared, typed
 * i18n dictionary at src/core/i18n/strings.ts (the `category_*` and
 * `select_category` keys), reaching the view through the `t` prop. That is
 * where translation, per-locale completeness and placeholder parity are
 * enforced.
 *
 * Nothing imports this module. It is retained, emptied, only because the 6-file
 * MVC slice contract (scripts/modularization-structure-contract.test.ts)
 * requires a copy.ts to be present in every modularized component. Add strings
 * to strings.ts, not here, so the sheet never grows a second English-only copy
 * of text the i18n merge already owns. Same rationale as the get-it-sheet
 * copy.ts precedent.
 */
export const copy = {} as const;
