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
  layout,
  status,
  statusLabel,
}: {
  offer: PlaceOffer;
  showImage: boolean;
  onImageError: () => void;
  layout: OfferRowLayout;
  status: StatusKind | null;
  statusLabel: string;
}) {
  const isRegular = layout === "regular";
  const artwork = showImage ? (
    <Image
      src={offer.imageUrl!}
      alt=""
      fill
      sizes={isRegular ? "(min-width: 768px) 220px, 100vw" : "(min-width: 768px) 72px, 88px"}
      className="object-cover"
      unoptimized
      onError={onImageError}
    />
  ) : (
    <div
      className="grid h-full w-full place-items-center bg-fillTertiary text-text-secondary"
      aria-hidden="true"
    >
      <SolidIcon name="food" size={24} />
    </div>
  );

  return (
    <figure
      className={
        isRegular
          ? "group relative h-28 min-h-tap w-full shrink-0"
          : "group relative w-[88px] shrink-0 self-stretch md:w-[72px]"
      }
    >
      <div
        className={
          isRegular
            ? "relative h-full min-h-tap w-full bg-transparent"
            : "relative h-full min-h-[88px] w-[88px] bg-transparent md:min-h-[80px] md:w-[72px]"
        }
      >
        {artwork}
      </div>
      {isRegular ? (
        <div
          className="pointer-events-none absolute left-2 top-2 z-10 rounded-full
                     bg-black/25 p-0.5 shadow-[0_2px_10px_rgb(0_0_0_/_0.28)]
                     backdrop-blur-sm forced-colors:bg-[Canvas] forced-colors:p-0"
        >
          {status ? (
            <StatusBadge kind={status}>{statusLabel}</StatusBadge>
          ) : (
            <span
              className="inline-flex items-center gap-1.5 rounded-full bg-fillSecondary px-2 py-0.5 text-[11px] text-text-secondary
                         forced-colors:bg-[Canvas] forced-colors:text-[CanvasText]
                         forced-colors:outline forced-colors:outline-1 forced-colors:outline-offset-[-1px]"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-text-tertiary forced-colors:bg-[CanvasText]" />
              {statusLabel}
            </span>
          )}
        </div>
      ) : null}
      {isRegular ? (
        <>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/75 via-black/30 to-transparent"
          />
          <div className="pointer-events-none absolute bottom-2 right-2 z-10 max-w-[calc(100%-1rem)] text-right">
            <p className="truncate text-subhead font-semibold tabular-nums text-white [text-shadow:0_1px_2px_rgb(0_0_0_/_0.72)]">
              {priceLabel(offer)}
            </p>
            <p className="truncate text-caption-2 text-white/85 [text-shadow:0_1px_2px_rgb(0_0_0_/_0.72)]">
              / {offer.unit}
            </p>
          </div>
        </>
      ) : null}
      {showImage ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 -right-px w-4
                     bg-gradient-to-r from-transparent to-[var(--stack-surface,var(--color-background))]
                     group-focus-within:opacity-0"
        />
      ) : null}
    </figure>
  );
}

/**
 * One market-specific price claim. Browse rows keep the facts needed to
 * decide whether an offer is useful; deeper provenance remains in detail.
 */
export type OfferRowLayout = "compact" | "regular";

export function PlaceOfferRow({
  offer,
  layout = "compact",
  onSelect,
}: {
  offer: PlaceOffer;
  layout?: OfferRowLayout;
  onSelect?: () => void;
}) {
  const isRegular = layout === "regular";
  const [imageBroken, setImageBroken] = useState(false);
  const showImage = Boolean(
    offer.imageUrl &&
      offer.imageAttribution &&
      offer.imageLicense &&
      offer.imageSourceUrl &&
      !imageBroken
  );
  const status = availabilityKind(offer);
  const statusLabel = availabilityLabel(offer);
  const isSample = offer.trust?.origin === "synthetic";
  const observedAt = OBSERVED_DATE.format(new Date(offer.lastObservedAt));
  const dateLabel = isSample
    ? "Sample"
    : offer.trust?.origin === "observed"
      ? "Last observed"
      : "Reference date";

  const cardContent = (
    <div
      className={
        isRegular
          ? "relative z-0 flex min-w-0 w-full flex-col text-left"
          : "relative z-0 flex min-h-[88px] min-w-0 w-full items-stretch text-left md:min-h-[80px]"
      }
    >
      <ItemArtwork
        offer={offer}
        showImage={showImage}
        onImageError={() => setImageBroken(true)}
        layout={layout}
        status={status}
        statusLabel={statusLabel}
      />

      <div
        className={
          isRegular
            ? "flex min-h-[104px] min-w-0 flex-1 flex-col px-2.5 py-2"
            : "min-w-0 flex-1 py-2 pl-2 pr-1.5 md:py-1.5 md:pl-2 md:pr-1"
        }
      >
        {isRegular ? (
          <>
            <h5 className="truncate text-subhead font-semibold text-text-primary">
              {offer.itemName}
            </h5>
            <p className="truncate text-caption-1 text-text-secondary">{offer.variantName}</p>
            <span className="mt-auto truncate pt-2 text-caption-2 text-text-secondary">
              {freshnessLabel(offer)}
            </span>
          </>
        ) : (
          <>
            <div className="flex items-start justify-between gap-1.5">
              <div className="min-w-0 flex-1">
                <h5 className="truncate text-subhead font-semibold text-text-primary">
                  {offer.itemName}
                </h5>
                <p className="truncate text-caption-1 text-text-secondary">{offer.variantName}</p>
              </div>
              <div className="min-w-0 max-w-[45%] shrink text-right md:max-w-[40%]">
                <p className="truncate whitespace-nowrap text-subhead font-semibold tabular-nums text-text-primary">
                  {priceLabel(offer)}
                </p>
                <p className="truncate text-caption-2 text-text-secondary">/ {offer.unit}</p>
              </div>
            </div>

            <div className="mt-1 flex min-w-0 items-end justify-between gap-2">
              <div className="min-w-0 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-caption-2 text-text-secondary">
                <span>{freshnessLabel(offer)}</span>
                <span className="inline-flex items-center gap-1">
                  {isSample ? <SolidIcon name="star" size={16} /> : null}
                  {dateLabel} {observedAt}
                </span>
              </div>
              {status ? (
                <StatusBadge kind={status} className="shrink-0">
                  {statusLabel}
                </StatusBadge>
              ) : (
                <span
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full
                             bg-fillTertiary px-2 py-0.5 text-[11px] text-text-secondary
                             forced-colors:bg-[Canvas] forced-colors:text-[CanvasText]
                             forced-colors:outline forced-colors:outline-1
                             forced-colors:outline-offset-[-1px]"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-text-tertiary forced-colors:bg-[CanvasText]" />
                  {statusLabel}
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );

  return (
    <article
      className={
        isRegular
          ? "squircle-card relative flex min-w-0 w-full overflow-hidden bg-transparent"
          : "squircle-card relative flex min-h-[88px] w-full items-stretch overflow-hidden bg-transparent md:min-h-[80px]"
      }
      aria-label={`${offer.itemName}, ${priceLabel(offer)} per ${offer.unit}`}
    >
      {onSelect ? (
        <button
          type="button"
          onClick={onSelect}
          aria-label={`View ${offer.itemName} details`}
          className="absolute inset-0 z-10 min-h-tap w-full text-left focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
        />
      ) : (
        null
      )}
      {cardContent}
    </article>
  );
}

export function PlaceOfferRowSkeleton({ layout = "compact" }: { layout?: OfferRowLayout }) {
  const isRegular = layout === "regular";
  return (
    <div
      className={isRegular ? "grid grid-cols-2 gap-2" : "space-y-2"}
      aria-hidden="true"
    >
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          className={
            isRegular
              ? "squircle-card flex min-w-0 flex-col overflow-hidden bg-transparent"
              : "squircle-card flex min-h-[88px] items-stretch overflow-hidden bg-transparent md:min-h-[80px]"
          }
        >
          <div
            className={
              isRegular
                ? "h-28 min-h-tap w-full shrink-0 animate-pulse bg-fillTertiary"
                : "w-[88px] shrink-0 animate-pulse self-stretch bg-fillTertiary md:w-[72px]"
            }
          />
          <div
            className={
              isRegular
                ? "min-w-0 flex-1 space-y-2 px-2.5 py-2"
                : "min-w-0 flex-1 space-y-2 py-2 pl-2 pr-1.5 md:py-1.5 md:pl-2 md:pr-1"
            }
          >
            <div className="flex items-start justify-between gap-1.5">
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
