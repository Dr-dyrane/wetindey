/**
 * Naira, formatted once.
 *
 * This app stores every price in KOBO — an integer, because money in a float is
 * a bug waiting for a decimal. Nothing outside this file should divide by 100:
 * that constant is the storage unit leaking into the view, and it leaked into
 * five files before this one existed.
 *
 * THE FIVE COPIES THIS REPLACES, all byte-identical, none exported, three
 * different names:
 *   · src/app/page.tsx:864                          `formatPrice`
 *   · src/design-system/components/ItemCard.tsx:25  `naira`
 *   · src/app/_components/ItemDetailSheet.tsx:91    `naira`
 *   · src/app/_components/GetItSheet.tsx:211        `naira`
 *   · src/app/_components/ConfirmVisitSheet.tsx:371 `naira`
 *
 * Only the first is in this lane, so only the first is converted here. The other
 * four are handed to their owners rather than reached into — a sixth copy would
 * have been the easy thing and the wrong one.
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
