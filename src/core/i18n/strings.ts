/**
 * WetinDey copy, in one place.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * The dictionary used to live inline in `src/app/page.tsx` (a 1018-line
 * component) as a literal object of 34 keys. Two consequences, both observed:
 *
 *   1. No component could add a key without editing page.tsx, so every sheet
 *      built after it — GetItSheet, ItemDetailSheet, LocationSheet,
 *      AreaPickerSheet, ProfileSheet — is hardcoded English regardless of the
 *      language the user picked. Selecting Yorùbá today changes the map header
 *      and leaves the entire "Get it" flow in English.
 *   2. It forked. `ConfirmVisitSheet.tsx:185` carries its OWN `COPY` record in
 *      the same three languages. Its Yorùbá is markedly better than page.tsx's
 *      (properly toned: "Ṣé ó wà níbẹ̀?"). Two dictionaries, one product.
 *
 * This file is the merge. `ConfirmVisitSheet`'s strings are reproduced verbatim
 * under `confirm.*` rather than re-translated — it is the better of the two
 * sources and re-doing it would be exactly the third copy this codebase does
 * not need.
 *
 * HOW COMPLETENESS IS ENFORCED
 * ----------------------------
 * `en` is the source of truth. `StringKey` is derived from it, and every other
 * locale is typed `LocaleTable` — a mapped type over the full key union. Adding
 * a key to `en` breaks the build in `pidgin` and `yoruba` until each one is
 * answered. There is no runtime "fall back to English if the key is missing",
 * because that is precisely how a dictionary rots invisibly.
 *
 * A locale answers a key in one of two ways, and both are deliberate:
 *   - a string: this is the vouched-for copy;
 *   - `UNTRANSLATED`: no vouched translation exists, show English.
 *
 * `UNTRANSLATED` is a `unique symbol`, not a sentinel string, for two reasons.
 * It can never be confused with real copy, and if the resolver is ever bypassed
 * React throws on a symbol child instead of rendering something plausible. Same
 * principle as `geographyPoint.fromDriver`: an exception on day one beats a
 * plausible wrong answer that hides for months.
 *
 * ON THE TRANSLATIONS THEMSELVES — READ THIS BEFORE SHIPPING
 * ---------------------------------------------------------
 * This product's subject is trust. Clumsy Yorùbá in a Lagos app is not a
 * cosmetic defect; it is the app telling a user it does not really know them.
 * So nothing here is invented to look complete:
 *
 *   - Every Yorùbá string inherited from page.tsx reads machine-translated and
 *     is largely untoned. Yorùbá is a tonal language written with diacritics;
 *     "Eto" and "Ẹ̀tọ́" are different words. Every one of those keys is listed in
 *     `NEEDS_NATIVE_REVIEW.yoruba` below.
 *   - Every NEW key is `UNTRANSLATED` in Yorùbá. English shows through, on
 *     purpose. Fluent-looking fabricated Yorùbá would be worse than English,
 *     because a user cannot tell invented copy from careless copy — they can
 *     only conclude the app is not for them.
 *   - Nigerian Pidgin is written for new keys where the register is
 *     unambiguous. Where it is not, the key is `UNTRANSLATED` rather than
 *     guessed. Pidgin has a register: too-heavy reads as mockery, too-light
 *     reads as English with a costume on.
 *
 * A native Yorùbá speaker and a Pidgin speaker must pass over this file before
 * the language picker is presented as a finished feature.
 *
 * That sentence has been in this file since it was written, and the picker
 * shipped anyway — which is what a comment asking people to be careful is worth.
 * So `NEEDS_NATIVE_REVIEW` at the bottom is now load-bearing: `./index.ts`
 * refuses to let the store hold a locale whose copy is mostly unread by someone
 * who speaks it. Today that offers English and Pidgin and withholds Yorùbá. The
 * list is the gate, not a note about the gate — clearing an entry here is the
 * only thing that opens a language, and clearing one you have not actually read
 * is now indistinguishable from shipping it.
 */

/* ── Locales ──────────────────────────────────────────────────────────────── */

export const LOCALES = ["en", "pidgin", "yoruba"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

/* `LOCALE_NAMES` — the endonyms {en: "English", pidgin: "Pidgin", yoruba:
   "Yorùbá"} — used to live here and had no caller. SettingsSheet.tsx:74-76
   hardcodes those exact three literals instead, so this was not a dictionary the
   picker read; it was a fourth copy of the picker's labels, waiting to disagree
   with them. AGENTS.md §0 is unambiguous, so it is deleted rather than kept warm
   for a call site that has never arrived. It comes back in the change that makes
   SettingsSheet read it — with the caller, not before it. */

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/**
 * "This locale has no vouched translation for this key — show English."
 *
 * A declared, greppable, countable decision. Not a silent runtime fallback:
 * the key still has to be present, so a NEW key cannot slip through as English
 * without someone typing this word next to it.
 */
export const UNTRANSLATED: unique symbol = Symbol("i18n.untranslated");
type Untranslated = typeof UNTRANSLATED;

/* ── English — the source of truth ────────────────────────────────────────── */

/**
 * `as const` is load-bearing twice over: it produces the `StringKey` union, and
 * it lets `./index.ts` read the `{placeholders}` out of each literal to type the
 * interpolation arguments. Removing it silently degrades `t()` to `t(key, any)`.
 */
export const en = {
  /* Shell — keys 1:1 with the old page.tsx dictionary. Names unchanged so the
     swap at page.tsx:87 is a deletion, not a rewrite. */
  wetin_dey: "WetinDey",
  search_placeholder: "Wetin you dey find?",
  popular_items: "Popular items around",
  settings: "Settings",
  theme: "Interface Theme",
  radius: "Geospatial Search Radius",
  pilot_areas: "Lagos Pilot Areas",
  report_price: "Report Food Price",
  done: "Done",
  submit: "Submit Report",
  price_paid: "Price Paid (₦)",
  market: "Select Market",
  item: "Select Food Item",
  variant: "Select Quality/Type",
  unit: "Select Packaging",
  availability: "Is it available?",
  available: "Yes, available",
  unavailable: "No, out of stock",
  success_msg: "Report saved successfully!",
  offline_msg: "Saved offline. Will sync when back online!",
  no_results: "No items found",
  locations_found: "locations found",
  reported_price: "Reported Price",
  freshness: "Freshness Status",
  data_confidence: "Data Confidence",
  data_source: "Data Source",
  directions: "Directions",
  share: "Share",
  clear_search: "Clear Search",
  confirmed: "Confirmed Available",
  caution: "Likely Available",
  language: "App Language",
  light_mode: "Light Mode",
  dark_mode: "Dark Mode",

  /* Settings — SettingsSheet.tsx:107,115 are hardcoded English today. */
  "settings.radius_label": "Search radius",
  "settings.radius_a11y": "Search radius in kilometres",
  "settings.radius_value": "{km} km",

  /* Profile — ProfileSheet.tsx. No line numbers: they rot, and a comment that
     points at the wrong line is worse than no comment.

     `profile.reports_one` / `profile.reports_other` used to live here. They were
     deleted, not disabled: `reportCount` was never once supplied — page.tsx
     builds `sessionUser` as `{ name, email }` — so the pluralisation resolved to
     "0 prices reported" for every signed-in user, including one who had reported
     twenty. Keeping the keys would have kept `coverage()` counting Pidgin nobody
     could ever read. The Pidgin is in git when the count is real. */
  "profile.title_signed_in": "Account",
  "profile.title_signed_out": "You",
  "profile.signed_out_name": "Sign in to see WetinDey",
  "profile.my_reports": "My reports",
  "profile.saved_markets": "Saved markets",
  "profile.change_area": "Change area",
  "profile.settings": "Settings",
  "profile.report_problem": "Report a problem",
  "profile.about": "About WetinDey",

  /* Sign in — ProfileSheet.tsx.
   *
   * There is no sign-up copy here because there is no sign-up step:
   * `signIn.emailOtp` creates the user if the email is unknown. Nothing in this
   * block may say "create an account" or "register".
   *
   * WHY THE ERROR KEYS EXIST. better-auth populates `error.message` itself, and
   * its words are "Invalid OTP", "OTP expired", "Too many attempts", "Too many
   * requests" — another codebase's acronyms, English-only, untranslatable
   * because they never pass through `t()`. Rendering them shipped a developer's
   * voice to Lagos. These are keyed off `error.code` and `error.status` instead,
   * which is why there are nine of them: each one is a different thing to DO. */
  "auth.sign_in": "Sign in",
  "auth.sign_out": "Sign out",
  "auth.email_label": "Your email",
  "auth.send_code": "Send code",
  "auth.check_mail": "Check your mail",
  "auth.sent_to": "Sent to {email}",
  "auth.code_label": "6-digit code",
  "auth.resend": "Resend code",
  "auth.resend_in": "Resend in {seconds}s",
  "auth.different_email": "Use a different email",
  "auth.retry": "Try again",
  "auth.err_send": "That didn't send. Try again.",
  "auth.err_send_network": "That didn't send. Check your network.",
  "auth.err_email_invalid": "That email doesn't look right.",
  // The rate limiter is 3 sends per 60s. "Wait a minute" is the only part of
  // that a user can act on, so it is the only part that is said.
  "auth.err_rate_limited": "Too many tries. Wait a minute.",
  "auth.err_code_wrong": "That code isn't right.",
  // Expired and attempts-exhausted share a remedy but not a cause, and the cause
  // is what tells someone whether they mistyped or simply took too long.
  "auth.err_code_expired": "That code has expired. Get a new one.",
  "auth.err_code_attempts": "Too many tries. Get a new code.",
  "auth.err_code_network": "We couldn't check that code. Check your network.",
  "auth.err_code": "That code didn't work.",
  "auth.err_sign_out": "That didn't work. Try again.",

  /* Geolocation problem titles. Shared verbatim between AreaPickerSheet and
     LocationSheet; only the remedy (the body) differs, so only the body forks.
     These stay five distinct titles, never collapsed into "Couldn't get your
     location" — five causes with five different fixes. */
  "geo.err_insecure_title": "Location needs a secure connection",
  "geo.err_unsupported_title": "This browser can't share location",
  "geo.err_denied_title": "Location is blocked",
  "geo.err_unavailable_title": "Your device couldn't get a fix",
  "geo.err_timeout_title": "Finding you took too long",
  "geo.err_unknown_title": "Location didn't work",

  /* Area picker — AreaPickerSheet.tsx:117-227. Remedy is "pick an area below". */
  "area.title": "Choose area",
  "area.use_my_location": "Use my location",
  "area.locating": "Finding you…",
  "area.privacy_footer":
    "We only use your location to pick the nearest area. It never leaves your device.",
  "area.areas_we_cover": "Areas we cover",
  "area.no_places": "No places yet",
  "area.places_one": "1 place",
  "area.places_other": "{count} places",
  "area.err_insecure_body":
    "Your browser only shares location over https. Open WetinDey on the secure address, or pick an area below.",
  "area.err_unsupported_body":
    "It doesn't support location at all. Pick an area from the list below instead.",
  "area.err_denied_body":
    "WetinDey doesn't have permission to see where you are. Allow location for this site in your browser settings, or pick an area below.",
  "area.err_unavailable_body":
    "Location is allowed, but no position came back — this is common indoors. Try again near a window or outside, or pick an area below.",
  "area.err_timeout_body":
    "The location request timed out before your device answered. Try again, or pick an area below.",
  "area.err_unknown_body":
    "Your browser refused the request without saying why. Pick an area below instead.",

  /* Location sheet — LocationSheet.tsx:204-512. Remedy is "simulate above". */
  "location.title": "Where are you?",
  "location.no_areas": "No areas are set up yet",
  "location.coverage_unreachable":
    "That coordinate is fine, but we couldn't reach the price data to check it. Check your network and try again.",
  "location.err_insecure_body":
    "Your browser only shares location over https. Open WetinDey on the secure address, or simulate a position above.",
  "location.err_unsupported_body":
    "It doesn't support location at all. Simulate a position above instead.",
  "location.err_denied_body":
    "WetinDey doesn't have permission to see where you are. Allow location for this site in your browser settings, or simulate a position above.",
  "location.err_unavailable_body":
    "Location is allowed, but no position came back — this is common indoors. Try again near a window or outside, or simulate a position above.",
  "location.err_timeout_body":
    "The location request timed out before your device answered. Try again, or simulate a position above.",
  "location.err_unknown_body":
    "Your browser refused the request without saying why. Simulate a position above instead.",

  /* Item detail — ItemDetailSheet.tsx:143-500, hardcoded English today. */
  "item.title_fallback": "Prices",
  "item.choose": "Choose",
  "item.choose_type": "Choose type",
  "item.choose_size": "Choose size",
  "item.any_type": "Any type",
  "item.any_size": "Any size",
  "item.nothing_nearby": "Nothing nearby",
  "item.none_nearby": "None nearby",
  "item.sort_nearest": "Nearest",
  "item.sort_cheapest": "Cheapest",
  "item.sort_freshest": "Freshest",
  "item.checking_prices": "Checking prices…",
  "item.count_within": "{count} within {km} km",
  "item.network_hint": "Check your network and try again.",
  "item.empty_title": "Nothing within {km} km",
  "item.empty_body":
    "No one has reported {item} near {area} yet. Widen the radius in Settings, or report a price you have seen.",
  "item.chip_cheapest": "Cheapest",
  "item.chip_closest": "Closest",
  "item.confidence_high": "High",
  "item.confidence_medium": "Medium",
  "item.confidence_low": "Low",
  "item.a11y_available": "Available",
  "item.a11y_not_available": "Not available",

  /*
   * The status badge — the highest-frequency copy in the product, on every card
   * and every offer row. It lived as a hardcoded `Record` in ItemCard.tsx and
   * ItemDetailSheet.tsx, which is why no locale ever reached it: three languages
   * shipped and the most-seen string in the app answered to none of them.
   *
   * These are NOT `item.a11y_*`. Those describe availability for a screen
   * reader ("Available" / "Not available"). These are the visible verdict, and
   * the verdict is freshness AND availability at once — "Check again" is not a
   * claim about stock, it is an instruction about age.
   *
   * The English is taken verbatim from the card, not from this file's older
   * `freshness`/`data_confidence` wording, because the code is the truth and the
   * card is better: "Confirmed" beats "Confirmed Available", and "Check again"
   * tells a shopper what to DO where "Likely Available" only hedges.
   *
   * `status_unavailable` keeps "E no dey" in ENGLISH deliberately. This app's
   * English is Nigerian English — the search field asks "Wetin you dey find?" —
   * so Pidgin here is the brand, not a leak. See ItemCard.tsx, which carries the
   * native speaker's correction of "Not dey" and the reasoning for it.
   */
  "item.status_confirmed": "Confirmed",
  "item.status_caution": "Check again",
  "item.status_unavailable": "E no dey",

  /* Get it — GetItSheet.tsx:99-504, hardcoded English today. */
  "get.title": "Get it",
  "get.go_there": "Go there",
  "get.share": "Share",
  "get.copy_details": "Copy details",
  "get.copied": "Copied",
  "get.maps_apple": "Apple Maps",
  "get.maps_android": "Maps app",
  "get.maps_google": "Google Maps",
  "get.confirmed_at": "Confirmed {when}",
  "get.manual_copy_hint": "This browser will not let WetinDey copy for you. Select and copy:",
  "get.shared_from": "Shared from WetinDey.",
  "get.contact_seller": "Contact seller",
  "get.contact_checking": "Checking",
  "get.contact_checking_footer": "Reading this seller's contact setting.",
  "get.contact_error": "Unavailable",
  "get.contact_error_footer":
    "This seller's contact setting could not be read, so nothing is shown. Rather than guess, WetinDey shows nothing at all.",
  "get.contact_private": "Not shared",
  "get.contact_private_footer":
    "This seller keeps their contact details private. You can still go there — every price here comes from someone who did.",
  "get.contact_none": "None on file",
  "get.contact_none_footer":
    "This seller allows contact, but WetinDey holds no phone number or handle for them yet. There is nothing to dial, and nothing is being withheld.",

  /* Report price — ReportPriceSheet.tsx:88-166, hardcoded English today. */
  "report.choose_market": "Choose market",
  "report.choose_item": "Choose item",
  "report.choose_quality": "Choose quality",
  "report.pick_item_first": "Pick an item first",
  "report.choose_unit": "Choose unit",
  "report.price_placeholder": "₦ e.g. 3500",
  "report.submitting": "Submitting…",

  /* Confirm visit — lifted verbatim from ConfirmVisitSheet.tsx:185-249, which
     already ships all three languages. The `at`/`qPrice` closures become
     `{place}`/`{price}` interpolation; the words are untouched. */
  "confirm.title": "How did it go?",
  "confirm.at": "At {place}",
  "confirm.q_there": "Was it there?",
  "confirm.there_yes": "Yes, it was",
  "confirm.there_no": "No, it wasn't",
  "confirm.q_price": "Was it {price}?",
  "confirm.price_yes": "Yes, that's it",
  "confirm.price_no": "No, it was different",
  "confirm.price_label": "What did it cost?",
  "confirm.price_placeholder": "₦ e.g. 3500",
  "confirm.q_buy": "Did you buy it?",
  "confirm.buy_yes": "Yes, I bought it",
  "confirm.buy_no": "No, I didn't",
  "confirm.send": "Send",
  "confirm.sending": "Sending…",
  "confirm.thanks": "Thank you. The next person gets a better answer.",
  "confirm.queued": "Saved. We'll send it when you're back online.",
  "confirm.failed": "That didn't send. Try again.",
  "confirm.retry": "Try again",
} as const;

/** Every key in the product. Derived, never hand-maintained. */
export type StringKey = keyof typeof en;

/**
 * A non-English locale. Mapped over the full key union, so omitting a key is a
 * compile error rather than an English string appearing at runtime in Lagos.
 */
type LocaleTable = { readonly [K in StringKey]: string | Untranslated };

/* ── Nigerian Pidgin ──────────────────────────────────────────────────────── */

/* Not exported: `TABLES` below is the only way in, so there is exactly one way
   to reach a locale's copy and exactly one place to gate it. A component that
   imported `pidgin` directly would read around the resolver and get a raw
   `UNTRANSLATED` symbol for its trouble. */
const pidgin: LocaleTable = {
  wetin_dey: "WetinDey",
  search_placeholder: "Wetin you dey find?",
  popular_items: "Things people dey buy for",
  settings: "Settings",
  theme: "How app dey look",
  radius: "Distance where you dey find market",
  pilot_areas: "Places where we dey work for Lagos",
  report_price: "Tell us how much dem sell food",
  // Was "O ti tan" in page.tsx:133 — that is Yorùbá, sitting in the Pidgin
  // table. Not a translation choice, a copy-paste. Pidgin uses "Done".
  done: "Done",
  submit: "Send Report",
  price_paid: "Money inside Naira (₦)",
  market: "Which market you go?",
  item: "Which food be dat?",
  variant: "How the quality be?",
  unit: "How dem pack am?",
  availability: "Food dey there?",
  available: "Yes, e dey",
  unavailable: "No, e don finish",
  success_msg: "We don save your report, correct!",
  offline_msg: "Network bad. We save am offline, we go sync later!",
  no_results: "We no find anything",
  locations_found: "places where we see am",
  reported_price: "Price dem tell us",
  freshness: "E dey fresh?",
  data_confidence: "How we trust the report",
  data_source: "Who tell us",
  directions: "Show me road",
  share: "Share",
  clear_search: "Comot Search",
  confirmed: "True-true e dey",
  caution: "Maybe e dey",
  language: "App Language",
  light_mode: "Day time style",
  dark_mode: "Night time style",

  "settings.radius_label": "How far you wan look",
  "settings.radius_a11y": "How far you wan look, for kilometre",
  "settings.radius_value": "{km} km",

  "profile.title_signed_in": "Your account",
  "profile.title_signed_out": "You",
  "profile.signed_out_name": "Sign in to see WetinDey",
  "profile.my_reports": "My reports",
  "profile.saved_markets": "Markets wey I save",
  "profile.change_area": "Change area",
  "profile.settings": "Settings",
  "profile.report_problem": "Tell us wetin spoil",
  "profile.about": "About WetinDey",

  // "Sign in"/"Sign out" stay English on purpose — `profile.signed_out_name`
  // above already reads "Sign in to see WetinDey" in this table, and inventing a
  // Pidgin verb for it here would make one sheet disagree with itself.
  "auth.sign_in": "Sign in",
  "auth.sign_out": "Sign out",
  "auth.email_label": "Your email",
  "auth.send_code": "Send code",
  "auth.check_mail": "Go check your mail",
  "auth.sent_to": "We send am go {email}",
  // "6-digit code": every Pidgin rendering of "digit" I can construct is either
  // a calque or reads as mockery. English is the honest answer, not a placeholder.
  "auth.code_label": UNTRANSLATED,
  "auth.resend": "Send code again",
  // A live countdown. The register for it is not something I can vouch for, and
  // "Resend in 43s" is legible to a Pidgin speaker as it stands.
  "auth.resend_in": UNTRANSLATED,
  "auth.different_email": "Use another email",
  "auth.retry": "Try again", // verbatim from `confirm.retry` in this table.
  "auth.err_send": "E no send. Try again.", // `confirm.failed`'s voice, unchanged.
  "auth.err_send_network": "E no send. Check your network.",
  "auth.err_email_invalid": "This email no correct.",
  // Both of these hinge on saying "you have tried too many times" without it
  // landing as a scolding. That is exactly the register the header warns about.
  "auth.err_rate_limited": UNTRANSLATED,
  "auth.err_code_attempts": UNTRANSLATED,
  "auth.err_code_wrong": "That code no correct.",
  "auth.err_code_expired": "That code don expire. Get new one.",
  "auth.err_code_network": "We no fit check that code. Check your network.",
  "auth.err_code": "That code no work.",
  "auth.err_sign_out": "E no work. Try again.",

  "geo.err_insecure_title": "Location need secure connection",
  "geo.err_unsupported_title": "This browser no fit share location",
  "geo.err_denied_title": "Dem block location",
  "geo.err_unavailable_title": "Your phone no fit find you",
  "geo.err_timeout_title": "E take too long to find you",
  "geo.err_unknown_title": "Location no work",

  "area.title": "Pick area",
  "area.use_my_location": "Use my location",
  "area.locating": "We dey find you…",
  "area.privacy_footer":
    "Na only to pick the area wey near you we dey use your location. E no dey comot from your phone.",
  "area.areas_we_cover": "Areas wey we cover",
  "area.no_places": "No place yet",
  "area.places_one": "1 place",
  "area.places_other": "{count} places",
  "area.err_insecure_body":
    "Your browser go only share location for https. Open WetinDey for the secure address, abi pick area for down.",
  "area.err_unsupported_body": "E no support location at all. Pick area for the list wey dey down.",
  "area.err_denied_body":
    "WetinDey no get permission to see where you dey. Allow location for this site for your browser settings, abi pick area for down.",
  "area.err_unavailable_body":
    "Location dey allowed, but position no come back — na so e dey do for inside house. Try again near window abi outside, abi pick area for down.",
  "area.err_timeout_body":
    "The location request tire before your phone answer. Try again, abi pick area for down.",
  "area.err_unknown_body":
    "Your browser refuse the request and e no talk why. Pick area for down instead.",

  "location.title": "Where you dey?",
  "location.no_areas": "We never set any area",
  "location.coverage_unreachable":
    "That coordinate correct, but we no fit reach the price data to check am. Check your network, try again.",
  "location.err_insecure_body":
    "Your browser go only share location for https. Open WetinDey for the secure address, abi put yourself for one place for up.",
  "location.err_unsupported_body":
    "E no support location at all. Put yourself for one place for up instead.",
  "location.err_denied_body":
    "WetinDey no get permission to see where you dey. Allow location for this site for your browser settings, abi put yourself for one place for up.",
  "location.err_unavailable_body":
    "Location dey allowed, but position no come back — na so e dey do for inside house. Try again near window abi outside, abi put yourself for one place for up.",
  "location.err_timeout_body":
    "The location request tire before your phone answer. Try again, abi put yourself for one place for up.",
  "location.err_unknown_body":
    "Your browser refuse the request and e no talk why. Put yourself for one place for up instead.",

  "item.title_fallback": "Prices",
  "item.choose": "Pick",
  "item.choose_type": "Pick type",
  "item.choose_size": "Pick size",
  "item.any_type": "Any type",
  "item.any_size": "Any size",
  "item.nothing_nearby": "Nothing near you",
  "item.none_nearby": "None near you",
  "item.sort_nearest": "Near me",
  "item.sort_cheapest": "Cheap pass",
  "item.sort_freshest": "Fresh pass",
  "item.checking_prices": "We dey check price…",
  "item.count_within": "{count} inside {km} km",
  "item.network_hint": "Check your network, try again.",
  "item.empty_title": "Nothing inside {km} km",
  "item.empty_body":
    "Nobody don report {item} near {area} yet. Open the distance for Settings, abi report price wey you don see.",
  "item.chip_cheapest": "Cheap pass",
  "item.chip_closest": "Near pass",
  "item.confidence_high": "Strong",
  "item.confidence_medium": "Small small",
  "item.confidence_low": "Weak",
  "item.a11y_available": "E dey",
  "item.a11y_not_available": "E no dey",

  /*
   * UNTRANSLATED, and that is the honest answer rather than a gap to fill in
   * passing. The English these fall back to is already Nigerian English and
   * `status_unavailable` is already Pidgin ("E no dey"), so nothing reads as an
   * outsider's app today.
   *
   * What is missing is Pidgin for "Confirmed" and "Check again", and no agent
   * should invent it. This file's own history is the argument: three components
   * shipped "Not dey" — neither Pidgin nor English, a foreigner's guess — and it
   * read worse to a Lagos shopper than plain English would, precisely because it
   * is visibly an outsider imitating them. A guess here would repeat that on the
   * most-seen string in the product.
   *
   * The point of moving these out of TSX is that a native speaker can now fill
   * them without touching a component.
   */
  "item.status_confirmed": UNTRANSLATED,
  "item.status_caution": UNTRANSLATED,
  "item.status_unavailable": UNTRANSLATED,

  "get.title": "Go get am",
  "get.go_there": "Go there",
  "get.share": "Share",
  "get.copy_details": "Copy the details",
  "get.copied": "We don copy am",
  "get.maps_apple": "Apple Maps",
  "get.maps_android": "Maps app",
  "get.maps_google": "Google Maps",
  "get.confirmed_at": "Dem confirm am {when}",
  "get.manual_copy_hint": "This browser no go let WetinDey copy for you. Select am, copy am:",
  "get.shared_from": "From WetinDey.",
  "get.contact_seller": "Call the seller",
  "get.contact_checking": "We dey check",
  "get.contact_checking_footer": "We dey read wetin this seller talk about contact.",
  "get.contact_error": "E no dey available",
  "get.contact_error_footer":
    "We no fit read wetin this seller talk about contact, so we no dey show anything. Rather than guess, WetinDey no dey show anything at all.",
  "get.contact_private": "Dem no share am",
  "get.contact_private_footer":
    "This seller keep im contact private. You still fit go there — every price for here come from person wey go.",
  "get.contact_none": "We no get am",
  "get.contact_none_footer":
    "This seller allow contact, but WetinDey never get phone number abi handle for dem. Nothing dey to call, and we no dey hide anything.",

  "report.choose_market": "Pick market",
  "report.choose_item": "Pick food",
  "report.choose_quality": "Pick quality",
  "report.pick_item_first": "Pick food first",
  "report.choose_unit": "Pick how dem pack am",
  "report.price_placeholder": "₦ like 3500",
  "report.submitting": "We dey send…",

  // Verbatim from ConfirmVisitSheet.tsx:207-227.
  "confirm.title": "How e go?",
  "confirm.at": "For {place}",
  "confirm.q_there": "E dey there?",
  "confirm.there_yes": "Yes, e dey",
  "confirm.there_no": "No, e no dey",
  "confirm.q_price": "Na {price} dem sell am?",
  "confirm.price_yes": "Yes, na im",
  "confirm.price_no": "No, e different",
  "confirm.price_label": "How much dem sell am?",
  "confirm.price_placeholder": "₦ e.g. 3500",
  "confirm.q_buy": "You buy am?",
  "confirm.buy_yes": "Yes, I buy am",
  "confirm.buy_no": "No, I no buy",
  "confirm.send": "Send am",
  "confirm.sending": "Dey send…",
  "confirm.thanks": "Thank you! You don help the next person.",
  "confirm.queued": "Network bad. We save am, we go send later.",
  "confirm.failed": "E no send. Try again.",
  "confirm.retry": "Try again",
};

/* ── Yorùbá ───────────────────────────────────────────────────────────────── */

/**
 * Read the file header before touching this table.
 *
 * The 34 inherited keys are page.tsx's originals, unchanged. They read
 * machine-translated and most are untoned. They are kept rather than deleted so
 * the picker is not a lie, and every one of them is listed in
 * `NEEDS_NATIVE_REVIEW.yoruba`.
 *
 * The `confirm.*` block is the exception: it comes from ConfirmVisitSheet, is
 * properly toned, and reads like a person wrote it. It still wants a native
 * review — "better than the rest of this file" is not the same as "correct".
 *
 * Everything else is `UNTRANSLATED`, deliberately, and must stay that way until
 * a native speaker supplies the copy. Filling these in from a machine would
 * produce a Yorùbá-shaped app that no Yorùbá speaker trusts, and this app is
 * about trust.
 */
const yoruba: LocaleTable = {
  wetin_dey: "Kilo n ṣẹlẹ",
  search_placeholder: "Kini o n wa?",
  popular_items: "Awọn ounjẹ ti o wọpọ ni",
  settings: "Eto",
  theme: "Irisi Ohun elo",
  radius: "Ijinna Wiwa Ọja",
  pilot_areas: "Awọn agbegbe Lagos ti a n ṣiṣẹ",
  report_price: "Sọ idiyele ounjẹ",
  done: "O ti tan",
  submit: "Firanṣẹ",
  price_paid: "Iye owo ni Naira (₦)",
  market: "Yan Ọja",
  item: "Yan Ounjẹ",
  variant: "Yan Iru rẹ",
  unit: "Yan Iṣakojọpọ",
  availability: "Ṣe o wa?",
  available: "Bẹẹni, o wa",
  unavailable: "Rara, o ti tan",
  success_msg: "O ti ṣaṣeyọri firanṣẹ tuntun!",
  offline_msg: "Ko si netiwọọki. A ti fipamọ offline lati sync nigbamii!",
  no_results: "A kò rí kankan",
  locations_found: "awọn ọja ti o wa",
  reported_price: "Iye owo ti a sọ",
  freshness: "Ṣe o tun jẹ tuntun?",
  data_confidence: "Igbekele Data",
  data_source: "Orisun Data",
  directions: "Fi ọna han mi",
  share: "Pin",
  clear_search: "Nu Wiwa kuro",
  confirmed: "Daju pe o wa",
  caution: "O le wa",
  language: "Ede Ohun elo",
  light_mode: "Ipo Imọlẹ",
  dark_mode: "Ipo Okunkun",

  "settings.radius_label": UNTRANSLATED,
  "settings.radius_a11y": UNTRANSLATED,
  "settings.radius_value": "{km} km",

  "profile.title_signed_in": UNTRANSLATED,
  "profile.title_signed_out": UNTRANSLATED,
  "profile.signed_out_name": UNTRANSLATED,
  "profile.my_reports": UNTRANSLATED,
  "profile.saved_markets": UNTRANSLATED,
  "profile.change_area": UNTRANSLATED,
  "profile.settings": UNTRANSLATED,
  "profile.report_problem": UNTRANSLATED,
  "profile.about": UNTRANSLATED,

  /* Sign in. Every key, without exception — the header's rule for NEW keys, and
     this is the worst possible place to break it. A user who cannot tell
     invented Yorùbá from careless Yorùbá is being asked, in that moment, to hand
     over their email address. English showing through is the honest answer. */
  "auth.sign_in": UNTRANSLATED,
  "auth.sign_out": UNTRANSLATED,
  "auth.email_label": UNTRANSLATED,
  "auth.send_code": UNTRANSLATED,
  "auth.check_mail": UNTRANSLATED,
  "auth.sent_to": UNTRANSLATED,
  "auth.code_label": UNTRANSLATED,
  "auth.resend": UNTRANSLATED,
  "auth.resend_in": UNTRANSLATED,
  "auth.different_email": UNTRANSLATED,
  "auth.retry": UNTRANSLATED,
  "auth.err_send": UNTRANSLATED,
  "auth.err_send_network": UNTRANSLATED,
  "auth.err_email_invalid": UNTRANSLATED,
  "auth.err_rate_limited": UNTRANSLATED,
  "auth.err_code_wrong": UNTRANSLATED,
  "auth.err_code_expired": UNTRANSLATED,
  "auth.err_code_attempts": UNTRANSLATED,
  "auth.err_code_network": UNTRANSLATED,
  "auth.err_code": UNTRANSLATED,
  "auth.err_sign_out": UNTRANSLATED,

  "geo.err_insecure_title": UNTRANSLATED,
  "geo.err_unsupported_title": UNTRANSLATED,
  "geo.err_denied_title": UNTRANSLATED,
  "geo.err_unavailable_title": UNTRANSLATED,
  "geo.err_timeout_title": UNTRANSLATED,
  "geo.err_unknown_title": UNTRANSLATED,

  "area.title": UNTRANSLATED,
  "area.use_my_location": UNTRANSLATED,
  "area.locating": UNTRANSLATED,
  "area.privacy_footer": UNTRANSLATED,
  "area.areas_we_cover": UNTRANSLATED,
  "area.no_places": UNTRANSLATED,
  "area.places_one": UNTRANSLATED,
  "area.places_other": UNTRANSLATED,
  "area.err_insecure_body": UNTRANSLATED,
  "area.err_unsupported_body": UNTRANSLATED,
  "area.err_denied_body": UNTRANSLATED,
  "area.err_unavailable_body": UNTRANSLATED,
  "area.err_timeout_body": UNTRANSLATED,
  "area.err_unknown_body": UNTRANSLATED,

  "location.title": UNTRANSLATED,
  "location.no_areas": UNTRANSLATED,
  "location.coverage_unreachable": UNTRANSLATED,
  "location.err_insecure_body": UNTRANSLATED,
  "location.err_unsupported_body": UNTRANSLATED,
  "location.err_denied_body": UNTRANSLATED,
  "location.err_unavailable_body": UNTRANSLATED,
  "location.err_timeout_body": UNTRANSLATED,
  "location.err_unknown_body": UNTRANSLATED,

  "item.title_fallback": UNTRANSLATED,
  "item.choose": UNTRANSLATED,
  "item.choose_type": UNTRANSLATED,
  "item.choose_size": UNTRANSLATED,
  "item.any_type": UNTRANSLATED,
  "item.any_size": UNTRANSLATED,
  "item.nothing_nearby": UNTRANSLATED,
  "item.none_nearby": UNTRANSLATED,
  "item.sort_nearest": UNTRANSLATED,
  "item.sort_cheapest": UNTRANSLATED,
  "item.sort_freshest": UNTRANSLATED,
  "item.checking_prices": UNTRANSLATED,
  "item.count_within": UNTRANSLATED,
  "item.network_hint": UNTRANSLATED,
  "item.empty_title": UNTRANSLATED,
  "item.empty_body": UNTRANSLATED,
  "item.chip_cheapest": UNTRANSLATED,
  "item.chip_closest": UNTRANSLATED,
  "item.confidence_high": UNTRANSLATED,
  "item.confidence_medium": UNTRANSLATED,
  "item.confidence_low": UNTRANSLATED,
  "item.a11y_available": UNTRANSLATED,
  "item.a11y_not_available": UNTRANSLATED,

  "item.status_confirmed": UNTRANSLATED,
  "item.status_caution": UNTRANSLATED,
  "item.status_unavailable": UNTRANSLATED,

  "get.title": UNTRANSLATED,
  "get.go_there": UNTRANSLATED,
  "get.share": "Pin",
  "get.copy_details": UNTRANSLATED,
  "get.copied": UNTRANSLATED,
  "get.maps_apple": "Apple Maps",
  "get.maps_android": "Maps app",
  "get.maps_google": "Google Maps",
  "get.confirmed_at": UNTRANSLATED,
  "get.manual_copy_hint": UNTRANSLATED,
  "get.shared_from": UNTRANSLATED,
  "get.contact_seller": UNTRANSLATED,
  "get.contact_checking": UNTRANSLATED,
  "get.contact_checking_footer": UNTRANSLATED,
  "get.contact_error": UNTRANSLATED,
  "get.contact_error_footer": UNTRANSLATED,
  "get.contact_private": UNTRANSLATED,
  "get.contact_private_footer": UNTRANSLATED,
  "get.contact_none": UNTRANSLATED,
  "get.contact_none_footer": UNTRANSLATED,

  "report.choose_market": UNTRANSLATED,
  "report.choose_item": UNTRANSLATED,
  "report.choose_quality": UNTRANSLATED,
  "report.pick_item_first": UNTRANSLATED,
  "report.choose_unit": UNTRANSLATED,
  "report.price_placeholder": UNTRANSLATED,
  "report.submitting": UNTRANSLATED,

  // Verbatim from ConfirmVisitSheet.tsx:228-248 — the good Yorùbá in this repo.
  "confirm.title": "Báwo ni ó ṣe lọ?",
  "confirm.at": "Ní {place}",
  "confirm.q_there": "Ṣé ó wà níbẹ̀?",
  "confirm.there_yes": "Bẹ́ẹ̀ni, ó wà",
  "confirm.there_no": "Rárá, kò sí",
  "confirm.q_price": "Ṣé {price} ni?",
  "confirm.price_yes": "Bẹ́ẹ̀ni, ìyẹn ni",
  "confirm.price_no": "Rárá, ó yàtọ̀",
  "confirm.price_label": "Iye tí wọ́n tà á?",
  "confirm.price_placeholder": "₦ bí 3500",
  "confirm.q_buy": "Ṣé o rà á?",
  "confirm.buy_yes": "Bẹ́ẹ̀ni, mo rà á",
  "confirm.buy_no": "Rárá, n kò rà á",
  "confirm.send": "Firanṣẹ́",
  "confirm.sending": "Ń firanṣẹ́…",
  "confirm.thanks": "A dúpẹ́. Ẹni tó bá tẹ̀lé e yóò rí ìdáhùn tó dára.",
  "confirm.queued": "A ti fipamọ́. A ó firanṣẹ́ nígbà tí netiwọọki bá dé.",
  "confirm.failed": "Kò lọ. Gbìyànjú lẹ́ẹ̀kansí.",
  "confirm.retry": "Gbìyànjú lẹ́ẹ̀kansí",
};

/* ── The tables, and what is not vouched for ──────────────────────────────── */

export const TABLES: Readonly<Record<Locale, LocaleTable>> = {
  en,
  pidgin,
  yoruba,
};

/**
 * Keys whose translation EXISTS but which nobody qualified has signed off.
 *
 * This is not the same as `UNTRANSLATED`. These strings render — a user sees
 * them — and they may be wrong, awkward, or untoned. They are the trust risk,
 * because a user cannot tell "unreviewed" from "sloppy": they only see an app
 * that speaks their language badly.
 *
 * Typed against `StringKey`, so a rename cannot leave a stale entry behind
 * quietly claiming a key was reviewed.
 *
 * Clear an entry only when a native speaker has actually read it.
 */
export const NEEDS_NATIVE_REVIEW: Readonly<
  Record<Exclude<Locale, "en">, readonly StringKey[]>
> = {
  /**
   * Nigerian Pidgin. The inherited keys are uneven in register — `radius`
   * ("Distance where you dey find market") is a description, not a label, and
   * `settings`/`share`/`language` are simply English. New keys are written to a
   * consistent register but want a Lagos speaker's ear, particularly the
   * confidence words: "Small small" for medium confidence is idiomatic but may
   * read as hedging about the FOOD rather than about the DATA, which would
   * invert the meaning of the whole trust model.
   *
   * The `auth.*` entries are the sign-in flow. They were written by mirroring
   * constructions this table already uses ("E no send." is `confirm.failed`
   * verbatim), which makes them consistent but does not make them vouched for —
   * a Lagos speaker has still never read them. `auth.sent_to` is the one to look
   * at hardest: "We send am go {email}" has to carry a bare email address on the
   * end without the sentence collapsing.
   */
  pidgin: [
    "settings",
    "radius",
    "language",
    "share",
    "light_mode",
    "dark_mode",
    "auth.send_code",
    "auth.check_mail",
    "auth.sent_to",
    "auth.resend",
    "auth.different_email",
    "auth.err_email_invalid",
    "auth.err_code_expired",
    "item.confidence_high",
    "item.confidence_medium",
    "item.confidence_low",
    "item.sort_cheapest",
    "item.sort_freshest",
    "item.chip_cheapest",
    "item.chip_closest",
    "get.title",
    "get.contact_seller",
    "profile.report_problem",
  ],

  /**
   * Yorùbá. EVERY rendering string in this locale is unreviewed.
   *
   * The 34 inherited keys read machine-translated: "Eto" for Settings is
   * untoned (Ẹ̀tọ́), "sync" and "offline" sit untranslated inside `offline_msg`,
   * and `wetin_dey` renders the brand name as a phrase ("Kilo n ṣẹlẹ") rather
   * than as a name — a brand should not be translated at all. The `confirm.*`
   * block is properly toned and much better, but "much better" is not "signed
   * off" and it is listed too.
   *
   * Everything absent from this list is `UNTRANSLATED` and shows English, which
   * is the honest state. Do not "fix" that by machine-translating it: this list
   * would then be the only thing standing between a Lagos user and an app that
   * fluently says the wrong thing about the price of food.
   */
  yoruba: [
    "wetin_dey",
    "search_placeholder",
    "popular_items",
    "settings",
    "theme",
    "radius",
    "pilot_areas",
    "report_price",
    "done",
    "submit",
    "price_paid",
    "market",
    "item",
    "variant",
    "unit",
    "availability",
    "available",
    "unavailable",
    "success_msg",
    "offline_msg",
    "no_results",
    "locations_found",
    "reported_price",
    "freshness",
    "data_confidence",
    "data_source",
    "directions",
    "share",
    "clear_search",
    "confirmed",
    "caution",
    "language",
    "light_mode",
    "dark_mode",
    "get.share",
    "confirm.title",
    "confirm.at",
    "confirm.q_there",
    "confirm.there_yes",
    "confirm.there_no",
    "confirm.q_price",
    "confirm.price_yes",
    "confirm.price_no",
    "confirm.price_label",
    "confirm.price_placeholder",
    "confirm.q_buy",
    "confirm.buy_yes",
    "confirm.buy_no",
    "confirm.send",
    "confirm.sending",
    "confirm.thanks",
    "confirm.queued",
    "confirm.failed",
    "confirm.retry",
  ],
};
