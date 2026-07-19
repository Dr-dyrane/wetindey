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
import { getImageProps } from "next/image";
import { AlertTriangle, MapPin, Navigation, Sun, Moon, X, Plus, ChevronDown } from "lucide-react";

import { Button } from "@/design-system/components/Button";
import { SearchField } from "@/design-system/components/SearchField";
import { AdaptiveShell } from "@/design-system/components/AdaptiveShell";
import {
  MapboxCanvas,
  MapRecenterControl,
  type MapCameraHandle
} from "@/design-system/components/MapboxCanvas";
import type { RouteGeometry } from "@/integrations/maps/MapboxAdapter";
import { authClient } from "@/lib/auth-client";
import { type Detent } from "@/design-system/components/BottomSheet";
import { useModalPresented } from "@/design-system/components/ModalSheet";
import { AsyncList } from "@/design-system/components/AsyncList";
import { NigeriaLogo } from "@/design-system/components/NigeriaLogo";
import { ItemCard, PhotoCredits, type ItemCardData } from "@/design-system/components/ItemCard";
import {
  PlaceOfferRow,
  PlaceOfferRowSkeleton
} from "@/design-system/components/PlaceOfferRow";
import { SettingsSheet } from "@/app/_components/SettingsSheet";
import { ReportPriceSheet } from "@/app/_components/ReportPriceSheet";
import { ProfileSheet, Avatar } from "@/app/_components/ProfileSheet";
import { CategorySelectorSheet, type CategoryPillar } from "@/app/_components/CategorySelectorSheet";
import {
  ExchangePanel,
  type ExchangeLocationFilter
} from "@/app/_components/ExchangePanel";
import {
  EXCHANGE_SAMPLE_LOCATIONS,
  type ExchangeSampleLocation
} from "@/app/_data/exchange-sample-locations";
import { ItemDetailSheet, offerSignal } from "@/app/_components/ItemDetailSheet";
import { PresentationHost } from "@/app/_components/PresentationHost";
import { GetItSheet, type GetItTarget } from "@/app/_components/GetItSheet";
import {
  ConfirmVisitSheet,
  armVisit,
  takeDueVisit,
  type VisitContext
} from "@/app/_components/ConfirmVisitSheet";

import { useTheme } from "@/core/context/ThemeContext";
import { usePresentation } from "@/core/navigation/usePresentation";
import { useGlobalStore } from "@/core/state/globalStore";
import {
  useLocationChrome,
  useLocationHydration,
  useFreshDeviceLocation,
  useLocationStore,
} from "@/core/state/locationStore";
import { useLocaleControl, useStrings } from "@/core/i18n";
import { useEventCallback } from "@/lib/perf";
import {
  searchItems,
  getPopularItems,
  getMyProfile,
  type MyProfile,
  getPlaces,
  getPlaceOffers,
  getInitialSubmissionData,
  getVisitContext,
  type PlaceOffer,
  type NarrowedOffer
} from "@/app/actions";
import { getHaversineDistance, formatDistance } from "@/lib/geospatial";
import {
  fetchRoute,
  type DisclosedRouteOrigin,
} from "@/lib/directions";

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

/**
 * The map chrome's error strip.
 *
 * `MapRecenterControl` reports a denied permission, a device that cannot fix, or
 * a timeout, and its contract says do not swallow it. There is no toast system
 * in this app and one control does not justify inventing one, so the message
 * lands here: on the map, under the pill, dismissible, and gone on its own after
 * a beat. Solid fill rather than the translucent material, this is the one
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

  const locationHydrated = useLocationHydration();
  const location = useLocationChrome();

  // Which detent the compact sheet rides at. Page-local: this component is the
  // only writer, and it hands both halves to AdaptiveShell as props.
  const [activeDetent, setActiveDetent] = useState<Detent>("medium");
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

  const mapCameraRef = useRef<MapCameraHandle>(null);

  /**
   * How much of the leading edge the shell's panel covers, in px.
   *
   * AdaptiveShell publishes this as `--shell-leading-inset` precisely so this
   * file can pad the camera by it, otherwise a selected pin lands UNDER the
   * panel, including the pin the user just tapped.
   *
   * MEASURED, not recomputed. The value is
   * `calc(clamp(12px,1.5vw,24px) + clamp(320px,36vw,420px))`, continuous, so
   * there is no constant to copy, and `getComputedStyle` hands back that string
   * unresolved rather than a number. A zero-height probe styled with the
   * variable makes the browser do the arithmetic, and a ResizeObserver on it
   * tracks every viewport change AND the compact↔regular flip for free. Copying
   * the clamps into JS would be a second source of truth that silently drifts
   * the day the panel is retuned, which is exactly what happened to the
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
   * compact default, and ThemeProvider hides the tree until mount, so that
   * frame is never seen.
   */
  const isRegular = leadingInset > 0;

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
  const [selectedExchangeLocationId, setSelectedExchangeLocationId] = useState<string | null>(
    null
  );
  const [userProfile, setUserProfile] = useState<MyProfile | null>(null);
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
   * found nothing, which AsyncList would correctly render as "No prices yet" ,
   * on the very first frame, before the effect has even run.
   */
  const [popularItems, setPopularItems] = useState<ItemCardData[] | undefined>(undefined);
  const [searchResults, setSearchResults] = useState<ItemCardData[]>([]);
  // Set when a search rejects (offline, server down). AsyncList renders it in the
  // search list's error state instead of the whole app falling to the boundary.
  const [searchError, setSearchError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  /** Kept apart from `loadError`: the two loads fail independently, and a dead
   *  places query must not blank the list with the list's own error text. */
  const [popularError, setPopularError] = useState<string | null>(null);
  /** The narrowed set ItemDetailSheet is showing. The map pins ARE this list. */
  const [itemOffers, setItemOffers] = useState<NarrowedOffer[]>([]);
  const [allPlaces, setAllPlaces] = useState<PlaceData[]>([]);
  const [placeOffers, setPlaceOffers] = useState<PlaceOffer[] | undefined>(undefined);
  const [placeOffersError, setPlaceOffersError] = useState<string | null>(null);
  const [placeOffersRetry, setPlaceOffersRetry] = useState(0);
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

  const browsingLocation = useLocationStore((s) => s.browsingLocation);
  const deviceLocation = useLocationStore((s) => s.deviceLocation);
  const freshDeviceLocation = useFreshDeviceLocation();
  const recordDeviceLocation = useLocationStore((s) => s.recordDeviceLocation);
  const initialBrowsingCameraApplied = useRef(false);
  useEffect(() => {
    if (!locationHydrated || initialBrowsingCameraApplied.current) return;
    initialBrowsingCameraApplied.current = true;
    setCameraCenter({
      lat: browsingLocation.lat,
      lng: browsingLocation.lng,
    });
  }, [
    browsingLocation.lat,
    browsingLocation.lng,
    locationHydrated,
    setCameraCenter,
  ]);

  useEffect(() => {
    if (deviceLocation && !freshDeviceLocation) {
      setLocateError(
        "Your last device location expired. Tap the recenter control to refresh it."
      );
    }
  }, [deviceLocation, freshDeviceLocation]);

  /**
   * Who the user is, if we know. NEVER a gate.
   *
   * Read on the CLIENT, not in a Server Component, and that is not a stylistic
   * choice: Neon's `getSession` writes a refreshed session cookie through an
   * UNGUARDED `ctx.setCookie`, and Next throws ReadonlyRequestCookiesError for a
   * cookie write in an RSC. It would pass every test while signed out (the write
   * is skipped when there are no cookies to set) and then 500 the whole map for
   * exactly the people we had just recognised. Server Actions may write cookies;
   * Server Components may not.
   *
   * `pending` is deliberately unused. This resolves after first paint and the
   * map must never wait on it, a shopper reading prices is not asked to sign in,
   * so signed-out IS the ready state, not a loading state. If the fetch fails,
   * `data` is null, which means "not recognised", the honest degradation, and
   * identical to the anonymous path the app is built around.
   */
  const { data: session, refetch: refetchSession } = authClient.useSession();
  const sessionUser = useMemo(() => {
    const u = session?.user;
    if (!u) return null;
    // `name` is "" for anyone created by email OTP; ProfileSheet falls back to
    // the email rather than rendering an empty identity.
    return { name: u.name ?? "", email: u.email };
  }, [session]);

  const selfIdentity = useMemo(
    () => {
      if (!sessionUser) return null;

      const avatarUrl = userProfile?.avatarUrl;
      let markerAvatarUrl: string | null = null;
      if (avatarUrl) {
        try {
          markerAvatarUrl = getImageProps({
            src: avatarUrl,
            alt: "",
            width: 64,
            height: 64
          }).props.src;
        } catch {
          // A stale or malformed stored URL must degrade to initials, not make
          // the map page fail while Next validates the optimizer source.
        }
      }

      return {
        name: sessionUser.name || sessionUser.email,
        // The map adapter owns a DOM <img>, not a Next <Image>. Send that image
        // through the same configured, same-origin optimizer as the visible
        // profile avatars; a raw Vercel Blob URL is outside the document's
        // img-src policy and therefore fails before it can cover the initials.
        avatarUrl: markerAvatarUrl
      };
    },
    [sessionUser, userProfile?.avatarUrl]
  );

  // Load the signed-in user's profile for their avatar.
  useEffect(() => {
    let cancelled = false;
    // Never let the previous account's avatar bridge an auth transition.
    setUserProfile(null);
    if (sessionUser) {
      void getMyProfile()
        .then((profile) => {
          if (!cancelled) setUserProfile(profile);
        })
        .catch(() => {
          // Initials remain the local fallback when profile loading fails.
        });
    }
    return () => {
      cancelled = true;
    };
  }, [session, sessionUser]);

  /**
   * The persisted browsing context. Every search, distance and "Nearest"
   * measures from here; it is not a physical-location claim.
   *
   * NOT `cameraCenter`, and the difference is not academic: tapping a result flies
   * the camera to that market, so a query keyed on `cameraCenter` would measure the
   * next search from the last shop you looked at rather than from you. Open rice,
   * tap a stall two streets away, go back and open beans, and "Nearest" would
   * quietly mean "nearest to that stall". The camera follows the position; the
   * position never follows the camera.
   */
  const searchOrigin = useMemo(
    () => ({ lat: browsingLocation.lat, lng: browsingLocation.lng }),
    [browsingLocation.lat, browsingLocation.lng]
  );

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
          lat: browsingLocation.lat,
          lng: browsingLocation.lng,
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
    browsingLocation.lat,
    browsingLocation.lng,
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
          lat: browsingLocation.lat,
          lng: browsingLocation.lng,
          radiusKm: activeRadiusKm
        });
        if (!cancelled) setSearchResults(matched);
      } catch (err) {
        console.error("Search failed:", err);
        if (!cancelled) {
          setSearchResults([]);
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
    browsingLocation.lat,
    browsingLocation.lng,
    activeRadiusKm
  ]);

  useEffect(() => {
    const categoryInfo: Record<CategoryPillar, { title: string; desc: string }> = {
      food: {
        title: "WetinDey — Food Prices & Availability in Lagos",
        desc: "Find where specific food items are available nearby and compare current market prices in Lagos in real time."
      },
      home: {
        title: "WetinDey — Home & Building Materials in Lagos",
        desc: "Check prices and local stock of cement, paint, tiles, and household cooking fuels around you."
      },
      health: {
        title: "WetinDey — Medicine & Skincare Availability",
        desc: "Search nearby pharmacy prices, drug stock levels, and personal care/cosmetics in your neighborhood."
      },
      money: {
        title: "WetinDey — Official CBN Exchange Reference",
        desc: "Convert USD, GBP, and EUR with the official CBN reference rate and explore clearly labelled Sample exchange-place UI."
      },
      transport: {
        title: "WetinDey — Local Transport Fares & Ride Prices",
        desc: "Check Danfo bus routes, ferry options, and standard private ride-hailing fares in Lagos."
      },
      community: {
        title: "WetinDey — Local Services & NEPA Power Status",
        desc: "See real-time NEPA power outage reports and find local service providers (mechanics, tailors)."
      }
    };

    const info = categoryInfo[activeCategory] || categoryInfo.food;
    document.title = info.title;

    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute("content", info.desc);
    } else {
      const newMeta = document.createElement("meta");
      newMeta.name = "description";
      newMeta.content = info.desc;
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

  /** The pins are the list. See ItemDetailSheet's `onOffersChange`. */
  const handleItemOffersChange = useEventCallback((offers: NarrowedOffer[]) => {
    setItemOffers(offers);
  });

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
  const handleSelectOffer = useEventCallback((offer: NarrowedOffer) => {
    const signal = offerSignal(offer);

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

  const filteredExchangeLocations = useMemo(
    () =>
      exchangeFilter === "all"
        ? EXCHANGE_SAMPLE_LOCATIONS
        : EXCHANGE_SAMPLE_LOCATIONS.filter((location) => location.kind === exchangeFilter),
    [exchangeFilter]
  );

  const handleSelectExchangeLocation = useEventCallback(
    (location: ExchangeSampleLocation) => {
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
      const match = EXCHANGE_SAMPLE_LOCATIONS.find((location) => location.id === placeId);
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
   * The status comes from `offerSignal`, the same derivation the rows use ,
   * rather than from `freshnessState` directly. Reading the column here would
   * paint a pin green while the row beside it said "Needs checking" for the same
   * expired offer, and nothing would tell the user which to believe.
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
        address: `${location.description} · Sample`
      }));
    }

    if (itemOffers.length > 0) {
      return itemOffers.map((o) => ({
        id: o.id,
        placeId: o.placeId,
        placeName: o.placeName,
        placeType: o.placeType,
        lat: o.lat,
        lng: o.lng,
        address: o.address ?? "",
        detail: { confidenceLevel: offerSignal(o).kind }
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
  const routeTargetLat = getItTarget?.lat ?? null;
  const routeTargetLng = getItTarget?.lng ?? null;
  const handleOriginDisclosed = useEventCallback(
    (origin: DisclosedRouteOrigin) => {
      setRouteOrigin(origin);
    }
  );

  useEffect(() => {
    setRouteOrigin(null);
    setRoute(null);
  }, [getItTarget?.placeId]);

  useEffect(() => {
    setRoute(null);
    if (
      activeCategory !== "food" ||
      routeOrigin === null ||
      routeTargetLat === null ||
      routeTargetLng === null
    )
      return;

    const controller = new AbortController();
    void fetchRoute(
      routeOrigin,
      { lat: routeTargetLat, lng: routeTargetLng },
      controller.signal
    ).then((geometry) => {
      if (controller.signal.aborted) return;
      setRoute(geometry);
    });

    return () => controller.abort();
  }, [activeCategory, routeOrigin, routeTargetLat, routeTargetLng]);

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
        selectedPlaceId={
          activeCategory === "money" ? selectedExchangeLocationId : detailPlaceId
        }
        onMarkerClick={handleMarkerSelection}
        center={cameraCenter}
        selfIdentity={selfIdentity}
        route={route}
        /* At regular width the shell mounts no bottom sheet, so there is nothing
           below to compensate for, but the panel covers the leading edge, and
           without that padding a pin can be flown to and land behind it. */
        detent={isRegular ? null : activeDetent}
        padding={isRegular ? { left: leadingInset } : undefined}
        sharedUsers={[]}
      />

      {/* Floating controls. These sit directly on the map, so they use the
          translucent material rather than a solid surface, the map needs to
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
          {/* A control, not a label, hence `pointer-events-auto` against the
              stack's `pointer-events-none`, and the tap floors. `min-w-tap` is
              load-bearing now the label stands alone: the shortest area name in
              the db is "Ojo", which would otherwise collapse the width under
              44pt. The caveat for a manually picked area survives on the selected
              row in LocationSheet, at the point where it is actionable. */}
          <button
            type="button"
            onClick={() => openSurface({ kind: "location" })}
            aria-label={`Change location, currently ${location.label}`}
            className="pointer-events-auto flex h-11 min-w-tap items-center justify-center gap-1.5 squircle-full
                       material-thick px-2.5 shadow-raised active:opacity-60 transition-opacity duration-instant"
          >
            <MapPin aria-hidden="true" className="h-4 w-4 shrink-0 text-text-secondary" strokeWidth={2.25} />
            <span className="text-footnote font-medium text-text-primary">
              {location.label}
            </span>
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

      {/* Recenter. The shell publishes the live active detent inset; safe-area
          padding is additive so this remains reachable on gesture-navigation
          devices at every compact detent and on regular layouts. */}
      <div
        className="absolute right-4 z-10 pointer-events-none"
        style={{
          bottom:
            "calc(var(--shell-bottom-inset, 0px) + env(safe-area-inset-bottom, 0px) + 16px)"
        }}
      >
        <MapRecenterControl
          /* Recenter refreshes physical evidence and moves presentation state.
             It never mutates the persisted browsing/search context. */
          onLocate={(deviceLocation) => {
            setLocateError(null);
            if (!recordDeviceLocation(deviceLocation)) {
              setLocateError(
                "A newer device location is already active. The older response was ignored."
              );
              return;
            }
            setCameraCenter({
              lat: deviceLocation.lat,
              lng: deviceLocation.lng,
            });
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
          <div className="flex items-center space-x-2">
            <NigeriaLogo className="h-7 w-7" />
            <button
              onClick={() => setIsCategoryOpen(true)}
              className="flex h-11 items-center text-text-primary active:scale-98 transition-all duration-instant text-[14px] font-medium"
            >
              <span className="flex h-8 items-center gap-0.5 rounded-[14px] bg-fillSecondary px-2">
                <span>
                  {activeCategory === "money"
                    ? "Aboki FX"
                    : (t as Record<string, string>).category_food || "Food"}
                </span>
                <ChevronDown className="h-3 w-3 text-text-secondary" />
              </span>
            </button>
          </div>

          {/* Both actions present a sheet over this one rather than replacing
              its contents, so the search context stays put underneath. */}
          <div className="flex items-center gap-1.5">
            {activeCategory === "food" && (
              <button
                onClick={() => setIsReportOpen(true)}
                className="grid h-11 w-11 place-items-center text-text-primary
                           active:scale-90 transition-transform duration-instant"
                aria-label={t.report_price}
              >
                <span className="grid h-8 w-8 place-items-center rounded-full bg-fillSecondary">
                  <Plus className="h-[18px] w-[18px]" strokeWidth={2.5} />
                </span>
              </button>
            )}

            <button
              onClick={() => setIsProfileOpen(true)}
              className="grid h-11 w-11 place-items-center squircle-full
                         active:scale-90 transition-transform duration-instant"
              aria-label="Profile"
            >
              {/* The one piece of persistent recognition chrome in the app.
                  Without a name it drew the anonymous silhouette forever, so
                  signing in changed nothing anyone could see: you were
                  recognised only inside the sheet you had to reopen to check.
                  `||`, not `??`, email OTP mints users with name: "". */}
              <Avatar name={sessionUser ? sessionUser.name || sessionUser.email : undefined} url={userProfile?.avatarUrl} size={32} />
            </button>
          </div>
          </div>

          {activeCategory === "food" && (
          <SearchField
            value={searchQuery}
            onChange={handleSearchChange}
            onClear={clearSearch}
            placeholder={t.search_placeholder}
          />
        )}
      </div>

      {/* The app's level-0 scroller, sibling to NavigationStack's level-1
          scroller inside the same sheet; the two reserve their bottom strip the
          same way, and must keep agreeing.

          That reservation is the LARGER of two strips, never their sum.
          `--sheet-hidden` is the part of the sheet hanging below the viewport at
          the current detent, which BottomSheet publishes because only it knows
          the number. It starts at the viewport's bottom edge, so it already
          spans the home indicator, and adding the safe area to it would pad the
          same 34px twice. At `large` the sheet is docked, `--sheet-hidden` is 0,
          and the safe area is the whole reservation. 20px is the breathing room.
          The `0px` fallback is load-bearing, the regular shell mounts no
          BottomSheet, so the variable is undefined there and `max()` yields the
          safe area alone, the padding it has always had, with no branch on size
          class.

          `overscroll-contain` keeps an overscroll at either end of this list
          from chaining out to the document behind the sheet. It has no bearing
          on BottomSheet's wrapper box, which cannot scroll in the first place:
          that box's only child is `h-full`. */}
      <div
        className={`flex-1 overflow-y-auto overscroll-contain ${
          activeCategory === "food"
            ? "px-3 pb-[calc(max(var(--sheet-hidden,0px),var(--safe-area-bottom))+20px)]"
            : ""
        }`}
      >
        {activeCategory === "money" ? (
          <ExchangePanel
            origin={searchOrigin}
            locations={filteredExchangeLocations}
            filter={exchangeFilter}
            onFilterChange={(filter) => {
              setExchangeFilter(filter);
              setSelectedExchangeLocationId(null);
            }}
            selectedLocationId={selectedExchangeLocationId}
            onSelectLocation={handleSelectExchangeLocation}
          />
        ) : (
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
                  that already says Yaba. This was previously omitted, correctly,
                  at the time, because the query ignored location and a refetch
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

          {/* B. Search results. One branch, not two, the old "searching" branch
              rendered h-12 bars that stood in for ItemCards and jumped the layout
              the moment real rows arrived. */}
          {searchQuery && (
            <AsyncList
              items={searchResults}
              isLoading={isSearching}
              error={searchError}
              errorState={searchError ? { description: searchError } : undefined}
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
        )}
      </div>
    </div>
  );

  // 3. Place detail, level 1 of the navigation stack, in BOTH size classes.
  //
  // Not a sidebar and not desktop-only: RegularShell's right island is gone, so
  // both shells hand this node to the same NavigationStack, compact inside the
  // bottom sheet, regular inside the left panel.
  //
  // ONE way in: tapping a pin. The offer list hands off to GetItSheet directly
  // and never pushes this, because a level the user did not ask for stacks under
  // that modal and hides the map behind two full surfaces.
  //
  // Place → its items. Offer detail is NOT this axis and does not belong here;
  // ItemDetailSheet owns item → its places, on both shells.
  const detailNode = useMemo(() => {
    if (activeCategory !== "food" || !detailPlace) return undefined;

    const getItAction = (
      <div
        className={`stack-surface z-10 shrink-0 ${
          isRegular ? "static pt-1" : "static py-2"
        }`}
      >
        <Button
          variant="primary"
          size="md"
          className="w-full flex items-center justify-center"
          onClick={() =>
            setGetItTarget({
              placeId: detailPlace.id,
              placeName: detailPlace.name,
              lat: detailPlace.location.lat,
              lng: detailPlace.location.lng,
              address: detailPlace.address,
              areaName: location.label,
              // Reached from a pin, so there is no single price under test ,
              // and therefore nothing to confirm on the way back.
              offer: null
            })
          }
        >
          <Navigation className="h-4 w-4 mr-1.5" />
          Get it
        </Button>
      </div>
    );

    return (
      <div
        data-navigation-detail-bounded
        className="flex h-[calc(var(--navigation-detail-visible-height,100dvh)-24px)] min-h-0 flex-col gap-4 md:h-full md:overflow-hidden"
      >
        <div className="flex shrink-0 items-start justify-between">
          <div className="flex-1 pr-4">
            <h2 className="text-headline tracking-tight text-text-primary">{detailPlace.name}</h2>
            <p className="text-caption-1 text-text-secondary mt-1 flex items-center">
              <MapPin className="h-3.5 w-3.5 text-accent mr-1 shrink-0" />
              {/* From the user, not from the camera, this panel opens by
                  tapping a pin, which centres the camera ON that pin, so
                  measuring from `cameraCenter` printed "0 m away" for every
                  market you clicked. */}
              {formatDistance(
                getHaversineDistance(
                  searchOrigin.lat,
                  searchOrigin.lng,
                  detailPlace.location.lat,
                  detailPlace.location.lng
                )
              )}{" "}
              • {detailPlace.address || `${location.label}, Lagos`}
            </p>
          </div>
          <button
            onClick={() => setDetailPlaceId(null)}
            aria-label="Close"
            className="grid min-h-tap min-w-tap shrink-0 place-items-center rounded-full
                       text-text-secondary transition-colors hover:text-text-primary
                       focus-visible:outline-2 focus-visible:outline-offset-2
                       focus-visible:outline-accent"
          >
            <span className="grid h-8 w-8 place-items-center rounded-full bg-fillSecondary">
              <X className="h-4 w-4" />
            </span>
          </button>
        </div>

        {/* Compact keeps one persistent in-flow action after the place context.
            Prices own the only moving region beneath it, so rows never pass
            behind the action and the translated sheet creates no blank tail. */}
        {!isRegular ? getItAction : null}

        {/* What this market is currently selling. */}
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <h4 className="shrink-0 text-footnote text-text-secondary">
            Prices in market
          </h4>
          <div
            data-navigation-detail-scroller
            className="min-h-0 flex-1 overflow-y-auto overscroll-y-none pr-1"
          >
            <AsyncList
              items={placeOffers}
              isLoading={isPlaceOffersLoading}
              error={placeOffersError}
              onRetry={() => setPlaceOffersRetry((attempt) => attempt + 1)}
              subject={detailPlace.id}
              keyExtractor={(offer) => offer.id}
              renderItem={(offer) => <PlaceOfferRow offer={offer} />}
              skeleton={<PlaceOfferRowSkeleton />}
              empty={{
                icon: <MapPin className="h-6 w-6" />,
                title: "No prices here yet",
                description: "Nobody has reported a price at this market."
              }}
              errorState={{
                title: placeOffersError ?? "Could not load",
                description: "Check your network and try again.",
                retryLabel: "Try again"
              }}
            />
          </div>
        </div>

        {/* Regular preserves the action's established bottom placement. */}
        {isRegular ? getItAction : null}
      </div>
    );
  }, [
    activeCategory,
    detailPlace,
    isRegular,
    placeOffers,
    placeOffersError,
    isPlaceOffersLoading,
    searchOrigin,
    location.label,
    setDetailPlaceId
  ]);

  return (
    <div className="relative h-dvh w-full overflow-hidden">
      {/* `detailLabel` and `onDetailBack` name and pop level 1. Both are driven
          by the same `detailPlaceId` that gates `detailNode`, so the level, its
          title and its back button cannot disagree about what is open. */}
      <AdaptiveShell
        mapNode={mapNode}
        sheetNode={sheetNode}
        detailNode={detailNode}
        detailLabel={detailPlace?.name}
        onDetailBack={() => setDetailPlaceId(null)}
        activeDetent={activeDetent}
        setActiveDetent={setActiveDetent}
      />

      {/* Progressive reveal: each task presents its own surface over the map
          and the results sheet, instead of taking their place. */}

      {/* rice → long-grain → 50 kg bag → ranked offers. */}
      <ItemDetailSheet
        open={activeCategory === "food" && Boolean(detailItem)}
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
        open={activeCategory === "food" && Boolean(getItTarget)}
        onClose={() => setGetItTarget(null)}
        target={getItTarget}
        onOriginDisclosed={handleOriginDisclosed}
        onGoThere={handleArmVisit}
      />

      {/* The trip becomes an answer. This is the part that compounds. */}
      <ConfirmVisitSheet
        open={activeCategory === "food" && Boolean(pendingVisit)}
        visit={pendingVisit}
        onClose={() => setPendingVisit(null)}
        lang={locale}
      />

      {/* The presentation spine: the four controller surfaces (location, my
          reports, report a problem, about), each gated by `surface`. One is open
          at a time, so opening any of them closes the others and none peeks above
          the next, and this is where a hash deep-link surfaces. */}
      <PresentationHost
        surface={surface}
        onClose={closeSurface}
        radiusKm={activeRadiusKm}
        onCommitLocation={(coords) => setCameraCenter(coords)}
        signedIn={Boolean(sessionUser)}
        onReportPrice={() => {
          // The empty-state exit from My reports: close this surface, then open
          // the report-price sheet, which stays page.tsx's own boolean.
          closeSurface();
          setIsReportOpen(true);
        }}
        manageProfileUser={sessionUser}
        onSessionChange={refetchSession}
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
        onChangeArea={() => openSurface({ kind: "location" })}
        onOpenMyReports={() => openSurface({ kind: "my-reports" })}
        onOpenReportProblem={() => openSurface({ kind: "report-problem" })}
        onOpenAbout={() => openSurface({ kind: "about" })}
        onOpenManageProfile={() => openSurface({ kind: "manage-profile" })}
        currentAreaName={location.label}
        user={sessionUser}
        onSessionChange={refetchSession}
      />

      <ReportPriceSheet
        open={activeCategory === "food" && isReportOpen}
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
      />

      <CategorySelectorSheet
        open={isCategoryOpen}
        onClose={() => setIsCategoryOpen(false)}
        activeCategory={activeCategory}
        onCategoryChange={handleCategoryChange}
        t={t}
      />
    </div>
  );
}
