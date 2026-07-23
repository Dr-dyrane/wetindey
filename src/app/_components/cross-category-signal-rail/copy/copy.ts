/**
 * User-facing copy for the cross-category signal rail does not live here. The
 * rail renders whatever each signal carries: its code, amount, trend text and
 * accessible label all arrive fully-formed as props (the `signals` array on
 * CrossCategorySignalRailProps), assembled upstream where the live market and
 * currency data is shaped. Any shared, translatable strings belong in the typed
 * i18n dictionary at src/core/i18n/strings.ts, read via `useT()`.
 *
 * Nothing imports this module. It is retained, emptied, only because the 6-file
 * MVC slice contract (scripts/modularization-structure-contract.test.ts)
 * requires a copy.ts to be present in every modularized component. Add strings
 * to the props pipeline or to strings.ts, not here.
 */
export const copy = {} as const;
