/**
 * Naira, formatted once.
 *
 * This app stores every price in KOBO — an integer, because money in a float is
 * a bug waiting for a decimal. Nothing outside this file should divide by 100:
 * that constant is the storage unit leaking into the view, and it leaked into
 * five files before this one existed.
 *
 * IT REPLACED FIVE byte-identical copies, none exported, under three names
 * (`formatPrice`, `naira`, `formatNaira`). Four now import this one: `page.tsx`, `ItemCard`,
 * `GetItSheet` (whose copy was itself named `formatNaira`, shadowing this), and
 * `ConfirmVisitSheet`. The fifth, `ItemDetailSheet`'s `naira`, is the auth
 * lane's and stays theirs until they convert it. A sixth copy would have been
 * the easy thing and the wrong one.
 *
 * `maximumFractionDigits: 0` is not cosmetic. Nigerian street prices are whole
 * naira; kobo has not circulated as coin in decades, so "₦4,500.00" reads as a
 * receipt from a bank rather than a price from a market.
 */

/**
 * Hoisted, not built per call. `Intl.NumberFormat` construction is the expensive
 * half of this operation and these lists re-render on every map pan.
 */
const NAIRA = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

/** Kobo in, "₦4,500" out. The argument is ALWAYS kobo — never naira. */
export function formatNaira(kobo: number): string {
  return NAIRA.format(kobo / 100);
}
