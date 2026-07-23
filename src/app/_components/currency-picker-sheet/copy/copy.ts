export const RECENTS_KEY = "wetindey:reference-currency-recents:v1";
export const MAX_RECENTS = 3;

/* The user-facing copy that used to live here as an inline `copy` object now
   lives in the one dictionary, src/core/i18n/strings.ts, under `currency.*`, and
   is read through useT() in the view and content. Only the device-local storage
   key and recents cap stay here; they are not copy. */
