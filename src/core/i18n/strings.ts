/**
 * WetinDey copy, in one place.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * The dictionary used to live inline in `src/app/page.tsx` (a 1018-line
 * component) as a literal object of 34 keys. Two consequences, both observed:
 *
 *   1. No component could add a key without editing page.tsx, so every sheet
 *      built after it, GetItSheet, ItemDetailSheet, LocationSheet,
 *      AreaPickerSheet, ProfileSheet, is hardcoded English regardless of the
 *      language the user picked. Selecting Yorùbá today changes the map header
 *      and leaves the entire "Get it" flow in English.
 *   2. It forked. `ConfirmVisitSheet.tsx:185` carries its OWN `COPY` record in
 *      the same three languages. Its Yorùbá is markedly better than page.tsx's
 *      (properly toned: "Ṣé ó wà níbẹ̀?"). Two dictionaries, one product.
 *
 * This file is the merge. `ConfirmVisitSheet`'s strings are reproduced verbatim
 * under `confirm.*` rather than re-translated, it is the better of the two
 * sources and re-doing it would be exactly the third copy this codebase does
 * not need.
 *
 * HOW COMPLETENESS IS ENFORCED
 * ----------------------------
 * `en` is the source of truth. `StringKey` is derived from it, and every other
 * locale is typed `LocaleTable`, a mapped type over the full key union. Adding
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
 * ON THE TRANSLATIONS THEMSELVES, READ THIS BEFORE SHIPPING
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
 *     because a user cannot tell invented copy from careless copy, they can
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
 * shipped anyway, which is what a comment asking people to be careful is worth.
 * So `NEEDS_NATIVE_REVIEW` at the bottom is now load-bearing: `./index.ts`
 * refuses to let the store hold a locale whose copy is mostly unread by someone
 * who speaks it. Today that offers English and Pidgin and withholds Yorùbá. The
 * list is the gate, not a note about the gate, clearing an entry here is the
 * only thing that opens a language, and clearing one you have not actually read
 * is now indistinguishable from shipping it.
 */

/* ── Locales ──────────────────────────────────────────────────────────────── */

export const LOCALES = ["en", "pidgin", "yoruba"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

/* `LOCALE_NAMES`, the endonyms {en: "English", pidgin: "Pidgin", yoruba:
   "Yorùbá"}, used to live here and had no caller. SettingsSheet.tsx:74-76
   hardcodes those exact three literals instead, so this was not a dictionary the
   picker read; it was a fourth copy of the picker's labels, waiting to disagree
   with them. AGENTS.md §0 is unambiguous, so it is deleted rather than kept warm
   for a call site that has never arrived. It comes back in the change that makes
   SettingsSheet read it, with the caller, not before it. */

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/**
 * "This locale has no vouched translation for this key, show English."
 *
 * A declared, greppable, countable decision. Not a silent runtime fallback:
 * the key still has to be present, so a NEW key cannot slip through as English
 * without someone typing this word next to it.
 */
export const UNTRANSLATED: unique symbol = Symbol("i18n.untranslated");
type Untranslated = typeof UNTRANSLATED;

/* ── English, the source of truth ────────────────────────────────────────── */

/**
 * `as const` is load-bearing twice over: it produces the `StringKey` union, and
 * it lets `./index.ts` read the `{placeholders}` out of each literal to type the
 * interpolation arguments. Removing it silently degrades `t()` to `t(key, any)`.
 */
export const en = {
  /* Shell, keys 1:1 with the old page.tsx dictionary. Names unchanged so the
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

  /* Category chip + selector sheet. "Aboki FX" (money) and "Fuel prices" stay
     literal in CategorySelectorSheetView (a proper noun and an out-of-scope
     placeholder); every label that translates gets a key here. `select_category`
     is the selector sheet's title AND its group aria-label. Used by
     HomeSheetHeaderView and CategorySelectorSheet. The latter referenced these
     keys through `|| "…"` fallbacks before they existed, so English rendered even
     in Pidgin; the keys make the labels real. */
  category_food: "Food",
  select_category: "Select Category",
  category_home: "Home & Living",
  category_health: "Health & Beauty",
  category_transport: "Transport",
  category_community: "Community",
  category_agri: "Agri",

  /* Shared modal chrome. ModalSheet's close control (the X) is the one button
     behind every sheet in the app; its label is keyed once here rather than
     hardcoded in the shell, so translating it fixes every sheet at once. */
  close: "Close",

  /* The rest of ModalSheet's navigation chrome, also behind every sheet: the
     backdrop/scrim reads "Dismiss" for a top-level sheet and "Back to previous
     step" when a contextual child is stacked over it, and the child header
     carries a visible "Back" control. Keyed here so all three translate at once
     rather than staying English behind every sheet the way `close` used to. */
  dismiss: "Dismiss",
  back: "Back",
  back_to_previous_step: "Back to previous step",

  /* Settings, SettingsSheet.tsx:107,115 are hardcoded English today. */
  "settings.radius_label": "Search radius",
  "settings.radius_a11y": "Search radius in kilometres",
  "settings.radius_value": "{km} km",

  /* BottomSheet drag handle, the icon-only control that cycles the map sheet
     through its three detents. Its aria-label used to interpolate the raw detent
     token ("peek"/"medium"/"large"), a developer word a screen-reader user has no
     use for; these name the position in human terms instead. One full sentence
     each, so none of the label's structure is baked into the view. */
  "sheet.position_collapsed": "Sheet collapsed. Activate to change.",
  "sheet.position_half": "Sheet half open. Activate to change.",
  "sheet.position_expanded": "Sheet expanded. Activate to change.",

  /* Profile, ProfileSheet.tsx. No line numbers: they rot, and a comment that
     points at the wrong line is worse than no comment.

     `profile.reports_one` / `profile.reports_other` used to live here. They were
     deleted, not disabled: `reportCount` was never once supplied, page.tsx
     builds `sessionUser` as `{ name, email }`, so the pluralisation resolved to
     "0 prices reported" for every signed-in user, including one who had reported
     twenty. Keeping the keys would have kept `coverage()` counting Pidgin nobody
     could ever read. The Pidgin is in git when the count is real. */
  "profile.title_signed_in": "Profile",
  "profile.title_signed_out": "You",
  "profile.signed_out_name": "Sign in to see WetinDey",
  "profile.my_reports": "My reports",
  "profile.saved_markets": "Saved markets",
  "profile.change_area": "Change area",
  "profile.settings": "Settings",
  "profile.report_problem": "Report a problem",
  "profile.about": "About WetinDey",

  /* Manage profile, ManageProfileSheet.tsx. The first CTA row under the mini
     profile, and the sheet it opens. `name` round-trips through
     `authClient.updateUser`; `email` is DISPLAY-ONLY (there is no mounted
     change-email route on this SDK, so an editable field would be a dead
     control this codebase refuses); the contact pair round-trips through
     `updateMyProfile`. `email_readonly_note` is the honest line that says WHY
     the address cannot be edited here, never a promise of a change flow.

     `save_error` / `load_error` are Nigerian English, matching `reports.err_load`
     and LocationSheet's register verbatim, the app's English voice. */
  "profile.manage": "Manage profile",
  /* Avatar controls, ManageProfileSheet. `change_photo` is the icon-only
     avatar button's aria-label; `remove_photo` is the visible text link. */
  "profile.change_photo": "Change profile photo",
  "profile.remove_photo": "Remove photo",
  "profile.name_label": "Name",
  "profile.email_label": "Email",
  "profile.email_readonly_note": "Sign-in email.",
  "profile.contact_label": "Contact",
  "profile.contact_kind_phone": "Phone",
  "profile.contact_kind_whatsapp": "WhatsApp",
  "profile.contact_kind_sms": "SMS",
  "profile.contact_placeholder": "Phone number",
  "profile.save": "Save",
  "profile.saved": "Saved",
  "profile.save_error": "We no fit save your profile right now.",
  "profile.load_error": "We no fit load your profile right now.",
  "profile.nearby_presence": "Nearby presence",
  "profile.not_available_yet": "Unavailable",

  /* My reports, MyReportsSheet.tsx.
   *
   * TWO EMPTY STATES, NOT ONE, because they are two different facts. Signed out,
   * we do not know who you are. Signed in with nothing here, we know you and you
   * have not reported yet. Collapsing them would tell a signed-in user to sign
   * in.
   *
   * WHAT NONE OF THIS COPY MAY SAY: that signing in makes your report count for
   * more. It is the natural line to reach for and it is FALSE TODAY, the shared
   * anonymous Contributor row is seeded at reliability 98, the highest in the
   * table, while a new per-user row is minted at 75 (actions.ts:317), and
   * trust.ts multiplies by score/100. Signing in currently weighs 23% LESS. The
   * promise here is only what is true: your reports GATHER here, and you can SEE
   * them.
   *
   * `empty_footnote` is the load-bearing line. Without it the owner opens this,
   * sees nothing, and concludes it is broken, which is today's complaint
   * restated. It also says "reports sent without signing in", never "your past
   * reports": all 949 existing observations are anonymous seed rows, and we
   * cannot distinguish "the owner typed this" from "the seed wrote it", both
   * are app_entry against a user_id=NULL source. The copy states what is true of
   * ANY report filed without a session. */
  "reports.title": "My reports",
  "reports.empty_title": "You haven't reported a price yet",
  "reports.empty_body": "Prices you report while signed in show up here.",
  "reports.empty_footnote":
    "Reports sent without signing in stay anonymous: they still count, but nothing links them back to you.",
  "reports.signed_out_title": "Sign in to see your reports",
  "reports.signed_out_body":
    "You can report a price without an account (WetinDey never asks). Sign in and the prices you report gather here.",
  /* Pidgin-inflected English in the `en` table, matching LocationSheet.tsx:132's
     "We no fit load the areas right now." verbatim in register. This app's
     English locale already reads "Wetin you dey find?", the default voice is
     Nigerian English, not Received Standard. */
  "reports.err_load": "We no fit load your reports right now.",
  /* The verdict on a report that said the food was finished. The price is
     SUPPRESSED beside this, see MyReportsSheet. Matches `item.status_*` and
     offerSignal's owner-approved wording exactly; "ee no dey", never "not dey". */
  "reports.sold_out": "E no dey",

  /* Report a problem, ReportProblemSheet.tsx.
   *
   * The DESTINATION for the Profile "Report a problem" row, which shipped dead
   * (disabled, no-op onClick). Anyone can file, signed in or out (ADR-003).
   *
   * `success_body` is the load-bearing honest line. There is NO reply channel in
   * this product, no email-back, no ticket, no status the user can check, so
   * the copy must never say "we'll get back to you". It promises only receipt:
   * the report lands in a table the owner reads directly, and that is the whole
   * loop.
   *
   * `err_send` is Nigerian English, matching `reports.err_load` and
   * LocationSheet.tsx's register verbatim, the app's English voice is Lagos
   * English, not Received Standard. It is the line the user WILL see today: the
   * `problem_reports` migration is generated but not yet applied, so a real
   * submit throws until the orchestrator applies it. */
  "problem.title": "Report a problem",
  "problem.kind_label": "What kind of problem?",
  "problem.kind_placeholder": "Choose one",
  "problem.kind_price": "A price is wrong",
  "problem.kind_place": "A place is wrong",
  "problem.kind_bug": "Something's broken",
  "problem.kind_other": "Something else",
  "problem.body_label": "What's wrong?",
  "problem.body_placeholder": "Tell us what you saw",
  "problem.send": "Send",
  "problem.sending": "Sending…",
  "problem.success_title": "Thanks, we got it.",
  "problem.success_body":
    "This goes to the people who run WetinDey. They may not be able to reply.",
  "problem.err_send": "We no fit send your report right now.",

  /* About / legal / support, AboutSheet.tsx.
   *
   * This is the About row given a destination: a hub that leads to three
   * surfaces (Terms of service, Privacy, Support), pushed on ONE sheet via
   * NavigationStack rather than stacked as separate modals.
   *
   * THE LEGAL PROSE IS FACTUAL AND UNREVIEWED, ON PURPOSE. Every word here is a
   * plain description of what the app demonstrably does, derived from the schema
   * and the code, no warranties, no liability limits, no governing law, nothing
   * that reads as counsel, because an agent may not invent those. `about.draft_*`
   * says so IN THE UI, and it is load-bearing: a privacy notice that misdescribes
   * what is collected is worse than none. The owner must have a lawyer review it
   * before it is relied on.
   *
   * The privacy copy stays at the product boundary rather than making unreviewed
   * commitments about processing, retention, deletion, or service providers.
   * Human legal review must complete those details before this becomes a notice. */
  "about.title": "About WetinDey",
  "about.lede":
    "Nearby local information before you leave. Food prices and availability are V1 in south-west Lagos.",
  "about.body_what":
    "Coverage and freshness vary. Information can be incomplete, stale, uncertain, synthetic or for demonstration.",
  "about.body_prices":
    "WetinDey provides references, not sales, money exchange or delivery. FX references may differ from bank and exchanger rates. Confirm details before you travel.",
  "about.body_account":
    "No account is needed to browse. Sign-in is optional and can support recognized attribution and history where available.",
  "about.body_pilot":
    "Food prices and availability are the only live V1 capability.",

  /* Row labels + the back affordance. `about.back` is the NavigationStack back
     row's label: it names where back goes (the About hub), the way iOS shows the
     parent screen's title on the back button. */
  "about.terms": "Terms of service",
  "about.privacy": "Privacy",
  "about.support": "Support",
  "about.back": "About",

  /* The review marker every drafted legal surface must carry. Shown at the top
     of Terms and Privacy, in a caution tint, so it cannot be mistaken for the
     copy it guards. */
  "about.draft_notice": "Draft — pending human legal review",

  "about.terms_title": "Terms of service",
  "about.terms_intro":
    "This is not a final legal agreement. WetinDey provides live local information; Food prices and availability are V1.",
  "about.terms_prices":
    "Coverage and freshness vary. Information may be incomplete, stale, synthetic, demonstration-only or uncertain; price and availability are not guaranteed when you arrive.",
  "about.terms_fulfilment":
    "WetinDey does not sell, exchange money, take payment, provide checkout, deliver, dispatch or fulfil orders. Go there only passes a destination to your maps app; travel and purchases remain your decision.",
  "about.terms_reporting":
    "You may contribute structured information when useful. Browsing needs no account; signing in is optional and can support recognized attribution and history where available.",

  "about.privacy_title": "Privacy",
  "about.privacy_intro":
    "This is not a final legal notice. You can browse without an account.",
  "about.privacy_collect":
    "If you sign in, account information can support recognized attribution and history where available. Information you contribute may be kept with that contribution.",
  "about.privacy_device":
    "Your browser may keep preferences and cached reference-rate data on this device. When you use device location, your browser sends a coordinate to WetinDey to find nearby coverage. You can choose an area manually; it represents its centre, not your exact personal location.",
  "about.privacy_third":
    "Go there passes destination information to your chosen maps app. That app and your browser may handle it under their own terms.",
  "about.privacy_presence":
    "Nearby Presence is not available yet. WetinDey does not currently share coarse areas or reciprocal presence between people.",
  "about.privacy_ads": "Retention, deletion and service-provider details still need legal review.",
  "about.privacy_delete":
    "Email {email} for account deletion or account help. There is no self-service deletion; deletion and retention details remain under review.",

  "about.support_title": "Support",
  "about.support_body": "For problems, account requests or questions. A reply may not always be possible.",
  "about.support_cta": "Email support",

  /* The four reading surfaces reached from the About hub and by hash
     (#how-it-works, #accessibility, #licenses, #attributions). Row labels first,
     then the prose.

     ALL FACTUAL AND DERIVED, NOT INVENTED. How-it-works is drawn from ADR-001
     (fulfilment is out of scope), ADR-003 (accounts optional, reading anonymous)
     and ADR-006 (freshness) plus the about.body_* lines above. Accessibility
     states only behaviours the code demonstrably has, and its last line says it
     is a description, not a conformance claim. The licence list and the
     photo-credit list are DATA, not copy: they render from package.json and
     ITEM_IMAGES in AboutSheet, so a package name or a photographer's licence can
     never drift out of a translation. No draft marker here: unlike Terms and
     Privacy, none of this is legal text an owner must review, it is a plain
     account of what the app already does. */
  "about.how": "How WetinDey works",
  "about.accessibility": "Accessibility",
  "about.licenses": "Open-source licences",
  "about.attributions": "Attributions",

  "about.how_title": "How WetinDey works",
  "about.how_area_title": "Choose your area",
  "about.how_area_body":
    "Choose an area manually or use your device's location for nearby results. When you use device location, your browser sends a coordinate to WetinDey to find nearby coverage. A manual area represents its centre, not your exact personal location.",
  "about.how_need_title": "Choose what you need",
  "about.how_need_body":
    "Food prices and availability are V1. Search near your chosen area.",
  "about.how_signal_title": "Read the local signal",
  "about.how_signal_body":
    "Food results can show price, availability, place and freshness. Signals can be incomplete, uncertain, synthetic or for demonstration.",
  "about.how_freshness_title": "Check freshness and source limits",
  "about.how_freshness_body":
    "Check freshness and source information. They inform the signal; they do not guarantee it.",
  "about.how_maps_title": "Continue in your maps app",
  "about.how_maps_body":
    "Go there passes a destination to your chosen maps app. WetinDey does not arrange travel, money exchange, payment, delivery or orders.",
  "about.how_contribute_title": "Contribute when useful",
  "about.how_contribute_body":
    "You can add structured information when useful. Browsing needs no account; signing in can support recognized attribution and history where available.",
  "about.how_confirm_title": "Confirm before travelling",
  "about.how_confirm_body":
    "Prices and stock change. Confirm with the place before travelling.",

  "about.a11y_title": "Accessibility",
  "about.a11y_intro":
    "WetinDey is built to follow the way your device is already set up. Here is what that means today.",
  "about.a11y_vision":
    "It follows your light or dark setting, and text is sized in steps that grow when you enlarge your system text. Colour is never the only signal: every status carries a word (E sure, Check am, E no dey), not just a tint.",
  "about.a11y_motion":
    "If you ask your device to reduce motion, WetinDey turns its sheet and map animations down to match.",
  "about.a11y_keyboard":
    "Every sheet is a proper dialog: it takes keyboard focus when it opens, hands focus back where you left it when it closes, and closes with Escape, the close control, or a tap outside. Pinch to zoom works everywhere, the map included.",
  "about.a11y_targets":
    "Buttons and rows are sized to a comfortable minimum, so they are easy to reach without precise aim.",
  "about.a11y_note":
    "This describes how the app behaves today. It is not a claim to meet a formal accessibility standard. If something is hard to use, please tell us on the Support page.",

  "about.licenses_title": "Open-source licences",
  "about.licenses_intro": "Main open-source libraries and their licences.",

  "about.attributions_title": "Attributions",
  "about.attributions_photos_title": "Food photos",
  "about.attributions_photos_intro":
    "Food photographs come from Wikimedia Commons, each shared under a free Creative Commons licence and credited to its photographer.",
  "about.attributions_map_title": "Map",
  "about.attributions_map":
    "The map and its map data come from Mapbox and OpenStreetMap contributors.",

  /* Sign in, ProfileSheet.tsx.
   *
   * There is no sign-up copy here because there is no sign-up step:
   * `signIn.emailOtp` creates the user if the email is unknown. Nothing in this
   * block may say "create an account" or "register".
   *
   * WHY THE ERROR KEYS EXIST. better-auth populates `error.message` itself, and
   * its words are "Invalid OTP", "OTP expired", "Too many attempts", "Too many
   * requests", another codebase's acronyms, English-only, untranslatable
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
  "auth.code_accepted": "Code accepted",
  "auth.session_refreshing": "Finishing sign-in",
  "auth.session_stalled": "Code accepted. Refresh this screen.",
  "auth.refresh_session": "Refresh",

  /* Geolocation problem titles. Shared verbatim between AreaPickerSheet and
     LocationSheet; only the remedy (the body) differs, so only the body forks.
     These stay five distinct titles, never collapsed into "Couldn't get your
     location", five causes with five different fixes. */
  "geo.err_insecure_title": "Location needs a secure connection",
  "geo.err_unsupported_title": "This browser can't share location",
  "geo.err_denied_title": "Location is blocked",
  "geo.err_unavailable_title": "Your device couldn't get a fix",
  "geo.err_timeout_title": "Finding you took too long",
  "geo.err_unknown_title": "Location didn't work",

  /* Area picker, AreaPickerSheet.tsx:117-227. Remedy is "pick an area below". */
  "area.title": "Choose area",
  "area.use_my_location": "Use my location",
  "area.locating": "Finding you…",
  "area.privacy_footer":
    "We send your location coordinate to WetinDey to pick the nearest area.",
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
    "Location is allowed, but no position came back (this is common indoors). Try again near a window or outside, or pick an area below.",
  "area.err_timeout_body":
    "The location request timed out before your device answered. Try again, or pick an area below.",
  "area.err_unknown_body":
    "Your browser refused the request without saying why. Pick an area below instead.",

  /* Location sheet, LocationSheet.tsx:204-512. Remedy is "simulate above". */
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
    "Location is allowed, but no position came back (this is common indoors). Try again near a window or outside, or simulate a position above.",
  "location.err_timeout_body":
    "The location request timed out before your device answered. Try again, or simulate a position above.",
  "location.err_unknown_body":
    "Your browser refused the request without saying why. Simulate a position above instead.",

  /* Item detail, ItemDetailSheet.tsx:143-500, hardcoded English today. */
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
   * The status badge, the highest-frequency copy in the product, on every card
   * and every offer row. Three words that are the whole product:
   *
   *   E sure   , we stand behind this evidence.
   *   Check am , we do not; verify first.
   *   E no dey , we have evidence it is gone.
   *
   * Set by the owner, a native speaker, on 2026-07-16. They are Nigerian English
   * and they live in the ENGLISH table on purpose: this app's English IS Nigerian
   * English, the search field asks "Wetin you dey find?", so this is the brand,
   * not a leak. ONE STATUS, ONE NAME, EVERYWHERE.
   *
   * These are NOT `item.a11y_*`. Those describe availability for a screen reader
   * ("Available" / "Not available"). These are the visible verdict, and the
   * verdict is freshness AND availability at once.
   *
   * WHY THESE AND NOT THE OBVIOUS ONES, the rejections carry the reasoning, so
   * they are recorded rather than left to be re-litigated:
   *   · "Na true"    , agrees with a statement; this validates EVIDENCE.
   *   · "Correct"    , grades an answer.
   *   · "Don verify" , backend/process voice, not a shopper's.
   *   · "Fit dey" / "E fit dey", probability claims. They weaken the trust
   *                     model by hedging where it must either stand behind the
   *                     evidence or tell you to go and check.
   *   · "Needs checking", passive; does not tell the user what to DO.
   *
   * `Check am` is an IMPERATIVE and that is load-bearing. It is not a claim that
   * the price is wrong, it is an instruction: verify before you travel. That is
   * the product's promise in two words. If a future edit turns it into a hedge,
   * it has broken the thing that makes the badge useful.
   */
  "item.status_confirmed": "E sure",
  "item.status_caution": "Check am",
  "item.status_unavailable": "E no dey",

  /* Get it, GetItSheet.tsx:99-504, hardcoded English today. */
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
    "This seller keeps their contact details private. You can still go there, but details may change before you arrive.",
  "get.contact_none": "None on file",
  "get.contact_none_footer":
    "This seller allows contact, but WetinDey holds no phone number or handle for them yet. There is nothing to dial, and nothing is being withheld.",

  /* Get it, second wave. The rest of GetItSheetView + GetItReviewsView, keyed to
     finish routing that sheet through i18n. `{when}` is a relative-time string;
     get.maps_fallback is the maps-app name shown when the platform is unknown.

     The route-disclosure TITLES stay literals in the view: location-default-
     contract greps the component for "Choose what leaves WetinDey" to assert that
     the disclosure copy remains auditable there. The two static BODY sentences
     ("ready" and the default choose-origin paragraph) are keyed here so they flow
     through i18n like the rest of the sheet, but they are UNTRANSLATED in Pidgin
     and Yorùbá: this is a privacy/consent disclosure that renders English in every
     shippable locale, so the key exists for routing, not for a vouched translation.
     `{maps}` is the maps-app name (already i18n'd via get.maps_*). The reviews-
     preparation notes speak to safety and moderation, a tone-sensitive register,
     so they are UNTRANSLATED in Pidgin and Yorùbá too. */
  "get.last_seen": "Last seen {when}",
  "get.offer_per": " per {unit} · {item}",
  "get.more_details": "More details",
  "get.hide_details": "Hide details",
  "get.maps_fallback": "your maps app",
  "get.open_with_location": "Open with my location",
  "get.use_current_location": "Use current location",
  "get.refreshing_location": "Refreshing location…",
  "get.destination_only": "Destination only",
  "get.route_ready_body":
    "Your refreshed location and this market were sent to Mapbox for this route. Open {maps} within one minute to use the same origin.",
  "get.route_disclosure_body":
    "Use current location refreshes and sends your exact location and this market to Mapbox for a route, then to {maps}. Destination only sends the market, not your location.",
  "get.reviews_title": "Reviews",
  "get.reviews_prep_note": "New reviews are unavailable while we prepare safety and moderation safeguards.",
  "get.reviews_loading": "Loading reviews...",
  "get.reviews_unavailable_title": "Reviews unavailable",
  "get.reviews_unavailable_body": "We are preparing this feature with safety and moderation in mind.",
  "get.reviews_one": "review",
  "get.reviews_other": "reviews",

  /* Currency picker, CurrencyPickerSheet + its content/view. This sheet bypassed
     this file entirely and carried its own inline `copy` object; these keys are
     that copy, plus the two aria-labels it hardcoded. It is a reference-currency
     picker over an FX-rate table, so the group headers and the "Base"/"No trend"
     row badges are FX register: Pidgin is written only for the plain UI action
     (the sheet title) and the "Recent" group, and everything currency/FX-specific
     is UNTRANSLATED (shows English) rather than guessed. `{name}` in the a11y
     label is the selected currency's display name. */
  "currency.title": "Choose currency",
  "currency.search_placeholder": "Search currencies",
  "currency.no_results": "No currencies found",
  "currency.none": "No currencies available",
  "currency.group_base": "Base currency",
  "currency.group_recent": "Recent",
  "currency.group_popular": "Popular",
  "currency.group_all": "All currencies",
  "currency.group_search": "Search results",
  "currency.clear_search": "Clear currency search",
  "currency.base_badge": "Base",
  "currency.no_trend": "No trend",
  "currency.selected_a11y": "Choose currency, {name} selected",

  /* Report price, ReportPriceSheet.tsx:88-166, hardcoded English today. */
  "report.choose_market": "Choose market",
  "report.choose_item": "Choose item",
  "report.choose_quality": "Choose quality",
  "report.pick_item_first": "Pick an item first",
  "report.choose_unit": "Choose unit",
  "report.price_placeholder": "₦ e.g. 3500",
  "report.submitting": "Submitting…",
  "contribution.paused_title": "Reports temporarily unavailable",
  "contribution.paused_body": "We are adding safety checks before accepting food or visit reports.",
  "contribution.paused_action": "Reporting unavailable",
  "contribution.received_title": "Received for review",
  "contribution.received_body": "Waiting for review.",
  "contribution.replayed_body": "Already received. Still waiting for review.",
  "contribution.try_again_title": "Try again",
  "contribution.required": "Choose a market, food, type and size.",
  "contribution.price_required": "Enter a price from ₦5 to ₦5,000,000.",
  "contribution.maintenance": "Reports are unavailable right now. Try again later.",
  "contribution.invalid_input": "Check the details and try again.",
  "contribution.reporting_disabled": "Reports are closed right now.",
  "contribution.rate_limited": "Try again in {duration}.",
  "contribution.idempotency_conflict": "This report changed. Check it and send again.",
  "contribution.transport": "Couldn't confirm that report. Try again.",
  "contribution.new_report": "New report",

  /* Confirm visit, lifted verbatim from ConfirmVisitSheet.tsx:185-249, which
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

  /* FX & reference-rate panel, ExchangePanelView.tsx, hardcoded English today.
   *
   * This surface is about money end to end, so almost every line here is the
   * register the header warns against guessing at: provider names, the "does not
   * exchange money" disclaimer, the sample / listings disclaimers, the
   * rate-movement labels. A wrong nuance about a rate is a false statement about
   * a user's money. So the whole block is keyed for completeness and left
   * UNTRANSLATED in Pidgin and Yorùbá, waiting on a speaker who also carries the
   * FX register, not just the language. `{date}`/`{dist}`/`{direction}` are
   * runtime values the view supplies. */
  "exchange.foreign_amount_label": "Foreign amount",
  "exchange.naira_amount_label": "Naira amount",
  "exchange.reference_rate_answer": "Reference Rate Answer",
  "exchange.converter_section": "Interactive Currency Converter",
  "exchange.trend_section": "Rate Movement Trend",
  "exchange.provider_cbn": "CBN reference",
  "exchange.provider_frankfurter": "Frankfurter reference",
  "exchange.reference_rate": "Reference rate",
  "exchange.effective": "Effective {date}",
  "exchange.date_unavailable": "date unavailable",
  "exchange.same_currency": "1:1 Same currency",
  "exchange.swap_direction": "Swap conversion direction",
  "exchange.rate_disclaimer": "Reference rate estimate · WetinDey does not exchange money.",
  "exchange.rate_movement": "Rate Movement",
  "exchange.trend_time_range": "Trend Time Range",
  "exchange.high_label": "High:",
  "exchange.low_label": "Low:",
  "exchange.nearby_title": "Nearby exchange points",
  "exchange.sample": "Sample",
  "exchange.nearest": "Nearest {dist}",
  "exchange.finding_nearby": "Finding nearby places…",
  "exchange.no_listings": "No nearby map listings found.",
  "exchange.nearby_unavailable": "Nearby places unavailable.",
  "exchange.sample_disclaimer": "Sample places · not real businesses or offered rates.",
  "exchange.listings_disclaimer": "Map listings · rates, licence and opening status not verified.",
  "exchange.trend_aria": "Reference rate trend {direction}",
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
  // Was "O ti tan" in page.tsx:133, that is Yorùbá, sitting in the Pidgin
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

  // "Food", "Transport" and "Community" are standard in Lagos Pidgin and
  // unambiguous as category labels, the same treatment English one-word labels
  // get across this table. "Home & Living" and "Health & Beauty" are compound
  // marketing labels with no unambiguous Pidgin, so they show English rather than
  // a guess. `select_category` mirrors this table's "Pick ___" verb (report.choose_*).
  category_food: "Food",
  select_category: "Pick category",
  category_home: UNTRANSLATED,
  category_health: UNTRANSLATED,
  category_transport: "Transport",
  category_community: "Community",
  category_agri: UNTRANSLATED,

  // Verbatim English, the same class as "Done"/"Save"/"Settings" in this table:
  // a one-word UI control a Lagos speaker reads as-is.
  close: "Close",

  // "Back" joins that verbatim class (a one-word nav control read as-is). The
  // backdrop's "Dismiss" and the "Back to previous step" aria phrase are not
  // one-word controls and are not obviously read as-is, so they stay UNTRANSLATED
  // rather than guessed.
  dismiss: UNTRANSLATED,
  back: "Back",
  back_to_previous_step: UNTRANSLATED,

  "settings.radius_label": "How far you wan look",
  "settings.radius_a11y": "How far you wan look, for kilometre",
  "settings.radius_value": "{km} km",

  // BottomSheet handle a11y, UNTRANSLATED: a compound screen-reader instruction
  // ("… Activate to change.") is exactly the register the header says to leave
  // rather than guess. English shows through.
  "sheet.position_collapsed": UNTRANSLATED,
  "sheet.position_half": UNTRANSLATED,
  "sheet.position_expanded": UNTRANSLATED,

  "profile.title_signed_in": "Profile",
  "profile.title_signed_out": "You",
  "profile.signed_out_name": "Sign in to see WetinDey",
  "profile.my_reports": "My reports",
  "profile.saved_markets": "Markets wey I save",
  "profile.change_area": "Change area",
  "profile.settings": "Settings",
  "profile.report_problem": "Tell us wetin spoil",
  "profile.about": "About WetinDey",

  /* Manage profile. The short UI-noun labels stay verbatim English, the same
     treatment `profile.my_reports` and `profile.settings` get above, because a
     Lagos speaker reads "Name" / "Email" / "Save" as-is. The prose
     (`email_readonly_note`, `contact_placeholder`, `saved`) is UNTRANSLATED so
     English shows through rather than a guess. `save_error` / `load_error`
     mirror `reports.err_load`'s construction verbatim, the confident "We no fit
     ___ right now" register this table already ships. */
  "profile.manage": "Manage profile",
  // "Comot photo" mirrors `clear_search` ("Comot Search") verbatim in register;
  // "Change profile photo" mirrors `profile.change_area` ("Change area"), English
  // kept exactly as that row keeps it.
  "profile.change_photo": "Change profile photo",
  "profile.remove_photo": "Comot photo",
  "profile.name_label": "Name",
  "profile.email_label": "Email",
  "profile.email_readonly_note": UNTRANSLATED,
  "profile.contact_label": "Contact",
  "profile.contact_kind_phone": "Phone",
  "profile.contact_kind_whatsapp": "WhatsApp",
  "profile.contact_kind_sms": "SMS",
  "profile.contact_placeholder": UNTRANSLATED,
  "profile.save": "Save",
  "profile.saved": UNTRANSLATED,
  "profile.save_error": "We no fit save your profile right now.",
  "profile.load_error": "We no fit load your profile right now.",
  "profile.nearby_presence": UNTRANSLATED,
  "profile.not_available_yet": UNTRANSLATED,

  /* My reports.
   *
   * THE PROSE IS `UNTRANSLATED` AND THAT IS A DECISION, NOT LAZINESS. This
   * header's own doctrine: "Nigerian Pidgin is written for new keys where the
   * register is unambiguous. Where it is not, the key is UNTRANSLATED rather
   * than guessed." These are three sentences of careful explanatory prose about
   * anonymity and attribution, the hardest register in this app to land, and
   * the exact place a foreigner's guess reads worst. This repo shipped "Not dey"
   * once and it read worse to a Lagos shopper than English would have.
   *
   * The three keys that ARE written here each have direct precedent in this file
   * and invent nothing:
   *   · `reports.title` matches `profile.my_reports` above, verbatim.
   *   · `reports.err_load` mirrors LocationSheet.tsx:132's existing register.
   *   · `reports.sold_out` is `item.status_unavailable`'s word, owner-approved. */
  "reports.title": "My reports",
  "reports.empty_title": UNTRANSLATED,
  "reports.empty_body": UNTRANSLATED,
  "reports.empty_footnote": UNTRANSLATED,
  "reports.signed_out_title": UNTRANSLATED,
  "reports.signed_out_body": UNTRANSLATED,
  "reports.err_load": "We no fit load your reports right now.",
  "reports.sold_out": "E no dey",

  /* Report a problem.
   *
   * THE PROSE IS UNTRANSLATED, BY THE HEADER'S OWN RULE, the kind labels, the
   * body prompts, and above all `success_body` (three clauses about who reads a
   * report and that they may not reply) are exactly the register a foreigner's
   * guess reads worst in. English shows through, on purpose.
   *
   * The two written here have direct precedent and invent nothing:
   *   · `title` matches `profile.report_problem` above ("Tell us wetin spoil"),
   *     so the sheet reads the same as the row that opens it. Listed for review.
   *   · `err_send` mirrors `reports.err_load` / LocationSheet's register verbatim. */
  "problem.title": "Tell us wetin spoil",
  "problem.kind_label": UNTRANSLATED,
  "problem.kind_placeholder": UNTRANSLATED,
  "problem.kind_price": UNTRANSLATED,
  "problem.kind_place": UNTRANSLATED,
  "problem.kind_bug": UNTRANSLATED,
  "problem.kind_other": UNTRANSLATED,
  "problem.body_label": UNTRANSLATED,
  "problem.body_placeholder": UNTRANSLATED,
  "problem.send": UNTRANSLATED,
  "problem.sending": UNTRANSLATED,
  "problem.success_title": UNTRANSLATED,
  "problem.success_body": UNTRANSLATED,
  "problem.err_send": "We no fit send your report right now.",

  /* About / legal / support. EVERY key is UNTRANSLATED, and that is the
     doctrine, not laziness. This header's own rule: "Nigerian Pidgin is written
     for new keys where the register is unambiguous. Where it is not, the key is
     UNTRANSLATED rather than guessed." A privacy notice and a terms surface are
     careful explanatory prose about what data leaves the device, the single
     worst place in this app for a foreigner's guess, where a wrong nuance is a
     false statement to a user about their own information. The row labels ride
     the same decision: English ("Support", "Privacy") shows through honestly
     rather than a Pidgin coinage no Lagos speaker vouched for. */
  "about.title": UNTRANSLATED,
  "about.lede": UNTRANSLATED,
  "about.body_what": UNTRANSLATED,
  "about.body_prices": UNTRANSLATED,
  "about.body_account": UNTRANSLATED,
  "about.body_pilot": UNTRANSLATED,
  "about.terms": UNTRANSLATED,
  "about.privacy": UNTRANSLATED,
  "about.support": UNTRANSLATED,
  "about.back": UNTRANSLATED,
  "about.draft_notice": UNTRANSLATED,
  "about.terms_title": UNTRANSLATED,
  "about.terms_intro": UNTRANSLATED,
  "about.terms_prices": UNTRANSLATED,
  "about.terms_fulfilment": UNTRANSLATED,
  "about.terms_reporting": UNTRANSLATED,
  "about.privacy_title": UNTRANSLATED,
  "about.privacy_intro": UNTRANSLATED,
  "about.privacy_collect": UNTRANSLATED,
  "about.privacy_device": UNTRANSLATED,
  "about.privacy_third": UNTRANSLATED,
  "about.privacy_presence": UNTRANSLATED,
  "about.privacy_ads": UNTRANSLATED,
  "about.privacy_delete": UNTRANSLATED,
  "about.support_title": UNTRANSLATED,
  "about.support_body": UNTRANSLATED,
  "about.support_cta": UNTRANSLATED,

  /* The four reading surfaces, every key UNTRANSLATED, by the same doctrine as
     the About prose above: a help page, an accessibility statement and a licence
     screen are careful explanatory prose, exactly the register a foreigner's
     guess reads worst. English shows through, on purpose. */
  "about.how": UNTRANSLATED,
  "about.accessibility": UNTRANSLATED,
  "about.licenses": UNTRANSLATED,
  "about.attributions": UNTRANSLATED,
  "about.how_title": UNTRANSLATED,
  "about.how_area_title": UNTRANSLATED,
  "about.how_area_body": UNTRANSLATED,
  "about.how_need_title": UNTRANSLATED,
  "about.how_need_body": UNTRANSLATED,
  "about.how_signal_title": UNTRANSLATED,
  "about.how_signal_body": UNTRANSLATED,
  "about.how_freshness_title": UNTRANSLATED,
  "about.how_freshness_body": UNTRANSLATED,
  "about.how_maps_title": UNTRANSLATED,
  "about.how_maps_body": UNTRANSLATED,
  "about.how_contribute_title": UNTRANSLATED,
  "about.how_contribute_body": UNTRANSLATED,
  "about.how_confirm_title": UNTRANSLATED,
  "about.how_confirm_body": UNTRANSLATED,
  "about.a11y_title": UNTRANSLATED,
  "about.a11y_intro": UNTRANSLATED,
  "about.a11y_vision": UNTRANSLATED,
  "about.a11y_motion": UNTRANSLATED,
  "about.a11y_keyboard": UNTRANSLATED,
  "about.a11y_targets": UNTRANSLATED,
  "about.a11y_note": UNTRANSLATED,
  "about.licenses_title": UNTRANSLATED,
  "about.licenses_intro": UNTRANSLATED,
  "about.attributions_title": UNTRANSLATED,
  "about.attributions_photos_title": UNTRANSLATED,
  "about.attributions_photos_intro": UNTRANSLATED,
  "about.attributions_map_title": UNTRANSLATED,
  "about.attributions_map": UNTRANSLATED,

  // "Sign in"/"Sign out" stay English on purpose, `profile.signed_out_name`
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
  "auth.code_accepted": "Code correct",
  "auth.session_refreshing": "We dey sign you in",
  "auth.session_stalled": "Code correct. Refresh this screen.",
  "auth.refresh_session": "Refresh",

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
    "We dey send your location coordinate give WetinDey to pick the area wey near you.",
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
    "Location dey allowed, but position no come back (na so e dey do for inside house). Try again near window abi outside, abi pick area for down.",
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
    "Location dey allowed, but position no come back (na so e dey do for inside house). Try again near window abi outside, abi put yourself for one place for up.",
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
   * UNTRANSLATED on purpose, and this is the one place where that means
   * "already correct" rather than "not done".
   *
   * The English these fall back to IS the Pidgin, "E sure" / "Check am" /
   * "E no dey", set by a native speaker. Repeating them here would create a
   * second copy of three identical strings, and a duplicate that can drift is
   * exactly what this module keeps deleting: `LOCALE_NAMES` was removed for
   * being "a fourth copy of the picker's labels, waiting to disagree with them".
   *
   * So the fallback is not a shortfall here, it is the single source of truth
   * doing its job. If Pidgin ever needs to diverge from the default voice on
   * these three, that is the moment to write them, and not before.
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
    "This seller keep im contact private. You still fit go there, but details fit change before you reach.",
  "get.contact_none": "We no get am",
  "get.contact_none_footer":
    "This seller allow contact, but WetinDey never get phone number abi handle for dem. Nothing dey to call, and we no dey hide anything.",

  /* Get it, second wave. Only the two progress lines are written: "We dey ___…"
     is the construction this table already uses for `item.checking_prices`
     ("We dey check price…") and `area.locating` ("We dey find you…"), so they
     are consistent, though a Lagos speaker still owes them a read (both are in
     NEEDS_NATIVE_REVIEW). Everything else is UNTRANSLATED and shows English:
     "Last seen" is a WhatsApp-familiar phrase a Lagos user reads as-is; the
     reviews safety/moderation notes are the careful register the header says not
     to guess at. The two route-disclosure body sentences are now keyed (see the
     English table's note) but stay UNTRANSLATED here: a privacy/consent
     disclosure renders English in every shippable locale on purpose. */
  "get.last_seen": UNTRANSLATED,
  "get.offer_per": UNTRANSLATED,
  "get.more_details": UNTRANSLATED,
  "get.hide_details": UNTRANSLATED,
  "get.maps_fallback": UNTRANSLATED,
  "get.open_with_location": UNTRANSLATED,
  "get.use_current_location": UNTRANSLATED,
  "get.refreshing_location": "We dey refresh location…",
  "get.destination_only": UNTRANSLATED,
  "get.route_ready_body": UNTRANSLATED,
  "get.route_disclosure_body": UNTRANSLATED,
  "get.reviews_title": UNTRANSLATED,
  "get.reviews_prep_note": UNTRANSLATED,
  "get.reviews_loading": "We dey load reviews…",
  "get.reviews_unavailable_title": UNTRANSLATED,
  "get.reviews_unavailable_body": UNTRANSLATED,
  "get.reviews_one": UNTRANSLATED,
  "get.reviews_other": UNTRANSLATED,

  /* Currency picker. FX register: only the sheet's own action title ("Pick
     currency", the same "Pick ___" construction as report.choose_* below) and the
     "Recent" group (a one-word control read as-is, like `close`) are written. The
     rest names currencies, FX groups and trend and is UNTRANSLATED (shows English)
     rather than guessed. */
  "currency.title": "Pick currency",
  "currency.search_placeholder": UNTRANSLATED,
  "currency.no_results": UNTRANSLATED,
  "currency.none": UNTRANSLATED,
  "currency.group_base": UNTRANSLATED,
  "currency.group_recent": "Recent",
  "currency.group_popular": UNTRANSLATED,
  "currency.group_all": UNTRANSLATED,
  "currency.group_search": UNTRANSLATED,
  "currency.clear_search": UNTRANSLATED,
  "currency.base_badge": UNTRANSLATED,
  "currency.no_trend": UNTRANSLATED,
  "currency.selected_a11y": UNTRANSLATED,

  "report.choose_market": "Pick market",
  "report.choose_item": "Pick food",
  "report.choose_quality": "Pick quality",
  "report.pick_item_first": "Pick food first",
  "report.choose_unit": "Pick how dem pack am",
  "report.price_placeholder": "₦ like 3500",
  "report.submitting": "We dey send…",
  "contribution.paused_title": UNTRANSLATED,
  "contribution.paused_body": UNTRANSLATED,
  "contribution.paused_action": UNTRANSLATED,
  "contribution.received_title": UNTRANSLATED,
  "contribution.received_body": UNTRANSLATED,
  "contribution.replayed_body": UNTRANSLATED,
  "contribution.try_again_title": UNTRANSLATED,
  "contribution.required": UNTRANSLATED,
  "contribution.price_required": UNTRANSLATED,
  "contribution.maintenance": UNTRANSLATED,
  "contribution.invalid_input": UNTRANSLATED,
  "contribution.reporting_disabled": UNTRANSLATED,
  "contribution.rate_limited": UNTRANSLATED,
  "contribution.idempotency_conflict": UNTRANSLATED,
  "contribution.transport": UNTRANSLATED,
  "contribution.new_report": UNTRANSLATED,

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

  /* FX & reference-rate panel. Every key UNTRANSLATED, and that is the doctrine,
     not laziness: this is a money surface, and the header's rule is that Pidgin
     is written only where the register is unambiguous. FX provider names, rate
     disclaimers and rate-movement labels are exactly where a foreigner's guess
     reads worst, and a wrong nuance here is a false statement about a rate.
     English shows through until an FX-literate Pidgin speaker writes it. */
  "exchange.foreign_amount_label": UNTRANSLATED,
  "exchange.naira_amount_label": UNTRANSLATED,
  "exchange.reference_rate_answer": UNTRANSLATED,
  "exchange.converter_section": UNTRANSLATED,
  "exchange.trend_section": UNTRANSLATED,
  "exchange.provider_cbn": UNTRANSLATED,
  "exchange.provider_frankfurter": UNTRANSLATED,
  "exchange.reference_rate": UNTRANSLATED,
  "exchange.effective": UNTRANSLATED,
  "exchange.date_unavailable": UNTRANSLATED,
  "exchange.same_currency": UNTRANSLATED,
  "exchange.swap_direction": UNTRANSLATED,
  "exchange.rate_disclaimer": UNTRANSLATED,
  "exchange.rate_movement": UNTRANSLATED,
  "exchange.trend_time_range": UNTRANSLATED,
  "exchange.high_label": UNTRANSLATED,
  "exchange.low_label": UNTRANSLATED,
  "exchange.nearby_title": UNTRANSLATED,
  "exchange.sample": UNTRANSLATED,
  "exchange.nearest": UNTRANSLATED,
  "exchange.finding_nearby": UNTRANSLATED,
  "exchange.no_listings": UNTRANSLATED,
  "exchange.nearby_unavailable": UNTRANSLATED,
  "exchange.sample_disclaimer": UNTRANSLATED,
  "exchange.listings_disclaimer": UNTRANSLATED,
  "exchange.trend_aria": UNTRANSLATED,
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
 * review, "better than the rest of this file" is not the same as "correct".
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

  // LANES H2: Yorùbá withheld pending a native speaker; no agent stands in.
  category_food: UNTRANSLATED,
  select_category: UNTRANSLATED,
  category_home: UNTRANSLATED,
  category_health: UNTRANSLATED,
  category_transport: UNTRANSLATED,
  category_community: UNTRANSLATED,
  category_agri: UNTRANSLATED,

  // LANES H2: Yorùbá withheld pending a native speaker.
  close: UNTRANSLATED,

  // LANES H2: Yorùbá withheld pending a native speaker.
  dismiss: UNTRANSLATED,
  back: UNTRANSLATED,
  back_to_previous_step: UNTRANSLATED,

  "settings.radius_label": UNTRANSLATED,
  "settings.radius_a11y": UNTRANSLATED,
  "settings.radius_value": "{km} km",

  // LANES H2: Yorùbá withheld pending a native speaker.
  "sheet.position_collapsed": UNTRANSLATED,
  "sheet.position_half": UNTRANSLATED,
  "sheet.position_expanded": UNTRANSLATED,

  "profile.title_signed_in": UNTRANSLATED,
  "profile.title_signed_out": UNTRANSLATED,
  "profile.signed_out_name": UNTRANSLATED,
  "profile.my_reports": UNTRANSLATED,
  "profile.saved_markets": UNTRANSLATED,
  "profile.change_area": UNTRANSLATED,
  "profile.settings": UNTRANSLATED,
  "profile.report_problem": UNTRANSLATED,
  "profile.about": UNTRANSLATED,

  /* Manage profile. Every key UNTRANSLATED, LANES H2: Yorùbá is withheld pending
     a native speaker, and no agent may stand in for one. English shows through. */
  "profile.manage": UNTRANSLATED,
  "profile.change_photo": UNTRANSLATED,
  "profile.remove_photo": UNTRANSLATED,
  "profile.name_label": UNTRANSLATED,
  "profile.email_label": UNTRANSLATED,
  "profile.email_readonly_note": UNTRANSLATED,
  "profile.contact_label": UNTRANSLATED,
  "profile.contact_kind_phone": UNTRANSLATED,
  "profile.contact_kind_whatsapp": UNTRANSLATED,
  "profile.contact_kind_sms": UNTRANSLATED,
  "profile.contact_placeholder": UNTRANSLATED,
  "profile.save": UNTRANSLATED,
  "profile.saved": UNTRANSLATED,
  "profile.save_error": UNTRANSLATED,
  "profile.load_error": UNTRANSLATED,
  "profile.nearby_presence": UNTRANSLATED,
  "profile.not_available_yet": UNTRANSLATED,

  /* My reports. Every key, without exception, LANES H2: Yorùbá is withheld
     pending a native speaker, and no agent may stand in for one. English shows
     through, on purpose. */
  "reports.title": UNTRANSLATED,
  "reports.empty_title": UNTRANSLATED,
  "reports.empty_body": UNTRANSLATED,
  "reports.empty_footnote": UNTRANSLATED,
  "reports.signed_out_title": UNTRANSLATED,
  "reports.signed_out_body": UNTRANSLATED,
  "reports.err_load": UNTRANSLATED,
  "reports.sold_out": UNTRANSLATED,

  /* Report a problem. Every key UNTRANSLATED, LANES H2: Yorùbá is withheld
     pending a native speaker. English shows through, on purpose. */
  "problem.title": UNTRANSLATED,
  "problem.kind_label": UNTRANSLATED,
  "problem.kind_placeholder": UNTRANSLATED,
  "problem.kind_price": UNTRANSLATED,
  "problem.kind_place": UNTRANSLATED,
  "problem.kind_bug": UNTRANSLATED,
  "problem.kind_other": UNTRANSLATED,
  "problem.body_label": UNTRANSLATED,
  "problem.body_placeholder": UNTRANSLATED,
  "problem.send": UNTRANSLATED,
  "problem.sending": UNTRANSLATED,
  "problem.success_title": UNTRANSLATED,
  "problem.success_body": UNTRANSLATED,
  "problem.err_send": UNTRANSLATED,

  /* About / legal / support. Every key, without exception, LANES H2: Yorùbá is
     withheld pending a native speaker, and no agent may stand in for one, least
     of all for a privacy notice. English shows through, on purpose. */
  "about.title": UNTRANSLATED,
  "about.lede": UNTRANSLATED,
  "about.body_what": UNTRANSLATED,
  "about.body_prices": UNTRANSLATED,
  "about.body_account": UNTRANSLATED,
  "about.body_pilot": UNTRANSLATED,
  "about.terms": UNTRANSLATED,
  "about.privacy": UNTRANSLATED,
  "about.support": UNTRANSLATED,
  "about.back": UNTRANSLATED,
  "about.draft_notice": UNTRANSLATED,
  "about.terms_title": UNTRANSLATED,
  "about.terms_intro": UNTRANSLATED,
  "about.terms_prices": UNTRANSLATED,
  "about.terms_fulfilment": UNTRANSLATED,
  "about.terms_reporting": UNTRANSLATED,
  "about.privacy_title": UNTRANSLATED,
  "about.privacy_intro": UNTRANSLATED,
  "about.privacy_collect": UNTRANSLATED,
  "about.privacy_device": UNTRANSLATED,
  "about.privacy_third": UNTRANSLATED,
  "about.privacy_presence": UNTRANSLATED,
  "about.privacy_ads": UNTRANSLATED,
  "about.privacy_delete": UNTRANSLATED,
  "about.support_title": UNTRANSLATED,
  "about.support_body": UNTRANSLATED,
  "about.support_cta": UNTRANSLATED,

  /* The four reading surfaces. Every key, without exception, LANES H2: Yorùbá is
     withheld pending a native speaker, and no agent may stand in for one, least of
     all for a help page or an accessibility statement. English shows through, on
     purpose. */
  "about.how": UNTRANSLATED,
  "about.accessibility": UNTRANSLATED,
  "about.licenses": UNTRANSLATED,
  "about.attributions": UNTRANSLATED,
  "about.how_title": UNTRANSLATED,
  "about.how_area_title": UNTRANSLATED,
  "about.how_area_body": UNTRANSLATED,
  "about.how_need_title": UNTRANSLATED,
  "about.how_need_body": UNTRANSLATED,
  "about.how_signal_title": UNTRANSLATED,
  "about.how_signal_body": UNTRANSLATED,
  "about.how_freshness_title": UNTRANSLATED,
  "about.how_freshness_body": UNTRANSLATED,
  "about.how_maps_title": UNTRANSLATED,
  "about.how_maps_body": UNTRANSLATED,
  "about.how_contribute_title": UNTRANSLATED,
  "about.how_contribute_body": UNTRANSLATED,
  "about.how_confirm_title": UNTRANSLATED,
  "about.how_confirm_body": UNTRANSLATED,
  "about.a11y_title": UNTRANSLATED,
  "about.a11y_intro": UNTRANSLATED,
  "about.a11y_vision": UNTRANSLATED,
  "about.a11y_motion": UNTRANSLATED,
  "about.a11y_keyboard": UNTRANSLATED,
  "about.a11y_targets": UNTRANSLATED,
  "about.a11y_note": UNTRANSLATED,
  "about.licenses_title": UNTRANSLATED,
  "about.licenses_intro": UNTRANSLATED,
  "about.attributions_title": UNTRANSLATED,
  "about.attributions_photos_title": UNTRANSLATED,
  "about.attributions_photos_intro": UNTRANSLATED,
  "about.attributions_map_title": UNTRANSLATED,
  "about.attributions_map": UNTRANSLATED,

  /* Sign in. Every key, without exception, the header's rule for NEW keys, and
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
  "auth.code_accepted": UNTRANSLATED,
  "auth.session_refreshing": UNTRANSLATED,
  "auth.session_stalled": UNTRANSLATED,
  "auth.refresh_session": UNTRANSLATED,

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

  /* Get it, second wave. Every key UNTRANSLATED, LANES H2: Yorùbá is withheld
     pending a native speaker, and no agent may stand in for one. English shows
     through, on purpose. */
  "get.last_seen": UNTRANSLATED,
  "get.offer_per": UNTRANSLATED,
  "get.more_details": UNTRANSLATED,
  "get.hide_details": UNTRANSLATED,
  "get.maps_fallback": UNTRANSLATED,
  "get.open_with_location": UNTRANSLATED,
  "get.use_current_location": UNTRANSLATED,
  "get.refreshing_location": UNTRANSLATED,
  "get.destination_only": UNTRANSLATED,
  "get.route_ready_body": UNTRANSLATED,
  "get.route_disclosure_body": UNTRANSLATED,
  "get.reviews_title": UNTRANSLATED,
  "get.reviews_prep_note": UNTRANSLATED,
  "get.reviews_loading": UNTRANSLATED,
  "get.reviews_unavailable_title": UNTRANSLATED,
  "get.reviews_unavailable_body": UNTRANSLATED,
  "get.reviews_one": UNTRANSLATED,
  "get.reviews_other": UNTRANSLATED,

  // Currency picker. Yorùbá withheld pending a native speaker.
  "currency.title": UNTRANSLATED,
  "currency.search_placeholder": UNTRANSLATED,
  "currency.no_results": UNTRANSLATED,
  "currency.none": UNTRANSLATED,
  "currency.group_base": UNTRANSLATED,
  "currency.group_recent": UNTRANSLATED,
  "currency.group_popular": UNTRANSLATED,
  "currency.group_all": UNTRANSLATED,
  "currency.group_search": UNTRANSLATED,
  "currency.clear_search": UNTRANSLATED,
  "currency.base_badge": UNTRANSLATED,
  "currency.no_trend": UNTRANSLATED,
  "currency.selected_a11y": UNTRANSLATED,

  "report.choose_market": UNTRANSLATED,
  "report.choose_item": UNTRANSLATED,
  "report.choose_quality": UNTRANSLATED,
  "report.pick_item_first": UNTRANSLATED,
  "report.choose_unit": UNTRANSLATED,
  "report.price_placeholder": UNTRANSLATED,
  "report.submitting": UNTRANSLATED,
  "contribution.paused_title": UNTRANSLATED,
  "contribution.paused_body": UNTRANSLATED,
  "contribution.paused_action": UNTRANSLATED,
  "contribution.received_title": UNTRANSLATED,
  "contribution.received_body": UNTRANSLATED,
  "contribution.replayed_body": UNTRANSLATED,
  "contribution.try_again_title": UNTRANSLATED,
  "contribution.required": UNTRANSLATED,
  "contribution.price_required": UNTRANSLATED,
  "contribution.maintenance": UNTRANSLATED,
  "contribution.invalid_input": UNTRANSLATED,
  "contribution.reporting_disabled": UNTRANSLATED,
  "contribution.rate_limited": UNTRANSLATED,
  "contribution.idempotency_conflict": UNTRANSLATED,
  "contribution.transport": UNTRANSLATED,
  "contribution.new_report": UNTRANSLATED,

  // Verbatim from ConfirmVisitSheet.tsx:228-248, the good Yorùbá in this repo.
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

  /* FX & reference-rate panel. Every key UNTRANSLATED, LANES H2: Yorùbá is
     withheld pending a native speaker, and no agent may stand in for one, least
     of all on a money surface. English shows through, on purpose. */
  "exchange.foreign_amount_label": UNTRANSLATED,
  "exchange.naira_amount_label": UNTRANSLATED,
  "exchange.reference_rate_answer": UNTRANSLATED,
  "exchange.converter_section": UNTRANSLATED,
  "exchange.trend_section": UNTRANSLATED,
  "exchange.provider_cbn": UNTRANSLATED,
  "exchange.provider_frankfurter": UNTRANSLATED,
  "exchange.reference_rate": UNTRANSLATED,
  "exchange.effective": UNTRANSLATED,
  "exchange.date_unavailable": UNTRANSLATED,
  "exchange.same_currency": UNTRANSLATED,
  "exchange.swap_direction": UNTRANSLATED,
  "exchange.rate_disclaimer": UNTRANSLATED,
  "exchange.rate_movement": UNTRANSLATED,
  "exchange.trend_time_range": UNTRANSLATED,
  "exchange.high_label": UNTRANSLATED,
  "exchange.low_label": UNTRANSLATED,
  "exchange.nearby_title": UNTRANSLATED,
  "exchange.sample": UNTRANSLATED,
  "exchange.nearest": UNTRANSLATED,
  "exchange.finding_nearby": UNTRANSLATED,
  "exchange.no_listings": UNTRANSLATED,
  "exchange.nearby_unavailable": UNTRANSLATED,
  "exchange.sample_disclaimer": UNTRANSLATED,
  "exchange.listings_disclaimer": UNTRANSLATED,
  "exchange.trend_aria": UNTRANSLATED,
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
 * This is not the same as `UNTRANSLATED`. These strings render, a user sees
 * them, and they may be wrong, awkward, or untoned. They are the trust risk,
 * because a user cannot tell "unreviewed" from "sloppy": they only see an app
 * that speaks their language badly.
 *
 * Typed against `StringKey`, so a rename cannot leave a stale entry behind
 * quietly claiming a key was reviewed.
 *
 * Clear an entry only when a native speaker has actually read it.
 */
export const NEEDS_NATIVE_REVIEW: Readonly<Record<Exclude<Locale, "en">, readonly StringKey[]>> = {
  /**
   * Nigerian Pidgin. The inherited keys are uneven in register, `radius`
   * ("Distance where you dey find market") is a description, not a label, and
   * `settings`/`share`/`language` are simply English. New keys are written to a
   * consistent register but want a Lagos speaker's ear, particularly the
   * confidence words: "Small small" for medium confidence is idiomatic but may
   * read as hedging about the FOOD rather than about the DATA, which would
   * invert the meaning of the whole trust model.
   *
   * The `auth.*` entries are the sign-in flow. They were written by mirroring
   * constructions this table already uses ("E no send." is `confirm.failed`
   * verbatim), which makes them consistent but does not make them vouched for ,
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
    // Get-it second wave. Both are the "We dey ___…" progress construction this
    // table already uses (item.checking_prices, area.locating), consistent but
    // still owed a Lagos speaker's read.
    "get.refreshing_location",
    "get.reviews_loading",
    // "Pick currency" mirrors the report.choose_* "Pick ___" construction, which
    // makes it consistent but not vouched: unlike those, a Lagos speaker has not
    // read it. (currency.group_recent "Recent" is verbatim English like `close`
    // and needs no review.)
    "currency.title",
    "profile.report_problem",
    // "Tell us wetin spoil", the same phrase as `profile.report_problem` above,
    // carried onto the sheet's own title so the two agree. Genuine Pidgin, but it
    // wants a Lagos speaker's ear like everything else here.
    "problem.title",
  ],

  /**
   * Yorùbá. EVERY rendering string in this locale is unreviewed.
   *
   * The 34 inherited keys read machine-translated: "Eto" for Settings is
   * untoned (Ẹ̀tọ́), "sync" and "offline" sit untranslated inside `offline_msg`,
   * and `wetin_dey` renders the brand name as a phrase ("Kilo n ṣẹlẹ") rather
   * than as a name, a brand should not be translated at all. The `confirm.*`
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
