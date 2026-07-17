/**
 * SEO primitives shared by the indexable routes: absolute URLs, a safe JSON-LD
 * script, the structured-data builders, and two display helpers.
 *
 * ONE ORIGIN, resolved in ONE place. `absoluteUrl` reuses `siteOrigin()` from
 * `sitemap.ts` rather than re-reading env, so the canonical host, the sitemap
 * host, and every JSON-LD `url` cannot drift apart. `robots.ts` already imports
 * `siteOrigin` from the same module, so this follows an established seam rather
 * than inventing a second one. `siteOrigin()` throws when no origin is
 * configured; that is deliberate (see its comment) and it is the same throw the
 * sitemap already relies on at build.
 */
import { siteOrigin } from "@/app/sitemap";

/** e.g. absoluteUrl("/item/rice") -> "https://wetindey.live/item/rice". */
export function absoluteUrl(path = "/"): string {
  const origin = siteOrigin();
  if (path === "" || path === "/") return `${origin}/`;
  return `${origin}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * A JSON-LD block, embedded the way Google reads it.
 *
 * `type="application/ld+json"` is a script, so the site CSP's `script-src`
 * covers it (vercel.json ships `'unsafe-inline'` today; if H6's nonce lands,
 * this tag needs the nonce threaded in, same as layout.tsx's inline scripts).
 *
 * The `<` escape is not decoration: a stray "</script>" inside any string value
 * (a market address, an item description) would otherwise close the tag early
 * and inject the remainder as markup. Escaping "<" to its unicode form is the
 * standard, and it leaves the JSON semantically identical.
 */
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}

const CURRENCY = "NGN";

/** Site-wide identity, emitted from the root layout so every page carries it. */
export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "WetinDey",
    url: absoluteUrl("/"),
    inLanguage: "en-NG",
    description:
      "Nearby live local information before you leave. Food price and availability in south-west Lagos; coverage and freshness vary, and price and availability may change before arrival.",
  };
}

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "WetinDey",
    url: absoluteUrl("/"),
    logo: absoluteUrl("/icons/icon-512.png"),
  };
}

export function breadcrumbJsonLd(crumbs: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: absoluteUrl(c.path),
    })),
  };
}

/**
 * A food item as a `Product` with an `AggregateOffer`.
 *
 * A price-comparison page (one commodity, many sellers) is exactly what
 * AggregateOffer models: `lowPrice`/`highPrice` bound the range and `offerCount`
 * says how many sellers back it. Prices arrive as KOBO and are divided by 100
 * here, the one place JSON-LD converts, because schema.org prices are in the
 * major currency unit (naira), not the storage unit.
 *
 * The offer block is included ONLY when there is a real range to state. An empty
 * `AggregateOffer` (no price) is worse than none: it asserts a product is for
 * sale while naming no price, which Google flags and a reader cannot use.
 */
export function productJsonLd(args: {
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
  priceMinKobo: number | null;
  priceMaxKobo: number | null;
  offerCount: number;
}) {
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: args.name,
    url: absoluteUrl(`/item/${args.slug}`),
    category: "Food",
  };
  if (args.description) data.description = args.description;
  if (args.image) data.image = args.image;
  if (args.priceMinKobo !== null && args.priceMaxKobo !== null && args.offerCount > 0) {
    data.offers = {
      "@type": "AggregateOffer",
      priceCurrency: CURRENCY,
      lowPrice: args.priceMinKobo / 100,
      highPrice: args.priceMaxKobo / 100,
      offerCount: args.offerCount,
    };
  }
  return data;
}

/**
 * A market as the closest schema.org store type. `GroceryStore` for markets and
 * supermarkets, `ConvenienceStore` for kiosks, `Store` as the honest fallback
 * for an unmapped type rather than a guess. LocalBusiness types like these are
 * understood by search engines even where they earn no special rich result;
 * they establish what the page is about, and the geo/address anchor it in Lagos.
 */
const PLACE_TYPE_SCHEMA: Record<string, string> = {
  open_market: "GroceryStore",
  supermarket: "GroceryStore",
  kiosk: "ConvenienceStore",
};

export function placeJsonLd(args: {
  name: string;
  slug: string;
  placeType: string;
  address: string | null;
  areaName: string | null;
  lat: number;
  lng: number;
}) {
  return {
    "@context": "https://schema.org",
    "@type": PLACE_TYPE_SCHEMA[args.placeType] ?? "Store",
    name: args.name,
    url: absoluteUrl(`/place/${args.slug}`),
    address: {
      "@type": "PostalAddress",
      ...(args.address ? { streetAddress: args.address } : {}),
      ...(args.areaName ? { addressLocality: args.areaName } : {}),
      addressRegion: "Lagos",
      addressCountry: "NG",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: args.lat,
      longitude: args.lng,
    },
  };
}

/**
 * "seen today" / "seen 3 days ago" / "seen on 12 Jun" from an ISO timestamp.
 *
 * Dating each price rather than badging it. The app's map badges ("E sure" /
 * "Check am") are a locale-aware vocabulary owned by the i18n lane; duplicating
 * them here would be a second copy that drifts (LANES H5). A plain observed date
 * says the same true thing, needs no dictionary, and reads correctly to anyone.
 *
 * Computed at render, which under `revalidate` means it is at most one
 * revalidation window stale. Days, not hours, so that drift never shows.
 */
const DATE_FMT = new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short" });

export function seenLabel(iso: string, now: number = Date.now()): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "seen recently";
  const days = Math.floor((now - then) / 86_400_000);
  if (days <= 0) return "seen today";
  if (days === 1) return "seen yesterday";
  if (days <= 30) return `seen ${days} days ago`;
  return `seen on ${DATE_FMT.format(then)}`;
}

/** Human label for `places.place_type`. */
const PLACE_TYPE_LABEL: Record<string, string> = {
  open_market: "Open market",
  supermarket: "Supermarket",
  kiosk: "Kiosk",
};

export function placeTypeLabel(placeType: string): string {
  return PLACE_TYPE_LABEL[placeType] ?? "Market";
}

export type ItemPriceSummary = {
  unit: string;
  minKobo: number;
  maxKobo: number;
  placeCount: number;
  offerCount: number;
};

/**
 * The headline price range for an item, taken WITHIN THE MODAL UNIT, never
 * across units.
 *
 * This is `getPopularItems`' hard-won rule (actions.ts): min/max grouped by item
 * alone quoted "Palm Oil" at a 1L-bottle floor and a 25L-keg ceiling, which is
 * arithmetically fine and factually a lie. So the range is taken inside the one
 * unit the item is most sold in, and that unit is named beside the number.
 *
 * Lives here, not in the item page, so the page body and the OG image render the
 * SAME number from one implementation. Input is the minimal shape both have.
 */
export function itemPriceSummary(
  offers: { unit: string; priceMin: number; priceMax: number | null; placeId: string }[],
): ItemPriceSummary | null {
  if (offers.length === 0) return null;

  const byUnit = new Map<string, typeof offers>();
  for (const o of offers) {
    const list = byUnit.get(o.unit);
    if (list) list.push(o);
    else byUnit.set(o.unit, [o]);
  }

  // Most offers wins; ties break on unit label so the choice is stable, the same
  // tiebreak `modal_unit` uses in actions.ts.
  let unit = "";
  let chosen: typeof offers = [];
  for (const [u, list] of byUnit) {
    if (list.length > chosen.length || (list.length === chosen.length && u < unit)) {
      unit = u;
      chosen = list;
    }
  }

  let minKobo = Infinity;
  let maxKobo = -Infinity;
  const places = new Set<string>();
  for (const o of chosen) {
    minKobo = Math.min(minKobo, o.priceMin);
    maxKobo = Math.max(maxKobo, o.priceMax ?? o.priceMin);
    places.add(o.placeId);
  }

  return { unit, minKobo, maxKobo, placeCount: places.size, offerCount: chosen.length };
}
