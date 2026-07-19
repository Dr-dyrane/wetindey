"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { IconOrb } from "@/design-system/components/IconOrb";
import { ModalSheet } from "@/design-system/components/ModalSheet";
import { SheetPicker } from "@/design-system/components/SheetPicker";
import { StatusDot, type StatusKind } from "@/design-system/components/StatusBadge";
import { CardListSkeleton } from "@/design-system/components/Skeleton";
import { SolidIcon } from "@/design-system/icons/SolidIcon";
import { formatDistance } from "@/lib/geospatial";
import {
  getItemNarrowingOptions,
  getOffersNarrowed,
  type NarrowedOffer,
  type OfferSort,
} from "@/app/_actions/actions";
import { useT } from "@/core/i18n";

/* ───────────────────────────────────────────────────────────────────────────
   ItemDetailSheet — the narrowing half of the core loop.

   USER-FLOW: rice → Long-grain rice → 50 kg bag → offers, then "compare
   availability, price, freshness, distance and confidence". Search used to make
   one decision and hand back a flat list; this sheet makes all three and then
   ranks what is left.

   The five dimensions have to be readable at a glance, which is only possible
   if they are encoded differently from each other:

     availability → the price is struck through, and the dot goes red
     price        → the heaviest, largest thing in the row. Neutral ink.
     freshness    → HUE. The status ramp. The only saturated colour in the row.
     distance     → a number, tabular, secondary
     confidence   → a three-bar meter in neutral fill, secondary

   That is the whole reason the chrome is grey: five signals can only coexist if
   exactly one of them is allowed to be saturated.
   ────────────────────────────────────────────────────────────────────────── */

export interface ItemDetailSheetItem {
  id: string;
  name: string;
  /**
   * The item's photo, and the two facts a CC BY / CC BY-SA licence obliges us to
   * print wherever it appears. They travel together or not at all: a URL without
   * its attribution is not a licence we hold.
   *
   * Optional because the column is nullable and nothing enforces coverage —
   * `assertItemImages` only catches image keys with no item, never the inverse,
   * and `withImage` (seed.ts:37) returns {} on a miss. Every item has a photo
   * today by hand, not by construction.
   */
  imageUrl?: string | null;
  imageAttribution?: string | null;
  imageLicense?: string | null;
}

interface ItemDetailSheetProps {
  open: boolean;
  onClose: () => void;
  /** The item the user picked. The sheet resolves it down to a unit. */
  item: ItemDetailSheetItem | null;
  /** Search origin. Frozen on open — see `origin` below. */
  center: { lat: number; lng: number };
  /** Honoured in PostGIS. Until now `activeRadiusKm` was read by no query. */
  radiusKm: number;
  /** Named in the empty state, so "nothing found" says where it looked. */
  areaName: string;
  /** Tapping a row. The parent centres the map and dismisses this sheet. */
  onSelectOffer: (offer: NarrowedOffer, signal: OfferPresentation) => void;
  /**
   * The narrowed set, whenever it changes, so the map behind can pin exactly
   * what this list is showing.
   *
   * The alternative — the parent running its own item→offer query for markers —
   * is what the app did before, via `getFoodItemCandidates`. Two queries for one
   * question is two answers: narrow to "50 kg bag" and the pins would still be
   * every size, so the map and the list would quietly describe different things.
   *
   * MUST be stable across renders (`useEventCallback`). It is called from an
   * effect, so an identity that churns re-fires it, and a handler that sets
   * parent state would loop.
   */
  onOffersChange?: (offers: PresentedOffer[]) => void;
  /** page.tsx's TRANSLATIONS dict. Only the keys that already exist are used. */
  t?: Record<string, string>;
}

const ANY = "__any";

const naira = (kobo: number) =>
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

const OBSERVED_AT = new Intl.DateTimeFormat("en-NG", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Africa/Lagos",
});

function formatObservedAt(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "time unavailable" : OBSERVED_AT.format(date);
}

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

/**
 * Present the server-derived trust answer using the active locale's one
 * authoritative status vocabulary.
 *
 * Freshness windows, availability, source independence, reliability weighting,
 * and confidence bands remain server-owned. Synthetic evidence keeps its
 * server-supplied provenance label verbatim.
 */
function presentOffer(
  offer: NarrowedOffer,
  translate: ReturnType<typeof useT>,
): OfferPresentation {
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

const FRESH_FG: Record<StatusKind, string> = {
  confirmed: "text-status-confirmed-fg",
  caution: "text-status-caution-fg",
  unavailable: "text-status-unavailable-fg",
  info: "text-status-info-fg",
};

/**
 * Confidence presentation, without a second confidence model.
 *
 * The server owns source independence, reliability, decay, score, and band.
 * The client maps that already-decided band to neutral bars and formats the
 * server counts for sighted and screen-reader users.
 */
function confidenceFor(offer: NarrowedOffer) {
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
  const word = band === "high" ? "High" : band === "medium" ? "Medium" : band === "low" ? "Low" : "No";
  const label =
    `${reports} ${reports === 1 ? "report" : "reports"}` +
    ` · ${sources} ${sources === 1 ? "source" : "sources"}`;
  return { bars, showMeter: true, word, label };
}

/** Neutral by design — confidence is secondary, so it never spends colour. */
function ConfidenceMeter({ bars }: { bars: number }) {
  return (
    <span aria-hidden className="flex items-end gap-[2px]">
      {[1, 2, 3].map((i) => (
        <span
          key={i}
          className={`w-[3px] rounded-full ${i <= bars ? "bg-text-tertiary" : "bg-fillQuaternary"}`}
          style={{ height: `${3 + i * 2}px` }}
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

/**
 * One step of the narrowing path.
 *
 * A choice presents a sheet — SheetPicker, per the HIG rule this app follows.
 * With one option there is no choice to present, so it renders as a plain
 * resolved value: a picker that opens a sheet containing a single row you
 * cannot deselect is a control that lies about having an outcome. The pilot
 * data hits this constantly — every item currently carries exactly one variant
 * and one unit — so the taxonomy stays visible without the dead affordance.
 */
function NarrowStep({
  label,
  title,
  options,
  value,
  onSelect,
}: {
  label: string;
  title: string;
  options: { id: string; label: string; detail?: string; disabled?: boolean }[];
  value: string;
  onSelect: (id: string) => void;
}) {
  if (options.length <= 1) {
    const only = options[0];
    return (
      <div>
        <span className="mb-1.5 block text-footnote text-text-secondary">{label}</span>
        <div className="flex min-h-tap w-full items-center bg-fillQuaternary px-4 squircle">
          <span className="truncate text-body text-text-primary">{only?.label ?? "Nothing nearby"}</span>
        </div>
      </div>
    );
  }

  return (
    <SheetPicker
      title={title}
      label={label}
      options={options}
      value={value}
      onSelect={onSelect}
      placeholder="Choose"
    />
  );
}

const SORTS: { id: OfferSort; label: string }[] = [
  { id: "nearest", label: "Nearest" },
  { id: "cheapest", label: "Cheapest" },
  { id: "freshest", label: "Freshest" },
];

export function ItemDetailSheet({
  open,
  onClose,
  item,
  center,
  radiusKm,
  areaName,
  onSelectOffer,
  onOffersChange,
  t,
}: ItemDetailSheetProps) {
  const translate = useT();
  const itemId = item?.id ?? null;

  const [variantId, setVariantId] = useState<string>(ANY);
  const [unitId, setUnitId] = useState<string>(ANY);
  const [sort, setSort] = useState<OfferSort>("nearest");
  const [detailsOpen, setDetailsOpen] = useState(false);

  const [variants, setVariants] = useState<
    { id: string; displayName: string; offerCount: number; placeCount: number }[]
  >([]);
  const [units, setUnits] = useState<
    { variantId: string; id: string; displayName: string; offerCount: number; placeCount: number }[]
  >([]);

  const [offers, setOffers] = useState<NarrowedOffer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Null is not the only empty path — the CDN 404s and 429s at request time. */
  const [imageBroken, setImageBroken] = useState(false);

  /**
   * The origin is frozen at open.
   *
   * `center` is the live map centre, and tapping a result moves the map — so a
   * live origin would re-measure every distance and re-rank the list underneath
   * the finger that just tapped it. A comparison you cannot tap twice is not a
   * comparison. It thaws on the next open.
   */
  const centerRef = useRef(center);
  centerRef.current = center;
  const [origin, setOrigin] = useState(center);
  useEffect(() => {
    if (open) setOrigin(centerRef.current);
  }, [open]);

  // A new item is a new question: drop the old narrowing rather than carry a
  // "50kg bag" filter from rice over onto tomatoes.
  //
  // `imageBroken` resets here for a different reason. ItemCard can hold it for
  // the component's lifetime because a card is mounted per item; this sheet is
  // one instance that every item passes through, so a single failed photo would
  // strip the hero from every item opened afterwards.
  useEffect(() => {
    setVariantId(ANY);
    setUnitId(ANY);
    setSort("nearest");
    setDetailsOpen(false);
    setOffers([]);
    setError(null);
    setImageBroken(false);
  }, [itemId]);

  const optionsReq = useRef(0);
  useEffect(() => {
    if (!open || !itemId) return;
    const req = ++optionsReq.current;
    (async () => {
      try {
        const res = await getItemNarrowingOptions({ itemId, center: origin, radiusKm });
        if (req !== optionsReq.current) return;
        setVariants(res.variants);
        setUnits(res.units);
      } catch (err) {
        if (req !== optionsReq.current) return;
        console.error("Failed to load narrowing options:", err);
        setVariants([]);
        setUnits([]);
      }
    })();
  }, [open, itemId, origin, radiusKm]);

  const offersReq = useRef(0);
  const load = useCallback(async () => {
    if (!open || !itemId) return;
    const req = ++offersReq.current;
    setLoading(true);
    setError(null);
    try {
      const rows = await getOffersNarrowed({
        itemId,
        variantId: variantId === ANY ? null : variantId,
        unitId: unitId === ANY ? null : unitId,
        center: origin,
        radiusKm,
        sort,
      });
      if (req !== offersReq.current) return;
      setOffers(rows);
    } catch (err) {
      if (req !== offersReq.current) return;
      console.error("Failed to load offers:", err);
      setOffers([]);
      setError("We no fit reach the price data right now.");
    } finally {
      if (req === offersReq.current) setLoading(false);
    }
  }, [open, itemId, variantId, unitId, origin, radiusKm, sort]);

  useEffect(() => {
    void load();
  }, [load]);

  const variantOptions = useMemo(() => {
    const opts = variants.map((v) => ({
      id: v.id,
      label: v.displayName,
      detail: v.placeCount
        ? `${v.offerCount} ${v.offerCount === 1 ? "price" : "prices"} · ${v.placeCount} ${v.placeCount === 1 ? "place" : "places"}`
        : "None nearby",
      disabled: v.placeCount === 0,
    }));
    // "Any type" only earns its row when there is more than one type to span.
    return opts.length > 1 ? [{ id: ANY, label: "Any type" }, ...opts] : opts;
  }, [variants]);

  const unitOptions = useMemo(() => {
    const scoped = variantId === ANY ? units : units.filter((u) => u.variantId === variantId);
    // Across "any type" the same unit can appear under several variants; fold
    // them together so the picker offers a unit once, with the full count.
    const folded = new Map<string, { id: string; displayName: string; offerCount: number; placeCount: number }>();
    for (const u of scoped) {
      const prev = folded.get(u.id);
      if (prev) {
        prev.offerCount += u.offerCount;
        prev.placeCount += u.placeCount;
      } else {
        folded.set(u.id, { id: u.id, displayName: u.displayName, offerCount: u.offerCount, placeCount: u.placeCount });
      }
    }
    const opts = [...folded.values()].map((u) => ({
      id: u.id,
      label: u.displayName,
      detail: `${u.offerCount} ${u.offerCount === 1 ? "price" : "prices"}`,
    }));
    return opts.length > 1 ? [{ id: ANY, label: "Any size" }, ...opts] : opts;
  }, [units, variantId]);

  // A unit chosen under one variant may not exist under the next. Rather than
  // silently returning nothing, drop back to "any size".
  useEffect(() => {
    if (unitId === ANY) return;
    if (unitOptions.length === 0) return;
    if (!unitOptions.some((o) => o.id === unitId)) setUnitId(ANY);
  }, [unitOptions, unitId]);

  const rows = useMemo(() => {
    const available = offers.filter((o) => o.availabilityState !== "unavailable");
    // Whatever the sort, name the row that wins on price and the row that wins
    // on distance. That is how "the best answer" stops depending on the user
    // having picked the right sort first.
    const cheapestId = available.reduce<NarrowedOffer | null>(
      (best, o) => (!best || o.priceMin < best.priceMin ? o : best),
      null
    )?.id;
    const closestId = available.reduce<NarrowedOffer | null>(
      (best, o) => (!best || o.distanceM < best.distanceM ? o : best),
      null
    )?.id;

    return offers.map((offer) => ({
      offer,
      signal: presentOffer(offer, translate),
      confidence: confidenceFor(offer),
      isCheapest: offers.length > 1 && offer.id === cheapestId,
      isClosest: offers.length > 1 && offer.id === closestId,
    }));
  }, [offers, translate]);

  // Publish the narrowed set with the presentation kind already used by its
  // row. The map consumes this answer without rebuilding trust or status copy.
  useEffect(() => {
    onOffersChange?.(rows.map(({ offer, signal }) => ({ offer, kind: signal.kind })));
  }, [rows, onOffersChange]);

  const visiblePlaceCount = new Set(offers.map((offer) => offer.placeId)).size;
  const countLabel = `${visiblePlaceCount} ${t?.locations_found ?? (visiblePlaceCount === 1 ? "place" : "places")}`;

  /**
   * The Maps place-card order: photo bleeding to the panel's top edge, then the
   * name centred beneath it. Apple publishes no rule for the bleed — the Images
   * and Collections pages cover resolution, format and colour only — so this is
   * precedent, not law. What is law is below: the panel keeps its dismissal
   * affordances, which ModalSheet floats over this block.
   *
   * No corner radius here. The panel is overflow-hidden and already carries
   * SHEET_RADIUS; a second declaration would drift the moment that constant does.
   *
   * With no photo there is no hero, and ModalSheet renders its ordinary header.
   * A monogram blown up to hero scale is a worse header than a real header.
   */
  const hero =
    item && item.imageUrl && !imageBroken ? (
      <div>
        {/* Height tracks the viewport, not the width: the panel is sized as a
            fraction of the screen's height in both size classes, so a hero in vh
            holds one proportion of it at compact and regular alike. */}
        <div className="relative h-[clamp(140px,22vh,200px)] w-full bg-surface-sunken">
          <Image
            src={item.imageUrl}
            alt=""
            fill
            sizes="(min-width: 768px) 440px, 100vw"
            className="object-cover"
            /**
             * Straight from Wikimedia's CDN, not /_next/image. The optimizer
             * fetches every photo server-side from one IP, which
             * upload.wikimedia.org answers with 429 and no image renders. This
             * failure reaches production without ever showing up locally.
             */
            unoptimized
            onError={() => setImageBroken(true)}
          />

        </div>

        {/* Restores the heading ModalSheet's hero path drops. `title` still
            carries the dialog's accessible name, so this is the outline, not
            the label. */}
        <h2 className="text-balance px-10 pt-3 pb-1 text-center text-title-2 text-text-primary">
          {item.name}
        </h2>
      </div>
    ) : undefined;

  return (
    <ModalSheet open={open} onClose={onClose} title={item?.name ?? "Prices"} hero={hero} size="page">
      <div className="space-y-4 py-3">
        {/* The narrowing path: item → type → size. */}
        <div className="mx-4 grid grid-cols-2 gap-3">
          <NarrowStep
            label="Type"
            title="Choose type"
            options={variantOptions}
            value={variantId}
            onSelect={setVariantId}
          />
          <NarrowStep
            label="Size"
            title="Choose size"
            options={unitOptions}
            value={unitId}
            onSelect={setUnitId}
          />
        </div>

        <div className="mx-4 flex items-center justify-between gap-3">
          <p className="text-footnote text-text-secondary">
            {loading ? "Checking prices…" : `${countLabel} within ${radiusKm} km`}
          </p>
          <button
            type="button"
            aria-expanded={detailsOpen}
            aria-controls="item-detail-secondary"
            onClick={() => setDetailsOpen((openState) => !openState)}
            className="min-h-tap shrink-0 px-2 text-footnote font-medium text-text-secondary transition duration-micro active:opacity-60 focus-visible:outline-2 focus-visible:outline-accent"
          >
            {detailsOpen ? "Hide details" : "More details"}
          </button>
        </div>

        {detailsOpen && (
          <div
            id="item-detail-secondary"
            className="mx-4 space-y-3 px-0 py-1"
          >
            {item?.imageAttribution && (
              <p className="text-caption-1 text-text-secondary">
                Photo credit: {item.imageAttribution}
                {item.imageLicense ? ` · ${item.imageLicense}` : ""}
              </p>
            )}

            {/* Secondary ordering belongs with the other comparison detail, not
                in the first scan of the selected item. */}
            <div className="grid grid-cols-3 gap-1 squircle bg-fillTertiary p-1">
              {SORTS.map((s) => {
                const active = sort === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setSort(s.id)}
                    className={`min-h-tap squircle text-footnote font-medium transition duration-micro
                      ${active ? "bg-surface text-text-primary shadow-card" : "text-text-secondary"}`}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {error ? (
          <div className="mx-4 space-y-2 squircle-card bg-surface dark:bg-surface-elevated p-5 text-center shadow-card">
            <div className="flex justify-center">
              <IconOrb size={48} tone="status-unavailable">
                <SolidIcon name="warning" size={24} />
              </IconOrb>
            </div>
            <p className="text-headline text-text-primary">{error}</p>
            <p className="text-footnote text-text-secondary">Check your network and try again.</p>
          </div>
        ) : loading ? (
          <div className="mx-4">
            <CardListSkeleton count={3} />
          </div>
        ) : rows.length === 0 ? (
          <div className="mx-4 space-y-2 squircle-card bg-surface dark:bg-surface-elevated p-6 text-center shadow-card">
            <div className="flex justify-center">
              <IconOrb tone="context-location">
                <SolidIcon name="map-pin" size={16} />
              </IconOrb>
            </div>
            <p className="text-headline text-text-primary">Nothing within {radiusKm} km</p>
            <p className="text-footnote text-text-secondary">
              No one has reported {item?.name.toLowerCase() ?? "this"} near {areaName} yet. Widen the
              radius in Settings, or report a price you have seen.
            </p>
          </div>
        ) : (
          <div className="mx-4 space-y-2">
            {rows.map(({ offer, signal, confidence, isCheapest, isClosest }) => (
              <button
                key={offer.id}
                type="button"
                onClick={() => onSelectOffer(offer, signal)}
                aria-label={
                  `${offer.placeName}. ` +
                  `${signal.sold ? translate("item.a11y_not_available") : translate("item.a11y_available")}. ` +
                  `${naira(offer.priceMin)}${offer.priceMax ? ` to ${naira(offer.priceMax)}` : ""} per ${offer.unitName}. ` +
                  `${signal.label}. ` +
                  `${formatDistance(offer.distanceM / 1000)}. ` +
                  `${confidence.word} confidence, ${confidence.label}.`
                }
                /* `dark:active:` is not redundant: `dark:bg-surface-elevated` and
                   `active:bg-fillTertiary` both weigh (0,2,0), and Tailwind emits
                   the dark rule second, so it would win the press state on a tie. */
                className="flex w-full items-start gap-3 bg-surface dark:bg-surface-elevated p-3 text-left shadow-card squircle-card
                           transition-colors duration-instant active:bg-fillTertiary dark:active:bg-fillTertiary"
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
                    <span className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-caption-1 text-text-secondary">
                      <span className="shrink-0 whitespace-nowrap tabular-nums">
                        {formatDistance(offer.distanceM / 1000)}
                      </span>
                      <span className="inline-flex min-w-0 items-center gap-1" title={`${confidence.word} confidence`}>
                        {confidence.showMeter && <ConfidenceMeter bars={confidence.bars} />}
                        <span className="min-w-0 truncate">{confidence.label}</span>
                      </span>
                      {isCheapest && <LeadChip>Cheapest</LeadChip>}
                      {isClosest && <LeadChip>Closest</LeadChip>}
                      <span>
                        {offer.trust.origin === "observed"
                          ? "Last observed"
                          : offer.trust.origin === "synthetic"
                            ? "Sample date"
                            : offer.trust.origin === "inadmissible"
                              ? "Reference date"
                              : "Projection date"}{" "}
                        {formatObservedAt(offer.lastObservedAt)}
                      </span>
                      <span>{offer.trust.provenanceLabel}</span>
                    </span>
                  )}
                </span>

                <span className="shrink-0 text-right">
                  {/* Weight carries price. Neutral ink — accent is black in
                      light and white in dark, so it stays out of the colour
                      budget while still being the loudest thing here. */}
                  <span
                    className={`block text-title-3 font-semibold tabular-nums
                      ${signal.sold ? "text-text-tertiary line-through" : "text-text-primary"}`}
                  >
                    {naira(offer.priceMin)}
                  </span>
                  {offer.priceMax !== null && offer.priceMax > offer.priceMin && (
                    <span
                      className={`block text-footnote tabular-nums
                        ${signal.sold ? "text-text-tertiary" : "text-text-secondary"}`}
                    >
                      to {naira(offer.priceMax)}
                    </span>
                  )}
                  <span className="mt-0.5 block text-caption-1 text-text-tertiary">per {offer.unitName}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </ModalSheet>
  );
}
