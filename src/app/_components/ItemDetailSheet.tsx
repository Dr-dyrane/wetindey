"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, MapPin } from "lucide-react";
import { ModalSheet } from "@/design-system/components/ModalSheet";
import { SheetPicker } from "@/design-system/components/SheetPicker";
import { StatusDot, type StatusKind } from "@/design-system/components/StatusBadge";
import { CardListSkeleton } from "@/design-system/components/Skeleton";
import { formatDistance } from "@/lib/geospatial";
import {
  getItemNarrowingOptions,
  getOffersNarrowed,
  type NarrowedOffer,
  type OfferSort,
} from "@/app/actions";

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
  onSelectOffer: (offer: NarrowedOffer) => void;
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
  onOffersChange?: (offers: NarrowedOffer[]) => void;
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

/** No silent fallbacks: a timestamp we cannot read is a bug, not a blank. */
function parseAt(iso: string, field: string): number {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) {
    throw new Error(`ItemDetailSheet: unreadable ${field} timestamp ${JSON.stringify(iso)}`);
  }
  return t;
}

function formatAge(ms: number): string {
  const mins = Math.round(Math.max(0, ms) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.round(hrs / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

/**
 * Freshness, derived rather than trusted.
 *
 * `offers_current.freshnessState` is a stored string and `expiresAt` is a
 * column nothing enforces (USER-FLOW open question 2), so a row can sit at
 * "confirmed" five days after it expired. Age wins over the stored state: an
 * expired confirmation is not a confirmation, and rendering it green would be
 * the confident-and-wrong failure this product cannot afford.
 *
 * Availability rides the same dot because an offer reported finished has no
 * meaningful freshness — but it also strikes the price, so the signal survives
 * greyscale and a colour-blind glance.
 *
 * EXPORTED because the map pins are the same claim in another projection. A pin
 * coloured straight from `freshnessState` while the row beside it derives the
 * kind would show green on the map and amber in the list for the same expired
 * offer, and the user would have no way to know which one was lying. One
 * derivation, two renderers.
 */
export function offerSignal(offer: NarrowedOffer, now: number) {
  const observedAt = parseAt(offer.lastObservedAt, "lastObservedAt");
  const expiresAt = parseAt(offer.expiresAt, "expiresAt");
  const age = formatAge(now - observedAt);
  const expired = expiresAt <= now;
  const sold = offer.availabilityState === "unavailable";

  let kind: StatusKind;
  /** The verdict alone. See `label` for why it is separate. */
  let short: string;
  if (sold) {
    kind = "unavailable";
    short = "Not dey";
  } else if (offer.freshnessState === "confirmed" && !expired) {
    kind = "confirmed";
    short = "Confirmed";
  } else {
    kind = "caution";
    short = expired ? "Needs checking" : "Likely";
  }

  /**
   * Verdict AND age, for a row that has room for one line and must carry both.
   * `short` exists for surfaces that already print the age themselves — GetItSheet
   * does — where this would read "Confirmed 18 min ago · Last seen 18 minutes ago".
   */
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
 * Confidence, as a count of people rather than a percentage.
 *
 * The old panel showed `supportingObservationCount * 10` as a percent, so ten
 * reports from one contributor read as 100% confidence. Independent sources are
 * the axis that carries trust; report volume is a tiebreak, never a promotion
 * on its own. Nothing here can reach "high" on one person's word.
 */
function confidenceFor(offer: NarrowedOffer) {
  const sources = offer.distinctSourceCount;
  const reports = offer.supportingObservationCount;
  const bars = sources >= 2 && reports >= 3 ? 3 : sources >= 2 || reports >= 3 ? 2 : 1;
  const word = bars === 3 ? "High" : bars === 2 ? "Medium" : "Low";
  const label =
    `${reports} ${reports === 1 ? "report" : "reports"}` +
    ` · ${sources} ${sources === 1 ? "source" : "sources"}`;
  return { bars, word, label };
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
    <span className="squircle-full bg-fillTertiary px-2 py-[1px] text-caption-2 font-medium text-text-secondary">
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
        <span className="mb-1.5 block text-footnote font-medium text-text-secondary">{label}</span>
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
  const itemId = item?.id ?? null;

  const [variantId, setVariantId] = useState<string>(ANY);
  const [unitId, setUnitId] = useState<string>(ANY);
  const [sort, setSort] = useState<OfferSort>("nearest");

  const [variants, setVariants] = useState<
    { id: string; displayName: string; offerCount: number; placeCount: number }[]
  >([]);
  const [units, setUnits] = useState<
    { variantId: string; id: string; displayName: string; offerCount: number; placeCount: number }[]
  >([]);

  const [offers, setOffers] = useState<NarrowedOffer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
  useEffect(() => {
    setVariantId(ANY);
    setUnitId(ANY);
    setSort("nearest");
    setOffers([]);
    setError(null);
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

  // Publish the narrowed set to whoever is drawing the map behind us. Keyed on
  // `offers` identity, which only turns over when a load actually lands — so a
  // re-render for an unrelated reason does not republish and rebuild every pin.
  useEffect(() => {
    onOffersChange?.(offers);
  }, [offers, onOffersChange]);

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
    const now = Date.now();
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
      signal: offerSignal(offer, now),
      confidence: confidenceFor(offer),
      isCheapest: offers.length > 1 && offer.id === cheapestId,
      isClosest: offers.length > 1 && offer.id === closestId,
    }));
  }, [offers]);

  const countLabel = `${offers.length} ${t?.locations_found ?? (offers.length === 1 ? "place" : "places")}`;

  return (
    <ModalSheet open={open} onClose={onClose} title={item?.name ?? "Prices"} size="page">
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

        <p className="mx-4 text-footnote text-text-secondary">
          {loading ? "Checking prices…" : `${countLabel} within ${radiusKm} km`}
        </p>

        {/* Sort is a segmented control, not a picker: three short, mutually
            exclusive options that are worth switching between repeatedly while
            comparing. A sheet per switch would cost two taps a look. */}
        <div className="mx-4 grid grid-cols-3 gap-1 squircle bg-fillTertiary p-1">
          {SORTS.map((s) => {
            const active = sort === s.id;
            return (
              <button
                key={s.id}
                type="button"
                aria-pressed={active}
                onClick={() => setSort(s.id)}
                className={`min-h-tap squircle text-footnote font-medium transition-all duration-micro
                  ${active ? "bg-surface text-text-primary shadow-card" : "text-text-secondary"}`}
              >
                {s.label}
              </button>
            );
          })}
        </div>

        {error ? (
          <div className="mx-4 space-y-2 squircle bg-surface p-5 text-center shadow-card">
            <span className="inline-flex squircle-full bg-status-unavailable-bg p-3 text-status-unavailable-fg">
              <AlertTriangle className="h-5 w-5" />
            </span>
            <p className="text-headline text-text-primary">{error}</p>
            <p className="text-footnote text-text-secondary">Check your network and try again.</p>
          </div>
        ) : loading ? (
          <div className="mx-4">
            <CardListSkeleton count={3} />
          </div>
        ) : rows.length === 0 ? (
          <div className="mx-4 space-y-2 squircle bg-surface p-6 text-center shadow-card">
            <MapPin className="mx-auto h-6 w-6 text-text-tertiary" />
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
                onClick={() => onSelectOffer(offer)}
                aria-label={
                  `${offer.placeName}. ` +
                  `${signal.sold ? "Not available" : "Available"}. ` +
                  `${naira(offer.priceMin)}${offer.priceMax ? ` to ${naira(offer.priceMax)}` : ""} per ${offer.unitName}. ` +
                  `${signal.label}. ` +
                  `${formatDistance(offer.distanceM / 1000)}. ` +
                  `${confidence.word} confidence, ${confidence.label}.`
                }
                className="flex w-full items-start gap-3 bg-surface p-4 text-left shadow-card squircle
                           transition-colors duration-instant active:bg-fillTertiary"
              >
                <span className="mt-[7px]">
                  <StatusDot kind={signal.kind} />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-headline text-text-primary">{offer.placeName}</span>
                    {isCheapest && <LeadChip>Cheapest</LeadChip>}
                    {isClosest && <LeadChip>Closest</LeadChip>}
                  </span>

                  {/* Hue — the one saturated thing in the row. */}
                  <span className={`mt-0.5 block truncate text-footnote ${FRESH_FG[signal.kind]}`}>
                    {signal.label}
                  </span>

                  <span className="mt-1.5 flex items-center gap-2">
                    <span className="text-footnote tabular-nums text-text-secondary">
                      {formatDistance(offer.distanceM / 1000)}
                    </span>
                    <span className="flex items-center gap-1" title={`${confidence.word} confidence`}>
                      <ConfidenceMeter bars={confidence.bars} />
                      <span className="text-caption-1 text-text-secondary">{confidence.label}</span>
                    </span>
                  </span>
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
