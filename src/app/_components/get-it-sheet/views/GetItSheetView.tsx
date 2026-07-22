import React from "react";
import {
  ModalSheet,
  ListRow,
  ListGroup,
  StatusBadge,
  SolidIcon,
} from "../imports/imports";
import {
  formatPriceRange,
  formatFreshness,
  whereabouts,
  contactCopy,
  mapsAppName,
  type GetItSheetProps,
  type useGetItSheet,
} from "../hooks/useGetItSheet";
import type { StatusKind } from "@/design-system/components/StatusBadge";
import { GetItReviewAggregateView, GetItReviewsView } from "./GetItReviewsView";
import "../styles/GetItSheet.css";

export interface GetItSheetViewProps extends GetItSheetProps {
  sheet: ReturnType<typeof useGetItSheet>;
}

export function GetItSheetView({
  open,
  onClose,
  target,
  sheet,
}: GetItSheetViewProps) {
  if (!target) return null;

  const {
    platform,
    canShare,
    shareResult,
    contact,
    reviewsList,
    aggregate,
    loadingReviews,
    originState,
    detailsOpen,
    setDetailsOpen,
    handleGoThere,
    handleDestinationOnly,
    handleUseCurrentLocation,
    handleOpenWithLocation,
    handleShare,
  } = sheet;

  const where = whereabouts(target);
  const fresh = formatFreshness(target.offer?.observedAt);
  const freshLabel = target.offer?.freshnessLabel;
  const freshKind: StatusKind = target.offer?.freshnessKind ?? "info";
  const contactText = contactCopy(contact);
  const shareLabel = canShare ? "Share" : "Copy details";

  return (
    <ModalSheet open={open} onClose={onClose} title="Get it" size="form">
      <div className="space-y-6 py-3">
        <>
          <div className="mx-4 squircle-card bg-surface dark:bg-surface-elevated px-4 py-3">
            <p className="truncate text-headline text-text-primary">{target.placeName}</p>
            {where && <p className="mt-0.5 truncate text-footnote text-text-secondary">{where}</p>}

            {target.offer && (
              <p className="mt-2 text-subhead text-text-secondary">
                <span className="text-text-primary font-semibold">{formatPriceRange(target.offer)}</span>
                {` per ${target.offer.unit} · ${target.offer.itemName}`}
              </p>
            )}

            {(freshLabel || fresh) && (
              <div className="mt-2 flex items-center gap-2">
                {freshLabel && <StatusBadge kind={freshKind}>{freshLabel}</StatusBadge>}
                {fresh && <span className="text-caption-1 text-text-tertiary">Last seen {fresh}</span>}
              </div>
            )}
          </div>

          <ListGroup>
            <ListRow
              icon={<SolidIcon name="navigation" size={16} />}
              iconTone="context-navigation"
              label="Go there"
              detail={platform ? mapsAppName(platform) : undefined}
              onClick={handleGoThere}
            />
          </ListGroup>

          <button
            type="button"
            aria-expanded={detailsOpen}
            aria-controls="get-it-secondary"
            onClick={() => setDetailsOpen((prev) => !prev)}
            className="mx-4 min-h-tap flex w-[calc(100%-2rem)] items-center justify-between squircle px-3 text-subhead font-semibold text-text-secondary active:opacity-70"
          >
            <span>{detailsOpen ? "Hide details" : "More details"}</span>
            <span className={detailsOpen ? "rotate-180" : ""}>
              <SolidIcon name="chevron-down" size={16} />
            </span>
          </button>

          {detailsOpen && (
            <div id="get-it-secondary" className="space-y-6">
              <GetItReviewAggregateView aggregate={aggregate} />

              <ListGroup>
                <ListRow
                  icon={
                    canShare ? (
                      <SolidIcon name="share" size={16} />
                    ) : (
                      <SolidIcon name="copy" size={16} />
                    )
                  }
                  label={shareLabel}
                  detail={shareResult.kind === "copied" ? "Copied" : undefined}
                  onClick={() => {
                    void handleShare();
                  }}
                />
              </ListGroup>

              {originState.kind !== "idle" && (
                <div
                  role={originState.kind === "problem" ? "alert" : undefined}
                  className="mx-4 space-y-3 squircle-card bg-fillSecondary px-4 py-3"
                >
                  <div className="space-y-1">
                    <p className="text-subhead font-semibold text-text-primary">
                      {originState.kind === "problem"
                        ? originState.title
                        : originState.kind === "ready"
                          ? "Current location ready"
                          : "Choose what leaves WetinDey"}
                    </p>
                    <p className="text-footnote text-text-secondary">
                      {originState.kind === "problem"
                        ? originState.message
                        : originState.kind === "ready"
                          ? `Your refreshed location and this market were sent to Mapbox for this route. Open ${
                              platform ? mapsAppName(platform) : "your maps app"
                            } within one minute to use the same origin.`
                          : `Use current location refreshes and sends your exact location and this market to Mapbox for a route, then to ${
                              platform ? mapsAppName(platform) : "your maps app"
                            }. Destination only sends the market, not your location.`}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    {originState.kind === "ready" ? (
                      <button
                        type="button"
                        onClick={handleOpenWithLocation}
                        className="min-h-tap flex-1 squircle bg-accent px-3 text-subhead font-semibold
                                   text-text-on-accent active:opacity-70"
                      >
                        Open with my location
                      </button>
                    ) : (originState.kind !== "problem" ||
                      originState.canRetry) && (
                      <button
                        type="button"
                        onClick={handleUseCurrentLocation}
                        disabled={originState.kind === "locating"}
                        aria-busy={originState.kind === "locating"}
                        className="min-h-tap flex-1 squircle bg-accent px-3 text-subhead font-semibold
                                   text-text-on-accent active:opacity-70 disabled:opacity-50"
                      >
                        {originState.kind === "locating"
                          ? "Refreshing location…"
                          : "Use current location"}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleDestinationOnly}
                      className="min-h-tap flex-1 squircle bg-fillPrimary px-3 text-subhead
                                 font-semibold text-text-primary active:opacity-70"
                    >
                      Destination only
                    </button>
                  </div>
                </div>
              )}

              {shareResult.kind === "manual" && (
                <div className="mx-4 space-y-1.5">
                  <p className="text-footnote text-text-secondary">
                    This browser will not let WetinDey copy for you. Select and copy:
                  </p>
                  <p className="squircle bg-fillTertiary px-3 py-2.5 text-footnote text-text-primary select-all break-words">
                    {shareResult.text}
                  </p>
                </div>
              )}

              <ListGroup footer={contactText.footer ?? undefined}>
                <ListRow
                  icon={<SolidIcon name="phone" size={16} />}
                  iconTone="context-contact"
                  label="Contact seller"
                  detail={contactText.detail}
                  chevron={false}
                />
              </ListGroup>

              <GetItReviewsView
                loading={loadingReviews}
                reviews={reviewsList}
              />
            </div>
          )}
        </>
      </div>
    </ModalSheet>
  );
}
