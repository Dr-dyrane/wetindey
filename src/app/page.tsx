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
import { AlertTriangle, MapPin, Navigation, Sun, Moon, X, Plus } from "lucide-react";

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
import { DETENT_FRACTION, type Detent } from "@/design-system/components/BottomSheet";
import { useModalPresented } from "@/design-system/components/ModalSheet";
import { AsyncList } from "@/design-system/components/AsyncList";
import { NigeriaLogo } from "@/design-system/components/NigeriaLogo";
import { ItemCard, PhotoCredits, type ItemCardData } from "@/design-system/components/ItemCard";
import { SettingsSheet } from "@/app/_components/SettingsSheet";
import { ReportPriceSheet } from "@/app/_components/ReportPriceSheet";
import { ProfileSheet, Avatar } from "@/app/_components/ProfileSheet";
import { ItemDetailSheet, offerSignal } from "@/app/_components/ItemDetailSheet";
import { PresentationHost } from "@/app/_components/PresentationHost";
import { formatNaira } from "@/lib/money";
import { GetItSheet, type GetItTarget } from "@/app/_components/GetItSheet";
import {
  ConfirmVisitSheet,
  armVisit,
  takeDueVisit,
  flushPendingVisitConfirmations,
  type VisitContext
} from "@/app/_components/ConfirmVisitSheet";

import { useTheme } from "@/core/context/ThemeContext";
import { usePresentation } from "@/core/navigation/usePresentation";
import { useGlobalStore } from "@/core/state/globalStore";
import { useLocationChrome, useLocationHydration, useLocationStore } from "@/core/state/locationStore";
import { useLocaleControl, useStrings } from "@/core/i18n";
import { useEventCallback } from "@/lib/perf";
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
import { fetchRoute } from "@/lib/directions";

/**
 * A price report typed while offline, waiting for a connection.
 *
 * `attempts` is what stops a payload the server will never accept from replaying
 * on every reconnect for the life of the install. Optional because entries
 * queued by an older build carry none, `?? 0` reads those as fresh rather than
 * dropping someone's report for having been queued yesterday.
 */
interface PendingObservation {
  placeId: string;
  itemVariantId: string;
  unitId: string;
  priceAmount: number;
  availabilityState: "available" | "unavailable";
  attempts?: number;
}

/** Matches ConfirmVisitSheet's MAX_ATTEMPTS. The two queues drain together in one
 *  function; they should give up together too. */
const MAX_OBSERVATION_ATTEMPTS = 3;

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
  const { mapCenter, setMapCenter, activeRadiusKm, setActiveRadiusKm } = useGlobalStore();

  useLocationHydration();
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
        // Settled, and we know nothing, NOT "never fetched". Without this the
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
          const queue = JSON.parse(cached) as PendingObservation[];

          if (queue.length > 0) {
            /**
             * PER-ENTRY, and the whole bug was where `removeItem` used to sit.
             *
             * It was AFTER the loop, with the loop inside one try/catch. So entry
             * 3 of 5 throwing skipped it, while entries 1 and 2 had already
             * COMMITTED. The queue survived intact and replayed both on the next
             * reconnect, and every reconnect after that, because the poisoned
             * entry never drained. `observations` is append-only, so each replay
             * is permanent: it inflates the evidence behind a price with copies of
             * a single report, which is exactly what the trust model cannot see.
             *
             * A network blip was enough to start it. With accounts it stops being
             * a blip, tokens expire on a schedule, so a 401 mid-queue is the
             * routine case, and the duplicates would carry an author.
             *
             * This is not a new mechanism. `flushPendingVisitConfirmations`
             * (ConfirmVisitSheet.tsx) has done it correctly since it was written:
             * per-entry try/catch, a keep list, an attempts counter, a ceiling.
             * The two queues drain side by side in this same function, one right,
             * one wrong. Ported, not reinvented.
             */
            const keep: PendingObservation[] = [];
            let sent = 0;

            for (const item of queue) {
              try {
                const { attempts: _a, ...payload } = item;
                await submitObservation(payload);
                sent++;
              } catch (err) {
                const attempts = (item.attempts ?? 0) + 1;
                if (attempts >= MAX_OBSERVATION_ATTEMPTS) {
                  // Dropped, and said out loud. An entry the server refuses three
                  // times is not a network problem, it is a bad payload, and
                  // retrying it forever costs a round-trip per reconnect forever.
                  // Silence here is how a lost price report becomes invisible by
                  // construction.
                  console.error(
                    `Dropping a queued price report after ${attempts} attempts; the server refused it.`,
                    err
                  );
                } else {
                  keep.push({ ...item, attempts });
                }
              }
            }

            if (keep.length > 0) {
              localStorage.setItem("pending_observations", JSON.stringify(keep));
            } else {
              localStorage.removeItem("pending_observations");
            }
            changed = sent > 0;
          }
        } catch (err) {
          // Only the parse and the storage write reach here now, a failing
          // submit is handled per entry above.
          console.error("Failed to read the offline price report queue:", err);
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
  }, [detailPlaceId]);

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
   * at once. The camera is `setMapCenter`'s job and needs nothing from the atom.
   *
   * The narrowed pins in `itemOffers` are deliberately left standing: they are
   * what remains visible behind the modal, and the geometry any route drawn
   * between origin and offer would need.
   */
  const handleSelectOffer = useEventCallback((offer: NarrowedOffer) => {
    const signal = offerSignal(offer, Date.now());

    setDetailItem(null);
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
   * render, and it is a dependency of MapboxCanvas's marker effect, which
   * clears and rebuilds every pin when it re-runs. Every unrelated re-render
   * (a keystroke, a focus) tore down and reconstructed the whole map.
   */
  const handleMarkerSelection = useEventCallback((placeId: string) => {
    // The pin flow, and the one place the pushed level is right: the user asked
    // for this market by tapping it, so its prices are where they were going.
    setDetailPlaceId(placeId);
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
    setDetailPlaceId(null);
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
        const queue: PendingObservation[] = cached ? JSON.parse(cached) : [];
        // Stamped at ENQUEUE, or the counter the drain reads never starts.
        queue.push({ ...payload, attempts: 0 });
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
        // `popularItems` at all, so reporting a price from the landing screen,
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
  const routeTargetLat = getItTarget?.lat ?? null;
  const routeTargetLng = getItTarget?.lng ?? null;
  useEffect(() => {
    setRoute(null);
    if (routeTargetLat === null || routeTargetLng === null) return;

    const controller = new AbortController();
    void fetchRoute(
      { lat: locPosition.lat, lng: locPosition.lng },
      { lat: routeTargetLat, lng: routeTargetLng },
      controller.signal
    ).then((geometry) => {
      if (controller.signal.aborted) return;
      setRoute(geometry);
    });

    return () => controller.abort();
  }, [routeTargetLat, routeTargetLng, locPosition.lat, locPosition.lng]);

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
        selectedPlaceId={detailPlaceId}
        onMarkerClick={handleMarkerSelection}
        center={mapCenter}
        route={route}
        /* At regular width the shell mounts no bottom sheet, so there is nothing
           below to compensate for, but the panel covers the leading edge, and
           without that padding a pin can be flown to and land behind it. */
        detent={isRegular ? null : activeDetent}
        padding={isRegular ? { left: leadingInset } : undefined}
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
            aria-label="Change location"
            className="pointer-events-auto flex min-h-tap min-w-tap items-center justify-center squircle-full
                       material-thick px-3 py-1.5 shadow-raised active:opacity-60 transition-opacity duration-instant"
          >
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

      {/* Recenter. Parked above the peek detent so the sheet never covers it ,
          the fraction is imported rather than typed as "20vh", so retuning the
          detent moves this with it. */}
      <div
        className="absolute right-4 z-10 pointer-events-none"
        style={{ bottom: isRegular ? "1rem" : `calc(${DETENT_FRACTION.peek * 100}vh + 16px)` }}
      >
        <MapRecenterControl
          /* recenterTo ONLY. Writing the position to the store here would fire
             the mapCenter effect above, and its state-driven flyTo would land a
             commit later and interrupt this animation mid-flight, freezing the
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
              aria-label="Profile"
            >
              {/* The one piece of persistent recognition chrome in the app.
                  Without a name it drew the anonymous silhouette forever, so
                  signing in changed nothing anyone could see: you were
                  recognised only inside the sheet you had to reopen to check.
                  `||`, not `??`, email OTP mints users with name: "". */}
              <Avatar name={sessionUser ? sessionUser.name || sessionUser.email : undefined} size={32} />
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
      <div className="flex-1 overflow-y-auto overscroll-contain px-3 pb-[calc(max(var(--sheet-hidden,0px),var(--safe-area-bottom))+20px)]">
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
    if (!detailPlace) return undefined;

    return (
      <div className="space-y-5 h-full flex flex-col justify-between">
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex-1 pr-4">
              <h2 className="text-headline tracking-tight text-text-primary">{detailPlace.name}</h2>
              <p className="text-caption-1 text-text-secondary mt-1 flex items-center">
                <MapPin className="h-3.5 w-3.5 text-accent mr-1 shrink-0" />
                {/* From the user, not from the camera, this panel opens by
                    tapping a pin, which centres the camera ON that pin, so
                    measuring from `mapCenter` printed "0 m away" for every
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
              subject={detailPlace.id}
              keyExtractor={(offer) => offer.id}
              className="max-h-[40vh] overflow-y-auto pr-1"
              renderItem={(offer) => (
                <div className="p-3 squircle bg-fillTertiary flex items-center justify-between">
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
                      {formatNaira(offer.priceMin)}
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
      </div>
    );
  }, [
    detailPlace,
    placeOffers,
    placeOffersError,
    isPlaceOffersLoading,
    searchOrigin,
    location.label,
    setDetailPlaceId
  ]);

  return (
    <div className="relative w-full h-full min-h-screen overflow-hidden">
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

      {/* The presentation spine: the four controller surfaces (location, my
          reports, report a problem, about), each gated by `surface`. One is open
          at a time, so opening any of them closes the others and none peeks above
          the next, and this is where a hash deep-link surfaces. */}
      <PresentationHost
        surface={surface}
        onClose={closeSurface}
        radiusKm={activeRadiusKm}
        onCommitLocation={(coords) => setMapCenter(coords)}
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
