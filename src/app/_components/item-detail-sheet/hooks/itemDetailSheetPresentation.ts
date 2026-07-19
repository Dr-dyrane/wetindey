import { type NarrowedOffer, type StatusKind, type useT } from "../imports/imports";

export type Translator = ReturnType<typeof useT>;

export interface OfferPresentation {
  kind: StatusKind;
  label: string;
  short: string;
  sold: boolean;
}

export interface PresentedOffer {
  offer: NarrowedOffer;
  kind: StatusKind;
}

export interface ConfidencePresentation {
  bars: number;
  showMeter: boolean;
  word: string;
  label: string;
}

export interface OfferRow {
  offer: NarrowedOffer;
  signal: OfferPresentation;
  confidence: ConfidencePresentation;
  isCheapest: boolean;
  isClosest: boolean;
}

const OBSERVED_AT = new Intl.DateTimeFormat("en-NG", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Africa/Lagos",
});

export const naira = (kobo: number) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(kobo / 100);

function formatAge(ageHours: number | null): string {
  if (ageHours === null) return "at an unknown time";

  const mins = Math.round(Math.max(0, ageHours) * 60);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;

  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;

  const days = Math.round(hrs / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

export function formatObservedAt(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "time unavailable" : OBSERVED_AT.format(date);
}

/**
 * Present the server-derived trust answer using the active locale's one
 * authoritative status vocabulary.
 *
 * Freshness windows, availability, source independence, reliability weighting,
 * and confidence bands remain server-owned. Synthetic evidence keeps its
 * server-supplied provenance label verbatim.
 */
export function presentOffer(offer: NarrowedOffer, translate: Translator): OfferPresentation {
  const observed = offer.trust.origin === "observed";
  const kind: StatusKind = observed ? offer.trust.status : "caution";
  const sold = offer.trust.availability === "unavailable";

  if (!observed) {
    const availability = sold
      ? translate("item.a11y_not_available")
      : translate("item.a11y_available");

    return {
      kind,
      label: `${availability} · ${offer.trust.provenanceLabel}`,
      short: offer.trust.provenanceLabel,
      sold,
    };
  }

  const short =
    kind === "unavailable"
      ? translate("item.status_unavailable")
      : kind === "confirmed"
        ? translate("item.status_confirmed")
        : translate("item.status_caution");
  const age = formatAge(offer.trust.ageHours);
  const label = kind === "confirmed" ? `${short} ${age}` : `${short} · ${age}`;

  return { kind, label, short, sold };
}

/**
 * Confidence presentation, without a second confidence model.
 *
 * The server owns source independence, reliability, decay, score, and band.
 * The client maps that already-decided band to neutral bars and formats the
 * server counts for sighted and screen-reader users.
 */
export function confidenceFor(offer: NarrowedOffer): ConfidencePresentation {
  const { band, distinctSourceCount: sources, observationCount: reports } = offer.trust;

  if (offer.trust.origin !== "observed") {
    return {
      bars: 0,
      showMeter: false,
      word: "No",
      label: `${reports} observed ${reports === 1 ? "report" : "reports"}`,
    };
  }

  const bars = band === "high" ? 3 : band === "medium" ? 2 : band === "low" ? 1 : 0;
  const word =
    band === "high" ? "High" : band === "medium" ? "Medium" : band === "low" ? "Low" : "No";
  const label =
    `${reports} ${reports === 1 ? "report" : "reports"}` +
    ` · ${sources} ${sources === 1 ? "source" : "sources"}`;

  return { bars, showMeter: true, word, label };
}

export function createOfferRows(offers: NarrowedOffer[], translate: Translator): OfferRow[] {
  const available = offers.filter((offer) => offer.availabilityState !== "unavailable");
  // Whatever the sort, name the row that wins on price and the row that wins
  // on distance. That is how "the best answer" stops depending on the user
  // having picked the right sort first.
  const cheapestId = available.reduce<NarrowedOffer | null>(
    (best, offer) => (!best || offer.priceMin < best.priceMin ? offer : best),
    null
  )?.id;
  const closestId = available.reduce<NarrowedOffer | null>(
    (best, offer) => (!best || offer.distanceM < best.distanceM ? offer : best),
    null
  )?.id;

  return offers.map((offer) => ({
    offer,
    signal: presentOffer(offer, translate),
    confidence: confidenceFor(offer),
    isCheapest: offers.length > 1 && offer.id === cheapestId,
    isClosest: offers.length > 1 && offer.id === closestId,
  }));
}
