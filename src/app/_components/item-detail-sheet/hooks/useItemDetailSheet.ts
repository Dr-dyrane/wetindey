import {
  getItemNarrowingOptions,
  getOffersNarrowed,
  type NarrowedOffer,
  type OfferSort,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useT,
} from "../imports/imports";
import { copy } from "../copy/copy";
import {
  createOfferRows,
  type OfferPresentation,
  type PresentedOffer,
} from "./itemDetailSheetPresentation";

export type { OfferPresentation, PresentedOffer } from "./itemDetailSheetPresentation";
/* -----------------------------------------------------------------------------
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
   -------------------------------------------------------------------------- */

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

export interface ItemDetailSheetProps {
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
/**
 * Shown in the Type/Size controls when the options request failed. A neutral
 * pending mark, not "Nothing nearby": it does not claim the taxonomy is empty,
 * only that it is unresolved. Kept local (punctuation, not translatable prose)
 * because the copy layer sits outside this hook.
 */
const OPTIONS_PLACEHOLDER = "…";
export function useItemDetailSheet({
  open,
  item,
  center,
  radiusKm,
  onOffersChange,
  t,
}: ItemDetailSheetProps) {
  const translate = useT();
  const itemId = item?.id ?? null;
  const [variantId, setVariantId] = useState(ANY);
  const [unitId, setUnitId] = useState(ANY);
  const [sort, setSort] = useState<OfferSort>("nearest");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [variants, setVariants] = useState<
    { id: string; displayName: string; offerCount: number; placeCount: number }[]
  >([]);
  const [units, setUnits] = useState<
    {
      variantId: string;
      id: string;
      displayName: string;
      offerCount: number;
      placeCount: number;
    }[]
  >([]);
  const [offers, setOffers] = useState<NarrowedOffer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /**
   * The narrowing-options request fails independently of the offers request, so
   * the offers list below can render fine while this one rejects. Clearing
   * variants/units to [] on that rejection makes the Type/Size controls read
   * "Nothing nearby" (NarrowStep's empty-options fallback), which claims we
   * looked and found nothing when we could not reach the data at all. Track the
   * failure so the options memos can show a neutral placeholder instead of a
   * false empty state.
   */
  const [optionsError, setOptionsError] = useState(false);
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
    setOptionsError(false);
    setImageBroken(false);
  }, [itemId]);

  const optionsReq = useRef(0);

  useEffect(() => {
    if (!open || !itemId) return;

    const req = ++optionsReq.current;
    setOptionsError(false);

    void getItemNarrowingOptions({ itemId, center: origin, radiusKm })
      .then((result) => {
        if (req !== optionsReq.current) return;
        setVariants(result.variants);
        setUnits(result.units);
      })
      .catch((err) => {
        if (req !== optionsReq.current) return;
        console.error("Failed to load narrowing options:", err);
        // Clear the sets so a previous item's taxonomy cannot linger, but flag
        // the failure: the memos read this to show a neutral placeholder rather
        // than let the empty sets read as an honest "Nothing nearby".
        setVariants([]);
        setUnits([]);
        setOptionsError(true);
      });
  }, [open, itemId, origin, radiusKm]);

  const offersReq = useRef(0);

  const load = useCallback(async () => {
    if (!open || !itemId) return;

    const req = ++offersReq.current;
    setLoading(true);
    setError(null);

    try {
      const result = await getOffersNarrowed({
        itemId,
        variantId: variantId === ANY ? null : variantId,
        unitId: unitId === ANY ? null : unitId,
        center: origin,
        radiusKm,
        sort,
      });

      if (req !== offersReq.current) return;
      setOffers(result);
    } catch (err) {
      if (req !== offersReq.current) return;
      console.error("Failed to load offers:", err);
      setOffers([]);
      setError(copy.error);
    } finally {
      if (req === offersReq.current) setLoading(false);
    }
  }, [open, itemId, variantId, unitId, origin, radiusKm, sort]);

  useEffect(() => {
    void load();
  }, [load]);

  const variantOptions = useMemo(() => {
    const options = variants.map((variant) => ({
      id: variant.id,
      label: variant.displayName,
      detail: variant.placeCount
        ? `${variant.offerCount} ${variant.offerCount === 1 ? "price" : "prices"}` +
          ` · ${variant.placeCount} ${variant.placeCount === 1 ? "place" : "places"}`
        : copy.noneNearby,
      disabled: variant.placeCount === 0,
    }));

    // The request failed rather than returned nothing: show a neutral pending
    // mark, not the empty-set "Nothing nearby". A genuine empty result (no
    // error) still falls through to the honest empty state below.
    if (options.length === 0 && optionsError) {
      return [{ id: ANY, label: OPTIONS_PLACEHOLDER }];
    }

    // "Any type" only earns its row when there is more than one type to span.
    return options.length > 1 ? [{ id: ANY, label: copy.anyType }, ...options] : options;
  }, [variants, optionsError]);

  const unitOptions = useMemo(() => {
    const scoped = variantId === ANY ? units : units.filter((unit) => unit.variantId === variantId);

    // Across "any type" the same unit can appear under several variants; fold
    // them together so the picker offers a unit once, with the full count.
    const folded = new Map<
      string,
      { id: string; displayName: string; offerCount: number; placeCount: number }
    >();

    for (const unit of scoped) {
      const previous = folded.get(unit.id);
      if (previous) {
        previous.offerCount += unit.offerCount;
        previous.placeCount += unit.placeCount;
      } else {
        folded.set(unit.id, {
          id: unit.id,
          displayName: unit.displayName,
          offerCount: unit.offerCount,
          placeCount: unit.placeCount,
        });
      }
    }

    const options = [...folded.values()].map((unit) => ({
      id: unit.id,
      label: unit.displayName,
      detail: `${unit.offerCount} ${unit.offerCount === 1 ? "price" : "prices"}`,
    }));

    // Mirror the variant control: a failed request is unresolved, not empty.
    if (options.length === 0 && optionsError) {
      return [{ id: ANY, label: OPTIONS_PLACEHOLDER }];
    }

    return options.length > 1 ? [{ id: ANY, label: copy.anySize }, ...options] : options;
  }, [units, variantId, optionsError]);

  // A unit chosen under one variant may not exist under the next. Rather than
  // silently returning nothing, drop back to "any size".
  useEffect(() => {
    if (unitId === ANY || unitOptions.length === 0) return;
    if (!unitOptions.some((option) => option.id === unitId)) setUnitId(ANY);
  }, [unitOptions, unitId]);

  const rows = useMemo(() => createOfferRows(offers, translate), [offers, translate]);

  // Publish the narrowed set with the presentation kind already used by its
  // row. The map consumes this answer without rebuilding trust or status copy.
  //
  // Guarded on teardown. Tapping a row nulls the item and closes the sheet,
  // which empties `offers` (and so `rows`); publishing that empty set would
  // revert the map behind from the narrowed pins to every place, contradicting
  // handleSelectOffer, which centres on the pick. Only the open sheet owns the
  // map's narrowed set, so skip while closing or item-less. A genuine empty
  // narrowing (open, item set, zero matches) still publishes [].
  useEffect(() => {
    if (!open || !itemId) return;
    onOffersChange?.(rows.map(({ offer, signal }) => ({ offer, kind: signal.kind })));
  }, [open, itemId, rows, onOffersChange]);

  const visiblePlaceCount = new Set(offers.map((offer) => offer.placeId)).size;
  const countLabel = `${visiblePlaceCount} ${
    t?.locations_found ?? (visiblePlaceCount === 1 ? "place" : "places")
  }`;

  return {
    translate,
    variantId,
    setVariantId,
    unitId,
    setUnitId,
    sort,
    setSort,
    detailsOpen,
    setDetailsOpen,
    variantOptions,
    unitOptions,
    rows,
    loading,
    error,
    imageBroken,
    setImageBroken,
    countLabel,
  };
}
