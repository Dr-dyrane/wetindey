"use client";

import { useCallback, useEffect, useState } from "react";
import { Star } from "lucide-react";
import { IconOrb } from "@/design-system/components/IconOrb";
import { ModalSheet } from "@/design-system/components/ModalSheet";
import { ListRow, ListGroup } from "@/design-system/components/ListRow";
import { StatusBadge, type StatusKind } from "@/design-system/components/StatusBadge";
import { SolidIcon } from "@/design-system/icons/SolidIcon";
import {
  getPlaceContactPolicy,
  getReviewsForEntity,
  getReviewAggregate,
  type PlaceContactPolicy,
  type ReviewData,
  type ReviewAggregateData
} from "@/app/actions";
import { formatNaira } from "@/lib/money";

/** The offer the user was looking at when they tapped "Get it", if any. */
export interface GetItOffer {
  /**
   * `offers_current.id` — the claim the user is about to go and test.
   *
   * Carried so the caller can snapshot it with `getVisitContext` while the sheet
   * is open and still has a connection, and arm the post-visit question against
   * it on the way out. Optional because a place reached from a neutral pin has
   * no offer, and therefore no claim under test and nothing to confirm.
   */
  offerId?: string;
  itemName: string;
  variantName?: string;
  /** Display name of the unit, e.g. "50 kg bag". */
  unit: string;
  /** Kobo, as stored. Formatting to naira happens here, once. */
  priceMin: number;
  priceMax?: number;
  /** ISO 8601, straight from the server. */
  observedAt?: string;
  freshnessKind?: StatusKind;
  freshnessLabel?: string;
}

export interface GetItTarget {
  placeId: string;
  placeName: string;
  lat: number;
  lng: number;
  address?: string | null;
  /** Fallback for the place's whereabouts when it has no street address. */
  areaName?: string;
  /** Absent when the user arrived from a neutral pin rather than an offer. */
  offer?: GetItOffer | null;
}

interface GetItSheetProps {
  open: boolean;
  onClose: () => void;
  /** Null closes the sheet's content; the sheet itself is driven by `open`. */
  target: GetItTarget | null;
  /** Where the user is now — becomes the route's start point when known. */
  origin?: { lat: number; lng: number } | null;
  /**
   * The user is leaving for the market. Fired synchronously, after the
   * coordinate has been checked and BEFORE the handoff — on Android the handoff
   * is a real navigation, so anything deferred past this point may never run.
   *
   * This is the seam the trust loop hangs on: going is the event worth
   * remembering, and this sheet is the only place that knows it happened.
   * Handlers must not await.
   */
  onGoThere?: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Coordinates
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Every coordinate that leaves this file ends up in a maps app, where a wrong
 * one is indistinguishable from a right one — the user simply drives to the
 * wrong place. This app has already shipped one silent coordinate bug (WKT
 * parsed where the driver returns hex EWKB, putting every market in the Gulf of
 * Guinea), so nothing here gets a plausible default. It throws.
 */
function assertCoordinate(lat: number, lng: number, placeName: string): void {
  const ok =
    Number.isFinite(lat) && Number.isFinite(lng) &&
    lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
  if (!ok) {
    throw new Error(`GetItSheet: invalid coordinate for "${placeName}": lat=${lat}, lng=${lng}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Platform handoff
// ─────────────────────────────────────────────────────────────────────────────

type MapsPlatform = "apple" | "android" | "web";

/**
 * Which maps app should receive this tap.
 *
 * User-agent sniffing is a poor tool and this is one of its few remaining
 * legitimate uses: there is no feature test for "which maps app does this
 * device have". The consequence of a wrong guess is bounded — the wrong-but-
 * working web map opens — so the guess stays coarse on purpose.
 */
function detectMapsPlatform(): MapsPlatform {
  if (typeof navigator === "undefined") return "web";
  const ua = navigator.userAgent;

  // Android first: Android UAs also contain "Linux", and some contain "Mac".
  if (/Android/i.test(ua)) return "android";

  // iPadOS 13+ deliberately reports itself as a desktop Mac. Touch points are
  // what separates an iPad from an iMac; both want Apple Maps anyway, so this
  // only has to be right about the family, not the device.
  const iPhone = /iPad|iPhone|iPod/.test(ua);
  const mac = /Macintosh|Mac OS X/.test(ua);
  if (iPhone || mac) return "apple";

  return "web";
}

/** The app the "Go there" row is actually going to open, named honestly. */
function mapsAppName(platform: MapsPlatform): string {
  if (platform === "apple") return "Apple Maps";
  // A geo: URI hands off to whichever maps app the user set as default, so
  // naming a vendor here would be a guess. Name the role instead.
  if (platform === "android") return "Maps app";
  return "Google Maps";
}

function appleMapsUrl(t: GetItTarget, origin?: { lat: number; lng: number } | null): string {
  const p = new URLSearchParams();
  p.set("daddr", `${t.lat},${t.lng}`);
  p.set("q", t.placeName);
  p.set("dirflg", "d");
  if (origin) p.set("saddr", `${origin.lat},${origin.lng}`);
  return `https://maps.apple.com/?${p.toString()}`;
}

function googleMapsUrl(t: GetItTarget, origin?: { lat: number; lng: number } | null): string {
  const p = new URLSearchParams();
  p.set("api", "1");
  p.set("destination", `${t.lat},${t.lng}`);
  p.set("travelmode", "driving");
  if (origin) p.set("origin", `${origin.lat},${origin.lng}`);
  return `https://www.google.com/maps/dir/?${p.toString()}`;
}

/**
 * RFC 5870, plus Android's `q` extension so the pin carries the market's name
 * rather than a bare coordinate.
 */
function geoUri(t: GetItTarget): string {
  return `geo:${t.lat},${t.lng}?q=${t.lat},${t.lng}(${encodeURIComponent(t.placeName)})`;
}

/**
 * A shareable pin for the place.
 *
 * WetinDey has no place-detail route yet (USER-FLOW lists one as needed but
 * unbuilt), so there is no wetindey.app URL that resolves to this market. A
 * link to the app root would be a link to nothing in particular. This is a
 * real, universally-openable pin at the real coordinate — the only honest
 * linkable representation that exists today. It should be replaced with the
 * place-detail URL the moment that route ships.
 */
function sharePinUrl(t: GetItTarget): string {
  return `https://www.google.com/maps/search/?api=1&query=${t.lat},${t.lng}`;
}

function openExternal(url: string): void {
  // noopener/noreferrer: the destination gets no handle on this window.
  const w = window.open(url, "_blank", "noopener,noreferrer");
  // Popup blockers return null. Navigating the current tab is the fallback —
  // the handoff is what the user asked for, so it must not evaporate.
  if (!w) window.location.href = url;
}

/**
 * Android: try the user's default maps app, fall back to the web map.
 *
 * A geo: URI that nothing claims does *nothing at all* — no error, no
 * navigation. That silent no-op is precisely the dead end this sheet exists to
 * remove, so the handoff is watched: if the page is still in the foreground a
 * beat later, the scheme was never handled and the web map opens instead.
 */
function openAndroidMaps(t: GetItTarget, origin?: { lat: number; lng: number } | null): void {
  let handedOff = false;
  const markHandedOff = () => {
    handedOff = true;
  };
  const onVisibility = () => {
    if (document.visibilityState === "hidden") handedOff = true;
  };

  window.addEventListener("pagehide", markHandedOff);
  window.addEventListener("blur", markHandedOff);
  document.addEventListener("visibilitychange", onVisibility);

  window.location.href = geoUri(t);

  window.setTimeout(() => {
    window.removeEventListener("pagehide", markHandedOff);
    window.removeEventListener("blur", markHandedOff);
    document.removeEventListener("visibilitychange", onVisibility);
    if (!handedOff && document.visibilityState === "visible") {
      window.location.href = googleMapsUrl(t, origin);
    }
  }, 1200);
}

// ─────────────────────────────────────────────────────────────────────────────
// Formatting
// ─────────────────────────────────────────────────────────────────────────────

function formatPriceRange(offer: GetItOffer): string {
  if (offer.priceMax && offer.priceMax !== offer.priceMin) {
    return `${formatNaira(offer.priceMin)}–${formatNaira(offer.priceMax)}`;
  }
  return formatNaira(offer.priceMin);
}

/**
 * "18 minutes ago", from an ISO timestamp.
 *
 * An absent timestamp is a legitimate absence and yields null. A *present* but
 * unparseable one is a broken contract with our own server, which serialises
 * these with toISOString() — so that throws rather than quietly dropping the
 * freshness line. Freshness is the claim this product lives on; a share that
 * silently omits it reads as a price with no age, which is worse than an error.
 */
function formatFreshness(iso?: string): string | null {
  if (iso === undefined || iso === null) return null;
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) {
    throw new Error(`GetItSheet: unparseable observedAt timestamp: ${JSON.stringify(iso)}`);
  }

  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const minutes = Math.round((then - Date.now()) / 60_000);
  if (Math.abs(minutes) < 60) return rtf.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return rtf.format(hours, "hour");
  return rtf.format(Math.round(hours / 24), "day");
}

function whereabouts(t: GetItTarget): string | null {
  const address = t.address?.trim();
  if (address) return address;
  return t.areaName?.trim() || null;
}

/**
 * The message a user actually sends a friend: what it is, what it costs, where
 * it is, and how old the price is. The age is the point — a price without one
 * is a rumour, and this is the string that leaves the app and gets believed.
 */
function buildShareText(t: GetItTarget): string {
  const parts: string[] = [];

  if (t.offer) {
    const name = t.offer.variantName ? `${t.offer.itemName} (${t.offer.variantName})` : t.offer.itemName;
    parts.push(`${name} — ${formatPriceRange(t.offer)} per ${t.offer.unit} at ${t.placeName}.`);
  } else {
    parts.push(`${t.placeName}.`);
  }

  const where = whereabouts(t);
  if (where) parts.push(`${where}.`);

  const fresh = formatFreshness(t.offer?.observedAt);
  if (fresh) parts.push(`Price confirmed ${fresh}.`);

  parts.push("Shared from WetinDey.");
  return parts.join(" ");
}

// ─────────────────────────────────────────────────────────────────────────────
// Contact
// ─────────────────────────────────────────────────────────────────────────────

type ContactState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; policy: PlaceContactPolicy };

/**
 * What the contact row is allowed to say.
 *
 * Two separate facts, kept apart because they have different fixes:
 *
 *   1. `contactVisibility` is the seller's own answer and defaults to
 *      'private'. Private means private. There is no "reveal anyway".
 *   2. Even an explicit 'public' yields nothing to dial, because no channel
 *      column exists — no phone, no handle. Inventing a placeholder field to
 *      fill this row would be inventing a person's phone number.
 *
 * THE DETAIL CARRIES THE FACT; THE FOOTER IS ALMOST ALWAYS NOISE. Each of these
 * rows used to ship a sentence or two underneath explaining the app's reasoning
 * to itself — "Rather than guess, WetinDey shows nothing at all", "nothing is
 * being withheld". That is a developer defending a design decision to someone
 * who only wanted a phone number. "Not shared" already says everything a
 * shopper can act on, which is nothing, so the row stops talking.
 *
 * The one surviving footer is the error case, because "Unavailable" alone reads
 * as the seller's choice when it is actually our failure — a distinction the
 * user cannot make and would be misled by.
 */
function contactCopy(state: ContactState): { detail: string; footer: string | null } {
  if (state.status === "loading") return { detail: "Checking", footer: null };
  if (state.status === "error") {
    return { detail: "Unavailable", footer: "We couldn't read this seller's setting." };
  }
  if (state.policy.contactVisibility === "private") {
    return { detail: "Not shared", footer: null };
  }
  return { detail: "None on file", footer: null };
}

// ─────────────────────────────────────────────────────────────────────────────

type ShareResult = { kind: "idle" } | { kind: "copied" } | { kind: "manual"; text: string };

/**
 * "Get it" — the step where the lookup turns into a trip.
 *
 * An action sheet rather than a menu, per the HIG: these are choices related to
 * an action the user just took deliberately. Every row here either does
 * something real or explains, in place, why it cannot. Nothing is inert: this
 * component exists because Directions and Share rendered without handlers, and
 * a control that looks alive and does nothing is worse than no control.
 */
export function GetItSheet({ open, onClose, target, origin, onGoThere }: GetItSheetProps) {
  const [platform, setPlatform] = useState<MapsPlatform | null>(null);
  const [canShare, setCanShare] = useState(false);
  const [shareResult, setShareResult] = useState<ShareResult>({ kind: "idle" });
  const [contact, setContact] = useState<ContactState>({ status: "loading" });
  const [reviewsList, setReviewsList] = useState<ReviewData[]>([]);
  const [aggregate, setAggregate] = useState<ReviewAggregateData | null>(null);
  const [loadingReviews, setLoadingReviews] = useState(false);

  const placeId = target?.placeId ?? null;

  // Capability detection runs after mount so the server and the first client
  // render agree — navigator does not exist during SSR, and a mismatch here
  // would be a hydration error rather than a missing feature.
  useEffect(() => {
    setPlatform(detectMapsPlatform());
    setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

  // The seller's contact setting is read per place, when the sheet opens.
  useEffect(() => {
    if (!open || !placeId) return;
    let cancelled = false;
    setContact({ status: "loading" });
    getPlaceContactPolicy(placeId)
      .then((policy) => {
        if (!cancelled) setContact({ status: "ready", policy });
      })
      .catch(() => {
        // The thrown detail belongs in the server log, not in a user's face.
        // The row degrades to "Unavailable" and says so rather than defaulting
        // to a permissive value that could expose a seller who never agreed.
        if (!cancelled) setContact({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [open, placeId]);

  // Load reviews and aggregates per place, when the sheet opens.
  useEffect(() => {
    if (!open || !placeId) return;
    let cancelled = false;
    
    setLoadingReviews(true);
    
    Promise.all([
      getReviewsForEntity("place", placeId),
      getReviewAggregate("place", placeId)
    ])
      .then(([list, agg]) => {
        if (!cancelled) {
          setReviewsList(list);
          setAggregate(agg);
        }
      })
      .catch((err) => {
        console.error("Failed to load reviews:", err);
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingReviews(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, placeId]);

  useEffect(() => {
    if (!open) {
      setShareResult({ kind: "idle" });
    }
  }, [open]);

  useEffect(() => {
    if (shareResult.kind !== "copied") return;
    const t = window.setTimeout(() => setShareResult({ kind: "idle" }), 2000);
    return () => window.clearTimeout(t);
  }, [shareResult]);

  const copyToClipboard = useCallback(async (payload: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(payload);
        setShareResult({ kind: "copied" });
        return;
      } catch {
        // Permission refused, or an insecure context. Fall through.
      }
    }
    // No share sheet and no clipboard. Rather than leave a control that
    // silently fails, put the text on screen and let the user take it.
    setShareResult({ kind: "manual", text: payload });
  }, []);

  const handleGoThere = useCallback(() => {
    if (!target) return;
    assertCoordinate(target.lat, target.lng, target.placeName);

    // Before the handoff, never after: `openAndroidMaps` assigns
    // `window.location.href`, and a page that has been navigated away from does
    // not run the rest of this function. Ordered after the coordinate check so
    // a visit is never armed against a place we would refuse to route to.
    onGoThere?.();

    // Detected live rather than read from state: state exists for the label,
    // but the handoff must be right even on the first frame after mount.
    const p = detectMapsPlatform();
    if (p === "android") {
      openAndroidMaps(target, origin);
    } else if (p === "apple") {
      openExternal(appleMapsUrl(target, origin));
    } else {
      openExternal(googleMapsUrl(target, origin));
    }
    onClose();
  }, [target, origin, onClose, onGoThere]);

  const handleShare = useCallback(async () => {
    if (!target) return;
    assertCoordinate(target.lat, target.lng, target.placeName);

    const text = buildShareText(target);
    const url = sharePinUrl(target);
    const title = target.offer ? `${target.offer.itemName} at ${target.placeName}` : target.placeName;

    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ title, text, url });
        onClose();
        return;
      } catch (err) {
        // AbortError means the user opened the share sheet and dismissed it.
        // That is a completed interaction, not a failure — copying to their
        // clipboard after they backed out would be the app overruling them.
        if (err instanceof DOMException && err.name === "AbortError") return;
        // Anything else: the share never happened, so fall through to copying.
      }
    }

    await copyToClipboard(`${text} ${url}`);
  }, [target, onClose, copyToClipboard]);

  if (!target) return null;

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
            {/* What you are about to act on. Restated because the sheet covers the
                detail view it was opened from, and a handoff to another app should
                never be a leap of faith about which market it is. */}
            <div className="mx-4 squircle-card bg-surface dark:bg-surface-elevated px-4 py-3">
              <p className="truncate text-headline text-text-primary">{target.placeName}</p>
              {where && <p className="mt-0.5 truncate text-footnote text-text-secondary">{where}</p>}

              {aggregate && aggregate.ratingCount > 0 && (
                <div className="mt-1.5 flex items-center gap-1.5">
                  <div className="flex items-center text-rating">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`h-3.5 w-3.5 ${
                          i < Math.round(aggregate.ratingAverage)
                            ? "fill-current"
                            : "text-rating-muted"
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-caption-1 font-semibold text-text-secondary">
                    {aggregate.ratingAverage.toFixed(1)} ({aggregate.ratingCount} {aggregate.ratingCount === 1 ? "review" : "reviews"})
                  </span>
                </div>
              )}

              {target.offer && (
                <p className="mt-2 text-subhead text-text-secondary">
                  <span className="text-text-primary font-semibold">{formatPriceRange(target.offer)}</span>
                  {` per ${target.offer.unit} · ${target.offer.itemName}`}
                </p>
              )}

              {(freshLabel || fresh) && (
                <div className="mt-2 flex items-center gap-2">
                  {freshLabel && <StatusBadge kind={freshKind}>{freshLabel}</StatusBadge>}
                  {/* "Last seen", not "Confirmed": this line states WHEN we heard,
                      and the badge beside it states WHAT we heard. Saying "confirmed"
                      here read as confirmed-available next to a red "E no dey" badge —
                      the two halves of the row contradicting each other. */}
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

            {/* Last resort: no share sheet, no clipboard. The text is still the
                thing the user wanted, so it goes on screen where they can take it
                by hand. select-all makes one tap select the lot. */}
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

            {/* Informational, not disabled: a greyed-out button implies it might
                light up. It will not — the seller said no, or there is nothing to
                dial. The row states the fact and the footer gives the reason. */}
            <ListGroup footer={contactText.footer ?? undefined}>
              <ListRow
                icon={<SolidIcon name="phone" size={16} />}
                iconTone="context-contact"
                label="Contact seller"
                detail={contactText.detail}
                chevron={false}
              />
            </ListGroup>

            {/* Reviews Section */}
            <div className="px-4 pt-5 space-y-4">
              <div>
                <h3 className="text-headline text-text-primary font-bold">Reviews</h3>
                <p className="mt-1 text-footnote text-text-secondary">
                  New reviews are unavailable while we prepare safety and moderation safeguards.
                </p>
              </div>

              {loadingReviews ? (
                <p className="text-footnote text-text-secondary py-2">Loading reviews...</p>
              ) : reviewsList.length === 0 ? (
                <div className="rounded-[20px] bg-fillSecondary px-4 py-8 text-center">
                  <div className="mb-2 flex justify-center">
                    <IconOrb tone="rating">
                      <SolidIcon name="star" size={16} />
                    </IconOrb>
                  </div>
                  <p className="text-subhead font-semibold text-text-secondary">Reviews unavailable</p>
                  <p className="text-caption-1 text-text-tertiary mt-1 max-w-[240px] mx-auto leading-relaxed">
                    We are preparing this feature with safety and moderation in mind.
                  </p>
                </div>
              ) : (
                <div className="space-y-4 pb-4">
                  {reviewsList.map((review) => {
                    const initials = review.reviewerName
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .substring(0, 2)
                      .toUpperCase() || "?";
                    
                    return (
                      <div key={review.id} className="rounded-[20px] bg-fillSecondary p-3.5 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-fillPrimary text-footnote font-bold text-text-primary">
                              {review.reviewerAvatarUrl ? (
                                <img
                                  src={review.reviewerAvatarUrl}
                                  alt=""
                                  className="w-full h-full rounded-full object-cover"
                                />
                              ) : (
                                initials
                              )}
                            </div>
                            <div>
                              <p className="text-footnote font-semibold text-text-primary leading-tight">
                                {review.reviewerName}
                              </p>
                              <div className="mt-0.5 flex items-center text-rating">
                                {Array.from({ length: 5 }).map((_, idx) => (
                                  <Star
                                    key={idx}
                                    className={`h-3 w-3 ${idx < review.rating ? "fill-current" : "text-rating-muted"}`}
                                  />
                                ))}
                              </div>
                            </div>
                          </div>
                          <span className="text-caption-1 text-text-tertiary">
                            {new Date(review.createdAt).toLocaleDateString("en-NG", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                        </div>

                        {review.title && (
                          <p className="text-footnote font-semibold text-text-primary">
                            {review.title}
                          </p>
                        )}

                        {review.body && (
                          <p className="text-footnote text-text-secondary whitespace-pre-wrap leading-relaxed">
                            {review.body}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
        </>
      </div>
    </ModalSheet>
  );
}
