"use client";

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { LocateFixed, LoaderCircle } from "lucide-react";
import {
  MapboxAdapter,
  ZERO_PADDING,
  type MapPadding,
  type ScreenPoint
} from "@/integrations/maps/MapboxAdapter";
import { DETENT_FRACTION, type Detent } from "./BottomSheet";
import { useTheme } from "@/core/context/ThemeContext";
import { MapLoading, MapFailed } from "./MapLoader";

interface MapMarkerData {
  id: string;
  placeId: string;
  placeName: string;
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
}

/**
 * The map chrome — location pill and theme toggle — floats at
 * `safe-area-top + 12` and is 36px tall, so this much of the top of the canvas
 * is spoken for. Kept as a constant rather than measured: it is only load-
 * bearing at the large detent (below), where it is clamped away anyway, and a
 * measurement here would couple the camera to page.tsx's DOM.
 */
export const MAP_TOP_CHROME = 60;

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
export function sheetMapPadding(
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
  { candidates, selectedPlaceId: _selectedPlaceId, onMarkerClick, center, detent = null, padding },
  ref
) {
  const { theme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const adapterRef = useRef<MapboxAdapter | null>(null);
  const initialCenterRef = useRef(center);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
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

    whenMapboxReady().then((gl) => {
      if (cancelled || !containerRef.current) return;
      if (!gl) {
        setFailed(true);
        return;
      }
      const accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || "";
      const adapter = new MapboxAdapter(accessToken);
      adapterRef.current = adapter;
      // Read the theme at init, not at first render: ThemeContext resolves
      // localStorage in an effect, so a ref captured during render is always
      // "light" and the map would flash the wrong basemap.
      const t = document.documentElement.classList.contains("dark") ? "dark" : "light";
      adapter.initialize(containerRef.current, initialCenterRef.current, 14.5, t, paddingRef.current);
      setFailed(false);
      // Flips the marker effect once the adapter exists — otherwise markers
      // added before init are silently dropped and never re-added.
      setReady(true);
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
  useEffect(() => {
    const adapter = adapterRef.current;
    if (!adapter) return;
    adapter.setPadding(mapPadding, { animate: paddingSettled.current });
    paddingSettled.current = true;
  }, [mapPadding, ready]);

  // Update map center when global coordinate changes
  const { lat, lng } = center;
  useEffect(() => {
    adapterRef.current?.setCenter(lat, lng);
  }, [lat, lng, ready]);

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
  }, [candidates, onMarkerClick, ready]);

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

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* The container must stay mounted underneath: Mapbox attaches to this
          node, so unmounting it while loading would give the adapter nothing to
          initialise into. The placeholders sit ON TOP and peel away. */}
      <div ref={containerRef} className="h-full w-full" />
      {!ready && !failed && <MapLoading />}
      {failed && <MapFailed onRetry={() => { setFailed(false); setAttempt((n) => n + 1); }} />}
    </div>
  );
});

interface MapRecenterControlProps {
  /** The user's position, once acquired. Feed it to `MapCameraHandle.recenterTo`. */
  onLocate: (position: { lat: number; lng: number }) => void;
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
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      onError?.("This device cannot share your location.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (!mounted.current) return;
        setLocating(false);
        onLocate({ lat: position.coords.latitude, lng: position.coords.longitude });
      },
      (error) => {
        if (!mounted.current) return;
        setLocating(false);
        onError?.(
          error.code === error.PERMISSION_DENIED
            ? "Location is off for WetinDey. Turn am on for your browser settings."
            : "We no fit find your location. Try again."
        );
      },
      // 15s is generous on purpose: a cold GPS fix on a mid-range Android over a
      // Lagos data connection routinely takes more than the 6s people reach for.
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 }
    );
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
