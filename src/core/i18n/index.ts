"use client";

/**
 * The i18n surface. Import from `@/core/i18n` and nothing else.
 *
 * WHAT THIS REPLACES
 * ------------------
 * `page.tsx:87` held a `TRANSLATIONS` literal and `page.tsx:225` held the
 * selected language in a plain `useState`. Both facts were private to that one
 * component, so every sheet built afterwards had exactly two options: take a
 * `t` prop threaded down from the map page (SettingsSheet, ReportPriceSheet
 * did), or hardcode English (everything else did). ConfirmVisitSheet took a
 * third option and forked the dictionary.
 *
 * So the language lives in a module store here, not in a component. Any sheet,
 * at any depth, calls `useT()`. Nothing is threaded, no provider is mounted,
 * and no one needs to open the 1018-line map page to add a word.
 *
 * WHY NO CONTEXT PROVIDER
 * -----------------------
 * A provider would have to be mounted in the shell — layout.tsx / AdaptiveShell
 * — which is a file this module has no business editing, and it would make
 * every consumer's correctness depend on a mount someone can delete. A module
 * store with `useSyncExternalStore` has neither problem: importing the hook is
 * the whole wiring. It is also SSR-correct by construction, because
 * `getServerSnapshot` pins the server and the hydration pass to the same value
 * before the client's stored preference is read.
 *
 * WHY `t` IS NOT ALLOWED TO INVENT ANYTHING
 * -----------------------------------------
 * `t(key)` cannot be called with a key that does not exist, and a locale cannot
 * omit a key — `StringKey` is derived from the English table and every locale
 * is mapped over it. The one fallback in this file (`UNTRANSLATED` → English)
 * is declared per key in strings.ts by a human, is countable via `coverage()`,
 * and is the honest answer to "we do not have this in Yorùbá yet".
 *
 * There is no fallback for a missing key, because there cannot be one.
 */

import { useCallback, useSyncExternalStore } from "react";
import {
  DEFAULT_LOCALE,
  LOCALES,
  NEEDS_NATIVE_REVIEW,
  TABLES,
  UNTRANSLATED,
  en,
  isLocale,
  type Locale,
  type StringKey,
} from "./strings";

export {
  DEFAULT_LOCALE,
  LOCALES,
  LOCALE_NAMES,
  NEEDS_NATIVE_REVIEW,
  UNTRANSLATED,
  isLocale,
  type Locale,
  type LocaleTable,
  type StringKey,
  type Untranslated,
} from "./strings";

/* ── Typed interpolation ──────────────────────────────────────────────────── */

/**
 * Pulls `{place}` out of the English literal at the type level, so
 * `t("confirm.at")` is a compile error and `t("confirm.at", { place })` is not.
 *
 * This only works because `en` is declared `as const`. If someone drops that
 * assertion, this degrades to `never` for every key and silently stops checking
 * anything — which is why strings.ts says so at the declaration.
 */
type PlaceholdersOf<S extends string> = S extends `${string}{${infer V}}${infer Rest}`
  ? V | PlaceholdersOf<Rest>
  : never;

/** The named holes in a key's copy. `never` when the copy is a plain sentence. */
export type Vars<K extends StringKey> = PlaceholdersOf<(typeof en)[K]>;

/**
 * No holes → no second argument, and passing one is an error.
 * Holes → the exact set is required, and a typo in a name is an error.
 */
type TArgs<K extends StringKey> = [Vars<K>] extends [never]
  ? []
  : [vars: Record<Vars<K>, string | number>];

const PLACEHOLDER = /\{(\w+)\}/g;

function interpolate(text: string, vars: Record<string, string | number>): string {
  return text.replace(PLACEHOLDER, (whole, name: string) =>
    // Types make an absent key unreachable from application code; a translation
    // whose placeholders drift from English is the real risk, and it is caught
    // by `checkPlaceholderParity()` below rather than papered over here.
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : whole,
  );
}

/* ── The selector ─────────────────────────────────────────────────────────── */

/**
 * Pure. Safe on the server, in event handlers, in the offline queue — anywhere.
 *
 * `UNTRANSLATED` resolves to English. That is the only substitution this
 * function makes, and strings.ts had to ask for it by name.
 */
export function translate<K extends StringKey>(
  locale: Locale,
  key: K,
  ...args: TArgs<K>
): string {
  const raw = TABLES[locale][key];
  const text: string = typeof raw === "string" ? raw : en[key];
  const vars = args[0] as Record<string, string | number> | undefined;
  return vars ? interpolate(text, vars) : text;
}

/**
 * A whole locale, flattened and resolved, as `Record<StringKey, string>`.
 *
 * This exists for the components that still take a `t` object as a prop
 * (SettingsSheet, ReportPriceSheet) so they keep working untouched during the
 * swap. New code should use `useT()` and leave the prop alone — a dictionary
 * passed as a prop is how the old one became impossible to extend.
 *
 * Parameterised keys come back with their `{braces}` intact; only `t()` fills
 * those. Memoised per locale: the tables are immutable, so the result is too.
 */
const resolved = new Map<Locale, Readonly<Record<StringKey, string>>>();

export function strings(locale: Locale): Readonly<Record<StringKey, string>> {
  const hit = resolved.get(locale);
  if (hit) return hit;

  const table = TABLES[locale];
  const out = {} as Record<StringKey, string>;
  for (const key of Object.keys(en) as StringKey[]) {
    const raw = table[key];
    out[key] = typeof raw === "string" ? raw : en[key];
  }

  const frozen = Object.freeze(out);
  resolved.set(locale, frozen);
  return frozen;
}

/* ── The store ────────────────────────────────────────────────────────────── */

/**
 * `localStorage`, not a cookie: the language is a device preference with no
 * server behaviour hanging off it, and a cookie would push it into every
 * request for nothing. The read is guarded because this module is imported by
 * server components too.
 */
export const LOCALE_STORAGE_KEY = "wetindey.locale";

let current: Locale = DEFAULT_LOCALE;
let hydrated = false;
const listeners = new Set<() => void>();

function readStored(): Locale {
  try {
    const raw = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    return isLocale(raw) ? raw : DEFAULT_LOCALE;
  } catch {
    // Private mode, disabled storage, a sandboxed iframe. A missing preference
    // is not an error worth surfacing — English is a real answer, not a guess.
    return DEFAULT_LOCALE;
  }
}

function emit(): void {
  for (const l of listeners) l();
}

function subscribe(onChange: () => void): () => void {
  if (!hydrated) {
    hydrated = true;
    const stored = readStored();
    if (stored !== current) {
      current = stored;
      // Anyone already subscribed rendered against the server snapshot and has
      // to be told; the caller is about to be told by returning.
      emit();
    }
  }

  listeners.add(onChange);

  // A second tab is the same person with the same preference.
  const onStorage = (e: StorageEvent) => {
    if (e.key !== LOCALE_STORAGE_KEY) return;
    const next = isLocale(e.newValue) ? e.newValue : DEFAULT_LOCALE;
    if (next === current) return;
    current = next;
    emit();
  };
  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

const getSnapshot = (): Locale => current;

/**
 * The server, and the client's hydration pass, both render English.
 *
 * That is deliberate. Reading `localStorage` during hydration would render a
 * different tree than the server sent, and React would discard it — the
 * language would flicker or, worse, stick. Theme gets away with resolving
 * pre-paint in a blocking `<head>` script because it is one class on `<html>`;
 * copy is the tree itself and cannot be. The stored locale lands on the first
 * effect instead, one frame later.
 */
const getServerSnapshot = (): Locale => DEFAULT_LOCALE;

export function setLocale(next: Locale): void {
  if (next === current) return;
  current = next;
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
  } catch {
    // Preference does not persist. The session still switches — refusing to
    // change the language because we cannot remember the choice would be worse.
  }
  emit();
}

/** The current locale, for non-React callers. */
export function getLocale(): Locale {
  return current;
}

/* ── Hooks ────────────────────────────────────────────────────────────────── */

/** The selected locale. Re-renders on change, from anywhere, with no provider. */
export function useLocale(): Locale {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** `[locale, setLocale]`, for the picker in SettingsSheet. */
export function useLocaleControl(): readonly [Locale, (next: Locale) => void] {
  return [useLocale(), setLocale] as const;
}

/**
 * The one import a component needs.
 *
 *   const t = useT();
 *   <h2>{t("get.title")}</h2>
 *   <p>{t("confirm.at", { place: offer.placeName })}</p>
 *
 * A key that does not exist is a compile error. A locale that is missing that
 * key is a compile error in strings.ts. A missing `{place}` is a compile error
 * here. None of the three can reach a user.
 */
export function useT(): <K extends StringKey>(key: K, ...args: TArgs<K>) => string {
  const locale = useLocale();
  return useCallback(
    <K extends StringKey>(key: K, ...args: TArgs<K>) => translate(locale, key, ...args),
    [locale],
  );
}

/**
 * The flattened dictionary for the current locale.
 *
 * Only for the two components that take `t` as a prop today. `useT()` is the
 * one to reach for otherwise — it gives you interpolation and it does not
 * re-render a component for a string it never reads.
 */
export function useStrings(): Readonly<Record<StringKey, string>> {
  return strings(useLocale());
}

/* ── What is actually outstanding ─────────────────────────────────────────── */

export interface Coverage {
  locale: Locale;
  total: number;
  /** Keys with a vouched-for string in this locale. */
  translated: number;
  /** Keys explicitly marked `UNTRANSLATED` — these render English, knowingly. */
  untranslated: StringKey[];
  /** Keys that render this locale but which no native speaker has signed off. */
  needsNativeReview: StringKey[];
  /** Share of keys a user of this locale actually sees in their language. */
  percent: number;
}

/**
 * The honest number, computed rather than claimed.
 *
 * Use it in a script or a test before anyone describes the language picker as
 * done. A locale can be 100% "complete" and still be entirely unreviewed —
 * which is exactly the state Yorùbá's inherited keys are in — so the two
 * figures are reported separately and neither one alone means shipped.
 */
export function coverage(locale: Locale): Coverage {
  const keys = Object.keys(en) as StringKey[];
  const table = TABLES[locale];
  const untranslated = keys.filter((k) => table[k] === UNTRANSLATED);
  const translated = keys.length - untranslated.length;

  return {
    locale,
    total: keys.length,
    translated,
    untranslated,
    needsNativeReview:
      locale === "en" ? [] : [...NEEDS_NATIVE_REVIEW[locale as Exclude<Locale, "en">]],
    percent: Math.round((translated / keys.length) * 100),
  };
}

/**
 * Does every translation carry the same `{holes}` as the English it replaces?
 *
 * The type system guarantees the CALLER passes the right variables, because it
 * reads them off English. It cannot guarantee a translator kept them: write
 * `"Ní {ibi}"` for `"At {place}"` and the types stay green while the sheet
 * renders the word "{ibi}" to a user in Festac.
 *
 * So this is checked, not assumed. It runs at import in development and throws,
 * because a translation that is quietly wrong is the failure mode this whole
 * module exists to prevent — the same reason `geographyPoint.fromDriver` throws
 * instead of returning a plausible point. It does not run in production: a
 * broken placeholder should cost a developer a stack trace on day one, not cost
 * a Lagos user their entire app on day ninety.
 */
export function checkPlaceholderParity(): string[] {
  const holes = (s: string): string[] => (s.match(PLACEHOLDER) ?? []).slice().sort();
  const problems: string[] = [];

  for (const locale of LOCALES) {
    if (locale === "en") continue;
    const table = TABLES[locale];
    for (const key of Object.keys(en) as StringKey[]) {
      const raw = table[key];
      if (typeof raw !== "string") continue;
      const want = holes(en[key]).join(",");
      const got = holes(raw).join(",");
      if (want !== got) {
        problems.push(
          `${locale}.${String(key)}: expected placeholders [${want}], found [${got}]`,
        );
      }
    }
  }

  return problems;
}

if (process.env.NODE_ENV !== "production") {
  const problems = checkPlaceholderParity();
  if (problems.length > 0) {
    throw new Error(
      `i18n: translations disagree with English about their placeholders. ` +
        `A user would see the literal brace text.\n  ${problems.join("\n  ")}`,
    );
  }
}
