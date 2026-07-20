"use client";

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState
} from "react";
import { LocateFixed, LoaderCircle } from "lucide-react";
import {
  MapboxAdapter,
  ZERO_PADDING,
  type MapPadding,
  type RouteGeometry,
  type RouteTint,
  type ScreenPoint,
  type MapStyleLifecycleState,
  type UserPositionPrecision
} from "@/integrations/maps/MapboxAdapter";
import {
  DETENT_FRACTION,
  type Detent,
  type MapRetryCapability
} from "./BottomSheet";
import type { SharedUserLocation } from "@/app/_actions/actions";
import { useTheme } from "@/core/context/ThemeContext";
import {
  acquireDeviceLocation,
  useFreshDeviceLocation,
  type DeviceLocation
} from "@/core/state/locationStore";
import { motion, useReducedMotion } from "@/design-system/motion";
import { MapLoading, MapFailed } from "./MapLoader";

interface MapMarkerData {
  id: string;
  placeId: string;
  placeName: string;
  placeType?: string | null;
  lat: number;
  lng: number;
  detail?: {
    confidenceLevel: string;
  };
  address?: string;
}

interface MapboxCanvasProps {
  candidates: MapMarkerData[];
  selectedPlaceId: string | null;
  onMarkerClick: (placeId: string) => void;
  center: { lat: number; lng: number };
  selfIdentity: {
    name: string;
    avatarUrl: string | null;
  } | null;
  /**
   * The area the user is exploring when no fresh device fix exists. This is
   * rendered as identity context, never as a physical-location claim.
   */
  browsingAnchor: {
    lat: number;
    lng: number;
    label: string;
  };
  /**
   * How far the bottom sheet is up. The camera compensates for it, so anything
   * we fly to lands in the strip of map the user can actually see. `null` for
   * layouts with no bottom sheet (the desktop sidebar) — pass `padding.left`
   * there instead.
   */
  detent?: Detent | null;
  /**
   * Per-edge occlusion override, in CSS px. Anything omitted falls back to the
   * derived value (`bottom` from the detent, `top` from MAP_TOP_CHROME).
   */
  padding?: Partial<MapPadding>;
  /**
   * The line connecting the user to whatever they are heading for, as ordered
   * `[lng, lat]` pairs. `null`/omitted draws nothing.
   *
   * GEOMETRY, not a request. This component never asks anyone for a route and
   * deliberately cannot: who computes it is the caller's business and is not
   * knowable here. Anything that yields a GeoJSON LineString can be handed
   * straight down, which is what keeps the source replaceable.
   *
   * Identity matters, as with `candidates` — memoise it, or every render
   * re-applies the layer.
   */
  route?: RouteGeometry | null;
  /**
   * Which token colours the route. A colour selector, not a status: no route
   * status model exists, and this is only the seam able to carry one later.
   */
  routeTint?: RouteTint;
  sharedUsers?: SharedUserLocation[];
  onRetryCapabilityChange?: (capability: MapRetryCapability | null) => void;
}

export interface MapCanvasStyleState {
  status: MapStyleLifecycleState["status"];
  generation: number;
}

export const INITIAL_MAP_CANVAS_STYLE_STATE: MapCanvasStyleState = {
  status: "loading",
  generation: 0,
};

export interface MapCanvasRuntimeState {
  adapterEpoch: number;
  adapterReady: boolean;
  libraryFailed: boolean;
  style: MapCanvasStyleState;
}

export type MapCanvasRuntimeEvent =
  | { type: "adapter-started"; adapterEpoch: number }
  | { type: "adapter-ready"; adapterEpoch: number }
  | { type: "library-failed"; adapterEpoch: number }
  | { type: "retry-library"; adapterEpoch: number }
  | {
      type: "style-lifecycle";
      adapterEpoch: number;
      lifecycle: MapStyleLifecycleState;
    };

export const INITIAL_MAP_CANVAS_RUNTIME_STATE: MapCanvasRuntimeState = {
  adapterEpoch: 0,
  adapterReady: false,
  libraryFailed: false,
  style: INITIAL_MAP_CANVAS_STYLE_STATE,
};

/**
 * Canvas is the overlay owner, so it independently rejects stale Adapter
 * callbacks. A late ready for the current generation may heal failure; a late
 * failure may never cover a frame that generation already proved usable.
 */
export function reduceMapCanvasStyleState(
  current: MapCanvasStyleState,
  event: MapStyleLifecycleState
): MapCanvasStyleState {
  if (event.generation < current.generation) return current;
  if (
    event.generation === current.generation &&
    current.status === "ready" &&
    event.status === "failed"
  ) {
    return current;
  }
  return { status: event.status, generation: event.generation };
}

/**
 * Adapter construction and style readiness used to update independent React
 * states. A recovered Adapter could therefore report `ready` while a stale
 * library failure continued to win `mapCanvasOverlay` and paint the failure
 * card. Keep those authorities in one reducer, and identify every callback by
 * the Adapter epoch that installed it.
 */
export function reduceMapCanvasRuntimeState(
  current: MapCanvasRuntimeState,
  event: MapCanvasRuntimeEvent
): MapCanvasRuntimeState {
  if (event.type === "adapter-started") {
    if (event.adapterEpoch <= current.adapterEpoch) return current;
    return {
      adapterEpoch: event.adapterEpoch,
      adapterReady: false,
      libraryFailed: false,
      style: INITIAL_MAP_CANVAS_STYLE_STATE,
    };
  }

  if (event.adapterEpoch !== current.adapterEpoch) return current;

  if (event.type === "adapter-ready") {
    return {
      ...current,
      adapterReady: true,
      libraryFailed: false,
    };
  }

  if (event.type === "library-failed") {
    return {
      ...current,
      adapterReady: false,
      libraryFailed: true,
    };
  }

  if (event.type === "retry-library") {
    return {
      ...current,
      adapterReady: false,
      libraryFailed: false,
      style: INITIAL_MAP_CANVAS_STYLE_STATE,
    };
  }

  const style = reduceMapCanvasStyleState(current.style, event.lifecycle);
  if (style === current.style) return current;
  return {
    ...current,
    // A current Adapter proving a current generation usable is stronger than
    // stale initialization failure. Loading/failed style events do not alter
    // the separate library authority.
    adapterReady: event.lifecycle.status === "ready" ? true : current.adapterReady,
    libraryFailed: event.lifecycle.status === "ready" ? false : current.libraryFailed,
    style,
  };
}

export function mapCanvasOverlay(
  adapterReady: boolean,
  libraryFailed: boolean,
  style: MapCanvasStyleState
): "loading" | "failed" | null {
  if (libraryFailed || style.status === "failed") return "failed";
  if (!adapterReady || style.status === "loading") return "loading";
  return null;
}

/** Above this browser-reported radius, the halo receives approximate treatment. */
const APPROXIMATE_DEVICE_ACCURACY_M = 100;

/**
 * The map chrome — location pill and theme toggle — floats at
 * `safe-area-top + 12` and stands 44px tall, so this much of the top of the
 * canvas is spoken for.
 *
 * 44, not the 36 an earlier version of this comment claimed: the theme toggle is
 * 36px (`h-9`), but the location pill beside it carries `min-h-tap` — 44px, from
 * tailwind.config.ts:106 — and the row is `items-start`, so the taller of the two
 * sets the height (page.tsx:998-1018). 12 + 44 = 56; the extra 4px here is slack.
 *
 * Kept as a constant rather than measured: measuring here would couple the camera
 * to page.tsx's DOM, and the number is stable enough that the coupling costs more
 * than it buys.
 *
 * An earlier version of this comment claimed the opposite of what the code does —
 * that the constant "is only load-bearing at the large detent, where it is clamped
 * away anyway", which manages to be backwards twice and self-contradictory once.
 * Traced through `sheetMapPadding`'s clamp below, at an 876px viewport: peek and
 * medium both leave far more headroom than 60, so `top` comes out at 60 — the
 * constant applies VERBATIM, and those are precisely the detents where a top band
 * still exists to protect. At large the sheet covers 94%, the clamp's ceiling
 * collapses to single digits, and `top` lands near 9: MIN_VISIBLE_BAND wins and
 * this constant is the thing that yields. It is load-bearing everywhere EXCEPT
 * large — the exact inverse of what was written here.
 *
 * (Recompute rather than trust these figures if a detent is retuned. The first
 * draft of this correction quoted a peek bound derived from DETENT_FRACTION.peek
 * = 0.12; the real value is 0.20. The conclusion held, the arithmetic did not.)
 */
const MAP_TOP_CHROME = 60;

/**
 * The visible box is never allowed to collapse. At the large detent the sheet
 * covers 94% of the screen, so honouring both the sheet AND the top chrome would
 * ask for a negative viewport, and Mapbox would happily place the centre off the
 * top of the canvas. The sheet wins; the top chrome yields.
 */
const MIN_VISIBLE_BAND = 44;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * The occlusion the camera must compensate for, in canvas pixels.
 *
 * The fractions come from BottomSheet — imported, never re-typed: a second copy
 * of 0.52 would drift the moment a detent is retuned, and the failure mode
 * (camera centring slightly behind the sheet) is exactly the kind of thing
 * nobody files a bug for.
 *
 * Deliberate approximation: at peek and medium the sheet floats 10px clear of
 * the bottom edge, so it truly occludes `fraction * vh + 10`. We pad by
 * `fraction * vh`, which biases the centre 5px lower than perfect — a quarter of
 * a marker's radius. Reproducing BottomSheet's private island/dock geometry to
 * recover those 5px would create the very duplication this file avoids.
 */
function sheetMapPadding(
  detent: Detent | null | undefined,
  viewportHeight: number,
  overrides: Partial<MapPadding> = {}
): MapPadding {
  if (viewportHeight <= 0) return { ...ZERO_PADDING, ...overrides };

  const covered = detent ? DETENT_FRACTION[detent] * viewportHeight : 0;
  const bottom = clamp(
    overrides.bottom ?? covered,
    0,
    Math.max(0, viewportHeight - MIN_VISIBLE_BAND)
  );
  const top = clamp(
    overrides.top ?? MAP_TOP_CHROME,
    0,
    Math.max(0, viewportHeight - bottom - MIN_VISIBLE_BAND)
  );

  return { top, bottom, left: overrides.left ?? 0, right: overrides.right ?? 0 };
}

/** Imperative camera access for chrome that lives outside this component. */
export interface MapCameraHandle {
  /** Fly to a point at a legible zoom, above whatever is covering the map. */
  recenterTo(lat: number, lng: number, zoom?: number): void;
  /** Where a coordinate currently lands on screen, in canvas px. */
  projectPoint(lat: number, lng: number): ScreenPoint | null;
  /** The occlusion the camera is currently compensating for. */
  getPadding(): MapPadding;
}

/**
 * Resolve the Mapbox GL global, waiting for it if it has not arrived yet.
 *
 * Mapbox GL is loaded from a CDN with `defer` (layout.tsx). A deferred script is
 * only guaranteed to run before DOMContentLoaded — it is NOT guaranteed to run
 * before React hydrates and fires effects. On a slow network the effect wins the
 * race, `window.mapboxgl` is undefined, and the previous code logged a warning
 * and returned. There was no retry and no fallback, so the map stayed dead for
 * the rest of the session — the intermittent "map no longer renders" report.
 *
 * Polled rather than hooked to the script's onload: we don't own the tag, and a
 * load listener attached after the script already ran would never fire.
 */
function whenMapboxReady(timeoutMs = 10_000): Promise<unknown | null> {
  const w = window as unknown as { mapboxgl?: unknown };
  if (w.mapboxgl) return Promise.resolve(w.mapboxgl);

  return new Promise((resolve) => {
    const started = Date.now();
    const tick = () => {
      if (w.mapboxgl) return resolve(w.mapboxgl);
      if (Date.now() - started > timeoutMs) return resolve(null);
      window.setTimeout(tick, 60);
    };
    tick();
  });
}

export const MapboxCanvas = forwardRef<MapCameraHandle, MapboxCanvasProps>(function MapboxCanvas(
  {
    candidates,
    selectedPlaceId,
    onMarkerClick,
    center,
    selfIdentity,
    browsingAnchor,
    detent = null,
    padding,
    route = null,
    routeTint,
    sharedUsers = [],
    onRetryCapabilityChange
  },
  ref
) {
  const { theme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const adapterRef = useRef<MapboxAdapter | null>(null);
  const adapterEpochRef = useRef(0);
  const initialCenterRef = useRef(center);
  const [runtimeState, dispatchRuntime] = useReducer(
    reduceMapCanvasRuntimeState,
    INITIAL_MAP_CANVAS_RUNTIME_STATE
  );
  const { adapterReady: ready, libraryFailed: failed, style: styleState } = runtimeState;
  /** Bumped by 'Try again'; re-runs the init effect. */
  const [attempt, setAttempt] = useState(0);

  /**
   * Viewport height in px. The sheet expresses itself in vh; the camera needs
   * pixels. Measured in a layout effect so the first painted frame is already
   * padded, and re-measured on resize because the padding is a fraction of it —
   * a rotation with stale vh would centre on the wrong band.
   */
  const [viewportHeight, setViewportHeight] = useState(0);
  useLayoutEffect(() => {
    const measure = () => setViewportHeight(window.innerHeight);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const { top: padTop, right: padRight, bottom: padBottom, left: padLeft } = padding ?? {};
  const mapPadding = useMemo(
    () =>
      sheetMapPadding(detent, viewportHeight, {
        ...(padTop === undefined ? {} : { top: padTop }),
        ...(padRight === undefined ? {} : { right: padRight }),
        ...(padBottom === undefined ? {} : { bottom: padBottom }),
        ...(padLeft === undefined ? {} : { left: padLeft })
      }),
    [detent, viewportHeight, padTop, padRight, padBottom, padLeft]
  );

  /** Read by the async init, which resolves after this may have changed. */
  const paddingRef = useRef(mapPadding);
  paddingRef.current = mapPadding;

  // Initialize once the library is actually available.
  useEffect(() => {
    let cancelled = false;
    const adapterEpoch = ++adapterEpochRef.current;
    dispatchRuntime({ type: "adapter-started", adapterEpoch });

    whenMapboxReady().then((gl) => {
      if (cancelled || !containerRef.current) return;
      if (!gl) {
        dispatchRuntime({ type: "library-failed", adapterEpoch });
        return;
      }
      const accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || "";
      const adapter = new MapboxAdapter(accessToken);
      adapterRef.current = adapter;
      adapter.setStyleLifecycleListener((state) => {
        if (!cancelled && adapterRef.current === adapter) {
          dispatchRuntime({
            type: "style-lifecycle",
            adapterEpoch,
            lifecycle: state,
          });
        }
      });
      // Read the theme at init, not at first render: ThemeContext resolves
      // localStorage in an effect, so a ref captured during render is always
      // "light" and the map would flash the wrong basemap.
      const t = document.documentElement.classList.contains("dark") ? "dark" : "light";
      try {
        adapter.initialize(
          containerRef.current,
          initialCenterRef.current,
          14.5,
          t,
          paddingRef.current
        );
      } catch {
        adapter.destroy();
        if (adapterRef.current === adapter) adapterRef.current = null;
        dispatchRuntime({ type: "library-failed", adapterEpoch });
        return;
      }
      // Flips marker/camera effects once the adapter exists. Style completion
      // has its own state above: markers are DOM and must not be rebuilt merely
      // because the basemap is swapping underneath them.
      dispatchRuntime({ type: "adapter-ready", adapterEpoch });
    });

    return () => {
      cancelled = true;
      adapterRef.current?.destroy();
      adapterRef.current = null;
    };
  }, [attempt]);

  /**
   * Keep the camera's idea of the viewport in step with the sheet.
   *
   * Animated, except for the first application after init — the map opens
   * already padded (initialize takes it), so easing here on mount would slide
   * the world sideways on load for no reason. Never reset: `ready` only ever
   * goes false → true, and a retry re-initialises through `initialize`, which
   * takes the padding directly.
   */
  const paddingSettled = useRef(false);
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    const adapter = adapterRef.current;
    if (!adapter) return;
    adapter.setPadding(mapPadding, { animate: paddingSettled.current });
    paddingSettled.current = true;
  }, [mapPadding, ready]);

  // Update map center when global coordinate changes, except when framing an active route
  const { lat, lng } = center;
  useEffect(() => {
    if (route && route.length >= 2) return;
    adapterRef.current?.setCenter(lat, lng);
  }, [lat, lng, route, ready]);

  // The map is the base layer of the UI, so it follows the app theme.
  // `ready` is in the deps because the adapter is created asynchronously: at
  // mount there is nothing to call, and without re-running here a dark session
  // would keep the light basemap it was initialised with.
  useEffect(() => {
    adapterRef.current?.setTheme(theme === "dark" ? "dark" : "light");
  }, [theme, ready]);

  // Update pins on the map whenever candidate details change
  useEffect(() => {
    const adapter = adapterRef.current;
    if (!adapter) return;

    adapter.clearMarkers();

    candidates.forEach((candidate) => {
      adapter.addMarker({
        id: candidate.placeId,
        lat: candidate.lat,
        lng: candidate.lng,
        label: candidate.placeName,
        placeType: candidate.placeType,
        selected: candidate.placeId === selectedPlaceId,
        status: candidate.detail
          ? (candidate.detail.confidenceLevel === "confirmed"
              ? "confirmed"
              : candidate.detail.confidenceLevel === "caution"
                ? "caution"
                : "unavailable")
          : "neutral",
        onClick: () => onMarkerClick(candidate.placeId)
      });
    });
  }, [candidates, onMarkerClick, ready, selectedPlaceId]);

  /**
   * Fresh GPS is authoritative. Without it, retain the user's identity at the
   * browsing anchor so routes have a visible origin, while the accessible label
   * and broad halo explicitly avoid claiming physical precision.
   */
  const deviceLocation = useFreshDeviceLocation();
  useEffect(() => {
    const adapter = adapterRef.current;
    if (!adapter) return;
    if (!deviceLocation) {
      adapter.setUserPosition({
        lat: browsingAnchor.lat,
        lng: browsingAnchor.lng,
        precision: "approximate",
        accuracyM: 500,
        identity: selfIdentity,
        label: `Your browsing location near ${browsingAnchor.label}, not your current GPS location`,
      });
      return;
    }
    const precision: UserPositionPrecision =
      deviceLocation.accuracyM <= APPROXIMATE_DEVICE_ACCURACY_M
        ? "precise"
        : "approximate";
    const roundedAccuracy = Math.max(1, Math.round(deviceLocation.accuracyM));
    adapter.setUserPosition({
      lat: deviceLocation.lat,
      lng: deviceLocation.lng,
      precision,
      accuracyM: deviceLocation.accuracyM,
      identity: selfIdentity,
      label:
        precision === "precise"
          ? `Your current location, accurate to about ${roundedAccuracy} metres`
          : `Your approximate current location, accurate to about ${roundedAccuracy} metres`
    });
  }, [
    browsingAnchor.label,
    browsingAnchor.lat,
    browsingAnchor.lng,
    deviceLocation,
    selfIdentity,
    ready,
  ]);

  // Render other location-sharing users on the map
  useEffect(() => {
    const adapter = adapterRef.current;
    if (!adapter) return;
    adapter.setSharedUserMarkers(sharedUsers);
  }, [sharedUsers, ready]);

  /**
   * The route is geometry the caller owns; this hands it to the layer AND
   * frames it.
   *
   * The framing is the owner's ask: when the user and the seller are joined by
   * a line, both ends have to stay on the map the user can actually see. Until
   * now the camera ignored the route entirely — it drew and nothing moved, so a
   * seller across Lagos ran the line off the viewport with neither end framed.
   *
   * It lives HERE rather than in page.tsx because this is where the route
   * arrives and where the padding is already known, so the fit needs nothing
   * from the caller. That also keeps the rule the file already states: the
   * camera follows the position, the position never follows the camera. This is
   * the camera reacting to geometry, not a caller driving it.
   *
   * Keyed on `route` identity, deliberately: `mapPadding` is NOT in the deps.
   * Re-fitting every time the sheet moves would fight the user's own drag. We
   * frame immediately, then once more after the shared sheet transition has
   * settled so a newly opened detail sheet cannot leave either endpoint
   * outside the final visible map band.
   */
  useEffect(() => {
    const adapter = adapterRef.current;
    if (!adapter) return;
    adapter.setRoute(route, routeTint ? { tint: routeTint } : undefined);
    if (!route || route.length < 2) return;

    adapter.fitRoute(route);
    if (reducedMotion) return;

    const settleTimer = window.setTimeout(() => {
      if (adapterRef.current === adapter) adapter.fitRoute(route);
    }, motion.duration.slow);

    return () => window.clearTimeout(settleTimer);
  }, [route, routeTint, ready, reducedMotion]);

  useImperativeHandle(
    ref,
    (): MapCameraHandle => ({
      recenterTo: (recenterLat, recenterLng, zoom) =>
        adapterRef.current?.recenterTo(recenterLat, recenterLng, zoom),
      projectPoint: (projectLat, projectLng) =>
        adapterRef.current?.projectPoint(projectLat, projectLng) ?? null,
      getPadding: () => adapterRef.current?.getPadding() ?? { ...ZERO_PADDING }
    }),
    // No `ready` dependency, unlike the effects above: these close over a ref
    // and read it at CALL time, so the handle is correct before the adapter
    // exists (it no-ops) and correct after, without being rebuilt.
    []
  );

  const retryMap = useCallback(() => {
    if (failed) {
      dispatchRuntime({
        type: "retry-library",
        adapterEpoch: runtimeState.adapterEpoch,
      });
      setAttempt((currentAttempt) => currentAttempt + 1);
      return;
    }
    adapterRef.current?.retryStyle();
  }, [failed, runtimeState.adapterEpoch]);

  const overlay = mapCanvasOverlay(ready, failed, styleState);

  React.useLayoutEffect(() => {
    onRetryCapabilityChange?.(
      overlay === "failed" ? { onRetry: retryMap } : null
    );

    return () => {
      onRetryCapabilityChange?.(null);
    };
  }, [onRetryCapabilityChange, overlay, retryMap]);

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* The container must stay mounted underneath: Mapbox attaches to this
          node, so unmounting it while loading would give the adapter nothing to
          initialise into. The placeholders sit ON TOP and peel away. */}
      <div ref={containerRef} className="h-full w-full" />
      {overlay === "loading" && <MapLoading />}
      {overlay === "failed" && (
        <MapFailed onRetry={retryMap} />
      )}
    </div>
  );
});

interface MapRecenterControlProps {
  /** A freshly acquired physical fix. The caller records it and moves camera state. */
  onLocate: (position: DeviceLocation) => void;
  /** Geolocation refused, unavailable or timed out. Surface it — do not swallow. */
  onError?: (message: string) => void;
  className?: string;
}

/**
 * Map chrome: "put me back where I am".
 *
 * Owns the acquisition, not the camera. Every caller needs the same
 * permission/pending/failure dance around `navigator.geolocation`, and none of
 * them need it differently — but where the camera should go afterwards IS
 * caller-specific (a place detail may want to recentre on the place, not the
 * user), so the fix is `onLocate` rather than a map reference held in here.
 */
export function MapRecenterControl({ onLocate, onError, className = "" }: MapRecenterControlProps) {
  const [locating, setLocating] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const locate = useCallback(() => {
    if (locating) return;
    setLocating(true);
    void acquireDeviceLocation({
      enableHighAccuracy: true,
      timeoutMs: 15_000,
      // Recenter means refresh, never reuse a cached physical claim.
      maximumAgeMs: 0,
    }).then((result) => {
      if (!mounted.current) return;
      setLocating(false);
      if (!result.ok) {
        onError?.(`${result.problem.title}. ${result.problem.message}`);
        return;
      }
      onLocate(result.location);
    });
  }, [locating, onLocate, onError]);

  return (
    <button
      type="button"
      onClick={locate}
      aria-label="Recenter on my location"
      aria-busy={locating}
      className={`pointer-events-auto grid min-h-tap min-w-tap place-items-center squircle-full
                  material-thick shadow-raised text-accent
                  active:scale-90 transition-transform duration-instant
                  disabled:opacity-60 ${className}`}
      disabled={locating}
    >
      {locating ? (
        <LoaderCircle className="h-[20px] w-[20px] animate-spin" />
      ) : (
        <LocateFixed className="h-[20px] w-[20px]" />
      )}
    </button>
  );
}
