import {
  React,
  StatusDot,
  formatDistance,
  type NarrowedOffer,
  type StatusKind,
} from "../imports/imports";
import { copy } from "../copy/copy";
import {
  formatObservedAt,
  naira,
  type OfferPresentation,
  type OfferRow,
  type Translator,
} from "../hooks/itemDetailSheetPresentation";

const FRESH_FG: Record<StatusKind, string> = {
  confirmed: "text-status-confirmed-fg",
  caution: "text-status-caution-fg",
  unavailable: "text-status-unavailable-fg",
  info: "text-status-info-fg",
};

/** Neutral by design — confidence is secondary, so it never spends colour. */
function ConfidenceMeter({ bars }: { bars: number }) {
  return (
    <span aria-hidden className="item-detail-sheet-meter flex items-end gap-[2px]">
      {[1, 2, 3].map((bar) => (
        <span
          key={bar}
          className={`w-[3px] rounded-full ${
            bar <= bars ? "bg-text-tertiary" : "bg-fillQuaternary"
          }`}
          style={{ height: `${3 + bar * 2}px` }}
        />
      ))}
    </span>
  );
}

/** A neutral marker for the row that wins a dimension. Never a status colour. */
function LeadChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="squircle-full bg-fillTertiary px-2 py-[1px] text-caption-2 text-text-secondary">
      {children}
    </span>
  );
}

interface ItemDetailOfferRowProps {
  row: OfferRow;
  detailsOpen: boolean;
  onSelectOffer: (offer: NarrowedOffer, signal: OfferPresentation) => void;
  translate: Translator;
}

export function ItemDetailOfferRow({
  row: { offer, signal, confidence, isCheapest, isClosest },
  detailsOpen,
  onSelectOffer,
  translate,
}: ItemDetailOfferRowProps) {
  const availability = signal.sold
    ? translate("item.a11y_not_available")
    : translate("item.a11y_available");
  const priceRange = `${naira(offer.priceMin)}${
    offer.priceMax ? ` ${copy.to} ${naira(offer.priceMax)}` : ""
  }`;
  const observedLabel =
    offer.trust.origin === "observed"
      ? copy.lastObserved
      : offer.trust.origin === "synthetic"
        ? copy.sampleDate
        : offer.trust.origin === "inadmissible"
          ? copy.referenceDate
          : copy.projectionDate;
  const ariaLabel = [
    `${offer.placeName}.`,
    `${availability}.`,
    `${priceRange} ${copy.per} ${offer.unitName}.`,
    `${signal.label}.`,
    `${formatDistance(offer.distanceM / 1000)}.`,
    `${confidence.word} confidence, ${confidence.label}.`,
  ].join(" ");

  return (
    <button
      type="button"
      onClick={() => onSelectOffer(offer, signal)}
      aria-label={ariaLabel}
      /* `dark:active:` is not redundant: `dark:bg-surface-elevated` and
         `active:bg-fillTertiary` both weigh (0,2,0), and Tailwind emits
         the dark rule second, so it would win the press state on a tie. */
      className={[
        "flex w-full items-start gap-3 bg-surface dark:bg-surface-elevated p-3",
        "text-left shadow-card squircle-card transition-colors duration-instant",
        "active:bg-fillTertiary dark:active:bg-fillTertiary",
      ].join(" ")}
    >
      <span className="mt-[7px]">
        <StatusDot kind={signal.kind} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-headline text-text-primary">{offer.placeName}</span>
        </span>

        {/* Hue — the one saturated thing in the row. */}
        <span className={`mt-0.5 block truncate text-footnote ${FRESH_FG[signal.kind]}`}>
          {signal.label}
        </span>

        {detailsOpen && (
          <span
            className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-caption-1 text-text-secondary"
          >
            <span className="shrink-0 whitespace-nowrap tabular-nums">
              {formatDistance(offer.distanceM / 1000)}
            </span>
            <span
              className="inline-flex min-w-0 items-center gap-1"
              title={`${confidence.word} confidence`}
            >
              {confidence.showMeter && <ConfidenceMeter bars={confidence.bars} />}
              <span className="min-w-0 truncate">{confidence.label}</span>
            </span>
            {isCheapest && <LeadChip>{copy.cheapestChip}</LeadChip>}
            {isClosest && <LeadChip>{copy.closestChip}</LeadChip>}
            <span>
              {observedLabel} {formatObservedAt(offer.lastObservedAt)}
            </span>
            <span>{offer.trust.provenanceLabel}</span>
          </span>
        )}
      </span>

      <span className="shrink-0 text-right">
        {/* Weight carries price. Neutral ink — accent is black in light and white
            in dark, so it stays out of the colour budget while still being the
            loudest thing here. */}
        <span
          className={`block text-title-3 font-semibold tabular-nums ${
            signal.sold ? "text-text-tertiary line-through" : "text-text-primary"
          }`}
        >
          {naira(offer.priceMin)}
        </span>
        {offer.priceMax !== null && offer.priceMax > offer.priceMin && (
          <span
            className={`block text-footnote tabular-nums ${
              signal.sold ? "text-text-tertiary" : "text-text-secondary"
            }`}
          >
            {copy.to} {naira(offer.priceMax)}
          </span>
        )}
        <span className="mt-0.5 block text-caption-1 text-text-tertiary">
          {copy.per} {offer.unitName}
        </span>
      </span>
    </button>
  );
}
