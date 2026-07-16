/**
 * The seed's content layer: the basket, the pricing, and the extra places.
 *
 * `seed.ts` owns the database mechanics — connect, migrate, truncate, insert.
 * This file owns *what* gets inserted, so the two can move independently and so
 * the numbers below can be argued with directly.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PRICES
 *
 * Every price is in KOBO (naira * 100), because `observations.price_amount` and
 * `offers_current.price_min` are `integer` columns and naira with decimals in a
 * float would drift. The ceiling of a Postgres `integer` is 2,147,483,647 kobo
 * (~₦21.4m); the most expensive row here is a carton of frozen titus at
 * ₦120,000 = 12,000,000 kobo, so there is a wide margin.
 *
 * The anchor is the rice row already in the seed: a 50kg bag of imported
 * parboiled rice at ₦82,000–₦92,000, which is where Lagos actually sits. Every
 * other price is set relative to that, at open-market rates for south-west
 * Lagos. `seed.ts` then applies its own per-channel multiplier on top
 * (supermarket 1.08, kiosk 1.04, open market 0.96), so the ranges here are the
 * *pre-premium* market band — do not bake a supermarket markup into them twice.
 *
 * These are seed figures for a pilot, not a price index. They are plausible,
 * not observed. Nothing in this file should ever be presented to a user as a
 * real reading; that is what `observations` rows from real sources are for.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ALIASES
 *
 * A Nigerian shopper asks for `ewa`, not "Oloyin Beans". Each alias below
 * is a name people genuinely use, tagged with the language it comes from:
 *
 *   yo   Yoruba      ig   Igbo      ha   Hausa
 *   pcm  Nigerian Pidgin / Lagos market shorthand
 *   en   English
 *
 * Aliases are written WITHOUT tone marks or diacritics on purpose. `actions.ts`
 * matches with `ilike(itemAliases.alias, q)` against the raw string, and nobody
 * types `ẹ̀wà` into a search field on a phone — they type `ewa`.
 *
 * Where a language has no settled word for a thing, or where I could not vouch
 * for one, THERE IS NO ALIAS. An invented alias is worse than a missing one: it
 * teaches the search index a word no one says, and it insults the reader who
 * does speak the language. Some entries below carry only a `pcm` alias for that
 * reason, and a few (spaghetti, sardines) carry none at all.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * IMAGES
 *
 * Deliberately absent. `itemImages.ts` holds eleven verified Wikimedia Commons
 * photos keyed by item slug, and every one of those slugs survives here
 * unchanged, so `seed.ts`'s `withImage()` keeps attaching them. The new items
 * have no photo and will render the per-slug monogram, which is the correct
 * outcome: a guessed Commons URL that 404s is a broken image plus a false
 * attribution, and it fails silently months later. A monogram is honest.
 */

import type { SeedPlace } from "./lagosSouthWest";

type PlaceType = SeedPlace["placeType"];

/** Naira → kobo. Every price literal below goes through this. */
const naira = (n: number) => n * 100;

// ─────────────────────────────────────────────────────────────────────────────
// UNITS
// ─────────────────────────────────────────────────────────────────────────────

export interface SeedUnit {
  code: string;
  displayName: string;
  dimension: "mass" | "volume" | "count";
  canonicalQuantity: number;
  notes?: string;
}

/**
 * The full units table.
 *
 * The first nine are exactly the nine `seed.ts` already inserts, in the same
 * order and with the same codes — replacing its literal array with this one is
 * a no-op for existing rows.
 *
 * The rest exist because the basket needs them and forcing a real item into a
 * wrong unit is a lie about its price. Bread is not sold by the kilogram; eggs
 * are sold by the crate of thirty; Maggi is sold by the sachet. Pricing a loaf
 * against `1kg_measure` would produce a number that is arithmetically fine and
 * factually nonsense.
 *
 * `congo_cup` and `derica_cup` are real Lagos market measures, not inventions —
 * a congo is the ~1kg milk-cup grain measure, a derica the smaller tomato-tin
 * measure. Their `canonicalQuantity` is approximate by nature: they are volume
 * scoops, and what a congo of beans weighs is not what a congo of garri weighs.
 */
export const SEED_UNITS: SeedUnit[] = [
  // ── the existing nine, unchanged ──
  { code: "50kg_bag", displayName: "50kg bag", dimension: "mass", canonicalQuantity: 50 },
  { code: "25kg_bag", displayName: "25kg bag", dimension: "mass", canonicalQuantity: 25 },
  { code: "1kg_measure", displayName: "1kg measure", dimension: "mass", canonicalQuantity: 1 },
  { code: "paint_bucket", displayName: "Paint bucket", dimension: "volume", canonicalQuantity: 4 },
  { code: "derica_cup", displayName: "Derica cup", dimension: "volume", canonicalQuantity: 0.8 },
  { code: "single_tuber", displayName: "Single tuber", dimension: "count", canonicalQuantity: 1 },
  { code: "bunch", displayName: "Bunch", dimension: "count", canonicalQuantity: 1 },
  { code: "1l_bottle", displayName: "1L bottle", dimension: "volume", canonicalQuantity: 1 },
  { code: "5l_bottle", displayName: "5L bottle", dimension: "volume", canonicalQuantity: 5 },

  // ── added, because the basket below cannot be priced honestly without them ──
  {
    code: "congo_cup",
    displayName: "Congo",
    dimension: "volume",
    canonicalQuantity: 1,
    notes: "The standard Lagos grain scoop, roughly a kilogram of rice or beans. Volume, so the mass it holds varies by grain."
  },
  {
    code: "basket",
    displayName: "Basket",
    dimension: "count",
    canonicalQuantity: 1,
    notes: "The large raffia market basket used for tomatoes and pepper. Size is not standardised; treat the price as indicative of a full basket at that stall."
  },
  {
    code: "25l_keg",
    displayName: "25L keg",
    dimension: "volume",
    canonicalQuantity: 25,
    notes: "Jerrycan of cooking oil, the wholesale unit."
  },
  { code: "crate_30_eggs", displayName: "Crate of 30 eggs", dimension: "count", canonicalQuantity: 30 },
  { code: "loaf", displayName: "Loaf", dimension: "count", canonicalQuantity: 1 },
  { code: "carton", displayName: "Carton", dimension: "count", canonicalQuantity: 1, notes: "Pack count differs per product — see the variant's attributes." },
  { code: "tin", displayName: "Tin", dimension: "count", canonicalQuantity: 1, notes: "Tin size differs per product — see the variant's attributes." },
  { code: "sachet", displayName: "Sachet", dimension: "count", canonicalQuantity: 1 },
  { code: "pack_500g", displayName: "500g pack", dimension: "mass", canonicalQuantity: 0.5 },
  { code: "5kg_pack", displayName: "5kg pack", dimension: "mass", canonicalQuantity: 5 },
  { code: "each", displayName: "Each", dimension: "count", canonicalQuantity: 1 }
];

const UNIT_CODES = new Set(SEED_UNITS.map((u) => u.code));

// ─────────────────────────────────────────────────────────────────────────────
// ITEMS
// ─────────────────────────────────────────────────────────────────────────────

export interface SeedAlias {
  alias: string;
  /** yo | ig | ha | pcm | en */
  locale: string;
  /** Higher ranks first in search. 3 = the name most people actually use. */
  weight: number;
}

export interface SeedVariant {
  slug: string;
  displayName: string;
  /** Must be a code in SEED_UNITS. Checked by assertSeedContent(). */
  unitCode: string;
  /** Pre-premium open-market band, in kobo. min < max. */
  priceKobo: { min: number; max: number };
  attributes?: Record<string, string | number>;
}

export interface SeedItem {
  slug: string;
  canonicalName: string;
  description: string;
  aliases: SeedAlias[];
  variants: SeedVariant[];
  /** Where this plausibly sells. A supermarket does not sell a basket of rodo. */
  channels: PlaceType[];
}

const ALL_CHANNELS: PlaceType[] = ["open_market", "supermarket", "kiosk"];
const MARKET_ONLY: PlaceType[] = ["open_market"];
const MARKET_AND_KIOSK: PlaceType[] = ["open_market", "kiosk"];

/**
 * The basket: 38 items, ~70 variants.
 *
 * The first eleven slugs are the ones already seeded and are untouched, because
 * `itemImages.ts` keys its verified photos off them. Reordering is safe;
 * renaming is not.
 */
export const SEED_ITEMS: SeedItem[] = [
  // ═══ Grains and staples ═══
  {
    slug: "rice",
    canonicalName: "Rice",
    description: "Local and imported parboiled rice",
    channels: ALL_CHANNELS,
    aliases: [
      { alias: "shinkafa", locale: "ha", weight: 3 },
      { alias: "iresi", locale: "yo", weight: 3 },
      { alias: "osikapa", locale: "ig", weight: 2 }
    ],
    variants: [
      {
        slug: "rice-50kg-imported",
        displayName: "Imported Parboiled Rice",
        unitCode: "50kg_bag",
        priceKobo: { min: naira(82_000), max: naira(105_000) },
        attributes: { grade: "Long-grain parboiled", origin: "Imported", packaging: "50kg bag" }
      },
      {
        slug: "rice-50kg-local",
        displayName: "Local Stone-Free Rice",
        unitCode: "50kg_bag",
        priceKobo: { min: naira(72_000), max: naira(92_000) },
        attributes: { grade: "Destoned", origin: "Nigerian", packaging: "50kg bag" }
      },
      {
        slug: "rice-congo-loose",
        displayName: "Loose Rice by the Congo",
        unitCode: "congo_cup",
        priceKobo: { min: naira(1_900), max: naira(2_500) },
        attributes: { grade: "Parboiled", packaging: "Measured from an open bag" }
      }
    ]
  },
  {
    slug: "oloyin-beans",
    canonicalName: "Oloyin Beans",
    description: "Honey beans",
    channels: ALL_CHANNELS,
    aliases: [
      { alias: "ewa", locale: "yo", weight: 3 },
      { alias: "ewa oloyin", locale: "yo", weight: 3 },
      { alias: "agwa", locale: "ig", weight: 2 },
      { alias: "wake", locale: "ha", weight: 2 }
    ],
    variants: [
      {
        slug: "beans-oloyin-1kg",
        displayName: "Oloyin Honey Beans",
        unitCode: "1kg_measure",
        priceKobo: { min: naira(2_200), max: naira(2_800) },
        attributes: { grade: "Oloyin", packaging: "Loose, weighed" }
      },
      {
        slug: "beans-oloyin-congo",
        displayName: "Oloyin Beans by the Congo",
        unitCode: "congo_cup",
        priceKobo: { min: naira(2_400), max: naira(3_100) }
      },
      {
        slug: "beans-drum-1kg",
        displayName: "Drum Beans (Olotu)",
        unitCode: "1kg_measure",
        priceKobo: { min: naira(2_000), max: naira(2_600) },
        attributes: { grade: "Olotu / drum", packaging: "Loose, weighed" }
      }
    ]
  },
  {
    slug: "white-garri",
    canonicalName: "White Garri",
    description: "White cassava flakes",
    channels: ALL_CHANNELS,
    aliases: [
      { alias: "gari", locale: "yo", weight: 3 },
      { alias: "gari funfun", locale: "yo", weight: 2 },
      { alias: "leki", locale: "yo", weight: 1 }
    ],
    variants: [
      {
        slug: "garri-white-paint",
        displayName: "White Open-Market Garri",
        unitCode: "paint_bucket",
        priceKobo: { min: naira(2_800), max: naira(3_800) }
      },
      {
        slug: "garri-ijebu-paint",
        displayName: "Ijebu Garri",
        unitCode: "paint_bucket",
        priceKobo: { min: naira(3_600), max: naira(4_600) },
        attributes: { grade: "Ijebu", note: "Sour, fine-grained; the drinking garri" }
      },
      {
        slug: "garri-white-congo",
        displayName: "White Garri by the Congo",
        unitCode: "congo_cup",
        priceKobo: { min: naira(800), max: naira(1_200) }
      }
    ]
  },
  {
    slug: "yellow-garri",
    canonicalName: "Yellow Garri",
    description: "Yellow garri, fried with palm oil",
    channels: ALL_CHANNELS,
    aliases: [
      { alias: "gari pupa", locale: "yo", weight: 3 },
      { alias: "ijebu", locale: "yo", weight: 1 }
    ],
    variants: [
      {
        slug: "garri-yellow-paint",
        displayName: "Yellow Garri",
        unitCode: "paint_bucket",
        priceKobo: { min: naira(3_200), max: naira(4_200) },
        attributes: { grade: "Yellow", note: "Fried with palm oil, which is where the colour comes from" }
      },
      {
        slug: "garri-yellow-congo",
        displayName: "Yellow Garri by the Congo",
        unitCode: "congo_cup",
        priceKobo: { min: naira(900), max: naira(1_400) }
      }
    ]
  },
  {
    slug: "semovita",
    canonicalName: "Semolina",
    description: "Semolina swallow flour",
    channels: ALL_CHANNELS,
    // "Semovita" is a Flour Mills brand that became the generic word for the
    // product, the way "biro" did for a pen. Nigerians ask for semo.
    aliases: [
      { alias: "semo", locale: "pcm", weight: 3 },
      { alias: "semovita", locale: "pcm", weight: 3 }
    ],
    variants: [
      {
        slug: "semovita-1kg",
        displayName: "Semolina Flour",
        unitCode: "1kg_measure",
        priceKobo: { min: naira(1_800), max: naira(2_400) },
        attributes: { packaging: "1kg pack" }
      },
      {
        slug: "semovita-5kg",
        displayName: "Semolina Flour (5kg)",
        unitCode: "5kg_pack",
        priceKobo: { min: naira(8_500), max: naira(11_000) },
        attributes: { packaging: "5kg pack" }
      }
    ]
  },
  {
    slug: "wheat-meal",
    canonicalName: "Wheat Meal",
    description: "Wheat swallow flour",
    channels: ALL_CHANNELS,
    aliases: [{ alias: "alikama", locale: "ha", weight: 3 }],
    variants: [
      {
        slug: "wheat-meal-1kg",
        displayName: "Wheat Meal Flour",
        unitCode: "1kg_measure",
        priceKobo: { min: naira(2_200), max: naira(2_900) },
        attributes: { packaging: "1kg pack" }
      }
    ]
  },
  {
    slug: "ogi-pap",
    canonicalName: "Pap",
    description: "Fermented maize pap",
    channels: MARKET_AND_KIOSK,
    aliases: [
      { alias: "ogi", locale: "yo", weight: 3 },
      { alias: "akamu", locale: "ig", weight: 3 },
      { alias: "koko", locale: "ha", weight: 2 },
      { alias: "pap", locale: "pcm", weight: 2 }
    ],
    variants: [
      {
        slug: "ogi-wet-1kg",
        displayName: "Wet Pap",
        unitCode: "1kg_measure",
        priceKobo: { min: naira(1_300), max: naira(1_900) },
        attributes: { packaging: "Wrapped in leaf or nylon", note: "Perishable — a few days at most" }
      },
      {
        slug: "ogi-wrap-single",
        displayName: "Single Pap Wrap",
        unitCode: "each",
        priceKobo: { min: naira(300), max: naira(600) }
      }
    ]
  },

  // ═══ Tubers, plantain, vegetables ═══
  {
    slug: "yam",
    canonicalName: "Yam",
    description: "Yam tuber",
    channels: ALL_CHANNELS,
    aliases: [
      { alias: "isu", locale: "yo", weight: 3 },
      { alias: "ji", locale: "ig", weight: 3 },
      { alias: "doya", locale: "ha", weight: 2 }
    ],
    variants: [
      {
        slug: "yam-tuber-medium",
        displayName: "Medium Yam Tuber",
        unitCode: "single_tuber",
        priceKobo: { min: naira(4_500), max: naira(7_000) },
        attributes: { size: "Medium" }
      },
      {
        slug: "yam-tuber-large",
        displayName: "Large Yam Tuber",
        unitCode: "single_tuber",
        priceKobo: { min: naira(7_000), max: naira(11_000) },
        attributes: { size: "Large" }
      }
    ]
  },
  {
    slug: "sweet-potato",
    canonicalName: "Sweet Potato",
    description: "Sweet potatoes",
    channels: ALL_CHANNELS,
    aliases: [{ alias: "anamo", locale: "yo", weight: 2 }],
    variants: [
      {
        slug: "potato-sweet-1kg",
        displayName: "Local Sweet Potatoes",
        unitCode: "1kg_measure",
        priceKobo: { min: naira(1_400), max: naira(1_900) }
      }
    ]
  },
  {
    slug: "plantain",
    canonicalName: "Plantain",
    description: "Ripe or unripe plantain bunch",
    channels: ALL_CHANNELS,
    // "dodo" is strictly fried plantain rather than the raw fruit, but it is
    // what a Lagos buyer says at the stall, so it earns its place in search.
    aliases: [
      { alias: "ogede agbagba", locale: "yo", weight: 3 },
      { alias: "ogede", locale: "yo", weight: 2 },
      { alias: "dodo", locale: "pcm", weight: 2 }
    ],
    variants: [
      {
        slug: "plantain-bunch-medium",
        displayName: "Medium Plantain Bunch",
        unitCode: "bunch",
        priceKobo: { min: naira(3_500), max: naira(5_500) }
      },
      {
        slug: "plantain-finger-single",
        displayName: "Single Plantain Finger",
        unitCode: "each",
        priceKobo: { min: naira(300), max: naira(600) }
      }
    ]
  },
  {
    slug: "tomatoes",
    canonicalName: "Tomatoes",
    description: "Fresh round tomatoes",
    channels: ALL_CHANNELS,
    aliases: [
      { alias: "tomati", locale: "yo", weight: 3 },
      { alias: "tumatir", locale: "ha", weight: 2 }
    ],
    variants: [
      {
        slug: "tomatoes-paint-bucket",
        displayName: "Paint Bucket of Tomatoes",
        unitCode: "paint_bucket",
        priceKobo: { min: naira(4_500), max: naira(8_000) },
        attributes: { note: "Swings hard with the season — cheap in glut, brutal in the dry-season gap" }
      },
      {
        slug: "tomatoes-basket-large",
        displayName: "Large Basket of Tomatoes",
        unitCode: "basket",
        priceKobo: { min: naira(28_000), max: naira(55_000) }
      }
    ]
  },
  {
    slug: "onions",
    canonicalName: "Onions",
    description: "Red onions",
    channels: ALL_CHANNELS,
    aliases: [
      { alias: "alubosa", locale: "yo", weight: 3 },
      { alias: "albasa", locale: "ha", weight: 3 },
      { alias: "yabasi", locale: "ig", weight: 2 }
    ],
    variants: [
      {
        slug: "onions-red-1kg",
        displayName: "Red Onions",
        unitCode: "1kg_measure",
        priceKobo: { min: naira(1_800), max: naira(2_600) }
      },
      {
        slug: "onions-paint-bucket",
        displayName: "Paint Bucket of Onions",
        unitCode: "paint_bucket",
        priceKobo: { min: naira(4_500), max: naira(7_000) }
      }
    ]
  },
  {
    slug: "pepper",
    canonicalName: "Pepper",
    description: "Fresh pepper — rodo, tatashe and shombo",
    channels: MARKET_AND_KIOSK,
    aliases: [
      { alias: "ata", locale: "yo", weight: 3 },
      { alias: "ata rodo", locale: "yo", weight: 3 },
      { alias: "tatashe", locale: "yo", weight: 3 },
      { alias: "shombo", locale: "yo", weight: 3 },
      { alias: "ose", locale: "ig", weight: 2 },
      { alias: "barkono", locale: "ha", weight: 2 }
    ],
    variants: [
      {
        slug: "pepper-rodo-paint",
        displayName: "Ata Rodo (Scotch Bonnet)",
        unitCode: "paint_bucket",
        priceKobo: { min: naira(5_000), max: naira(9_000) },
        attributes: { type: "Scotch bonnet", note: "The hot one" }
      },
      {
        slug: "pepper-rodo-basket",
        displayName: "Basket of Ata Rodo",
        unitCode: "basket",
        priceKobo: { min: naira(25_000), max: naira(45_000) }
      },
      {
        slug: "pepper-tatashe-paint",
        displayName: "Tatashe (Red Bell Pepper)",
        unitCode: "paint_bucket",
        priceKobo: { min: naira(4_000), max: naira(7_500) },
        attributes: { type: "Red bell", note: "Mild — carries the colour and body of a stew" }
      },
      {
        slug: "pepper-tatashe-basket",
        displayName: "Basket of Tatashe",
        unitCode: "basket",
        priceKobo: { min: naira(20_000), max: naira(38_000) }
      },
      {
        slug: "pepper-shombo-paint",
        displayName: "Shombo (Long Cayenne)",
        unitCode: "paint_bucket",
        priceKobo: { min: naira(3_500), max: naira(6_500) },
        attributes: { type: "Cayenne", note: "Medium heat" }
      }
    ]
  },
  {
    slug: "ginger",
    canonicalName: "Ginger",
    description: "Fresh ginger root",
    channels: ALL_CHANNELS,
    aliases: [
      { alias: "atale", locale: "yo", weight: 3 },
      { alias: "citta", locale: "ha", weight: 2 },
      { alias: "jinja", locale: "pcm", weight: 2 }
    ],
    variants: [
      {
        slug: "ginger-fresh-1kg",
        displayName: "Fresh Ginger Root",
        unitCode: "1kg_measure",
        priceKobo: { min: naira(2_000), max: naira(3_500) }
      }
    ]
  },
  {
    slug: "garlic",
    canonicalName: "Garlic",
    description: "Fresh garlic bulbs",
    channels: ALL_CHANNELS,
    aliases: [
      { alias: "aayu", locale: "yo", weight: 3 },
      { alias: "tafarnuwa", locale: "ha", weight: 2 }
    ],
    variants: [
      {
        slug: "garlic-fresh-1kg",
        displayName: "Fresh Garlic Bulbs",
        unitCode: "1kg_measure",
        priceKobo: { min: naira(3_500), max: naira(5_500) }
      }
    ]
  },

  // ═══ Soup ingredients ═══
  {
    slug: "egusi",
    canonicalName: "Egusi",
    description: "Ground melon seed for soup",
    channels: MARKET_AND_KIOSK,
    // "Egusi" is itself the local word — Yoruba and Igbo both use it. There is
    // no separate alias to give; the canonical name already is the alias.
    aliases: [
      { alias: "egusi", locale: "yo", weight: 3 },
      { alias: "melon seed", locale: "en", weight: 1 }
    ],
    variants: [
      {
        slug: "egusi-ground-1kg",
        displayName: "Ground Egusi",
        unitCode: "1kg_measure",
        priceKobo: { min: naira(4_500), max: naira(6_000) },
        attributes: { form: "Ground" }
      },
      {
        slug: "egusi-derica",
        displayName: "Egusi by the Derica",
        unitCode: "derica_cup",
        priceKobo: { min: naira(900), max: naira(1_400) }
      }
    ]
  },
  {
    slug: "ogbono",
    canonicalName: "Ogbono",
    description: "Ground wild mango seed for soup",
    channels: MARKET_AND_KIOSK,
    aliases: [
      { alias: "ogbono", locale: "ig", weight: 3 },
      { alias: "apon", locale: "yo", weight: 3 }
    ],
    variants: [
      {
        slug: "ogbono-ground-1kg",
        displayName: "Ground Ogbono",
        unitCode: "1kg_measure",
        priceKobo: { min: naira(9_000), max: naira(13_000) },
        attributes: { form: "Ground" }
      },
      {
        slug: "ogbono-derica",
        displayName: "Ogbono by the Derica",
        unitCode: "derica_cup",
        priceKobo: { min: naira(1_800), max: naira(2_600) }
      }
    ]
  },
  {
    slug: "crayfish",
    canonicalName: "Crayfish",
    description: "Dried ground crayfish",
    channels: MARKET_AND_KIOSK,
    // Yoruba "ede" covers shrimp and crayfish. It also happens to name cocoyam,
    // so it is weighted below the canonical name rather than above it.
    aliases: [{ alias: "ede", locale: "yo", weight: 2 }],
    variants: [
      {
        slug: "crayfish-dried-1kg",
        displayName: "Dried Crayfish",
        unitCode: "1kg_measure",
        priceKobo: { min: naira(8_000), max: naira(12_000) }
      },
      {
        slug: "crayfish-derica",
        displayName: "Crayfish by the Derica",
        unitCode: "derica_cup",
        priceKobo: { min: naira(1_200), max: naira(2_000) }
      }
    ]
  },
  {
    slug: "stockfish",
    canonicalName: "Stockfish",
    description: "Dried stockfish",
    channels: MARKET_ONLY,
    aliases: [{ alias: "okporoko", locale: "ig", weight: 3 }],
    variants: [
      {
        slug: "stockfish-1kg",
        displayName: "Stockfish Pieces",
        unitCode: "1kg_measure",
        priceKobo: { min: naira(18_000), max: naira(26_000) }
      },
      {
        slug: "stockfish-head-single",
        displayName: "Stockfish Head",
        unitCode: "each",
        priceKobo: { min: naira(2_500), max: naira(6_000) }
      }
    ]
  },
  {
    slug: "dried-fish",
    canonicalName: "Dried Fish",
    description: "Smoked and dried fish",
    channels: MARKET_AND_KIOSK,
    aliases: [
      { alias: "eja gbigbe", locale: "yo", weight: 3 },
      { alias: "panla", locale: "yo", weight: 2 },
      { alias: "azu", locale: "ig", weight: 2 }
    ],
    variants: [
      {
        slug: "dried-fish-1kg",
        displayName: "Smoked Dried Fish",
        unitCode: "1kg_measure",
        priceKobo: { min: naira(9_000), max: naira(14_000) }
      },
      {
        slug: "dried-fish-single",
        displayName: "Single Dried Fish",
        unitCode: "each",
        priceKobo: { min: naira(1_200), max: naira(2_500) }
      }
    ]
  },
  {
    slug: "seasoning-cube",
    canonicalName: "Seasoning Cubes",
    description: "Bouillon cubes",
    channels: ALL_CHANNELS,
    // "Maggi" is a Nestlé brand that swallowed the category whole. Nobody in
    // Lagos asks for "bouillon".
    aliases: [
      { alias: "maggi", locale: "pcm", weight: 3 },
      { alias: "knorr", locale: "pcm", weight: 2 }
    ],
    variants: [
      {
        slug: "seasoning-cube-sachet",
        displayName: "Sachet of Seasoning Cubes",
        unitCode: "sachet",
        priceKobo: { min: naira(300), max: naira(500) },
        attributes: { packaging: "Strip sachet" }
      },
      {
        slug: "seasoning-cube-carton",
        displayName: "Carton of Seasoning Cubes",
        unitCode: "carton",
        priceKobo: { min: naira(12_000), max: naira(18_000) },
        attributes: { packaging: "Bulk carton" }
      }
    ]
  },
  {
    slug: "salt",
    canonicalName: "Salt",
    description: "Refined table salt",
    channels: ALL_CHANNELS,
    aliases: [
      { alias: "iyo", locale: "yo", weight: 3 },
      { alias: "nnu", locale: "ig", weight: 3 },
      { alias: "gishiri", locale: "ha", weight: 3 }
    ],
    variants: [
      {
        slug: "salt-1kg",
        displayName: "Refined Salt",
        unitCode: "1kg_measure",
        priceKobo: { min: naira(500), max: naira(900) }
      },
      {
        slug: "salt-50kg-bag",
        displayName: "Bag of Salt",
        unitCode: "50kg_bag",
        priceKobo: { min: naira(18_000), max: naira(28_000) }
      }
    ]
  },

  // ═══ Oils ═══
  {
    slug: "palm-oil",
    canonicalName: "Palm Oil",
    description: "Red palm oil",
    channels: ALL_CHANNELS,
    aliases: [
      { alias: "epo pupa", locale: "yo", weight: 3 },
      { alias: "epo", locale: "yo", weight: 2 },
      { alias: "manja", locale: "ha", weight: 2 }
    ],
    variants: [
      {
        slug: "palm-oil-1l-bottle",
        displayName: "1L Palm Oil Bottle",
        unitCode: "1l_bottle",
        priceKobo: { min: naira(1_600), max: naira(2_200) },
        attributes: { grade: "Unbleached red", note: "Thick, deep red — the stew grade" }
      },
      {
        slug: "palm-oil-bleached-1l",
        displayName: "Bleached Palm Oil (1L)",
        unitCode: "1l_bottle",
        priceKobo: { min: naira(1_500), max: naira(2_100) },
        attributes: { grade: "Bleached", note: "Clarified for frying" }
      },
      {
        slug: "palm-oil-paint-bucket",
        displayName: "Palm Oil, 4L Keg",
        unitCode: "paint_bucket",
        priceKobo: { min: naira(6_500), max: naira(9_000) },
        attributes: { grade: "Unbleached red" }
      },
      {
        slug: "palm-oil-25l-keg",
        displayName: "Palm Oil, 25L Keg",
        unitCode: "25l_keg",
        priceKobo: { min: naira(38_000), max: naira(52_000) },
        attributes: { grade: "Unbleached red", packaging: "Wholesale jerrycan" }
      }
    ]
  },
  {
    slug: "groundnut-oil",
    canonicalName: "Groundnut Oil",
    description: "Groundnut cooking oil",
    channels: ALL_CHANNELS,
    aliases: [
      { alias: "ororo", locale: "yo", weight: 3 },
      { alias: "man gyada", locale: "ha", weight: 2 }
    ],
    variants: [
      {
        slug: "groundnut-oil-1l-bottle",
        displayName: "1L Groundnut Oil Bottle",
        unitCode: "1l_bottle",
        priceKobo: { min: naira(2_000), max: naira(2_600) }
      },
      {
        slug: "groundnut-oil-5l",
        displayName: "Groundnut Oil, 5L",
        unitCode: "5l_bottle",
        priceKobo: { min: naira(9_500), max: naira(13_000) }
      },
      {
        slug: "groundnut-oil-25l-keg",
        displayName: "Groundnut Oil, 25L Keg",
        unitCode: "25l_keg",
        priceKobo: { min: naira(46_000), max: naira(62_000) },
        attributes: { packaging: "Wholesale jerrycan" }
      }
    ]
  },
  {
    slug: "vegetable-oil",
    canonicalName: "Vegetable Oil",
    description: "Refined vegetable cooking oil",
    channels: ALL_CHANNELS,
    aliases: [{ alias: "ororo", locale: "yo", weight: 2 }],
    variants: [
      {
        slug: "vegetable-oil-1l",
        displayName: "1L Vegetable Oil Bottle",
        unitCode: "1l_bottle",
        priceKobo: { min: naira(1_900), max: naira(2_500) }
      },
      {
        slug: "vegetable-oil-5l",
        displayName: "Vegetable Oil, 5L",
        unitCode: "5l_bottle",
        priceKobo: { min: naira(9_000), max: naira(12_500) }
      }
    ]
  },

  // ═══ Tinned, packaged, dry goods ═══
  {
    slug: "tin-tomatoes",
    canonicalName: "Tinned Tomato Paste",
    description: "Concentrated tomato paste",
    channels: ALL_CHANNELS,
    // "Gino" and "Sonia" are brands doing generic duty at the counter.
    aliases: [
      { alias: "gino", locale: "pcm", weight: 3 },
      { alias: "tin tomato", locale: "pcm", weight: 3 }
    ],
    variants: [
      {
        slug: "tin-tomatoes-400g",
        displayName: "400g Tin of Tomato Paste",
        unitCode: "tin",
        priceKobo: { min: naira(1_300), max: naira(1_800) },
        attributes: { packaging: "400g tin" }
      },
      {
        slug: "tin-tomatoes-sachet-70g",
        displayName: "70g Sachet of Tomato Paste",
        unitCode: "sachet",
        priceKobo: { min: naira(300), max: naira(450) },
        attributes: { packaging: "70g sachet" }
      }
    ]
  },
  {
    slug: "sardines",
    canonicalName: "Tinned Sardines",
    description: "Sardines in oil",
    channels: ALL_CHANNELS,
    // No local-language name I can vouch for. Left empty rather than guessed.
    aliases: [],
    variants: [
      {
        slug: "sardines-tin-125g",
        displayName: "125g Tin of Sardines",
        unitCode: "tin",
        priceKobo: { min: naira(1_600), max: naira(2_300) },
        attributes: { packaging: "125g tin" }
      }
    ]
  },
  {
    slug: "milk-powder",
    canonicalName: "Powdered Milk",
    description: "Full-cream powdered milk",
    channels: ALL_CHANNELS,
    aliases: [
      { alias: "madara", locale: "ha", weight: 3 },
      { alias: "peak", locale: "pcm", weight: 3 }
    ],
    variants: [
      {
        slug: "milk-powder-tin-400g",
        displayName: "400g Tin of Powdered Milk",
        unitCode: "tin",
        priceKobo: { min: naira(4_500), max: naira(6_000) },
        attributes: { packaging: "400g tin" }
      },
      {
        slug: "milk-powder-sachet",
        displayName: "Milk Sachet",
        unitCode: "sachet",
        priceKobo: { min: naira(300), max: naira(450) },
        attributes: { packaging: "Single-serve sachet" }
      }
    ]
  },
  {
    slug: "milo",
    canonicalName: "Chocolate Drink Powder",
    description: "Malted chocolate drink powder",
    channels: ALL_CHANNELS,
    aliases: [{ alias: "milo", locale: "pcm", weight: 3 }],
    variants: [
      {
        slug: "milo-tin-500g",
        displayName: "500g Tin",
        unitCode: "tin",
        priceKobo: { min: naira(4_200), max: naira(5_600) },
        attributes: { packaging: "500g tin" }
      },
      {
        slug: "milo-sachet",
        displayName: "Single Sachet",
        unitCode: "sachet",
        priceKobo: { min: naira(250), max: naira(400) }
      }
    ]
  },
  {
    slug: "sugar",
    canonicalName: "Sugar",
    description: "Granulated sugar",
    channels: ALL_CHANNELS,
    aliases: [
      { alias: "suga", locale: "yo", weight: 3 },
      { alias: "sukari", locale: "ha", weight: 2 },
      { alias: "shuga", locale: "ig", weight: 2 }
    ],
    variants: [
      {
        slug: "sugar-1kg",
        displayName: "Granulated Sugar",
        unitCode: "1kg_measure",
        priceKobo: { min: naira(1_800), max: naira(2_500) }
      },
      {
        slug: "sugar-50kg-bag",
        displayName: "Bag of Sugar",
        unitCode: "50kg_bag",
        priceKobo: { min: naira(75_000), max: naira(95_000) }
      }
    ]
  },
  {
    slug: "noodles",
    canonicalName: "Instant Noodles",
    description: "Instant noodles",
    channels: ALL_CHANNELS,
    // "Indomie" is a brand that became the noun. Ask for noodles in a Lagos
    // kiosk and you will be handed Indomie.
    aliases: [{ alias: "indomie", locale: "pcm", weight: 3 }],
    variants: [
      {
        slug: "noodles-pack-single",
        displayName: "Single Pack of Noodles",
        unitCode: "each",
        priceKobo: { min: naira(350), max: naira(500) },
        attributes: { packaging: "70g pack" }
      },
      {
        slug: "noodles-carton-40",
        displayName: "Carton of Noodles",
        unitCode: "carton",
        priceKobo: { min: naira(11_500), max: naira(16_000) },
        attributes: { packaging: "Carton", packCount: 40 }
      }
    ]
  },
  {
    slug: "spaghetti",
    canonicalName: "Spaghetti",
    description: "Dried spaghetti",
    channels: ALL_CHANNELS,
    aliases: [],
    variants: [
      {
        slug: "spaghetti-500g",
        displayName: "500g Pack of Spaghetti",
        unitCode: "pack_500g",
        priceKobo: { min: naira(900), max: naira(1_400) }
      },
      {
        slug: "spaghetti-carton-20",
        displayName: "Carton of Spaghetti",
        unitCode: "carton",
        priceKobo: { min: naira(16_000), max: naira(24_000) },
        attributes: { packaging: "Carton", packCount: 20 }
      }
    ]
  },
  {
    slug: "bread",
    canonicalName: "Bread",
    description: "Sliced and Agege bread",
    channels: ALL_CHANNELS,
    aliases: [
      { alias: "burodi", locale: "yo", weight: 3 },
      { alias: "agege bread", locale: "pcm", weight: 3 }
    ],
    variants: [
      {
        slug: "bread-agege-loaf",
        displayName: "Agege Bread Loaf",
        unitCode: "loaf",
        priceKobo: { min: naira(1_000), max: naira(1_600) },
        attributes: { type: "Agege", note: "Dense, sweet, stretchy" }
      },
      {
        slug: "bread-sliced-family-loaf",
        displayName: "Sliced Family Loaf",
        unitCode: "loaf",
        priceKobo: { min: naira(1_400), max: naira(2_200) },
        attributes: { type: "Sliced family loaf" }
      }
    ]
  },

  // ═══ Protein ═══
  {
    slug: "eggs",
    canonicalName: "Eggs",
    description: "Fresh chicken eggs",
    channels: ALL_CHANNELS,
    aliases: [
      { alias: "eyin", locale: "yo", weight: 3 },
      { alias: "akwa", locale: "ig", weight: 3 },
      { alias: "kwai", locale: "ha", weight: 3 }
    ],
    variants: [
      {
        slug: "eggs-crate-30",
        displayName: "Crate of 30 Eggs",
        unitCode: "crate_30_eggs",
        priceKobo: { min: naira(5_500), max: naira(7_500) }
      },
      {
        slug: "eggs-single",
        displayName: "Single Egg",
        unitCode: "each",
        priceKobo: { min: naira(200), max: naira(280) }
      }
    ]
  },
  {
    slug: "chicken",
    canonicalName: "Chicken",
    description: "Frozen and live chicken",
    channels: ALL_CHANNELS,
    aliases: [
      { alias: "adiye", locale: "yo", weight: 3 },
      { alias: "okuko", locale: "ig", weight: 3 },
      { alias: "kaza", locale: "ha", weight: 2 }
    ],
    variants: [
      {
        slug: "chicken-frozen-1kg",
        displayName: "Frozen Chicken",
        unitCode: "1kg_measure",
        priceKobo: { min: naira(4_500), max: naira(6_500) },
        attributes: { form: "Frozen, cut" }
      },
      {
        slug: "chicken-whole-broiler",
        displayName: "Whole Broiler",
        unitCode: "each",
        priceKobo: { min: naira(12_000), max: naira(18_000) },
        attributes: { form: "Whole bird" }
      }
    ]
  },
  {
    slug: "beef",
    canonicalName: "Beef",
    description: "Fresh beef",
    channels: MARKET_AND_KIOSK,
    aliases: [
      { alias: "eran malu", locale: "yo", weight: 3 },
      { alias: "naman shanu", locale: "ha", weight: 2 },
      { alias: "anu ehi", locale: "ig", weight: 2 }
    ],
    variants: [
      {
        slug: "beef-fresh-1kg",
        displayName: "Fresh Beef",
        unitCode: "1kg_measure",
        priceKobo: { min: naira(7_000), max: naira(10_000) }
      }
    ]
  },
  {
    slug: "goat-meat",
    canonicalName: "Goat Meat",
    description: "Fresh goat meat",
    channels: MARKET_ONLY,
    aliases: [
      { alias: "eran ewure", locale: "yo", weight: 3 },
      { alias: "naman akuya", locale: "ha", weight: 2 }
    ],
    variants: [
      {
        slug: "goat-meat-1kg",
        displayName: "Fresh Goat Meat",
        unitCode: "1kg_measure",
        priceKobo: { min: naira(9_000), max: naira(13_000) }
      }
    ]
  },
  {
    slug: "frozen-fish",
    canonicalName: "Frozen Fish",
    description: "Frozen titus and kote",
    channels: ALL_CHANNELS,
    // "Titus" (mackerel) and "kote" (horse mackerel) are what the cold-room
    // board actually says. Neither is a brand; both are market names.
    aliases: [
      { alias: "titus", locale: "pcm", weight: 3 },
      { alias: "kote", locale: "pcm", weight: 3 },
      { alias: "eja tutu", locale: "yo", weight: 2 }
    ],
    variants: [
      {
        slug: "frozen-titus-1kg",
        displayName: "Frozen Titus (Mackerel)",
        unitCode: "1kg_measure",
        priceKobo: { min: naira(4_500), max: naira(6_500) },
        attributes: { species: "Mackerel" }
      },
      {
        slug: "frozen-titus-carton",
        displayName: "Carton of Titus",
        unitCode: "carton",
        priceKobo: { min: naira(85_000), max: naira(120_000) },
        attributes: { species: "Mackerel", packaging: "20kg carton" }
      },
      {
        slug: "frozen-kote-1kg",
        displayName: "Frozen Kote (Horse Mackerel)",
        unitCode: "1kg_measure",
        priceKobo: { min: naira(3_500), max: naira(5_200) },
        attributes: { species: "Horse mackerel" }
      }
    ]
  }
];

// ─────────────────────────────────────────────────────────────────────────────
// PLACES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Places to add on top of `SW_LAGOS_PLACES`, taking every area to 6–8 and the
 * pilot to 60 places total.
 *
 * NONE of these coordinates were resolved against live map data — I had no
 * tilequery to run. Every one is derived from a coordinate in
 * `lagosSouthWest.ts` that WAS confirmed, and the `source` field says so and
 * says how. Read them as "on this block", not "at this doorway".
 *
 * The derivation rules, so the arithmetic can be checked:
 *   · 0.001° of latitude  ≈ 111 m.
 *   · 0.001° of longitude ≈ 110 m at 6.46°N (cos 6.46° ≈ 0.994).
 *   · Offsets are kept under ~500 m of a confirmed anchor so a point cannot
 *     drift out of the neighbourhood it claims to be in.
 *   · Markets sit on roads. Where two confirmed anchors lie on the same road —
 *     Obuzu Market and Mile 2, both on the Lagos-Badagry Expressway — an
 *     intermediate point is interpolated along that line rather than dropped in
 *     the middle of a block.
 *
 * The five Yaba-side areas are marked `approximate` rather than `derived`: the
 * anchors they are placed against are themselves the coarse three-decimal
 * figures from the original seed, so there is no confirmed point to derive
 * from. They are honest guesses hung off other honest guesses, and the pilot is
 * south-west Lagos regardless.
 */
export const EXTRA_PLACES: SeedPlace[] = [
  // ══ Festac Town — 4 existing + 3 = 7 ══
  {
    slug: "festac-22-road-market", name: "22 Road Market", area: "festac", placeType: "open_market",
    location: { lat: 6.46560, lng: 3.27600 }, address: "22 Road, Festac Town",
    verified: false, source: "derived: ~180m N of the 24 Rd tilequery anchor; 22 Rd is the next cross-street"
  },
  {
    slug: "festac-market-annex", name: "Festac Market Annex", area: "festac", placeType: "open_market",
    location: { lat: 6.47500, lng: 3.27350 }, address: "4th Avenue, Festac Town",
    verified: false, source: "derived: ~150m SW of the Festac Market POI (tilequery)"
  },
  {
    slug: "festac-6th-avenue-provisions", name: "6th Avenue Provisions", area: "festac", placeType: "supermarket",
    location: { lat: 6.46520, lng: 3.27530 }, address: "6th Avenue, Festac Town",
    verified: false, source: "derived: on the interpolated 6th Ave longitude (3.2753), ~125m N of D Close"
  },

  // ══ Amuwo Odofin — 4 existing + 4 = 8 ══
  {
    slug: "agboju-market", name: "Agboju Market", area: "amuwo-odofin", placeType: "open_market",
    location: { lat: 6.46132, lng: 3.29800 }, address: "Lagos-Badagry Expressway, Agboju",
    verified: false, source: "derived: interpolated on the Obuzu Market → Mile 2 expressway line (t=0.48). Agboju is real and sits on this stretch; the exact point is not confirmed"
  },
  {
    slug: "mile-2-underbridge-stalls", name: "Mile 2 Under-Bridge Stalls", area: "amuwo-odofin", placeType: "open_market",
    location: { lat: 6.45900, lng: 3.31000 }, address: "Under the bridge, Mile 2",
    verified: false, source: "derived: ~200m SW of the Mile 2 station anchor (osm)"
  },
  {
    slug: "navy-town-road-kiosk", name: "Navy Town Road Kiosk", area: "amuwo-odofin", placeType: "kiosk",
    location: { lat: 6.44700, lng: 3.28450 }, address: "Navy Town Road, Amuwo Odofin",
    verified: false, source: "derived: ~250m NE of the Navy Town anchor (osm), along Navy Town Rd"
  },
  {
    slug: "amuwo-estate-provisions", name: "Amuwo Estate Provisions", area: "amuwo-odofin", placeType: "supermarket",
    location: { lat: 6.46650, lng: 3.28150 }, address: "Amuwo Odofin Housing Estate",
    verified: false, source: "derived: ~260m SW of the Amuwo Odofin area centre (osm)"
  },

  // ══ Satellite Town — 3 existing + 4 = 7 ══
  {
    slug: "trade-fair-aspamda-line", name: "Trade Fair Aspamda Line", area: "satellite-town", placeType: "open_market",
    location: { lat: 6.46250, lng: 3.24800 }, address: "Aspamda, Trade Fair Complex",
    verified: false, source: "derived: ~170m SE of the Trade Fair Complex anchor (osm)"
  },
  {
    slug: "trade-fair-food-line", name: "Trade Fair Food Line", area: "satellite-town", placeType: "open_market",
    location: { lat: 6.46450, lng: 3.24560 }, address: "Trade Fair Complex, Satellite Town",
    verified: false, source: "derived: ~170m NW of the Trade Fair Complex anchor (osm)"
  },
  {
    slug: "nwankwo-street-kiosk", name: "Nwankwo Street Kiosk", area: "satellite-town", placeType: "kiosk",
    location: { lat: 6.44200, lng: 3.25850 }, address: "Nwankwo Street, Satellite Town",
    verified: false, source: "derived: ~180m NE of the Nwankwo Street anchor (osm)"
  },
  {
    slug: "satellite-festac-link-stalls", name: "Satellite Link Stalls", area: "satellite-town", placeType: "open_market",
    location: { lat: 6.44990, lng: 3.26440 }, address: "Satellite Town–Festac link road",
    verified: false, source: "derived: midpoint of the Satellite Town Market and Festac 7th Ave anchors"
  },

  // ══ Ojo — 4 existing + 3 = 7 ══
  {
    slug: "ojo-barracks-kiosk", name: "Ojo Barracks Kiosk", area: "ojo", placeType: "kiosk",
    location: { lat: 6.47050, lng: 3.19750 }, address: "Ojo Cantonment Road",
    verified: false, source: "derived: ~230m NE of the Ojo Cantonment point (itself derived)"
  },
  {
    slug: "ojo-road-kiosk", name: "Ojo Road Kiosk", area: "ojo", placeType: "kiosk",
    location: { lat: 6.46200, lng: 3.19100 }, address: "Ojo Road, Ojo",
    verified: false, source: "derived: ~400m S of the Ojo Market anchor (osm), on Ojo Rd"
  },
  {
    slug: "ojo-alaba-food-line", name: "Alaba Rago Food Line", area: "ojo", placeType: "open_market",
    location: { lat: 6.45690, lng: 3.18960 }, address: "Alaba Rago, Ojo",
    verified: false, source: "derived: ~160m SE of the Alaba Rago point (itself derived from Alaba International)"
  },

  // ══ Yaba — 3 existing + 4 = 7 ══
  {
    slug: "tejuosho-ultra-modern-line", name: "Tejuosho Ultra Modern Line", area: "yaba", placeType: "open_market",
    location: { lat: 6.5140, lng: 3.3862 }, address: "Tejuosho Market, Yaba",
    verified: false, source: "approximate: legacy Yaba-side seed, offset from Tejuosho Market. Not resolved against map data"
  },
  {
    slug: "yaba-market-junction-stalls", name: "Yaba Market Junction Stalls", area: "yaba", placeType: "open_market",
    location: { lat: 6.5165, lng: 3.3790 }, address: "Yaba Market junction",
    verified: false, source: "approximate: legacy Yaba-side seed, near the Yaba area centre. Not resolved against map data"
  },
  {
    slug: "herbert-macaulay-provisions", name: "Herbert Macaulay Provisions", area: "yaba", placeType: "supermarket",
    location: { lat: 6.5090, lng: 3.3800 }, address: "Herbert Macaulay Way, Yaba",
    verified: false, source: "approximate: legacy Yaba-side seed. Not resolved against map data"
  },
  {
    slug: "alagomeji-corner-shop", name: "Alagomeji Corner Shop", area: "yaba", placeType: "kiosk",
    location: { lat: 6.5090, lng: 3.3760 }, address: "Alagomeji, Yaba",
    verified: false, source: "approximate: legacy Yaba-side seed. Not resolved against map data"
  },

  // ══ Ebute Metta — 3 existing + 3 = 6 ══
  {
    slug: "oyingbo-rail-line-stalls", name: "Oyingbo Rail Line Stalls", area: "ebute-metta", placeType: "open_market",
    location: { lat: 6.4935, lng: 3.3835 }, address: "Beside the rail line, Oyingbo",
    verified: false, source: "approximate: legacy Yaba-side seed, offset from Oyinbo Market. Not resolved against map data"
  },
  {
    slug: "costain-roundabout-kiosk", name: "Costain Roundabout Kiosk", area: "ebute-metta", placeType: "kiosk",
    location: { lat: 6.4885, lng: 3.3670 }, address: "Costain Roundabout, Ebute Metta",
    verified: false, source: "approximate: legacy Yaba-side seed. Not resolved against map data"
  },
  {
    slug: "denton-street-shop", name: "Denton Street Shop", area: "ebute-metta", placeType: "supermarket",
    location: { lat: 6.4900, lng: 3.3860 }, address: "Denton Street, Ebute Metta",
    verified: false, source: "approximate: legacy Yaba-side seed. Not resolved against map data"
  },

  // ══ Bariga — 3 existing + 3 = 6 ══
  {
    slug: "bariga-market-extension", name: "Bariga Market Extension", area: "bariga", placeType: "open_market",
    location: { lat: 6.5365, lng: 3.3970 }, address: "Bariga Road, Bariga",
    verified: false, source: "approximate: legacy Yaba-side seed, offset from Bariga Market. Not resolved against map data"
  },
  {
    slug: "ilaje-waterside-stalls", name: "Ilaje Waterside Stalls", area: "bariga", placeType: "open_market",
    location: { lat: 6.5290, lng: 3.3990 }, address: "Ilaje Waterside, Bariga",
    verified: false, source: "approximate: legacy Yaba-side seed. Not resolved against map data"
  },
  {
    slug: "shomolu-market-line", name: "Shomolu Market Line", area: "bariga", placeType: "open_market",
    location: { lat: 6.5310, lng: 3.3860 }, address: "Shomolu Market, Lagos",
    verified: false, source: "approximate: legacy Yaba-side seed. Not resolved against map data"
  },

  // ══ Surulere — 3 existing + 3 = 6 ══
  {
    slug: "aguda-market", name: "Aguda Market", area: "surulere", placeType: "open_market",
    location: { lat: 6.4940, lng: 3.3450 }, address: "Aguda, Surulere",
    verified: false, source: "approximate: legacy Yaba-side seed. Aguda is real; the point is not resolved against map data"
  },
  {
    slug: "itire-road-stalls", name: "Itire Road Stalls", area: "surulere", placeType: "open_market",
    location: { lat: 6.5000, lng: 3.3480 }, address: "Itire Road, Surulere",
    verified: false, source: "approximate: legacy Yaba-side seed. Not resolved against map data"
  },
  {
    slug: "bode-thomas-provisions", name: "Bode Thomas Provisions", area: "surulere", placeType: "supermarket",
    location: { lat: 6.4970, lng: 3.3540 }, address: "Bode Thomas Street, Surulere",
    verified: false, source: "approximate: legacy Yaba-side seed. Not resolved against map data"
  },

  // ══ Mushin — 3 existing + 3 = 6 ══
  {
    slug: "ladipo-market", name: "Ladipo Market", area: "mushin", placeType: "open_market",
    location: { lat: 6.5350, lng: 3.3400 }, address: "Ladipo, Mushin",
    verified: false, source: "approximate: legacy Yaba-side seed. Ladipo is real; the point is not resolved against map data"
  },
  {
    slug: "idi-oro-junction-stalls", name: "Idi Oro Junction Stalls", area: "mushin", placeType: "open_market",
    location: { lat: 6.5230, lng: 3.3480 }, address: "Idi Oro Junction, Mushin",
    verified: false, source: "approximate: legacy Yaba-side seed. Not resolved against map data"
  },
  {
    slug: "palm-avenue-shop", name: "Palm Avenue Shop", area: "mushin", placeType: "kiosk",
    location: { lat: 6.5290, lng: 3.3560 }, address: "Palm Avenue, Mushin",
    verified: false, source: "approximate: legacy Yaba-side seed. Not resolved against map data"
  }
];

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The form an alias is stored in for matching: lowercase, tone marks stripped,
 * whitespace collapsed. `actions.ts` currently matches the raw `alias` column,
 * so this only feeds `normalized_alias` — but the column exists to be used, and
 * writing it correctly now means a future ranked search does not need a
 * backfill.
 */
export const normalizeAlias = (s: string): string =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/** Every variant across every item, with its parent item's slug attached. */
export const allSeedVariants = (): Array<SeedVariant & { itemSlug: string; channels: PlaceType[] }> =>
  SEED_ITEMS.flatMap((item) =>
    item.variants.map((v) => ({ ...v, itemSlug: item.slug, channels: item.channels }))
  );

/**
 * Fail the seed on contradictory content rather than letting it reach the map.
 *
 * The last silent-fallback bug in this codebase — a geography decoder that
 * returned (0,0) instead of throwing — put every marker in the Gulf of Guinea
 * and hid for the life of the project, because a plausible wrong answer never
 * announces itself. A variant pointing at a unit code that does not exist would
 * fail the same way: `unitId` resolves to `undefined`, the insert throws
 * somewhere unrelated or writes a null, and the trail back here is cold. So the
 * checks run up front and name the offender.
 *
 * `seed.ts` should call this before it writes anything.
 */
export function assertSeedContent(): void {
  const problems: string[] = [];

  const seen = <T>(xs: T[], key: (x: T) => string, label: string) => {
    const counts = new Map<string, number>();
    for (const x of xs) counts.set(key(x), (counts.get(key(x)) ?? 0) + 1);
    for (const [k, n] of counts) if (n > 1) problems.push(`${label}: "${k}" appears ${n} times`);
  };

  seen(SEED_UNITS, (u) => u.code, "duplicate unit code");
  seen(SEED_ITEMS, (i) => i.slug, "duplicate item slug");
  seen(allSeedVariants(), (v) => v.slug, "duplicate variant slug");
  seen(EXTRA_PLACES, (p) => p.slug, "duplicate place slug");

  for (const item of SEED_ITEMS) {
    if (item.variants.length === 0) problems.push(`item "${item.slug}" has no variants`);
    if (item.channels.length === 0) problems.push(`item "${item.slug}" has no channels`);

    for (const v of item.variants) {
      if (!UNIT_CODES.has(v.unitCode)) {
        problems.push(`variant "${v.slug}" uses unit code "${v.unitCode}", which is not in SEED_UNITS`);
      }
      const { min, max } = v.priceKobo;
      if (!Number.isInteger(min) || !Number.isInteger(max)) {
        problems.push(`variant "${v.slug}" has a non-integer kobo price — kobo are whole units`);
      }
      if (min <= 0) problems.push(`variant "${v.slug}" has a non-positive price`);
      if (max < min) problems.push(`variant "${v.slug}" has max (${max}) below min (${min})`);
      // Postgres integer ceiling. The seed multiplies by up to 1.08 for the
      // supermarket premium and may widen the range on top, so leave headroom.
      if (max > 1_000_000_000) problems.push(`variant "${v.slug}" price would risk overflowing an int4 column`);
    }

    for (const a of item.aliases) {
      if (a.alias.trim() === "") problems.push(`item "${item.slug}" has an empty alias`);
      if (!["yo", "ig", "ha", "pcm", "en"].includes(a.locale)) {
        problems.push(`item "${item.slug}" alias "${a.alias}" has unknown locale "${a.locale}"`);
      }
    }
  }

  // A coordinate outside this box is not in Lagos, and a marker there is the
  // (0,0) bug wearing a different hat.
  for (const p of EXTRA_PLACES) {
    const { lat, lng } = p.location;
    if (!(lat > 6.35 && lat < 6.75)) problems.push(`place "${p.slug}" latitude ${lat} is outside Lagos`);
    if (!(lng > 3.05 && lng < 3.55)) problems.push(`place "${p.slug}" longitude ${lng} is outside Lagos`);
    if (p.source.trim() === "") problems.push(`place "${p.slug}" has no coordinate provenance`);
  }

  if (problems.length > 0) {
    throw new Error(`seedContent is inconsistent:\n  - ${problems.join("\n  - ")}`);
  }
}
