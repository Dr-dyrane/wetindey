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
 *
 * WHAT THIS MODULE EXPORTS, AND WHY IT IS THREE THINGS
 * ----------------------------------------------------
 * `useT`, `useStrings`, `useLocaleControl`. That is the whole surface, and it is
 * every export with a live caller today.
 *
 * It used to be twenty-two, and knip was right to call the other nineteen dead.
 * They were not dead in the useful sense — `translate` and `coverage` and the
 * rest do real work and are called from inside this file — they were dead in the
 * sense that mattered: a module that publishes machinery nobody has asked for is
 * how this repo produced five generations of code with no call site. The
 * machinery stayed; the `export` in front of it went. Anything below that a sheet
 * genuinely needs comes back in the change that needs it, with the caller in the
 * same diff.
 */

import { useCallback, useEffect, useSyncExternalStore } from "react";
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

/* The key union, for modules that carry keys without rendering them. The one
   consumer today is locationStore.ts, which returns `titleKey`/`messageKey`
   instead of English sentences; the import there is type-only, so no runtime
   dependency on this module leaks into non-React callers. */
export type { StringKey } from "./strings";

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
type Vars<K extends StringKey> = PlaceholdersOf<(typeof en)[K]>;

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
function translate<K extends StringKey>(
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

function strings(locale: Locale): Readonly<Record<StringKey, string>> {
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
const LOCALE_STORAGE_KEY = "wetindey.locale";

let current: Locale = DEFAULT_LOCALE;
let hydrated = false;
const listeners = new Set<() => void>();

function readStored(): Locale {
  try {
    const raw = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    // `isShippable` as well as `isLocale`: "yoruba" is a real locale and may well
    // be sitting in a user's storage from before it was withheld. Hiding a button
    // does not un-choose it for the person who already chose it, which is why the
    // gate lives on the read and not on the picker.
    return isLocale(raw) && isShippable(raw) ? raw : DEFAULT_LOCALE;
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
    const next = isLocale(e.newValue) && isShippable(e.newValue) ? e.newValue : DEFAULT_LOCALE;
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

function setLocale(next: Locale): void {
  // The other door. A picker that still offers a withheld locale — SettingsSheet
  // hardcodes its three options and does not read this module — gets a no-op
  // rather than unreviewed copy. That is a visibly dead button until the picker
  // is fixed, and a dead button is the smaller harm by a wide margin: the thing
  // it used to do was rename the app in its own header.
  if (!isShippable(next) || next === current) return;
  current = next;
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
  } catch {
    // Preference does not persist. The session still switches — refusing to
    // change the language because we cannot remember the choice would be worse.
  }
  emit();
}

/* `getLocale()` lived here — "the current locale, for non-React callers", for the
   offline queue and event handlers this module's header anticipates. Nothing ever
   called it, in this file or out of it, and unlike the rest of what knip flagged
   there was no half-built consumer to finish. Deleted rather than kept: `current`
   is one line above, and the day a non-React caller exists it can have this back
   in the same change. */

/* ── Hooks ────────────────────────────────────────────────────────────────── */

/** The selected locale. Re-renders on change, from anywhere, with no provider. */
function useLocale(): Locale {
  const locale = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    const codeMap: Record<Locale, string> = {
      en: "en",
      pidgin: "pcm",
      yoruba: "yo",
    };
    document.documentElement.lang = codeMap[locale] || "en";
  }, [locale]);

  return locale;
}

/** `[locale, setLocale]`, for the picker in SettingsSheet. */
export function useLocaleControl(): readonly [Locale, (next: Locale) => void] {
  return [useLocale(), setLocale] as const;
}

/**
 * The locales a picker may offer, with the endonyms to label them.
 *
 * This exists because `setLocale` refuses a withheld locale (:234). A picker
 * that lists Yorùbá anyway renders a button that does nothing when tapped — and
 * a dead control is the one thing this codebase is least willing to ship:
 * `GetItSheet` says it outright, "a control that looks alive and does nothing is
 * worse than no control". The gate and the picker have to agree, and the gate
 * is the one that knows.
 *
 * So the picker reads its options from here rather than hardcoding them. It is
 * derived, not declared: open Yorùbá by getting it reviewed and the button
 * appears, with no second file to remember. Withholding a locale hides it —
 * never greys it out. A disabled option implies it might light up; this one
 * will not until a Yorùbá speaker reads 107 strings, which is not something the
 * user can do anything about, so we do not advertise the wait to them.
 *
 * The endonyms live here, next to the gate that decides whether they render.
 * They used to live in strings.ts with no caller — a fourth copy of the
 * picker's labels waiting to disagree with them. That comment said they come
 * back "in the change that makes SettingsSheet read it — with the caller, not
 * before it". This is that change.
 */
const LOCALE_ENDONYMS: Readonly<Record<Locale, string>> = {
  en: "English",
  pidgin: "Pidgin",
  yoruba: "Yorùbá",
};

export function shippableLocales(): ReadonlyArray<{ id: Locale; label: string }> {
  return LOCALES.filter(isShippable).map((id) => ({ id, label: LOCALE_ENDONYMS[id] }));
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

interface Coverage {
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
 * This asked, in its own docstring, to be used "in a script or a test before
 * anyone describes the language picker as done". It never was: there is no test
 * script and no test runner in package.json, so the harness it wanted did not
 * exist and the function sat with no caller for its whole life — the one piece of
 * machinery that would have made "Yorùbá is 35% translated and 0% reviewed"
 * impossible to miss, pointed at nothing.
 *
 * It is now the input to `isShippable` below, which is a better home than a test
 * anyway: a test tells a developer the picker is dishonest, and this stops the
 * picker being dishonest. A locale can be 100% "complete" and still entirely
 * unreviewed — exactly the state Yorùbá's inherited keys are in — so the two
 * figures stay separate here and neither one alone means shipped.
 */
function coverage(locale: Locale): Coverage {
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
 * May this app offer this language to a Lagos user?
 *
 * `NEEDS_NATIVE_REVIEW` records that a string RENDERS and that nobody who speaks
 * the language has read it. Until now that record did nothing but describe a
 * problem. strings.ts asked, in a comment, for a native speaker to pass over the
 * file "before the language picker is presented as a finished feature"; the
 * picker was presented anyway, and Yorùbá reached users with 54 of its 58
 * rendering strings unread — renaming the app to "Kilo n ṣẹlẹ" in its own header
 * and labelling a Done button "O ti tan", which is what this app says when food
 * is SOLD OUT. A comment asking people to be careful is worth what it costs.
 *
 * So: a locale is offered when a native speaker has cleared MORE of its rendering
 * copy than they have left flagged. Nothing else gates it — no boolean to flip,
 * no threshold in a doc, no reviewer's promise. The only way to open a language
 * is to review the language, and the day someone does, it opens on its own with
 * no code change. That is the property worth having; a flag would just be the
 * comment again, typed.
 *
 * A majority is a floor, not a certificate. It says most of what a user reads has
 * been vouched for, which is the least this app can say about a language it names
 * in a picker. Today: English passes (nothing flagged), Pidgin passes (138 of 161
 * cleared — written by someone who speaks it), Yorùbá is withheld (4 of 58, and
 * those four are "{km} km" and three map brand names, so not one Yorùbá SENTENCE
 * in this product has ever been read by a Yorùbá speaker).
 *
 * Withheld is not deleted. The table stays, `coverage()` still counts it, and the
 * work to open it is a review — not a rewrite, and not a machine translation,
 * which would fabricate a Yorùbá-shaped app that no Yorùbá speaker trusts and
 * would satisfy this gate while doing it.
 */
function isShippable(locale: Locale): boolean {
  const { translated, needsNativeReview } = coverage(locale);
  return translated - needsNativeReview.length > needsNativeReview.length;
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
function checkPlaceholderParity(): string[] {
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

  // The gate coerces anything it withholds to DEFAULT_LOCALE, so a DEFAULT_LOCALE
  // that is itself withheld would coerce to itself and hand every user in Lagos
  // the exact copy this file refuses to show them. Unreachable today — English is
  // the source of truth and has nothing to review — and it stays that way only as
  // long as someone checks.
  if (!isShippable(DEFAULT_LOCALE)) {
    throw new Error(
      `i18n: DEFAULT_LOCALE "${DEFAULT_LOCALE}" is withheld by isShippable(), so ` +
        `there is no locale left to fall back to. Review its copy or change it.`,
    );
  }
}
