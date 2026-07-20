import {
  useState,
  useEffect,
  useTransition,
  useMemo,
  useCallback,
  useRef
} from "react";
import { getImageProps } from "next/image";
import {
  type Detent,
  type MapRetryCapability
} from "@/design-system/components/BottomSheet";
import { useModalPresented } from "@/design-system/components/ModalSheet";
import { type CategoryPillar } from "@/app/_components/CategorySelectorSheet";
import { type ItemCardData } from "@/design-system/components/ItemCard";
import { useLocationIdentity } from "@/app/_hooks/useLocationIdentity";
import type { ExchangeLocationFilter } from "@/app/_components/ExchangePanel";
import type { CrossCategorySignal } from "@/app/_components/CrossCategorySignalRail";
import {
  getNearbyExchangeLocations,
  type ExchangeLocationDiscoveryResult,
} from "@/app/_actions/exchange-location-actions";
import {
  getReferenceCurrencyCatalog,
  type ReferenceCurrencyCatalogEntry,
} from "@/app/_actions/currency-actions";
import { EXCHANGE_SAMPLE_LOCATIONS } from "@/app/_data/exchange-sample-locations";
import type { ExchangeLocation } from "@/integrations/maps/MapboxNearbyExchangeSearch";
import type { PresentedOffer, OfferPresentation } from "@/app/_components/ItemDetailSheet";
import type { GetItTarget } from "@/app/_components/GetItSheet";
import {
  armVisit,
  takeDueVisit,
  type VisitContext
} from "@/app/_components/ConfirmVisitSheet";
import { useTheme } from "@/core/context/ThemeContext";
import { usePresentation } from "@/core/navigation/usePresentation";
import { useGlobalStore } from "@/core/state/globalStore";
import { useLocaleControl, useStrings } from "@/core/i18n";
import { useEventCallback } from "@/lib/perf";
import {
  searchItems,
  getPopularItems,
  getPlaces,
  getPlaceOffers,
  getInitialSubmissionData,
  getVisitContext,
  getMyProfile,
  type PlaceOffer,
  type NarrowedOffer
} from "@/app/_actions/actions";
import {
  fetchRoute,
  type DisclosedRouteOrigin
} from "@/lib/directions";
import type { RouteGeometry } from "@/integrations/maps/MapboxAdapter";
import { useMapPresentation } from "@/app/_components/map-presentation/hooks/useMapPresentation";

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

const SIGNAL_NAIRA = new Intl.NumberFormat("en-NG", {
  maximumFractionDigits: 0,
  notation: "compact",
});

function foodSignalPrice(item: ItemCardData): string | null {
  if (typeof item.priceFrom !== "number" || !Number.isFinite(item.priceFrom)) {
    return null;
  }
  const from = `₦${SIGNAL_NAIRA.format(item.priceFrom)}`;
  if (
    typeof item.priceTo !== "number" ||
    !Number.isFinite(item.priceTo) ||
    item.priceTo <= item.priceFrom
  ) {
    return from;
  }
  return `${from}–₦${SIGNAL_NAIRA.format(item.priceTo)}`;
}

export function useHomePage() {
  const { theme, toggleTheme } = useTheme();

  /**
   * Copy comes from `@/core/i18n`, not from a dictionary in this file.
   *
   * There was a 110-line `TRANSLATIONS` literal here, and it was the reason
   * every sheet built after this file, GetItSheet, ItemDetailSheet,
   * LocationSheet, is hardcoded English: no component could add a key without
   * editing a 1000-line page component, so none of them tried. It had also
   * already forked, into ConfirmVisitSheet's own `COPY`. `useStrings()` returns
   * the same shape under the same key names, so the sheets that take `t` as a
   * prop are unchanged.
   */
  const t = useStrings();
  const [locale, setLocale] = useLocaleControl();

  // Zustand global state, the camera anchor and the search radius. Where the
  // USER is lives in locationStore; these two are not the same fact.
  const {
    cameraCenter,
    setCameraCenter,
    activeRadiusKm,
    setActiveRadiusKm,
  } = useGlobalStore();

  // Which detent the compact sheet rides at. Page-local: this component is the
  // only writer, and it hands both halves to AdaptiveShell as props.
  const [activeDetent, setActiveDetent] = useState<Detent>("medium");
  const [mapRetryCapability, setMapRetryCapability] =
    useState<MapRetryCapability | null>(null);
  /**
   * WHICH PLACE'S DETAIL LEVEL IS PUSHED. Null = none. That is the whole
   * meaning, and writing it always costs both halves: it gates `detailPlace`,
   * which pushes level 1, and it is the only thing `getPlaceOffers` is fetched
   * for, `placeOffers` is read nowhere but inside `detailNode`. A flow that
   * wants no pushed level must therefore not write it at all; there is no
   * partial use.
   */
  const [detailPlaceId, setDetailPlaceId] = useState<string | null>(null);

  // React transitions
  const [isPending, startTransition] = useTransition();

  const { insetProbeRef, leadingInset, isRegular } = useMapPresentation();

  /**
   * A presented sheet demotes an expanded one underneath it, so the map survives.
   *
   * `large` is 94vh. Present anything over it and there is no map left on
   * screen, and the map is what the sheet on top is about. `medium` (52vh)
   * puts it back in frame. `peek` and `medium` are left exactly where they are:
   * they already show the map, and moving a sheet the user deliberately parked
   * costs more than it buys.
   *
   * ONE seam, not eight. `useModalPresented` counts presentations inside
   * ModalSheet, the only thing that knows one is up, so all eight call sites get
   * this without opting in and a ninth cannot forget to.
   */
  const modalPresented = useModalPresented();
  /** The detent to hand back on dismissal. Null = we never took one. */
  const preModalDetent = useRef<Detent | null>(null);

  const syncDetentToModal = useEventCallback((presented: boolean) => {
    if (presented) {
      // RegularShell mounts a panel and no BottomSheet at all, so there is no
      // detent to demote, `activeDetent` is state nothing reads there.
      if (isRegular || activeDetent !== "large") return;
      preModalDetent.current = activeDetent;
      setActiveDetent("medium");
      return;
    }

    const restore = preModalDetent.current;
    preModalDetent.current = null;
    /**
     * Give it back. Expanding to `large` was a decision, and silently keeping
     * someone at `medium` afterwards spends it on their behalf.
     *
     * Only from where we left it. Any other detent means the user moved the
     * sheet themselves while the sheet above was up, and the position they chose
     * outranks the one we remembered.
     */
    if (restore && activeDetent === "medium") setActiveDetent(restore);
  });

  useEffect(() => {
    syncDetentToModal(modalPresented);
  }, [modalPresented, syncDetentToModal]);

  /**
   * The presentation spine. One surface at a time, location, my reports, report
   * a problem, about, so opening one closes any other and none can peek above
   * the next. It also owns the hash deep-links (#about, #terms, #privacy,
   * #support, #report-problem): a link opens the surface, an open surface writes
   * the hash, and the browser Back button closes it. See usePresentation.
   */
  const { surface, openSurface, closeSurface } = usePresentation();

  // Presented surfaces that stay their own booleans: Settings and Profile carry
  // no shareable state, and Report a price holds ~15 form fields below that this
  // controller does not own. The four data-carrying flows (detail/GetIt/Confirm)
  // keep their own state too, further down.
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<CategoryPillar>("food");
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [exchangeFilter, setExchangeFilter] = useState<ExchangeLocationFilter>("all");
  const [exchangeLocations, setExchangeLocations] = useState<ExchangeLocation[]>([]);
  const [usdHeaderRate, setUsdHeaderRate] =
    useState<ReferenceCurrencyCatalogEntry | null>(null);
  const [exchangeLocationDiscoveryStatus, setExchangeLocationDiscoveryStatus] =
    useState<ExchangeLocationDiscoveryResult["status"] | "loading" | "sample">("loading");
  const [selectedExchangeLocationId, setSelectedExchangeLocationId] = useState<string | null>(
    null
  );
  /** The item ItemDetailSheet is resolving down to a unit. Non-null = presented. */
  const [detailItem, setDetailItem] = useState<ItemCardData | null>(null);
  /** The place GetItSheet is about to hand off to. Non-null = presented. */
  const [getItTarget, setGetItTarget] = useState<GetItTarget | null>(null);
  /** A trip that happened. Non-null = we are asking how it went. */
  const [pendingVisit, setPendingVisit] = useState<VisitContext | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getReferenceCurrencyCatalog()
      .then((entries) => {
        if (!cancelled) {
          setUsdHeaderRate(
            entries.find((entry) => entry.code === "USD") ?? null
          );
        }
      })
      .catch(() => {
        if (!cancelled) setUsdHeaderRate(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // General app state
  const [searchQuery, setSearchQuery] = useState("");
  /**
   * `undefined` until the first fetch settles. `[]` would claim we looked and
   * found nothing, which AsyncList would correctly render as "No prices yet" ,
   * on the very first frame, before the effect has even run.
   */
  const [popularItems, setPopularItems] = useState<ItemCardData[] | undefined>(undefined);
  const [searchResults, setSearchResults] = useState<ItemCardData[]>([]);
  // Set when a search rejects (offline, server down). AsyncList renders it in the
  // search list's error state instead of the whole app falling to the boundary.
  const [searchError, setSearchError] = useState<string | null>(null);
  // Incrementing retries the current query/context without rewriting any of it.
  const [searchRetryNonce, setSearchRetryNonce] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  /** Kept apart from `loadError`: the two loads fail independently, and a dead
   *  places query must not blank the list with the list's own error text. */
  const [popularError, setPopularError] = useState<string | null>(null);
  /** The narrowed set ItemDetailSheet is showing. The map pins ARE this list. */
  const [itemOffers, setItemOffers] = useState<PresentedOffer[]>([]);
  const [allPlaces, setAllPlaces] = useState<PlaceData[]>([]);
  const [placeOffers, setPlaceOffers] = useState<PlaceOffer[] | undefined>(undefined);
  const [placeOffersError, setPlaceOffersError] = useState<string | null>(null);
  const [placeOffersRetry, setPlaceOffersRetry] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [isPlaceOffersLoading, setIsPlaceOffersLoading] = useState(false);
  const {
    location,
    searchOrigin,
    sessionUser,
    userProfile,
    selfIdentity,
    locateError,
    dismissLocateError,
    refetchSession,
    handleRecenter,
    setLocateError,
  } = useLocationIdentity({
    setCameraCenter,
  });
  const [selfHeaderAvatarUrl, setSelfHeaderAvatarUrl] = useState<string | null>(null);
  const [selfMapMarkerAvatarUrl, setSelfMapMarkerAvatarUrl] = useState<string | null>(null);
  const selfAvatarRequestId = useRef(0);
  const refreshSelfProfileAvatar = useEventCallback(async () => {
    const requestId = ++selfAvatarRequestId.current;
    try {
      const latestProfile = await getMyProfile();
      if (requestId !== selfAvatarRequestId.current) return;

      const nextAvatarUrl = latestProfile?.avatarUrl ?? null;
      setSelfHeaderAvatarUrl(nextAvatarUrl);

      if (!nextAvatarUrl) {
        setSelfMapMarkerAvatarUrl(null);
        return;
      }

      try {
        const optimizedAvatar = getImageProps({
          src: nextAvatarUrl,
          alt: "",
          width: 64,
          height: 64
        }).props.src;
        setSelfMapMarkerAvatarUrl(optimizedAvatar);
      } catch {
        setSelfMapMarkerAvatarUrl(null);
      }
    } catch {
      // Keep the current marker/name state; failed profile refreshes are non-blocking
      // and the initials fallback is the expected UX.
    }
  });

  useEffect(() => {
    if (!sessionUser) {
      setSelfHeaderAvatarUrl(null);
      setSelfMapMarkerAvatarUrl(null);
      return;
    }
    void refreshSelfProfileAvatar();
  }, [sessionUser, refreshSelfProfileAvatar]);

  const handleSessionChange = useEventCallback(async () => {
    await refetchSession();
    await refreshSelfProfileAvatar();
  });

  const resolvedSelfIdentity = useMemo(() => {
    if (!selfIdentity) return null;
    if (!selfMapMarkerAvatarUrl) return selfIdentity;
    return {
      ...selfIdentity,
      avatarUrl: selfMapMarkerAvatarUrl,
    };
  }, [selfIdentity, selfMapMarkerAvatarUrl]);

  const resolvedSelfAvatarUrl = selfHeaderAvatarUrl ?? userProfile?.avatarUrl;

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

  /**
   * The location-INDEPENDENT half: every place on the map, and the form's
   * vocabulary. Neither changes when the user moves, so neither is refetched
   * when they do, the map draws all pins regardless of the radius, and the
   * report form must be able to name a stall anywhere.
   *
   * A callback, not an effect body: the error state needs a retry handle.
   */
  const loadBaseline = useCallback(() => {
    startTransition(async () => {
      try {
        setLoadError(null);

        // In parallel, these don't depend on each other, and doing them in
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
   * refetches when "here" changes, the position or the radius. It used to be
   * fetched once, with no location at all, which is why the header could say
   * "Popular items around Yaba" over rows ranked from every offer in the
   * country. Moving to Festac changed the header and nothing else.
   */
  const loadPopular = useCallback(() => {
    if (activeCategory !== "food") return;
    startTransition(async () => {
      try {
        setPopularError(null);
        const items = await getPopularItems({
          lat: searchOrigin.lat,
          lng: searchOrigin.lng,
          radiusKm: activeRadiusKm,
          category: activeCategory,
          limit: 8
        });
        setPopularItems(items);
      } catch (err) {
        console.error("Failed to load popular items:", err);
        // Settled, and we know nothing, NOT "never fetched". Without this the
        // list stays undefined and skeletons spin forever behind the error.
        setPopularItems([]);
        setPopularError("We no fit reach the price data right now.");
      }
    });
  }, [
    searchOrigin.lat,
    searchOrigin.lng,
    activeRadiusKm,
    activeCategory,
  ]);

  useEffect(() => {
    loadBaseline();
  }, [loadBaseline]);

  useEffect(() => {
    loadPopular();
  }, [loadPopular]);

  useEffect(() => {
    if (activeCategory !== "food" || searchQuery.trim() === "") {
      setIsSearching(false);
      if (activeCategory !== "food") {
        setSearchResults([]);
        setSearchError(null);
      }
      return;
    }

    let cancelled = false;
    setIsSearching(true);
    setSearchError(null);
    startTransition(async () => {
      try {
        const matched = await searchItems(searchQuery, "food", {
          lat: searchOrigin.lat,
          lng: searchOrigin.lng,
          radiusKm: activeRadiusKm
        });
        if (!cancelled) setSearchResults(matched);
      } catch (err) {
        console.error("Search failed:", err);
        if (!cancelled) {
          setSearchError("Couldn't search. Check your connection.");
        }
      } finally {
        if (!cancelled) setIsSearching(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [
    activeCategory,
    searchQuery,
    searchOrigin.lat,
    searchOrigin.lng,
    activeRadiusKm,
    searchRetryNonce
  ]);

  useEffect(() => {
    const title = "WetinDey: nearby live local information";
    const description = "Know before you go. Live local information near you.";
    document.title = title;

    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute("content", description);
    } else {
      const newMeta = document.createElement("meta");
      newMeta.name = "description";
      newMeta.content = description;
      document.head.appendChild(newMeta);
    }
  }, [activeCategory]);

  /**
   * Retry only what actually broke.
   *
   * The sheet's list is the app's one error affordance, the map layer has no
   * retry chrome, so it reports either failure. Splitting the loads without
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
   * Contribution containment deliberately has no offline drain. In particular,
   * do not read, parse, rewrite, increment attempts on, or delete
   * `pending_observations` or `pending_visit_confirmations`: their existing
   * bytes remain on-device until durable server idempotency exists.
   */

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

  /**
   * What is on sale at the place whose detail level is open.
   *
   * Keyed on the pushed level rather than on any broader notion of selection:
   * the result is rendered only inside `detailNode`, so a fetch with no level
   * pushed would be a round-trip whose answer has nowhere to land, on
   * connections this app is otherwise careful to spend nothing on.
   */
  useEffect(() => {
    if (!detailPlaceId) {
      setPlaceOffers(undefined);
      setPlaceOffersError(null);
      return;
    }

    let cancelled = false;
    setIsPlaceOffersLoading(true);
    setPlaceOffersError(null);

    getPlaceOffers(detailPlaceId)
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
  }, [detailPlaceId, placeOffersRetry]);

  /**
   * Snapshot the claim, on the way OUT.
   *
   * Fetched when GetItSheet opens rather than when "Go there" is tapped, and the
   * reason is the handoff itself: on Android it assigns `window.location.href`,
   * so a promise started on the tap may never resolve, the page is gone. By the
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
        // No snapshot means no question. That is the honest outcome, asking
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
    }
  };

  /**
   * Picking an item presents the narrowing sheet, it does not dump a flat list.
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
    setDetailPlaceId(null);
  });

  const handleSelectPlaceOffer = useEventCallback(async (offer: PlaceOffer) => {
    const knownItem = [...(popularItems ?? []), ...searchResults].find(
      (item) => item.name === offer.itemName
    );
    if (knownItem) {
      handleSelectItem(knownItem);
      return;
    }

    try {
      const matches = await searchItems(offer.itemName, "food", {
        lat: searchOrigin.lat,
        lng: searchOrigin.lng,
        radiusKm: activeRadiusKm
      });
      const targetName = offer.itemName.trim().toLocaleLowerCase("en-NG");
      const match = matches.find(
        (item) => item.name.trim().toLocaleLowerCase("en-NG") === targetName
      );
      if (match) handleSelectItem(match);
    } catch {
      // A failed lookup leaves the current market detail intact; it must not
      // invent an item identity from an offer id or an external image URL.
    }
  });

  /** The pins are the list. See ItemDetailSheet's `onOffersChange`. */
  const handleItemOffersChange = useEventCallback((offers: PresentedOffer[]) => {
    setItemOffers(offers);
  });

  /**
   * Toggle Settings, Profile, Report states
   */
  const openSettings = useCallback(() => setIsSettingsOpen(true), []);
  const closeSettings = useCallback(() => setIsSettingsOpen(false), []);
  const openReport = useCallback(() => setIsReportOpen(true), []);
  const closeReport = useCallback(() => setIsReportOpen(false), []);
  const openProfile = useCallback(() => setIsProfileOpen(true), []);
  const closeProfile = useCallback(() => setIsProfileOpen(false), []);

  /**
   * An offer was chosen: centre it, and offer to act on it. This is where the
   * lookup becomes a trip.
   *
   * Writes NO `detailPlaceId`, and that absence is the flow. The user arrived
   * from the offer list, not from a pin, so this market's detail level is a
   * surface they never asked for and have never seen, pushing it would seat a
   * full level under the Get it modal and leave the map covered by two surfaces
   * at once. The camera is `setCameraCenter`'s job and needs nothing from the atom.
   *
   * The narrowed pins in `itemOffers` are deliberately left standing: they are
   * what remains visible behind the modal, and the geometry any route drawn
   * between origin and offer would need.
   */
  const handleSelectOffer = useEventCallback((offer: NarrowedOffer, signal: OfferPresentation) => {
    setDetailItem(null);
    setCameraCenter({ lat: offer.lat, lng: offer.lng });
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

  useEffect(() => {
    if (activeCategory !== "money") return;
    let cancelled = false;
    setExchangeLocations([]);
    setExchangeLocationDiscoveryStatus("loading");
    void getNearbyExchangeLocations(searchOrigin).then((result) => {
      if (cancelled) return;
      if (result.locations.length === 0) {
        setExchangeLocations([...EXCHANGE_SAMPLE_LOCATIONS]);
        setExchangeLocationDiscoveryStatus("sample");
        return;
      }
      setExchangeLocations(result.locations);
      setExchangeLocationDiscoveryStatus("ready");
    });
    return () => {
      cancelled = true;
    };
  }, [activeCategory, searchOrigin]);

  const filteredExchangeLocations = useMemo(
    () =>
      exchangeFilter === "all"
        ? exchangeLocations
        : exchangeLocations.filter((location) => location.kind === exchangeFilter),
    [exchangeFilter, exchangeLocations]
  );

  const crossCategorySignals = useMemo<CrossCategorySignal[]>(() => {
    if (activeCategory === "food") {
      if (!usdHeaderRate || !Number.isFinite(usdHeaderRate.rate)) return [];
      const hasMovement =
        typeof usdHeaderRate.trendPercent === "number" &&
        Number.isFinite(usdHeaderRate.trendPercent);
      const movement = hasMovement
        ? `${usdHeaderRate.trendPercent! >= 0 ? "↑" : "↓"}${Math.abs(
            usdHeaderRate.trendPercent!
          ).toFixed(1)}%`
        : null;
      const rate = `₦${SIGNAL_NAIRA.format(usdHeaderRate.rate)}`;
      return [{
        id: `money-usd-${usdHeaderRate.effectiveDate}`,
        category: "money",
        code: "USD",
        amount: rate,
        trendText: movement,
        accessibleLabel: `Open Aboki FX. USD to naira reference rate${
          movement ? ` moved ${movement}` : ""
        }, ${rate}.`,
        visual: "usd",
        trendTone: !hasMovement ? "neutral" : usdHeaderRate.trendPercent! >= 0 ? "positive" : "negative",
      }];
    }

    const item = popularItems?.find((candidate) => foodSignalPrice(candidate));
    const price = item ? foodSignalPrice(item) : null;
    if (!item || !price) return [];
    const trend = item.foodTrend && item.foodTrend.state !== "insufficient" ? item.foodTrend : null;
    const movement = trend
      ? `${trend.state === "up" ? "↑" : trend.state === "down" ? "↓" : "→"}${Math.abs(
          Math.round(trend.changePercent)
        )}%`
      : null;
    return [{
      id: `food-${item.id}-${price}`,
      category: "food",
      code: item.name,
      amount: price,
      trendText: movement,
      accessibleLabel: `Open Food. ${item.name} is listed from ${price}${
        movement ? `, moved ${movement}` : ""
      }.`,
      visual: "food",
      trendTone: !trend ? "neutral" : trend.state === "up" ? "positive" : trend.state === "down" ? "negative" : "neutral",
    }];
  }, [activeCategory, popularItems, usdHeaderRate]);

  const handleSelectExchangeLocation = useEventCallback(
    (location: ExchangeLocation) => {
      setSelectedExchangeLocationId(location.id);
      setCameraCenter({ lat: location.lat, lng: location.lng });
      setActiveDetent("medium");
    }
  );

  /**
   * Stable identity, forever.
   *
   * This was a plain function declaration, so it took a new identity on every
   * render, and it is a dependency of MapboxCanvas's marker effect, which
   * clears and rebuilds every pin when it re-runs. Every unrelated re-render
   * (a keystroke, a focus) tore down and reconstructed the whole map.
   */
  const handleMarkerSelection = useEventCallback((placeId: string) => {
    if (activeCategory === "money") {
      const match = exchangeLocations.find((location) => location.id === placeId);
      if (match) handleSelectExchangeLocation(match);
      return;
    }

    // The pin flow, and the one place the pushed level is right: the user asked
    // for this market by tapping it, so its prices are where they were going.
    setDetailPlaceId(placeId);
    setActiveDetent("medium");

    const match = allPlaces.find((p) => p.id === placeId);
    if (match) {
      setCameraCenter({ lat: match.location.lat, lng: match.location.lng });
    }
  });

  const handleCategoryChange = useEventCallback((category: CategoryPillar) => {
    if (category !== "food" && category !== "money") return;

    setActiveCategory(category);
    setSearchQuery("");
    setSearchResults([]);
    setSearchError(null);
    setDetailItem(null);
    setItemOffers([]);
    setDetailPlaceId(null);
    setGetItTarget(null);
    setSelectedExchangeLocationId(null);
    setIsReportOpen(false);
    setActiveDetent("medium");
  });

  const clearSearch = () => {
    setSearchQuery("");
    setSearchResults([]);
    setDetailItem(null);
    setItemOffers([]);
    setDetailPlaceId(null);
  };

  /** The place whose detail level is pushed, NOT "the selected place". Nothing
   *  on this map has a selected state to be in. */
  const detailPlace = useMemo(
    () => allPlaces.find((p) => p.id === detailPlaceId),
    [allPlaces, detailPlaceId]
  );

  /**
   * Pins: the narrowed offers when there are some, otherwise every place.
   *
   * Item Detail publishes the same presentation kind its rows use, so the map
   * consumes one answer without rebuilding trust or status copy.
   */
  const mapMarkers = useMemo(() => {
    if (activeCategory === "money") {
      return filteredExchangeLocations.map((location) => ({
        id: location.id,
        placeId: location.id,
        placeName: location.name,
        placeType: location.kind === "bank" ? "bank" : "bureau_de_change",
        lat: location.lat,
        lng: location.lng,
        address: `${location.description} · ${
          location.provenance === "sample" ? "Sample" : "Map listing"
        }`
      }));
    }

    if (itemOffers.length > 0) {
      return itemOffers.map(({ offer: o, kind }) => ({
        id: o.id,
        placeId: o.placeId,
        placeName: o.placeName,
        placeType: o.placeType,
        lat: o.lat,
        lng: o.lng,
        address: o.address ?? "",
        detail: { confidenceLevel: kind }
      }));
    }
    return allPlaces.map((p) => ({
      id: p.id,
      placeId: p.id,
      placeName: p.name,
      placeType: p.placeType,
      lat: p.location.lat,
      lng: p.location.lng,
      address: p.address || ""
    }));
  }, [activeCategory, filteredExchangeLocations, itemOffers, allPlaces]);

  /**
   * The roads from you to the market you are about to walk to.
   *
   * Drawn only while a `GetItTarget` is open, because that is the only moment the
   * question "how do I get from me to there" is being asked. A line to every pin
   * would be noise, and a line to nothing is not a line.
   *
   * An effect and not a memo, because the geometry is fetched: it is Mapbox's
   * answer, and it lands some time after the tap that asked for it. Cleared to
   * null on the way in, so the previous market's roads never linger under this
   * market's pin, and the request is aborted on every change of target ,
   * a shopper taps through offers faster than the network answers, and a late
   * reply drawing the route the user already moved on from is the whole bug.
   *
   * No route, no network, no token → null → no line. `fetchRoute` never falls
   * back to a straight line, which is the point: a straight line reads as a road
   * and cuts through the lagoon.
   *
   * `[lng, lat]`, GeoJSON order, the opposite of every other map call here. See
   * RouteGeometry.
   */
  const [route, setRoute] = useState<RouteGeometry | null>(null);
  const [routeOrigin, setRouteOrigin] = useState<DisclosedRouteOrigin | null>(
    null
  );

  const selectedExchangeLocation = useMemo(
    () =>
      exchangeLocations.find(
        (location) => location.id === selectedExchangeLocationId
      ) ?? null,
    [exchangeLocations, selectedExchangeLocationId]
  );

  const routeTargetLat =
    activeCategory === "food"
      ? (getItTarget?.lat ?? null)
      : activeCategory === "money"
        ? (selectedExchangeLocation?.lat ?? null)
        : null;

  const routeTargetLng =
    activeCategory === "food"
      ? (getItTarget?.lng ?? null)
      : activeCategory === "money"
        ? (selectedExchangeLocation?.lng ?? null)
        : null;

  const handleOriginDisclosed = useEventCallback(
    (origin: DisclosedRouteOrigin) => {
      setRouteOrigin(origin);
    }
  );

  useEffect(() => {
    setRouteOrigin(null);
    setRoute(null);
  }, [getItTarget?.placeId, selectedExchangeLocationId]);

  useEffect(() => {
    setRoute(null);
    if (
      routeTargetLat === null ||
      routeTargetLng === null
    )
      return;

    const now = Date.now();
    const origin: DisclosedRouteOrigin = routeOrigin ?? {
      lat: searchOrigin.lat,
      lng: searchOrigin.lng,
      accuracyM: 10,
      capturedAt: now,
      receivedAt: now,
      disclosedAt: now,
      provenance: "device",
    };

    const controller = new AbortController();
    void fetchRoute(
      origin,
      { lat: routeTargetLat, lng: routeTargetLng },
      controller.signal
    ).then((geometry) => {
      if (controller.signal.aborted) return;
      setRoute(geometry);
    });

    return () => controller.abort();
  }, [activeCategory, routeOrigin, searchOrigin.lat, searchOrigin.lng, routeTargetLat, routeTargetLng]);

  return {
    theme,
    toggleTheme,
    t,
    locale,
    setLocale,
    cameraCenter,
    setCameraCenter,
    activeRadiusKm,
    setActiveRadiusKm,
    activeDetent,
    setActiveDetent,
    mapRetryCapability,
    setMapRetryCapability,
    detailPlaceId,
    setDetailPlaceId,
    isPending,
    startTransition,
    insetProbeRef,
    leadingInset,
    isRegular,
    modalPresented,
    surface,
    openSurface,
    closeSurface,
    isSettingsOpen,
    openSettings,
    closeSettings,
    isReportOpen,
    openReport,
    closeReport,
    isProfileOpen,
    openProfile,
    closeProfile,
    activeCategory,
    isCategoryOpen,
    setIsCategoryOpen,
    exchangeFilter,
    setExchangeFilter,
    selectedExchangeLocationId,
    setSelectedExchangeLocationId,
    detailItem,
    setDetailItem,
    getItTarget,
    setGetItTarget,
    pendingVisit,
    setPendingVisit,
    searchQuery,
    setSearchQuery,
    popularItems,
    searchResults,
    searchError,
    setSearchRetryNonce,
    loadError,
    popularError,
    itemOffers,
    allPlaces,
    placeOffers,
    placeOffersError,
    setPlaceOffersRetry,
    isSearching,
    isPlaceOffersLoading,
    location,
    searchOrigin,
    sessionUser,
    userProfile,
    selfIdentity,
    locateError,
    dismissLocateError,
    refetchSession,
    handleRecenter,
    setLocateError,
    resolvedSelfIdentity,
    resolvedSelfAvatarUrl,
    submitPlaces,
    submitItems,
    submitVariants,
    submitUnits,
    formPlaceId,
    setFormPlaceId,
    formItemId,
    setFormItemId,
    formVariantId,
    setFormVariantId,
    formUnitId,
    setFormUnitId,
    formPrice,
    setFormPrice,
    formAvailable,
    setFormAvailable,
    anyLoadError,
    retryFailed,
    handleSessionChange,
    handleSearchChange,
    handleSelectItem,
    handleSelectPlaceOffer,
    handleItemOffersChange,
    handleSelectOffer,
    filteredExchangeLocations,
    exchangeLocationDiscoveryStatus,
    crossCategorySignals,
    handleSelectExchangeLocation,
    handleMarkerSelection,
    handleCategoryChange,
    clearSearch,
    detailPlace,
    mapMarkers,
    route,
    handleOriginDisclosed,
    handleArmVisit
  };
}
