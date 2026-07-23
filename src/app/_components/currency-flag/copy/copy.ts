/**
 * CurrencyFlag renders no user-facing copy of its own. It is a purely visual,
 * aria-hidden glyph: the only text-like input is the `symbol` prop, which selects
 * an SVG sprite id (`#flag-<symbol>`), not a translatable string. Any label a
 * caller wants read out belongs on the surrounding control, and shared wording
 * lives in the typed i18n dictionary at src/core/i18n/strings.ts, read via
 * `useT()`, where translation and placeholder parity are enforced.
 *
 * Nothing imports this module. It is retained, emptied, only because the 6-file
 * MVC slice contract (scripts/modularization-structure-contract.test.ts) requires
 * a copy.ts to be present. Add strings to strings.ts, not here.
 */
export const copy = {} as const;
