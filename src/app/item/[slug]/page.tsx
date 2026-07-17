import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";

import { formatNaira } from "@/lib/money";
import {
  JsonLd,
  absoluteUrl,
  breadcrumbJsonLd,
  productJsonLd,
  seenLabel,
} from "@/lib/seo";
import {
  getItemBySlug,
  getItemOffers,
  allItemSlugs,
  type SeoItemOffer,
} from "@/lib/seo-queries";

/**
 * The item page is one half of the two indexable routes the sitemap has always
 * probed for (sitemap.ts `item/[slug]` family). It answers one question in a
 * form a search engine can read: "what does <food> cost in Lagos, and where".
 *
 * ISR, not dynamic. `revalidate` caches the rendered page and refreshes it
 * hourly, so a crawler and a shopper get a fast static document that still
 * tracks reported prices. `generateStaticParams` pre-renders every active item
 * at build (the DB is reachable there, the sitemap proves it); `dynamicParams`
 * stays at its default, so an item added later renders on first request.
 */
export const revalidate = 3600;

/**
 * Deduplicate the two DB reads across `generateMetadata` and the component.
 * React `cache` memoises per request, so the metadata pass and the render share
 * one query each instead of four round-trips for one page.
 */
const loadItem = cache(getItemBySlug);
const loadOffers = cache(getItemOffers);

export async function generateStaticParams() {
  return (await allItemSlugs()).map((slug) => ({ slug }));
}

/**
 * The price range shown in the headline and the AggregateOffer, computed WITHIN
 * THE MODAL UNIT, never across units.
 *
 * This is `getPopularItems`' hard-won rule (actions.ts): min/max grouped by item
 * alone quoted "Palm Oil" at a 1L-bottle floor and a 25L-keg ceiling, which is
 * arithmetically fine and factually a lie. So the range is taken inside the one
 * unit the item is most sold in, and that unit is named beside the number.
 */
function summarize(offers: SeoItemOffer[]) {
  if (offers.length === 0) return null;

  const byUnit = new Map<string, SeoItemOffer[]>();
  for (const o of offers) {
    const list = byUnit.get(o.unit);
    if (list) list.push(o);
    else byUnit.set(o.unit, [o]);
  }

  // Most offers wins; ties break on unit label so the choice is stable between
  // builds, the same tiebreak `modal_unit` uses in actions.ts.
  let unit = "";
  let chosen: SeoItemOffer[] = [];
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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const item = await loadItem(slug);
  if (!item) return {};

  const summary = summarize(await loadOffers(item.id));
  const title = `${item.name} price in Lagos`;
  const description = summary
    ? `${item.name} costs ${formatNaira(summary.minKobo)}${
        summary.maxKobo > summary.minKobo ? ` to ${formatNaira(summary.maxKobo)}` : ""
      } per ${summary.unit} across ${summary.placeCount} ${
        summary.placeCount === 1 ? "market" : "markets"
      } in south-west Lagos, reported by people who saw it. Know before you go.`
    : `Prices for ${item.name} in south-west Lagos, reported by the people who saw them. Know before you go.`;

  const canonical = `/item/${item.slug}`;
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title: `${title} · WetinDey`,
      description,
      url: absoluteUrl(canonical),
      type: "article",
    },
    twitter: { card: "summary_large_image", title: `${title} · WetinDey`, description },
  };
}

export default async function ItemPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const item = await loadItem(slug);
  if (!item) notFound();

  const offers = await loadOffers(item.id);
  const summary = summarize(offers);

  return (
    <main className="mx-auto min-h-screen max-w-[720px] bg-background px-4 py-6 sm:px-6">
      <JsonLd
        data={productJsonLd({
          name: item.name,
          slug: item.slug,
          description: item.description,
          image: item.imageUrl,
          priceMinKobo: summary?.minKobo ?? null,
          priceMaxKobo: summary?.maxKobo ?? null,
          offerCount: summary?.offerCount ?? 0,
        })}
      />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "WetinDey", path: "/" },
          { name: item.name, path: `/item/${item.slug}` },
        ])}
      />

      <nav aria-label="Breadcrumb" className="mb-4 text-footnote text-text-secondary">
        <Link href="/" className="transition-opacity duration-instant active:opacity-60">
          WetinDey
        </Link>
        <span className="px-1.5 text-text-tertiary">/</span>
        <span className="text-text-primary">{item.name}</span>
      </nav>

      <header className="flex flex-col gap-4 sm:flex-row sm:items-start">
        {item.imageUrl && (
          <div className="relative h-40 w-40 shrink-0 overflow-hidden squircle bg-fillTertiary">
            <Image src={item.imageUrl} alt={item.name} fill sizes="160px" className="object-cover" />
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-title-1 font-semibold tracking-tight text-text-primary">
            {item.name} price in Lagos
          </h1>
          {summary ? (
            <p className="mt-2 text-body text-text-secondary">
              {formatNaira(summary.minKobo)}
              {summary.maxKobo > summary.minKobo ? ` to ${formatNaira(summary.maxKobo)}` : ""} per{" "}
              {summary.unit}, seen at {summary.placeCount}{" "}
              {summary.placeCount === 1 ? "market" : "markets"} near south-west Lagos.
            </p>
          ) : (
            <p className="mt-2 text-body text-text-secondary">
              No price reported yet. Be the first to report one.
            </p>
          )}
          {item.description && (
            <p className="mt-2 text-subhead text-text-tertiary">{item.description}</p>
          )}
        </div>
      </header>

      {offers.length > 0 && (
        <section className="mt-7">
          <h2 className="text-footnote font-semibold text-text-primary">Where to buy it</h2>
          <ul className="mt-2.5 flex flex-col gap-2">
            {offers.map((o) => (
              <li key={o.offerId}>
                <Link
                  href={`/place/${o.placeSlug}`}
                  className="flex items-center justify-between gap-3 squircle bg-surface px-3.5 py-3 shadow-card transition-opacity duration-instant active:opacity-80"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-callout text-text-primary">
                      {o.placeName}
                    </span>
                    <span className="block truncate text-caption-1 text-text-secondary">
                      {o.variantName}
                      {o.availabilityState === "unavailable"
                        ? ", reported unavailable"
                        : `, ${seenLabel(o.lastObservedAt)}`}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-callout font-semibold tabular-nums text-text-primary">
                      {formatNaira(o.priceMin)}
                    </span>
                    <span className="block text-caption-2 text-text-tertiary">/ {o.unit}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {item.imageAttribution && (
        <p className="mt-6 text-caption-2 text-text-tertiary">
          Photo:{" "}
          {item.imageSourceUrl ? (
            <a
              href={item.imageSourceUrl}
              rel="nofollow noopener"
              className="underline underline-offset-2"
            >
              {item.imageAttribution}
            </a>
          ) : (
            item.imageAttribution
          )}
          {item.imageLicense ? ` (${item.imageLicense})` : ""}
        </p>
      )}

      <div className="mt-8">
        <Link
          href="/"
          className="flex min-h-tap w-full items-center justify-center squircle bg-accent px-4 text-headline text-accent-contrast transition-opacity duration-micro ease-decelerate active:opacity-80"
        >
          See it on the map
        </Link>
      </div>
    </main>
  );
}
