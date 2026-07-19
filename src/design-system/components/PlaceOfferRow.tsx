"use client";

import { useState } from "react";
import Image from "next/image";

import type { PlaceOffer } from "@/app/actions";
import { formatNaira } from "@/lib/money";
import { SolidIcon } from "@/design-system/icons/SolidIcon";
import { StatusBadge, type StatusKind } from "./StatusBadge";

const OBSERVED_DATE = new Intl.DateTimeFormat("en-NG", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Africa/Lagos",
});

function priceLabel(offer: PlaceOffer) {
  return offer.priceMax != null && offer.priceMax > offer.priceMin
    ? `${formatNaira(offer.priceMin)} – ${formatNaira(offer.priceMax)}`
    : formatNaira(offer.priceMin);
}

function availabilityLabel(offer: PlaceOffer) {
  const availability = offer.trust?.availability ?? offer.availabilityState;
  if (availability === "available") return "Available";
  if (availability === "unavailable") return "Unavailable";
  return "Availability unverified";
}

function availabilityKind(offer: PlaceOffer): StatusKind | null {
  const availability = offer.trust?.availability ?? offer.availabilityState;
  if (availability === "unavailable") return "unavailable";
  if (availability !== "available") return null;

  const freshness =
    offer.trust?.origin === "observed"
      ? offer.trust.freshness
      : offer.freshnessState;
  return freshness === "stale" ||
    freshness === "expired" ||
    freshness === "caution" ||
    freshness === "unavailable"
    ? "caution"
    : "confirmed";
}

function freshnessLabel(offer: PlaceOffer) {
  const freshness =
    offer.trust?.origin === "observed"
      ? offer.trust.freshness
      : offer.freshnessState;
  switch (freshness) {
    case "fresh":
    case "confirmed":
      return "Fresh";
    case "stale":
    case "caution":
      return "Older report";
    case "expired":
      return "Out of date";
    case "unavailable":
      return "Not current";
    default:
      return "Freshness unverified";
  }
}

function ItemArtwork({
  offer,
  showImage,
  onImageError,
}: {
  offer: PlaceOffer;
  showImage: boolean;
  onImageError: () => void;
}) {
  const artwork = showImage ? (
    <Image
      src={offer.imageUrl!}
      alt=""
      fill
      sizes="88px"
      className="object-cover"
      unoptimized
      onError={onImageError}
    />
  ) : (
    <div
      className="grid h-full w-full place-items-center bg-surface-sunken text-text-secondary"
      aria-hidden="true"
    >
      <SolidIcon name="food" size={24} />
    </div>
  );

  return (
    <figure className="group relative w-[88px] shrink-0 self-stretch">
      {offer.imageSourceUrl && showImage ? (
        <a
          href={offer.imageSourceUrl}
          target="_blank"
          rel="nofollow noopener noreferrer"
          aria-label={`Photo source for ${offer.itemName}`}
          className="relative block h-full min-h-[104px] w-[88px] bg-surface-sunken
                     focus-visible:outline-2 focus-visible:outline-offset-[-3px]
                     focus-visible:outline-accent"
        >
          {artwork}
        </a>
      ) : (
        <div className="relative h-full min-h-[104px] w-[88px] bg-surface-sunken">
          {artwork}
        </div>
      )}
      {showImage ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 -right-px w-3
                     bg-gradient-to-r from-transparent to-surface-card
                     group-focus-within:opacity-0"
        />
      ) : null}
    </figure>
  );
}

/**
 * One market-specific price claim. The number never stands alone: unit,
 * availability, freshness, observation date and provenance remain attached.
 */
export function PlaceOfferRow({ offer }: { offer: PlaceOffer }) {
  const [imageBroken, setImageBroken] = useState(false);
  const showImage = Boolean(
    offer.imageUrl &&
      offer.imageAttribution &&
      offer.imageLicense &&
      offer.imageSourceUrl &&
      !imageBroken
  );
  const imageCredit = showImage
    ? `${offer.imageAttribution} · ${offer.imageLicense}`
    : null;
  const showProvenance =
    !offer.trust ||
    offer.trust.origin === "inadmissible" ||
    offer.trust.origin === "empty";
  const status = availabilityKind(offer);
  const isSample = offer.trust?.origin === "synthetic";
  const observedAt = OBSERVED_DATE.format(new Date(offer.lastObservedAt));
  const dateLabel =
    offer.trust?.origin === "observed"
      ? "Last observed"
      : offer.trust?.origin === "synthetic"
        ? "Sample date"
        : offer.trust?.origin === "inadmissible"
          ? "Reference date"
          : "Projection date";

  return (
    <article
      className="squircle-card flex min-h-[104px] w-full items-stretch
                 overflow-hidden bg-surface-card shadow-card"
      aria-label={`${offer.itemName}, ${priceLabel(offer)} per ${offer.unit}`}
    >
      <ItemArtwork
        offer={offer}
        showImage={showImage}
        onImageError={() => setImageBroken(true)}
      />

      <div className="min-w-0 flex-1 py-2 pl-2.5 pr-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h5 className="truncate text-subhead font-semibold text-text-primary">
              {offer.itemName}
            </h5>
            <p className="truncate text-caption-1 text-text-secondary">
              {offer.variantName}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="whitespace-nowrap text-subhead font-semibold tabular-nums text-text-primary">
              {priceLabel(offer)}
            </p>
            <p className="truncate text-caption-2 text-text-secondary">
              / {offer.unit}
            </p>
          </div>
        </div>

        {status ? (
          <StatusBadge kind={status} className="mt-1">
            {availabilityLabel(offer)}
          </StatusBadge>
        ) : (
          <span
            className="mt-1 inline-flex items-center gap-1.5 rounded-full
                       bg-fillTertiary px-2 py-0.5 text-[11px] text-text-secondary
                       forced-colors:bg-[Canvas] forced-colors:text-[CanvasText]
                       forced-colors:outline forced-colors:outline-1
                       forced-colors:outline-offset-[-1px]"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-text-tertiary forced-colors:bg-[CanvasText]" />
            {availabilityLabel(offer)}
          </span>
        )}

        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-caption-2 text-text-secondary">
          <span>{freshnessLabel(offer)}</span>
          <span className="inline-flex items-center gap-1">
            {isSample ? <SolidIcon name="star" size={16} /> : null}
            {dateLabel} {observedAt}
          </span>
          {showProvenance ? (
            <span>{offer.trust?.provenanceLabel ?? "No observed reports"}</span>
          ) : null}
        </div>

        {imageCredit ? (
          <p className="mt-1 break-words text-caption-2 leading-snug text-text-tertiary">
            {imageCredit}
          </p>
        ) : null}
      </div>
    </article>
  );
}

export function PlaceOfferRowSkeleton() {
  return (
    <div className="space-y-2" aria-hidden="true">
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          className="squircle-card flex min-h-[104px] items-stretch overflow-hidden
                     bg-surface-card shadow-card"
        >
          <div className="w-[88px] shrink-0 animate-pulse self-stretch bg-fillTertiary" />
          <div className="min-w-0 flex-1 space-y-2 py-2 pl-2.5 pr-2">
            <div className="flex items-start justify-between gap-2">
              <div className="h-4 w-2/5 animate-pulse rounded-full bg-fillTertiary" />
              <div className="h-4 w-1/3 animate-pulse rounded-full bg-fillTertiary" />
            </div>
            <div className="h-3 w-1/3 animate-pulse rounded-full bg-fillTertiary" />
            <div className="h-4 w-1/4 animate-pulse rounded-full bg-fillTertiary" />
            <div className="h-3 w-4/5 animate-pulse rounded-full bg-fillTertiary" />
          </div>
        </div>
      ))}
    </div>
  );
}
