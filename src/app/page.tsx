"use client";

import React, {
  useState,
  useEffect,
  useLayoutEffect,
  useTransition,
  useMemo,
  useCallback,
  useRef
} from "react";
import { useAtom } from "jotai";
import { AlertTriangle, MapPin, Navigation, Sun, Moon, X, Plus } from "lucide-react";

import { Button } from "@/design-system/components/Button";
import { SearchField } from "@/design-system/components/SearchField";
import { AdaptiveShell } from "@/design-system/components/AdaptiveShell";
import {
  MapboxCanvas,
  MapRecenterControl,
  type MapCameraHandle
} from "@/design-system/components/MapboxCanvas";
import { DETENT_FRACTION } from "@/design-system/components/BottomSheet";
import { AsyncList } from "@/design-system/components/AsyncList";
import { NigeriaLogo } from "@/design-system/components/NigeriaLogo";
import { ItemCard, PhotoCredits, type ItemCardData } from "@/design-system/components/ItemCard";
import { StatusDot, StatusBadge } from "@/design-system/components/StatusBadge";
import { SettingsSheet } from "@/app/_components/SettingsSheet";
import { ReportPriceSheet } from "@/app/_components/ReportPriceSheet";
import { ProfileSheet, Avatar } from "@/app/_components/ProfileSheet";
import { ItemDetailSheet, offerSignal } from "@/app/_components/ItemDetailSheet";
import { GetItSheet, type GetItTarget } from "@/app/_components/GetItSheet";
import {
  ConfirmVisitSheet,
  armVisit,
  takeDueVisit,
  flushPendingVisitConfirmations,
  type VisitContext
} from "@/app/_components/ConfirmVisitSheet";
import { LocationSheet } from "@/app/_components/LocationSheet";

import { useTheme } from "@/core/context/ThemeContext";
import { useGlobalStore } from "@/core/state/globalStore";
import { useLocationChrome, useLocationHydration, useLocationStore } from "@/core/state/locationStore";
import { useLocaleControl, useStrings } from "@/core/i18n";
import { useEventCallback } from "@/lib/perf";
import { sheetDetentAtom, activeMarkerIdAtom } from "@/core/state/uiAtoms";
import {
  searchFoodItems,
  getPopularItems,
  getPlaces,
  getPlaceOffers,
  getInitialSubmissionData,
  getVisitContext,
  submitObservation,
  type NarrowedOffer
} from "@/app/actions";
import { getHaversineDistance, formatDistance } from "@/lib/geospatial";

interface PlaceData {
  id: string;
  name: string;
  placeType: string;
  location: {
    lat: number;
    lng: number;
  };
  address: string | null;
}

interface PlaceOffer {
  id: string;
  itemName: string;
  variantName: string;
  priceMin: number;
  priceMax?: number;
  unit: string;
  availabilityState: string;
  freshnessState: string;
}

/**
 * The map chrome's error strip.
 *
 * `MapRecenterControl` reports a denied permission, a device that cannot fix, or
 * a timeout, and its contract says do not swallow it. There is no toast system
 * in this app and one control does not justify inventing one, so the message
 * lands here: on the map, under the pill, dismissible, and gone on its own after
 * a beat. Solid fill rather than the translucent material — this is the one
 * thing on the map that has to be read rather than seen through.
 */
function MapNotice({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => {
    const id = window.setTimeout(onDismiss, 6000);
    return () => window.clearTimeout(id);
  }, [message, onDismiss]);

  return (
    <div
      role="alert"
      className="pointer-events-auto flex items-start gap-2 squircle bg-status-caution-bg px-3 py-2
                 shadow-raised animate-fade-in"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-status-caution-fg" />
      <span className="text-footnote text-status-caution-fg">{message}</span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="-my-1 -mr-1 grid h-8 w-8 shrink-0 place-items-center squircle-full
                   text-status-caution-fg active:opacity-60 transition-opacity duration-instant"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export default function HomePage() {
  const { theme, toggleTheme } = useTheme();

  /**
   * Copy comes from `@/core/i18n`, not from a dictionary in this file.
   *
   * There was a 110-line `TRANSLATIONS` literal here, and it was the reason
   * every sheet built after this file — GetItSheet, ItemDetailSheet,
   * LocationSheet — is hardcoded English: no component could add a key without
   * editing a 1000-line page component, so none of them tried. It had also
   * already forked, into ConfirmVisitSheet's own `COPY`. `useStrings()` returns
   * the same shape under the same key names, so the sheets that take `t` as a
   * prop are unchanged.
   */
  const t = useStrings();
  const [locale, setLocale] = useLocaleControl();

  // Zustand global state — the camera anchor and the search radius. Where the
  // USER is lives in locationStore; these two are not the same fact.
  const { mapCenter, setMapCenter, activeRadiusKm, setActiveRadiusKm } = useGlobalStore();

  useLocationHydration();
  const location = useLocationChrome();

  // Jotai atomic state
  const [activeDetent, setActiveDetent] = useAtom(sheetDetentAtom);
  const [activeMarkerId, setActiveMarkerId] = useAtom(activeMarkerIdAtom);

  // React transitions
  const [isPending, startTransition] = useTransition();

  const mapCameraRef = useRef<MapCameraHandle>(null);

  /**
   * How much of the leading edge the shell's panel covers, in px.
   *
   * AdaptiveShell publishes this as `--shell-leading-inset` precisely so this
   * file can pad the camera by it — otherwise a selected pin lands UNDER the
   * panel, including the pin the user just tapped.
   *
   * MEASURED, not recomputed. The value is
   * `calc(clamp(12px,1.5vw,24px) + clamp(320px,36vw,420px))` — continuous, so
   * there is no constant to copy, and `getComputedStyle` hands back that string
   * unresolved rather than a number. A zero-height probe styled with the
   * variable makes the browser do the arithmetic, and a ResizeObserver on it
   * tracks every viewport change AND the compact↔regular flip for free. Copying
   * the clamps into JS would be a second source of truth that silently drifts
   * the day the panel is retuned — which is exactly what happened to the
   * hardcoded `452` this replaces (it was the old 420px panel + its 24px inset,
   * and both numbers are gone).
   */
  const insetProbeRef = useRef<HTMLDivElement>(null);
  const [leadingInset, setLeadingInset] = useState(0);
  useLayoutEffect(() => {
    const el = insetProbeRef.current;
    if (!el) return;
    const measure = () => setLeadingInset(el.getBoundingClientRect().width);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /**
   * The panel is up. Read from the shell's own published geometry rather than
   * from a second copy of its media query: a `useMediaQuery("(min-width:768px)")`
   * here would be this file guessing at a breakpoint AdaptiveShell owns, and the
   * two would disagree the moment it moves. Zero until measured, which is the
   * compact default — and ThemeProvider hides the tree until mount, so that
   * frame is never seen.
   */
  const isRegular = leadingInset > 0;

  // Presented surfaces
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isLocationOpen, setIsLocationOpen] = useState(false);
  /** The item ItemDetailSheet is resolving down to a unit. Non-null = presented. */
  const [detailItem, setDetailItem] = useState<ItemCardData | null>(null);
  /** The place GetItSheet is about to hand off to. Non-null = presented. */
  const [getItTarget, setGetItTarget] = useState<GetItTarget | null>(null);
  /** A trip that happened. Non-null = we are asking how it went. */
  const [pendingVisit, setPendingVisit] = useState<VisitContext | null>(null);

  // General app state
  const [searchQuery, setSearchQuery] = useState("");
  /**
   * `undefined` until the first fetch settles. `[]` would claim we looked and
   * found nothing, which AsyncList would correctly render as "No prices yet" —
   * on the very first frame, before the effect has even run.
   */
  const [popularItems, setPopularItems] = useState<ItemCardData[] | undefined>(undefined);
  const [searchResults, setSearchResults] = useState<ItemCardData[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  /** Kept apart from `loadError`: the two loads fail independently, and a dead
   *  places query must not blank the list with the list's own error text. */
  const [popularError, setPopularError] = useState<string | null>(null);
  /** The narrowed set ItemDetailSheet is showing. The map pins ARE this list. */
  const [itemOffers, setItemOffers] = useState<NarrowedOffer[]>([]);
  const [allPlaces, setAllPlaces] = useState<PlaceData[]>([]);
  const [placeOffers, setPlaceOffers] = useState<PlaceOffer[] | undefined>(undefined);
  const [placeOffersError, setPlaceOffersError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isPlaceOffersLoading, setIsPlaceOffersLoading] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);
  /** Stable: MapNotice keys its auto-dismiss timer on this, and a fresh identity
   *  every render would restart the countdown forever and never dismiss. */
  const dismissLocateError = useCallback(() => setLocateError(null), []);

  // Report submission lookup metadata
  const [submitPlaces, setSubmitPlaces] = useState<{ id: string; name: string }[]>([]);
  const [submitItems, setSubmitItems] = useState<{ id: string; name: string }[]>([]);
  const [submitVariants, setSubmitVariants] = useState<
    { id: string; itemId: string; displayName: string }[]
  >([]);
  const [submitUnits, setSubmitUnits] = useState<{ id: string; displayName: string }[]>([]);

  // Price submission form fields
  const [formPlaceId, setFormPlaceId] = useState("");
  const [formItemId, setFormItemId] = useState("");
  const [formVariantId, setFormVariantId] = useState("");
  const [formUnitId, setFormUnitId] = useState("");
  const [formPrice, setFormPrice] = useState("");
  const [formAvailable, setFormAvailable] = useState<"available" | "unavailable">("available");

  // Submission statuses
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [isOfflineSaved, setIsOfflineSaved] = useState(false);

  /**
   * The persisted position is the source of truth for the camera. This runs
   * after rehydration and on every location change, so a reload reopens where
   * the user actually left off rather than snapping back to Festac.
   */
  const locPosition = useLocationStore((s) => s.position);
  useEffect(() => {
    setMapCenter({ lat: locPosition.lat, lng: locPosition.lng });
  }, [locPosition.lat, locPosition.lng, setMapCenter]);

  /**
   * Where the user IS. Every distance, radius and "Nearest" measures from here.
   *
   * NOT `mapCenter`, and the difference is not academic: tapping a result flies
   * the camera to that market, so a query keyed on `mapCenter` would measure the
   * next search from the last shop you looked at rather than from you. Open rice,
   * tap a stall two streets away, go back and open beans, and "Nearest" would
   * quietly mean "nearest to that stall". The camera follows the position; the
   * position never follows the camera.
   */
  const searchOrigin = useMemo(
    () => ({ lat: locPosition.lat, lng: locPosition.lng }),
    [locPosition.lat, locPosition.lng]
  );

  /**
   * The location-INDEPENDENT half: every place on the map, and the form's
   * vocabulary. Neither changes when the user moves, so neither is refetched
   * when they do — the map draws all pins regardless of the radius, and the
   * report form must be able to name a stall anywhere.
   *
   * A callback, not an effect body: the error state needs a retry handle.
   */
  const loadBaseline = useCallback(() => {
    startTransition(async () => {
      try {
        setLoadError(null);

        // In parallel — these don't depend on each other, and doing them in
        // series stacked round-trips before anything rendered.
        const [placesList, metadata] = await Promise.all([
          getPlaces(),
          getInitialSubmissionData()
        ]);

        setAllPlaces(placesList);

        setSubmitPlaces(metadata.places);
        setSubmitItems(metadata.items);
        setSubmitVariants(metadata.variants);
        setSubmitUnits(metadata.units);

        // Baseline form defaults
        if (metadata.places.length > 0) setFormPlaceId(metadata.places[0].id);
        if (metadata.items.length > 0) setFormItemId(metadata.items[0].id);
        if (metadata.units.length > 0) setFormUnitId(metadata.units[0].id);
      } catch (err) {
        // Previously this effect had no catch, so a database that was down
        // produced an empty map and an empty sheet with no explanation.
        console.error("Failed to load initial data:", err);
        setLoadError("We no fit reach the price data right now.");
      }
    });
  }, []);

  /**
   * The location-DEPENDENT half, and the reason the split exists.
   *
   * The landing list is the answer to "what does food cost around here", so it
   * refetches when "here" changes — the position or the radius. It used to be
   * fetched once, with no location at all, which is why the header could say
   * "Popular items around Yaba" over rows ranked from every offer in the
   * country. Moving to Festac changed the header and nothing else.
   */
  const loadPopular = useCallback(() => {
    startTransition(async () => {
      try {
        setPopularError(null);
        const items = await getPopularItems({
          lat: locPosition.lat,
          lng: locPosition.lng,
          radiusKm: activeRadiusKm,
          limit: 8
        });
        setPopularItems(items);
      } catch (err) {
        console.error("Failed to load popular items:", err);
        // Settled, and we know nothing — NOT "never fetched". Without this the
        // list stays undefined and skeletons spin forever behind the error.
        setPopularItems([]);
        setPopularError("We no fit reach the price data right now.");
      }
    });
  }, [locPosition.lat, locPosition.lng, activeRadiusKm]);

  useEffect(() => {
    loadBaseline();
  }, [loadBaseline]);

  useEffect(() => {
    loadPopular();
  }, [loadPopular]);

  /**
   * Retry only what actually broke.
   *
   * The sheet's list is the app's one error affordance — the map layer has no
   * retry chrome — so it reports either failure. Splitting the loads without
   * this left `loadError` written and read by nothing: a dead `getPlaces()`
   * emptied the map of all 60 pins and said nothing anywhere, because the list
   * had stopped watching that flag. The compiler flagged it as an unused
   * variable, which is the polite name for a silent failure.
   */
  const anyLoadError = popularError ?? loadError;
  const retryFailed = useCallback(() => {
    if (popularError) loadPopular();
    if (loadError) loadBaseline();
  }, [popularError, loadError, loadPopular, loadBaseline]);

  /**
   * Drain both offline queues once a connection is back.
   *
   * Two queues, one drain: `pending_observations` holds price reports typed into
   * the form, `pending_visit_confirmations` holds answers about trips people
   * actually made. They are replayed together because they refresh the same
   * thing, and refreshing it twice would be two round-trips for one event.
   */
  useEffect(() => {
    const drain = async () => {
      if (typeof window === "undefined" || !navigator.onLine) return;

      let changed = false;

      const cached = localStorage.getItem("pending_observations");
      if (cached) {
        try {
          const queue = JSON.parse(cached) as Array<{
            placeId: string;
            itemVariantId: string;
            unitId: string;
            priceAmount: number;
            availabilityState: "available" | "unavailable";
          }>;

          if (queue.length > 0) {
            console.log(`Syncing ${queue.length} offline price reports…`);
            for (const item of queue) {
              await submitObservation(item);
            }
            localStorage.removeItem("pending_observations");
            changed = true;
          }
        } catch (err) {
          console.error("Failed to sync offline observations:", err);
        }
      }

      try {
        const { sent } = await flushPendingVisitConfirmations();
        if (sent > 0) changed = true;
      } catch (err) {
        console.error("Failed to flush queued visit confirmations:", err);
      }

      // One refetch, and a real one. The old code called `getPlaces()` here,
      // which carries no price data at all, so nothing the user could see ever
      // changed after a sync.
      if (changed) loadBaseline();
    };

    window.addEventListener("online", drain);
    void drain();
    return () => window.removeEventListener("online", drain);
  }, [loadBaseline]);

  /**
   * The loop closes here.
   *
   * Somebody tapped "Go there", we armed the question on the way out, and they
   * are back. `takeDueVisit` decides whether enough time passed to have been a
   * visit and whether too much has passed to ask honestly; it consumes the arm
   * either way, so the question is asked exactly once.
   *
   * Checked on mount as well as on focus, because "returning" can mean the PWA
   * was evicted while the user was in the maps app and is starting cold.
   */
  useEffect(() => {
    const check = () => {
      if (document.visibilityState !== "visible") return;
      const due = takeDueVisit();
      if (due) setPendingVisit((prev) => prev ?? due);
    };

    check();
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    return () => {
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("focus", check);
    };
  }, []);

  // Keep the variant field in step with the item field in the report form.
  useEffect(() => {
    const matched = submitVariants.filter((v) => v.itemId === formItemId);
    setFormVariantId(matched.length > 0 ? matched[0].id : "");
  }, [formItemId, submitVariants]);

  // What is on sale at the place whose pin is selected.
  useEffect(() => {
    if (!activeMarkerId) {
      setPlaceOffers(undefined);
      setPlaceOffersError(null);
      return;
    }

    let cancelled = false;
    setIsPlaceOffersLoading(true);
    setPlaceOffersError(null);

    getPlaceOffers(activeMarkerId)
      .then((offers) => {
        if (cancelled) return;
        setPlaceOffers(offers);
      })
      .catch((err) => {
        if (cancelled) return;
        // This had no catch at all, so a failure here was an unhandled rejection
        // and an empty panel that read as "this market sells nothing".
        console.error("Failed to load offers for place:", err);
        setPlaceOffers([]);
        setPlaceOffersError("We no fit load this market right now.");
      })
      .finally(() => {
        if (!cancelled) setIsPlaceOffersLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeMarkerId]);

  /**
   * Snapshot the claim, on the way OUT.
   *
   * Fetched when GetItSheet opens rather than when "Go there" is tapped, and the
   * reason is the handoff itself: on Android it assigns `window.location.href`,
   * so a promise started on the tap may never resolve — the page is gone. By the
   * time the tap happens this is already in hand and arming is a synchronous
   * write. It is also the last moment we are guaranteed a connection; the person
   * walking back from a market is the least likely user in the product to have one.
   */
  const visitContextRef = useRef<VisitContext | null>(null);
  const armedOfferId = getItTarget?.offer?.offerId ?? null;
  useEffect(() => {
    visitContextRef.current = null;
    if (!armedOfferId) return;

    let cancelled = false;
    getVisitContext(armedOfferId)
      .then((ctx) => {
        if (!cancelled) visitContextRef.current = ctx;
      })
      .catch((err) => {
        // No snapshot means no question. That is the honest outcome — asking
        // "was the price right?" without knowing what price we quoted would file
        // an answer against nothing.
        console.error("Could not snapshot the visit; the trip will not be confirmed:", err);
      });

    return () => {
      cancelled = true;
    };
  }, [armedOfferId]);

  const handleArmVisit = useEventCallback(() => {
    const ctx = visitContextRef.current;
    if (!ctx) return;
    armVisit(ctx);
  });

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);

    if (val.trim() === "") {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    startTransition(async () => {
      const matched = await searchFoodItems(val);
      setSearchResults(matched);
      setIsSearching(false);
    });
  };

  /**
   * Picking an item presents the narrowing sheet — it does not dump a flat list.
   *
   * `rice → long-grain → 50 kg bag` is three decisions (USER-FLOW §2). This used
   * to make one and hand back every offer for every variant at every size,
   * unsorted, with no radius. ItemDetailSheet makes all three and ranks what is
   * left; it runs its own query, so nothing is fetched here.
   */
  const handleSelectItem = useEventCallback((item: ItemCardData) => {
    setDetailItem(item);
    // A new item is a new question: drop the previous item's pins rather than
    // leave tomatoes on the map while the sheet talks about rice.
    setItemOffers([]);
    setActiveMarkerId(null);
  });

  /** The pins are the list. See ItemDetailSheet's `onOffersChange`. */
  const handleItemOffersChange = useEventCallback((offers: NarrowedOffer[]) => {
    setItemOffers(offers);
  });

  /**
   * An offer was chosen: centre it, and offer to act on it.
   *
   * This is where the lookup becomes a trip. The old path ended at a card with
   * two buttons that had no `onClick` at all.
   */
  const handleSelectOffer = useEventCallback((offer: NarrowedOffer) => {
    const signal = offerSignal(offer, Date.now());

    setDetailItem(null);
    setActiveMarkerId(offer.placeId);
    setMapCenter({ lat: offer.lat, lng: offer.lng });
    setGetItTarget({
      placeId: offer.placeId,
      placeName: offer.placeName,
      lat: offer.lat,
      lng: offer.lng,
      address: offer.address,
      areaName: location.label,
      offer: {
        offerId: offer.id,
        itemName: detailItem?.name ?? offer.variantName,
        variantName: offer.variantName,
        unit: offer.unitName,
        priceMin: offer.priceMin,
        priceMax: offer.priceMax ?? undefined,
        observedAt: offer.lastObservedAt,
        freshnessKind: signal.kind,
        freshnessLabel: signal.short
      }
    });
  });

  /**
   * Stable identity, forever.
   *
   * This was a plain function declaration, so it took a new identity on every
   * render — and it is a dependency of MapboxCanvas's marker effect, which
   * clears and rebuilds every pin when it re-runs. Every unrelated re-render
   * (a keystroke, a focus) tore down and reconstructed the whole map.
   */
  const handleMarkerSelection = useEventCallback((placeId: string) => {
    setActiveMarkerId(placeId);
    setActiveDetent("medium");

    const match = allPlaces.find((p) => p.id === placeId);
    if (match) {
      setMapCenter({ lat: match.location.lat, lng: match.location.lng });
    }
  });

  const clearSearch = () => {
    setSearchQuery("");
    setSearchResults([]);
    setDetailItem(null);
    setItemOffers([]);
    setActiveMarkerId(null);
  };

  const handlePriceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError("");
    setSubmitSuccess(false);
    setIsOfflineSaved(false);

    if (!formPlaceId || !formVariantId || !formUnitId || !formPrice) {
      setSubmitError("Please fill out all fields.");
      return;
    }

    const priceNum = parseFloat(formPrice);
    if (isNaN(priceNum) || priceNum <= 0) {
      setSubmitError("Please enter a valid price amount.");
      return;
    }

    setIsSubmitting(true);

    const payload = {
      placeId: formPlaceId,
      itemVariantId: formVariantId,
      unitId: formUnitId,
      priceAmount: priceNum,
      availabilityState: formAvailable
    };

    // Offline queueing
    if (typeof window !== "undefined" && !navigator.onLine) {
      try {
        const cached = localStorage.getItem("pending_observations");
        const queue = cached ? JSON.parse(cached) : [];
        queue.push(payload);
        localStorage.setItem("pending_observations", JSON.stringify(queue));

        setIsOfflineSaved(true);
        setFormPrice("");
        setIsSubmitting(false);

        setTimeout(() => {
          setIsReportOpen(false);
          setIsOfflineSaved(false);
        }, 2000);
      } catch (_err) {
        setSubmitError("Failed to store offline entry.");
        setIsSubmitting(false);
      }
      return;
    }

    try {
      const res = await submitObservation(payload);
      if (res.success) {
        setSubmitSuccess(true);
        setFormPrice("");
        setIsSubmitting(false);

        // Refetch what the user can actually see. The old code called
        // `getPlaces()`, which returns no price data, and never re-fetched
        // `popularItems` at all — so reporting a price from the landing screen,
        // the common case, changed nothing on screen.
        loadBaseline();

        setTimeout(() => {
          setIsReportOpen(false);
          setSubmitSuccess(false);
        }, 2000);
      }
    } catch (_err) {
      setSubmitError("Submission failed. Try again.");
      setIsSubmitting(false);
    }
  };

  const formatPrice = (koboAmount: number) =>
    new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      maximumFractionDigits: 0
    }).format(koboAmount / 100);

  const selectedPlace = useMemo(
    () => allPlaces.find((p) => p.id === activeMarkerId),
    [allPlaces, activeMarkerId]
  );

  /**
   * Pins: the narrowed offers when there are some, otherwise every place.
   *
   * The status comes from `offerSignal` — the same derivation the rows use —
   * rather than from `freshnessState` directly. Reading the column here would
   * paint a pin green while the row beside it said "Needs checking" for the same
   * expired offer, and nothing would tell the user which to believe.
   */
  const mapMarkers = useMemo(() => {
    if (itemOffers.length > 0) {
      const now = Date.now();
      return itemOffers.map((o) => ({
        id: o.id,
        placeId: o.placeId,
        placeName: o.placeName,
        lat: o.lat,
        lng: o.lng,
        address: o.address ?? "",
        detail: { confidenceLevel: offerSignal(o, now).kind }
      }));
    }
    return allPlaces.map((p) => ({
      id: p.id,
      placeId: p.id,
      placeName: p.name,
      lat: p.location.lat,
      lng: p.location.lng,
      address: p.address || ""
    }));
  }, [itemOffers, allPlaces]);

  // 1. Map node (base layer)
  const mapNode = (
    <div className="relative w-full h-full">
      {/* Resolves `--shell-leading-inset` to px. Zero-height and inert; it exists
          only to be measured. Must stay inside the shell's subtree, which is
          where the variable is set. */}
      <div
        ref={insetProbeRef}
        aria-hidden
        className="pointer-events-none absolute left-0 top-0 h-0"
        style={{ width: "var(--shell-leading-inset, 0px)" }}
      />

      <MapboxCanvas
        ref={mapCameraRef}
        candidates={mapMarkers}
        selectedPlaceId={activeMarkerId}
        onMarkerClick={handleMarkerSelection}
        center={mapCenter}
        /* At regular width the shell mounts no bottom sheet, so there is nothing
           below to compensate for — but the panel covers the leading edge, and
           without that padding a pin can be flown to and land behind it. */
        detent={isRegular ? null : activeDetent}
        padding={isRegular ? { left: leadingInset } : undefined}
      />

      {/* Floating controls. These sit directly on the map, so they use the
          translucent material rather than a solid surface — the map needs to
          stay legible through them. */}
      {/* `left` clears the shell's panel rather than sitting at a flat left-4.
          This chrome lives in the z-0 map layer, so at every regular width the
          panel was simply drawn on top of the location pill. Pure CSS, so it
          tracks the panel's clamp with no measurement and no resize listener. */}
      <div
        className="absolute right-4 z-10 flex flex-col gap-2 pointer-events-none"
        style={{
          top: "calc(var(--safe-area-top) + 12px)",
          left: "calc(var(--shell-leading-inset, 0px) + 16px)"
        }}
      >
        <div className="flex items-start justify-between gap-2">
          {/* A control, not a label. It was a `div` printing the literal
              "Festac" — a string nothing could change, next to a green dot that
              claimed a confirmed position we had never asked for. */}
          <button
            type="button"
            onClick={() => setIsLocationOpen(true)}
            aria-label="Change location"
            className="pointer-events-auto flex min-h-tap items-center gap-2 squircle-full material-thick
                       px-3 py-1.5 shadow-raised active:opacity-60 transition-opacity duration-instant"
          >
            <StatusDot
              kind={location.isSimulated ? "caution" : "confirmed"}
              pulse={!location.isSimulated}
            />
            <span className="text-footnote font-medium text-text-primary">
              Showing {location.label}
            </span>
            {/* The honesty guard: "Simulated" / "Manual pin" / "Default area",
                and null only for a real device fix. Every distance on this map is
                measured from that position. */}
            {location.tag && <StatusBadge kind={location.tag.kind}>{location.tag.label}</StatusBadge>}
          </button>

          <button
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            className="pointer-events-auto grid h-9 w-9 shrink-0 place-items-center squircle-full
                       material-thick shadow-raised text-text-primary
                       active:scale-90 transition-transform duration-instant"
          >
            {theme === "dark" ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
          </button>
        </div>

        {locateError && <MapNotice message={locateError} onDismiss={dismissLocateError} />}
      </div>

      {/* Recenter. Parked above the peek detent so the sheet never covers it —
          the fraction is imported rather than typed as "20vh", so retuning the
          detent moves this with it. */}
      <div
        className="absolute right-4 z-10 pointer-events-none"
        style={{ bottom: isRegular ? "1rem" : `calc(${DETENT_FRACTION.peek * 100}vh + 16px)` }}
      >
        <MapRecenterControl
          /* recenterTo ONLY. Writing the position to the store here would fire
             the mapCenter effect above, and its state-driven flyTo would land a
             commit later and interrupt this animation mid-flight — freezing the
             zoom at whatever value it had reached. Two things must never drive
             the camera for one interaction. This is the camera control; the
             location pill is the position control. */
          onLocate={({ lat, lng }) => {
            setLocateError(null);
            mapCameraRef.current?.recenterTo(lat, lng);
          }}
          onError={(message) => setLocateError(message)}
        />
      </div>
    </div>
  );

  // 2. Sheet node (left sidebar on desktop / bottom sheet on mobile)
  const sheetNode = (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Brand & search header */}
      <div className="px-4 pt-3 pb-2.5 flex flex-col gap-2.5">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center space-x-2.5">
            <NigeriaLogo className="h-7 w-7" />
            <span className="text-headline tracking-tight">{t.wetin_dey}</span>
          </div>

          {/* Both actions present a sheet over this one rather than replacing
              its contents, so the search context stays put underneath. */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setIsReportOpen(true)}
              className="grid place-items-center h-8 w-8 rounded-full bg-fillSecondary text-text-primary
                         active:scale-90 transition-transform duration-instant"
              aria-label={t.report_price}
            >
              <Plus className="h-[18px] w-[18px]" strokeWidth={2.5} />
            </button>

            <button
              onClick={() => setIsProfileOpen(true)}
              className="grid place-items-center squircle-full
                         active:scale-90 transition-transform duration-instant"
              aria-label="Account"
            >
              <Avatar size={32} />
            </button>
          </div>
        </div>

        <SearchField
          value={searchQuery}
          onChange={handleSearchChange}
          onClear={clearSearch}
          placeholder={t.search_placeholder}
        />
      </div>

      {/* Scrollable contents */}
      <div className="flex-1 overflow-y-auto px-3 pb-5">
        <div className="space-y-4">
          {/* A. Popular items */}
          {!searchQuery && (
            <div className="space-y-2.5">
              <div className="flex items-baseline justify-between px-0.5">
                <h4 className="text-footnote font-semibold text-text-primary">
                  {t.popular_items} {location.label}
                </h4>
                {popularItems && popularItems.length > 0 && (
                  <span className="text-caption-1 text-text-secondary tabular-nums">
                    {popularItems.reduce((n, i) => n + (i.offerCount ?? 0), 0)} prices
                  </span>
                )}
              </div>

              {/* `subject` is the location, because the list IS about the
                  location now. AsyncList remounts its skeletons when the subject
                  changes, so switching area shows the list loading rather than
                  silently swapping Festac's prices for Yaba's under a header
                  that already says Yaba. This was previously omitted — correctly,
                  at the time — because the query ignored location and a refetch
                  returned byte-identical rows. It no longer does. */}
              <AsyncList
                subject={`${location.label}·${activeRadiusKm}`}
                items={popularItems}
                isLoading={isPending}
                error={anyLoadError}
                onRetry={retryFailed}
                keyExtractor={(item) => item.id}
                renderItem={(item) => <ItemCard item={item} onSelect={handleSelectItem} />}
                skeletonCount={4}
                empty={{
                  title: `No prices within ${activeRadiusKm} km`,
                  description: "Be the first to report one."
                }}
                errorState={{
                  title: anyLoadError ?? "Could not load",
                  description: "Check your network and try again.",
                  retryLabel: "Try again"
                }}
                footer={popularItems && <PhotoCredits items={popularItems} />}
              />
            </div>
          )}

          {/* B. Search results. One branch, not two — the old "searching" branch
              rendered h-12 bars that stood in for ItemCards and jumped the layout
              the moment real rows arrived. */}
          {searchQuery && (
            <AsyncList
              items={searchResults}
              isLoading={isSearching}
              subject={searchQuery}
              keyExtractor={(item) => item.id}
              renderItem={(item) => <ItemCard item={item} onSelect={handleSelectItem} />}
              skeletonCount={3}
              empty={{
                icon: <AlertTriangle className="h-7 w-7" />,
                title: t.no_results,
                description: "Try a local name like “ewa” or “dodo”."
              }}
            />
          )}
        </div>
      </div>
    </div>
  );

  // 3. Desktop detail sidebar (right panel)
  //
  // The offer branch that used to live here is gone: it showed the same five
  // dimensions ItemDetailSheet now shows on BOTH shells, computed worse
  // (`supportingObservationCount * 10`, so ten reports from one person read as
  // 100% confidence), behind two buttons with no handlers.
  const detailNode = useMemo(() => {
    if (!selectedPlace) return undefined;

    return (
      <div className="space-y-5 h-full flex flex-col justify-between">
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex-1 pr-4">
              <h2 className="text-headline tracking-tight text-text-primary">{selectedPlace.name}</h2>
              <p className="text-caption-1 text-text-secondary mt-1 flex items-center">
                <MapPin className="h-3.5 w-3.5 text-accent mr-1 shrink-0" />
                {/* From the user, not from the camera — this panel opens by
                    tapping a pin, which centres the camera ON that pin, so
                    measuring from `mapCenter` printed "0 m away" for every
                    market you clicked. */}
                {formatDistance(
                  getHaversineDistance(
                    searchOrigin.lat,
                    searchOrigin.lng,
                    selectedPlace.location.lat,
                    selectedPlace.location.lng
                  )
                )}{" "}
                • {selectedPlace.address || `${location.label}, Lagos`}
              </p>
            </div>
            <button
              onClick={() => setActiveMarkerId(null)}
              aria-label="Close"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-fillSecondary
                         text-text-secondary hover:text-text-primary transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* What this market is currently selling. */}
          <div className="space-y-3">
            <h4 className="text-footnote text-text-secondary">Available prices in market</h4>
            <AsyncList
              items={placeOffers}
              isLoading={isPlaceOffersLoading}
              error={placeOffersError}
              subject={activeMarkerId ?? ""}
              keyExtractor={(offer) => offer.id}
              className="max-h-[40vh] overflow-y-auto pr-1"
              renderItem={(offer) => (
                <div className="p-3 squircle bg-fillSecondary/40 flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="truncate text-caption-1 font-bold text-text-primary">
                      {offer.itemName}
                    </div>
                    <div className="truncate text-caption-2 text-text-secondary mt-0.5">
                      {offer.variantName}
                    </div>
                  </div>
                  <div className="text-right shrink-0 pl-2">
                    <div className="text-caption-1 font-black text-accent tabular-nums">
                      {formatPrice(offer.priceMin)}
                    </div>
                    <div className="text-caption-2 text-text-tertiary">/ {offer.unit}</div>
                  </div>
                </div>
              )}
              /* This empty state was a bare grey pin with no words at all. */
              empty={{
                icon: <MapPin className="h-6 w-6" />,
                title: "No prices here yet",
                description: "Nobody has reported a price at this market."
              }}
              errorState={{
                title: placeOffersError ?? "Could not load",
                description: "Check your network and try again."
              }}
            />
          </div>
        </div>

        {/* One real action, replacing two that had no onClick. */}
        <div className="pt-4 mt-2">
          <Button
            variant="primary"
            size="md"
            className="w-full flex items-center justify-center"
            onClick={() =>
              setGetItTarget({
                placeId: selectedPlace.id,
                placeName: selectedPlace.name,
                lat: selectedPlace.location.lat,
                lng: selectedPlace.location.lng,
                address: selectedPlace.address,
                areaName: location.label,
                // Reached from a pin, so there is no single price under test —
                // and therefore nothing to confirm on the way back.
                offer: null
              })
            }
          >
            <Navigation className="h-4 w-4 mr-1.5" />
            Get it
          </Button>
        </div>
      </div>
    );
  }, [
    selectedPlace,
    placeOffers,
    placeOffersError,
    isPlaceOffersLoading,
    activeMarkerId,
    searchOrigin,
    location.label,
    setActiveMarkerId
  ]);

  return (
    <div className="relative w-full h-full min-h-screen overflow-hidden">
      {/* `detailNode` is now a pushed level in BOTH size classes, so the place
          detail — and its "Get it" — is reachable on a phone rather than being
          desktop-only. The label and back handler name and pop that level. */}
      <AdaptiveShell
        mapNode={mapNode}
        sheetNode={sheetNode}
        detailNode={detailNode}
        detailLabel={selectedPlace?.name}
        onDetailBack={() => setActiveMarkerId(null)}
        activeDetent={activeDetent}
        setActiveDetent={setActiveDetent}
      />

      {/* Progressive reveal: each task presents its own surface over the map
          and the results sheet, instead of taking their place. */}

      {/* rice → long-grain → 50 kg bag → ranked offers. */}
      <ItemDetailSheet
        open={Boolean(detailItem)}
        onClose={() => setDetailItem(null)}
        item={detailItem}
        center={searchOrigin}
        radiusKm={activeRadiusKm}
        areaName={location.label}
        onSelectOffer={handleSelectOffer}
        onOffersChange={handleItemOffersChange}
        t={t}
      />

      {/* The lookup becomes a trip. */}
      <GetItSheet
        open={Boolean(getItTarget)}
        onClose={() => setGetItTarget(null)}
        target={getItTarget}
        origin={searchOrigin}
        onGoThere={handleArmVisit}
      />

      {/* The trip becomes an answer. This is the part that compounds. */}
      <ConfirmVisitSheet
        open={Boolean(pendingVisit)}
        visit={pendingVisit}
        onClose={() => setPendingVisit(null)}
        onConfirmed={({ queued }) => {
          // A queued answer has changed nothing on the server yet, so refetching
          // would only redraw the same rows.
          if (!queued) loadBaseline();
        }}
        lang={locale}
      />

      <LocationSheet
        open={isLocationOpen}
        onClose={() => setIsLocationOpen(false)}
        radiusKm={activeRadiusKm}
        onCommit={(coords) => setMapCenter(coords)}
      />

      <SettingsSheet
        open={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        lang={locale}
        onLangChange={setLocale}
        theme={theme}
        onToggleTheme={toggleTheme}
        radiusKm={activeRadiusKm}
        onRadiusChange={setActiveRadiusKm}
        t={t}
      />

      <ProfileSheet
        open={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onChangeArea={() => setIsLocationOpen(true)}
        currentAreaName={location.label}
        user={null}
      />

      <ReportPriceSheet
        open={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        t={t}
        places={submitPlaces}
        items={submitItems}
        variants={submitVariants}
        units={submitUnits}
        placeId={formPlaceId}
        itemId={formItemId}
        variantId={formVariantId}
        unitId={formUnitId}
        price={formPrice}
        available={formAvailable}
        onPlaceId={setFormPlaceId}
        onItemId={setFormItemId}
        onVariantId={setFormVariantId}
        onUnitId={setFormUnitId}
        onPrice={setFormPrice}
        onAvailable={setFormAvailable}
        onSubmit={handlePriceSubmit}
        submitting={isSubmitting}
        error={submitError}
        success={submitSuccess}
        offlineSaved={isOfflineSaved}
      />
    </div>
  );
}
