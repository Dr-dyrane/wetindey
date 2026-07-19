import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, MapPin } from "lucide-react";

import { formatNaira } from "@/lib/money";
import {
  JsonLd,
  absoluteUrl,
  breadcrumbJsonLd,
  placeJsonLd,
  placeTypeLabel,
  seenLabel,
} from "@/lib/seo";
import { getPlaceBySlug, getPlaceOffersForSeo, allPlaceSlugs } from "@/lib/seo-queries";

/**
 * The place page is the second indexable route the sitemap probes for, and the
 * one `docs/product/USER-FLOW.md` singles out as "SEO-relevant". It is a price board for
 * one market: what is on sale, at what price, last seen when.
 *
 * ISR + `generateStaticParams`, same reasoning as the item page: fast static
 * pages that refresh hourly and pick up a new market on first request.
 */
export const revalidate = 3600;

const loadPlace = cache(getPlaceBySlug);
const loadOffers = cache(getPlaceOffersForSeo);

export async function generateStaticParams() {
  return (await allPlaceSlugs()).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const place = await loadPlace(slug);
  if (!place) return {};

  const where = place.areaName ? `${place.areaName}, Lagos` : "Lagos";
  const result = await loadOffers(place.id);
  const title = `${place.name}, ${place.areaName ?? "Lagos"}`;
  const description =
    result.kind === "observed"
      ? `Food price and availability at ${place.name} in ${where}: ${
          result.offers.length
        } observed ${
          result.offers.length === 1 ? "listing" : "listings"
        }. Coverage and freshness vary; price and availability may change before arrival.`
      : `${place.name} is a ${placeTypeLabel(place.placeType).toLowerCase()} in ${where} on WetinDey. Browse venue and location information.`;

  const canonical = `/place/${place.slug}`;
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

export default async function PlacePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const place = await loadPlace(slug);
  if (!place) notFound();

  const result = await loadOffers(place.id);
  const where = place.areaName ? `${place.areaName}, Lagos` : "Lagos";

  return (
    <main className="mx-auto min-h-screen max-w-[720px] bg-background px-4 py-6 sm:px-6">
      <JsonLd
        data={placeJsonLd({
          name: place.name,
          slug: place.slug,
          placeType: place.placeType,
          address: place.address,
          areaName: place.areaName,
          lat: place.lat,
          lng: place.lng,
        })}
      />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "WetinDey", path: "/" },
          { name: place.name, path: `/place/${place.slug}` },
        ])}
      />

      <nav aria-label="Breadcrumb" className="mb-4 text-footnote text-text-secondary">
        <Link href="/" className="transition-opacity duration-instant active:opacity-60">
          WetinDey
        </Link>
        <span className="px-1.5 text-text-tertiary">/</span>
        <span className="text-text-primary">{place.name}</span>
      </nav>

      <header>
        <div className="flex items-center gap-2">
          <h1 className="text-title-1 font-semibold tracking-tight text-text-primary">
            {place.name}
          </h1>
          {/* Venue verification is independent of observation confidence. */}
          {place.verificationStatus === "verified" && (
            <span
              title="Verified market"
              className="inline-flex items-center gap-1 squircle-full bg-status-confirmed-bg px-2 py-0.5 text-caption-2 text-status-confirmed-fg"
            >
              <BadgeCheck className="h-3.5 w-3.5" />
              Verified
            </span>
          )}
        </div>
        <p className="mt-1.5 flex items-start gap-1 text-subhead text-text-secondary">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-text-tertiary" />
          <span>
            {placeTypeLabel(place.placeType)} in {where}
            {place.address ? `. ${place.address}` : ""}
          </span>
        </p>
        {place.openingInformation && (
          <p className="mt-1.5 text-footnote text-text-tertiary">{place.openingInformation}</p>
        )}
      </header>

      <section className="mt-7">
        {result.kind === "observed" ? (
          <>
            <h2 className="text-footnote font-semibold text-text-primary">
              {result.offers.length} observed{" "}
              {result.offers.length === 1 ? "listing" : "listings"}
            </h2>
            <ul className="mt-2.5 flex flex-col gap-2">
              {result.offers.map((o) => (
                <li key={o.offerKey}>
                  <Link
                    href={`/item/${o.itemSlug}`}
                    className="flex items-center justify-between gap-3 squircle bg-surface px-3.5 py-3 shadow-card transition-opacity duration-instant active:opacity-80"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-callout text-text-primary">
                        {o.itemName}
                      </span>
                      <span className="block truncate text-caption-1 text-text-secondary">
                        {o.variantName}
                        {o.facts.availability.kind === "unavailable"
                          ? `, observed unavailable, ${seenLabel(o.facts.observedAt)}`
                          : `, ${seenLabel(o.facts.observedAt)}`}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      {o.facts.availability.kind === "available" ? (
                        <>
                          <span className="block text-callout font-semibold tabular-nums text-text-primary">
                            {formatNaira(o.facts.availability.price.minKobo)}
                            {o.facts.availability.price.maxKobo >
                            o.facts.availability.price.minKobo
                              ? ` to ${formatNaira(
                                  o.facts.availability.price.maxKobo,
                                )}`
                              : ""}
                          </span>
                          <span className="block text-caption-2 text-text-tertiary">
                            / {o.unit}
                          </span>
                        </>
                      ) : (
                        <span className="block text-callout text-text-secondary">
                          Unavailable
                        </span>
                      )}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        ) : result.kind === "sample" ? (
          <>
            <h2 className="text-footnote font-semibold text-text-primary">
              Sample listings
            </h2>
            <p className="mt-1.5 text-caption-1 text-text-tertiary">
              Sample data for exploring WetinDey, not a current observation.
            </p>
            <ul className="mt-2.5 flex flex-col gap-2">
              {result.samples.map((o) => (
                <li key={o.offerKey}>
                  <Link
                    href={`/item/${o.itemSlug}`}
                    className="flex items-center justify-between gap-3 squircle bg-surface px-3.5 py-3 shadow-card transition-opacity duration-instant active:opacity-80"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-callout text-text-primary">
                        {o.itemName}
                      </span>
                      <span className="block truncate text-caption-1 text-text-tertiary">
                        {o.variantName}, Sample
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-callout tabular-nums text-text-secondary">
                        {formatNaira(o.samplePrice.minKobo)}
                        {o.samplePrice.maxKobo > o.samplePrice.minKobo
                          ? ` to ${formatNaira(o.samplePrice.maxKobo)}`
                          : ""}
                      </span>
                      <span className="block text-caption-2 text-text-tertiary">
                        / {o.unit}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <h2 className="text-footnote font-semibold text-text-primary">
              Food information
            </h2>
            <p className="mt-2 text-subhead text-text-secondary">
              No public food observations are available here yet.
            </p>
          </>
        )}
      </section>

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
