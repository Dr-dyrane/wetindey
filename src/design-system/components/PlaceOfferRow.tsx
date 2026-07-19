"use client";

import { useState } from "react";
import Image from "next/image";
import { Clock3, Wheat } from "lucide-react";

import type { PlaceOffer } from "@/app/actions";
import { formatNaira } from "@/lib/money";
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
      sizes="76px"
      className="object-cover"
      unoptimized
      onError={onImageError}
    />
  ) : (
    <div
      className="grid h-full w-full place-items-center bg-surface-sunken text-text-secondary"
      aria-hidden="true"
    >
      <Wheat className="h-7 w-7" strokeWidth={1.75} />
    </div>
  );

  return (
    <figure className="w-[76px] shrink-0">
      {offer.imageSourceUrl && showImage ? (
        <a
          href={offer.imageSourceUrl}
          target="_blank"
          rel="nofollow noopener noreferrer"
          aria-label={`Photo source for ${offer.itemName}`}
          className="relative block h-[76px] w-[76px] overflow-hidden squircle
                     bg-surface-sunken focus-visible:outline-2 focus-visible:outline-offset-2
                     focus-visible:outline-accent"
        >
          {artwork}
        </a>
      ) : (
        <div className="relative h-[76px] w-[76px] overflow-hidden squircle bg-surface-sunken">
          {artwork}
        </div>
      )}
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
  const status: StatusKind =
    offer.trust?.status ??
    (offer.availabilityState === "unavailable" ? "unavailable" : "caution");
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
      className="squircle-card grid w-full grid-cols-[76px_minmax(0,1fr)]
                 items-start gap-x-3 gap-y-2 bg-surface-card p-3
                 shadow-card"
      aria-label={`${offer.itemName}, ${priceLabel(offer)} per ${offer.unit}`}
    >
      <ItemArtwork
        offer={offer}
        showImage={showImage}
        onImageError={() => setImageBroken(true)}
      />

      <div className="min-w-0 flex-1 py-0.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h5 className="truncate text-subhead font-semibold text-text-primary">
              {offer.itemName}
            </h5>
            <p className="truncate text-caption-1 text-text-secondary">
              {offer.variantName}
            </p>
          </div>
          <StatusBadge kind={status} className="shrink-0">
            {availabilityLabel(offer)}
          </StatusBadge>
        </div>

        <p className="mt-1 text-title-3 font-semibold tabular-nums text-text-primary">
          {priceLabel(offer)}
          <span className="ml-1 text-footnote font-normal text-text-secondary">
            / {offer.unit}
          </span>
        </p>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-caption-2 text-text-secondary">
          <span className="inline-flex items-center gap-1">
            <Clock3 className="h-3 w-3" aria-hidden="true" />
            {freshnessLabel(offer)}
          </span>
          <span>
            {dateLabel} {observedAt}
          </span>
          <span>{offer.trust?.provenanceLabel ?? "No observed reports"}</span>
        </div>
      </div>

      {imageCredit ? (
        <p className="col-span-2 break-words text-caption-2 leading-snug text-text-tertiary">
          Photo: {imageCredit}
        </p>
      ) : null}
    </article>
  );
}

export function PlaceOfferRowSkeleton() {
  return (
    <div className="space-y-2" aria-hidden="true">
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          className="squircle-card flex items-start gap-3 bg-surface-card p-3 shadow-card"
        >
          <div className="h-[76px] w-[76px] shrink-0 animate-pulse squircle bg-fillTertiary" />
          <div className="min-w-0 flex-1 space-y-2 py-1">
            <div className="h-4 w-2/3 animate-pulse rounded-full bg-fillTertiary" />
            <div className="h-3 w-1/2 animate-pulse rounded-full bg-fillTertiary" />
            <div className="h-5 w-3/5 animate-pulse rounded-full bg-fillTertiary" />
            <div className="h-3 w-4/5 animate-pulse rounded-full bg-fillTertiary" />
          </div>
        </div>
      ))}
    </div>
  );
}
