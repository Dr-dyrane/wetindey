/**
 * User-facing copy for the Settings sheet lives in the shared, typed i18n
 * dictionary at src/core/i18n/strings.ts (the `settings.*` keys plus the
 * language, theme and radius labels), read through the `t` prop the view
 * receives. That is where translation, per-locale completeness and placeholder
 * parity are enforced.
 *
 * Nothing imports this module. It holds no strings of its own so the sheet
 * cannot drift a second, English-only copy of a label away from the live i18n
 * value. It is retained, emptied, only because the 6-file MVC slice contract
 * (scripts/modularization-structure-contract.test.ts) requires a copy.ts to be
 * present. Add strings to strings.ts, not here.
 */
export const copy = {} as const;
