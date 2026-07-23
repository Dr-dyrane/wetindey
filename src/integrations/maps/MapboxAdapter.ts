import { AGRO_DEALER_PLACE_TYPE } from "@/config/pillars";

import type { SharedUserLocation } from "@/app/_actions/actions";
import { applyCartography as applyCartographyToStyle } from "./cartography";
import { ThemeSnapshotOverlay, captureThemeSnapshot, duration } from "./theme-transition";

export interface MapMarkerOptions {
  id: string;
  lat: number;
  lng: number;
  label: string;
  placeType?: string | null;
  selected?: boolean;
  status: "confirmed" | "caution" | "unavailable" | "neutral";
  onClick?: () => void;
}

/**
 * Accuracy treatment for a real device fix. Browsing/default/manual positions
 * never reach this boundary at all.
 */
export type UserPositionPrecision = "precise" | "approximate";

export interface UserPositionOptions {
  lat: number;
  lng: number;
  precision: UserPositionPrecision;
  /** Browser-reported 95% confidence radius in metres. */
  accuracyM: number;
  identity: {
    name: string;
    avatarUrl: string | null;
  } | null;
  /** Accessible name. The shape carries the precision; this carries it in words. */
  label: string;
}

/**
 * A drawn route, as ordered `[lng, lat]` pairs.
 *
 * AXIS ORDER IS THE OPPOSITE of every other method on this adapter, which takes
 * `(lat, lng)`. That is deliberate and it is the whole point of the seam: this
 * is GeoJSON order, which is what Mapbox Directions, Google, HERE, OSRM and any
 * delivery provider's API already return for a LineString. Taking `{lat, lng}`
 * here would look tidier and force every caller to transform a payload they
 * could otherwise pass straight through.
 *
 * Fewer than 2 points is not a line; `setRoute` treats it as null.
 */
export type RouteGeometry = [number, number][];

/**
 * The adapter accepts geometry from callers, not only `fetchRoute`. Keep this
 * boundary defensive: Mapbox throws for NaN bounds, taking down the whole React
 * tree, whereas an unusable route should simply be absent.
 */
function isRenderableRoute(coords: unknown): coords is RouteGeometry {
  if (!Array.isArray(coords) || coords.length < 2) return false;

  const points: unknown[] = coords;
  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    if (
      !Array.isArray(point) ||
      point.length !== 2 ||
      typeof point[0] !== "number" ||
      typeof point[1] !== "number" ||
      !Number.isFinite(point[0]) ||
      !Number.isFinite(point[1]) ||
      point[0] < -180 ||
      point[0] > 180 ||
      point[1] < -90 ||
      point[1] > 90
    ) {
      return false;
    }
  }

  return true;
}

function isRenderablePadding(padding: MapPadding): boolean {
  return [padding.top, padding.right, padding.bottom, padding.left].every(
    (value) => Number.isFinite(value) && value >= 0
  );
}

/**
 * Which token colours the route.
 *
 * A colour selector, NOT a status model — no route status model exists, and
 * inventing one here would mean inventing its meanings too. This is only the
 * seam able to carry one later: whatever eventually decides a route is worth
 * flagging picks a tint, and nothing in the render layer changes.
 *
 * Keys, not colours, so a caller never holds a hex and cannot break the theme by
 * passing one. Resolution to a token happens here — see ROUTE_TINT_TOKEN.
 */
export type RouteTint = "accent" | "confirmed" | "caution" | "unavailable";

/**
 * Pixels of the viewport that are covered by chrome, per edge.
 *
 * This is the single most important camera concept in this app. The sheet sits
 * ON TOP of the map and covers 52% of the screen at medium and 94% at large, so
 * the geometric centre of the <canvas> is NOT the centre of the map the user can
 * actually see. Mapbox models exactly this: given padding, every camera
 * operation treats the un-covered rectangle as the viewport, so `center` lands
 * in the middle of the visible band instead of behind the sheet.
 */
export interface MapPadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export const ZERO_PADDING: MapPadding = { top: 0, right: 0, bottom: 0, left: 0 };

/** Screen-space point, origin at the canvas top-left. */
export interface ScreenPoint {
  x: number;
  y: number;
}

export type MapStyleLifecycleState =
  | {
      status: "loading";
      generation: number;
      theme: "light" | "dark";
      attempt: number;
      /**
       * True when the outgoing frame is being held over the canvas by the
       * adapter's theme-snapshot overlay, so the canvas owner must NOT cover
       * the map with an opaque loading skeleton: doing so would hide the
       * continuity this load already provides. False for first loads, retries
       * without a photograph, and context-loss reconstruction, where a
       * skeleton remains the honest surface. Optional so that existing
       * producers of loading states (including test doubles owned by other
       * lanes) remain assignable; absent means false.
       */
      continuity?: boolean;
    }
  | {
      status: "ready";
      generation: number;
      theme: "light" | "dark";
      attempt: number;
    }
  | {
      status: "failed";
      generation: number;
      theme: "light" | "dark";
      attempt: number;
      reason: "context" | "error" | "probe" | "renderer" | "timeout";
    };

type MapStyleLifecycleListener = (state: MapStyleLifecycleState) => void;

interface MapProviderAdapter {
  initialize(
    container: HTMLDivElement,
    center: { lat: number; lng: number },
    zoom: number,
    theme?: "light" | "dark",
    padding?: MapPadding
  ): void;
  setStyleLifecycleListener(listener: MapStyleLifecycleListener | null): void;
  setTheme(theme: "light" | "dark"): void;
  retryStyle(): void;
  setPadding(padding: MapPadding, options?: { animate?: boolean }): void;
  getPadding(): MapPadding;
  setCenter(lat: number, lng: number): void;
  recenterTo(lat: number, lng: number, zoom?: number): void;
  projectPoint(lat: number, lng: number): ScreenPoint | null;
  addMarker(options: MapMarkerOptions): void;
  clearMarkers(): void;
  /** Draw "you". `null` removes it. Not touched by clearMarkers — see below. */
  setUserPosition(options: UserPositionOptions | null): void;
  /**
   * Draw a route, or `null` to remove it. Takes GEOMETRY ONLY: this adapter
   * never asks anyone for a route and holds no opinion about who computed it.
   */
  setRoute(coords: RouteGeometry | null, options?: { tint?: RouteTint }): void;
  resize(): void;
  destroy(): void;
}

/** Camera duration for a deliberate move (selection, recenter). */
const FLY_DURATION_MS = 800;
/**
 * Camera duration for a padding change. Short: the map is correcting itself
 * under a sheet the user is already moving, so it must read as the same gesture,
 * not as a second animation chasing the first.
 */
const PADDING_DURATION_MS = 300;

/**
 * A style swap destroys the old basemap immediately, so an unbounded wait for
 * `style.load` is an unbounded black canvas. Give each load one short network
 * window and one retry. The retry stays on the SAME Map instance: Mapbox keeps
 * its camera and DOM markers across `setStyle`, while style-owned layers are
 * replayed from `handleStyleLoad` below.
 */
const STYLE_LOAD_TIMEOUT_MS = 5_000;
const STYLE_LOAD_MAX_ATTEMPTS = 2;
/**
 * `style.load` proves that style-owned mutations are safe; it does not prove
 * that the current WebGL context produced a later render. Give the painter one
 * bounded window, reconstruct once only for confirmed renderer/context failure,
 * then fail visibly instead of looping.
 */
const STYLE_FRAME_TIMEOUT_MS = 5_000;
const MAX_AUTOMATIC_MAP_RECONSTRUCTIONS = 1;
/** The shipped dark land is ~38/255; readback remains diagnostic-only. */
const VISIBLE_FRAME_CHANNEL_FLOOR = 8;
const FRAME_SAMPLE_FRACTIONS = [0.18, 0.38, 0.5, 0.62, 0.82] as const;
const FRAME_READ_SENTINEL = [0xde, 0xad, 0xbe, 0xef] as const;
const BLACK_FRAME_CORROBORATION_SAMPLES = 2;

type FrameEvidence =
  | "pending"
  | "visible"
  | "genuinely-black"
  | "context-unavailable"
  | "context-lost"
  | "zero-buffer"
  | "read-error"
  | "gl-error";

type FrameReadEvidence = FrameEvidence | "black-sample";

/**
 * How close `fitRoute` is allowed to pull in. 16.5 is a street, not a doorway.
 * Without a cap, a seller 40m away frames at maximum zoom and the map reads as
 * a bug rather than as good news.
 */
const FIT_MAX_ZOOM = 16.5;

const ROUTE_SOURCE_ID = "wetindey-route";
const ROUTE_LAYER_ID = "wetindey-route-line";

/**
 * ONE line, no casing. The Mapbox idiom is two stacked layers — a wide dark
 * "casing" under a narrower bright fill — which is what reads as a double line.
 * It exists to separate a route from a busy basemap by outlining it, and an
 * outline is a stroke, which this app does not do. The route separates itself
 * the way everything else here does: one confident weight in the ink colour,
 * slotted under the basemap's labels so it never has to fight them.
 */
const ROUTE_WIDTH_PX = 4;

/**
 * Tint keys resolved to tokens. `accent` is the default and it is the answer to
 * "black polyline": --color-accent IS #000000 in light. It inverts to #FFFFFF in
 * dark, where a literal black line would be invisible against dark-v11.
 */
const ROUTE_TINT_TOKEN: Record<RouteTint, string> = {
  accent: "--color-accent",
  confirmed: "--color-status-confirmed",
  caution: "--color-status-caution",
  unavailable: "--color-status-unavailable",
};

const PLACES_SOURCE_ID = "wetindey-places";
const PLACES_GLOW_LAYER_ID = "wetindey-places-glow";

/**
 * Which admitted place types cast the ground glow, and why only these.
 *
 * The glow answers one question — where does commerce live? — and Festac's
 * tiles cannot answer it: dark-v11 ships no commercial_area polygons here, so
 * WetinDey's own admitted places are the only honest source (recorded in the
 * Lane C release). Markets are the thesis; banks, kiosks and BDCs are merely
 * candidates, and a glow under everything is a glow under nothing.
 */
const PLACES_GLOW_TYPES = new Set(["open_market", "supermarket"]);

/**
 * Full blur pushes the entire circle into its falloff, so neighbouring
 * markets merge into one soft ground wash instead of stacked discs — the
 * point is a warmth in the ground, never a shape with an edge.
 */
const PLACES_GLOW_BLUR = 1;

/**
 * Ground-scale, not pin-scale — and sized against the one thing that does
 * NOT scale with zoom: the 36px DOM pin disc sitting on top. blur 1 fades
 * the circle to nothing at its radius, so at the app's opening zoom (14.5,
 * see MapboxCanvas) a radius under ~34px is swallowed whole by the disc and
 * an isolated market casts no visible warmth at all; measured, not guessed —
 * the first cut (10 at z12, 42 at z16) put 30px under a 36px pin. These
 * values keep a quiet rim beyond the disc from the opening view up, while
 * z12 stays a hint and z16 reads as the block the market occupies.
 */
const PLACES_GLOW_RADIUS: Expression = ["interpolate", ["linear"], ["zoom"], 12, 12, 16, 54];

/**
 * Warm amber in the market label's family (cartography.ts paints market
 * labels hsl(38,92%,60%) dark / hsl(32,90%,34%) light), deliberately NOT the
 * same value: the label is ink and must clear 4.5:1, the glow is ground and
 * must never compete with ink. Slightly desaturated and mid-lightness so the
 * blur falloff stays warm rather than going muddy (dark) or grey (light).
 */
const PLACES_GLOW_COLOR: Record<"light" | "dark", string> = {
  dark: "hsl(38, 80%, 55%)",
  light: "hsl(35, 85%, 45%)",
};

/**
 * Faint is the constraint, per theme because the grounds differ: the dark
 * land sits near-black so amber carries further there; the light land is a
 * warm sand that would amplify the same opacity into a stain. Both values
 * keep the glow subordinate to labels, pins and the route.
 */
const PLACES_GLOW_OPACITY: Record<"light" | "dark", number> = {
  dark: 0.14,
  light: 0.08,
};

const PLACE_TYPE_SYMBOLS: Record<string, string> = {
  open_market: '<path d="M4 10h16l-1-5H5l-1 5Z"/><path d="M5 10v9h14v-9"/><path d="M9 19v-5h6v5"/>',
  supermarket:
    '<path d="M4 5h2l2 10h9l2-7H7"/><circle cx="9" cy="19" r="1"/><circle cx="17" cy="19" r="1"/>',
  kiosk: '<path d="M5 10h14v9H5z"/><path d="M4 10 6 5h12l2 5M8 14h3M13 14h3"/>',
  bank: '<path d="m3 9 9-5 9 5"/><path d="M5 10v7M9 10v7M15 10v7M19 10v7M3 19h18"/>',
  bureau_de_change: '<path d="M7 5h10v14H7z"/><path d="M10 9h4M10 12h4M10 15h4"/>',
  // ADR-031 lane 3: a sack with a sprout, reading "farm inputs", not produce.
  // Keyed by the lane-1 constant so the place-type string has one source of
  // truth (src/config/pillars.ts). Dormant until the pillar flag flips and
  // activation seeds real agro-dealer places; the own-markets glow deliberately
  // excludes this type, agro-dealers are not market-family.
  [AGRO_DEALER_PLACE_TYPE]:
    '<path d="M8 8c0-2 1.5-3 4-3s4 1 4 3l1 9c0 2-2 3-5 3s-5-1-5-3l1-9Z"/><path d="M12 5V3"/><path d="M12 3c-1.5 0-2-1-2-1s2-.5 2 1c0-1.5 2-1 2-1s-.5 1-2 1"/>',
};

const PLACE_TYPE_LABELS: Record<string, string> = {
  open_market: "open market",
  supermarket: "supermarket",
  kiosk: "kiosk",
  bank: "bank",
  bureau_de_change: "bureau de change",
  [AGRO_DEALER_PLACE_TYPE]: "agro-dealer",
};

/**
 * Keyboard focus ring for a pin. Needed because the selection path clears
 * the outline with an inline "none", and an inline style beats the app-wide
 * `:focus-visible` rule (globals.css) — without this, a Tab landing on an
 * unselected marker would be invisible. Same 2px `--color-focus-ring` as
 * that global rule, deliberately: focus stays one colour everywhere, and it
 * stays tellable apart from the 3px accent SELECTION outline the QA sweep
 * asserts verbatim.
 */
const MARKER_FOCUS_OUTLINE = "2px solid var(--color-focus-ring)";

/**
 * A Mapbox style value: a literal, or an expression tree of them.
 *
 * Deliberately structural rather than a union of every property's real type.
 * These values are handed to a style spec this file does not own and cannot
 * import types for, so the honest description is "JSON the renderer validates",
 * not a lie about compile-time safety. It is NOT `any`: a function, undefined,
 * or an object still fail to type here, which catches the mistakes that are
 * actually made when hand-writing expressions.
 *
 * Exported for cartography.ts, which hand-writes the expressions these types
 * exist to check; the declarations stay here beside the MapboxMap methods
 * that consume them.
 */
export type StyleValue = string | number | boolean | null | StyleValue[];
export type Expression = StyleValue[];

const USER_ORB_SIZE = 32;

/**
 * The halo is separate from identity and grows conservatively with reported
 * uncertainty. It is intentionally capped: a DOM marker cannot claim a
 * map-scale metric radius, so size communicates relative accuracy while the
 * accessible label states the actual browser value.
 */
function userAccuracyHaloSize(accuracyM: number): number {
  const safeAccuracy = Number.isFinite(accuracyM) ? Math.max(0, accuracyM) : 0;
  return Math.round(Math.min(112, Math.max(44, 44 + Math.log2(1 + safeAccuracy / 20) * 12)));
}

/**
 * Resolve a design token to the value the GPU layer needs.
 *
 * Mapbox paint properties take a colour STRING; they cannot read a CSS variable
 * or a class, because the line is painted into a <canvas> and never exists in
 * the DOM. So the token has to be resolved here, at paint time, against the live
 * theme — and re-resolved whenever the theme changes (see handleStyleLoad).
 *
 * Null when the token does not resolve. Callers must not draw rather than draw
 * in a guessed colour: Mapbox's own default for an omitted line-color is black,
 * which would silently look correct in light and vanish in dark.
 */
function readToken(name: string): string | null {
  if (typeof window === "undefined") return null;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || null;
}

// Local typings to satisfy strict TypeScript checking without using "any"
interface MapboxCameraOptions {
  center?: [number, number];
  zoom?: number;
  padding?: MapPadding;
  essential?: boolean;
  duration?: number;
}

/** The route's GeoJSON shape — one LineString feature. */
interface RouteFeature {
  type: "Feature";
  properties: Record<string, never>;
  geometry: { type: "LineString"; coordinates: RouteGeometry };
}

/** One admitted place, as a Point in GeoJSON `[lng, lat]` order. */
interface PlaceFeature {
  type: "Feature";
  properties: Record<string, never>;
  geometry: { type: "Point"; coordinates: [number, number] };
}

interface PlacesFeatureCollection {
  type: "FeatureCollection";
  features: PlaceFeature[];
}

/**
 * The GeoJSON this adapter builds: the route's LineString and the places
 * glow's point collection. A union rather than a generic "any GeoJSON" so a
 * third shape still has to be declared here before it can exist.
 */
type AdapterGeoJson = RouteFeature | PlacesFeatureCollection;

interface MapboxGeoJsonSource {
  setData(data: AdapterGeoJson): void;
}

interface MapboxLineLayer {
  id: string;
  type: "line";
  source: string;
  layout: { "line-cap": "round"; "line-join": "round" };
  paint: { "line-color": string; "line-width": number };
}

interface MapboxCircleLayer {
  id: string;
  type: "circle";
  source: string;
  paint: {
    "circle-color": string;
    "circle-blur": number;
    "circle-radius": Expression;
    "circle-opacity": number;
  };
}

/** `[[west, south], [east, north]]` — Mapbox's own LngLatBounds tuple form. */
type BoundsTuple = [[number, number], [number, number]];

interface FitBoundsOptions {
  padding?: MapPadding;
  maxZoom?: number;
  essential?: boolean;
  duration?: number;
}

type MapboxStyleReadinessEvent =
  "style.load" | "idle" | "render" | "webglcontextlost" | "webglcontextrestored";

interface MapboxLngLat {
  lng: number;
  lat: number;
}

/** Exported for cartography.ts and theme-transition.ts, which take the live Map at their seams. */
export interface MapboxMap {
  flyTo(options: MapboxCameraOptions): void;
  easeTo(options: MapboxCameraOptions): void;
  /**
   * Frame a box. Mapbox solves the zoom for us, honouring `padding`, which is
   * the entire reason this is the right primitive and a zoom derived from a
   * haversine distance is not: the visible band is not the viewport here, and
   * only the camera knows the projection at this latitude.
   */
  fitBounds(bounds: BoundsTuple, options?: FitBoundsOptions): void;
  project(lnglat: [number, number]): ScreenPoint;
  getCenter(): MapboxLngLat;
  getZoom(): number;
  getBearing(): number;
  getPitch(): number;
  getCanvas(): HTMLCanvasElement;
  setStyle(style: string): void;
  triggerRepaint(): void;
  on(type: MapboxStyleReadinessEvent, listener: () => void): void;
  on(type: "error", listener: (event: MapboxErrorEvent) => void): void;
  off(type: MapboxStyleReadinessEvent, listener: () => void): void;
  off(type: "error", listener: (event: MapboxErrorEvent) => void): void;
  isStyleLoaded(): boolean;
  getStyle():
    | {
        name?: string;
        sprite?: string | { id: string; url: string }[];
        layers?: { id: string; type: string }[];
      }
    | undefined;
  addSource(id: string, source: { type: "geojson"; data: AdapterGeoJson }): void;
  /**
   * Narrowed to the sources this adapter adds — all geojson. Accurate rather
   * than optimistic: only the route and the places glow call addSource, so
   * nothing of any other source type can come back.
   */
  getSource(id: string): MapboxGeoJsonSource | undefined;
  removeSource(id: string): void;
  addLayer(layer: MapboxLineLayer | MapboxCircleLayer, beforeId?: string): void;
  getLayer(id: string): { id: string } | undefined;
  removeLayer(id: string): void;
  /**
   * Widened from `name: "line-color", value: string` when the cartography
   * landed. The old signature described the ONE call this file made rather than
   * the API, which stopped being honest the moment a second caller existed.
   */
  setPaintProperty(layer: string, name: string, value: StyleValue): void;
  setLayoutProperty(layer: string, name: string, value: StyleValue): void;
  setFilter(layer: string, filter: Expression): void;
  resize(): void;
  remove(): void;
}

interface MapboxErrorEvent {
  error?: {
    message?: string;
  };
}

/**
 * Corrected from a chained-return shape to the real one: `setLngLat` and `addTo`
 * both return the marker. The old typing described only the construction chain,
 * which made an existing marker unmovable — setUserPosition has to move one.
 */
interface MapboxMarker {
  setLngLat(lnglat: [number, number]): MapboxMarker;
  addTo(map: MapboxMap): MapboxMarker;
  remove(): void;
}

interface MapboxPopup {
  setLngLat(lnglat: [number, number]): MapboxPopup;
  setDOMContent(html: HTMLElement): MapboxPopup;
  setHTML(html: string): MapboxPopup;
  addTo(map: MapboxMap): MapboxPopup;
  remove(): void;
  isOpen(): boolean;
  on(type: "close", listener: () => void): MapboxPopup;
}

interface WindowWithMapboxgl extends Window {
  mapboxgl?: {
    accessToken: string;
    Map: new (options: {
      container: HTMLDivElement;
      style: string;
      center: [number, number];
      zoom: number;
      bearing?: number;
      pitch?: number;
      attributionControl: boolean;
    }) => MapboxMap;
    Marker: new (element: HTMLDivElement) => MapboxMarker;
    Popup: new (options?: {
      closeButton?: boolean;
      closeOnClick?: boolean;
      className?: string;
      maxWidth?: string;
      anchor?: string;
      offset?: number | [number, number] | { [key: string]: [number, number] };
    }) => MapboxPopup;
  };
}

type MapboxGL = NonNullable<WindowWithMapboxgl["mapboxgl"]>;

/**
 * UPSTREAM WORKAROUND, mapbox-gl v3.1.2: DELETE this whole function when the
 * pinned library moves past the race. A static read of the v3.6.0 bundle
 * suggests its Fog constructor initializes `properties`, likely closing the
 * gap there (unverified at runtime); the controller ruled against a bump
 * regardless, because a full-library change reprices the whole map surface
 * for a defect this guard already contains.
 *
 * `Marker._update` arms a 60ms fade timer whenever the style has fog.
 * `setStyle` swaps in a new Style whose Fog OBJECT exists at parse time but
 * whose `properties` field is only assigned by the first recalculate render
 * pass. A timer landing in that gap passes the `style.fog` truthiness guard
 * and throws `TypeError: Cannot read properties of undefined (reading 'get')`
 * in `Fog.state` via `_queryFogOpacity` — uncaught, up to dozens per rapid
 * interaction burst, and each throw leaves that marker's `_fadeTimer` truthy,
 * permanently disabling its fog-fade evaluation. Controller ruling: guard
 * here rather than bump the library (the bump does not fix it and repriced
 * the whole map surface for nothing).
 *
 * Fail-safe by construction: applied once (symbol-marked), only when the
 * internal shape matches expectations, and the wrapper swallows exactly the
 * TypeError class this race produces, rethrowing everything else. If mapbox
 * ever renames the method or fixes the race, this becomes a no-op.
 */
const FOG_GUARD_APPLIED = Symbol.for("wetindey.fogOpacityGuard");
function guardMarkerFogOpacity(mapboxgl: MapboxGL): void {
  try {
    const marker = (mapboxgl as unknown as { Marker?: { prototype?: Record<PropertyKey, unknown> } })
      .Marker;
    const proto = marker?.prototype;
    if (!proto) return;
    if ((proto as Record<PropertyKey, unknown>)[FOG_GUARD_APPLIED]) return;
    const original = proto["_evaluateOpacity"];
    if (typeof original !== "function") return;
    proto["_evaluateOpacity"] = function guardedEvaluateOpacity(
      this: unknown,
      ...args: unknown[]
    ) {
      try {
        return (original as (...a: unknown[]) => unknown).apply(this, args);
      } catch (error) {
        // Only the fog-gap TypeError is survivable-by-design; anything else
        // is real and must surface.
        if (error instanceof TypeError) return undefined;
        throw error;
      }
    };
    (proto as Record<PropertyKey, unknown>)[FOG_GUARD_APPLIED] = true;
  } catch {
    // The guard itself must never take the map down.
  }
}

interface MapRecoverySnapshot {
  camera: {
    center: MapboxLngLat;
    zoom: number;
    bearing: number;
    pitch: number;
  };
  markers: Set<MapboxMarker>;
  popup: MapboxPopup | null;
}

export class MapboxAdapter implements MapProviderAdapter {
  private mapInstance: MapboxMap | null = null;
  private mapboxgl: MapboxGL | null = null;
  private mapContainer: HTMLDivElement | null = null;
  /** Invalidates callbacks retained by a removed/replaced Map instance. */
  private mapEpoch = 0;
  private mapLifecycleOwner: MapboxMap | null = null;
  private mapErrorListener: ((event: MapboxErrorEvent) => void) | null = null;
  private mapContextLostListener: (() => void) | null = null;
  private mapContextRestoredListener: (() => void) | null = null;
  private markersMap: Map<string, MapboxMarker> = new Map();
  /**
   * The marker DOM elements and their base accessible labels, keyed like
   * markersMap. Exists so setMarkerSelected can restyle a pin in place: the
   * MapboxMarker interface exposes no element accessor, and reading the label
   * back off the node would stack the ", selected" suffix on repeat
   * selections. Cleared with markersMap, always — the two describe the same
   * markers or they describe nothing.
   */
  private markerEls: Map<string, { el: HTMLDivElement; label: string }> = new Map();
  /**
   * The pin the adapter currently styles as selected. Adapter-held rather
   * than read from the DOM so setMarkerSelected can find the outgoing pin
   * without scanning every element, and so a rebuild that re-adds the same
   * selection (addMarker's `selected` option) leaves a later identical
   * setMarkerSelected call a no-op. Survives clearMarkers deliberately: it
   * records the caller's intent, and the rebuild that follows a clear re-adds
   * the selected pin from that same intent.
   */
  private selectedMarkerId: string | null = null;
  /**
   * Coordinates of the CURRENT glow-eligible markers, keyed like markersMap.
   * A parallel map rather than a widened markersMap value because the two
   * have different owners: markersMap holds DOM objects a style swap cannot
   * touch, this holds style-layer data a style swap destroys — the glow's
   * replay reads it back. Only PLACES_GLOW_TYPES entries are kept; the
   * exclusion of every other place type happens at admission, by design.
   */
  private markerPlaces: Map<string, { lng: number; lat: number }> = new Map();
  private sharedUserMarkers: Map<string, MapboxMarker> = new Map();
  private activeUserPopup: MapboxPopup | null = null;
  /**
   * "You", held apart from markersMap on purpose. MapboxCanvas calls
   * clearMarkers() and re-adds every candidate whenever the list changes; a user
   * marker living in that map would be destroyed and rebuilt on each search.
   */
  private userMarker: MapboxMarker | null = null;
  private userMarkerEl: HTMLDivElement | null = null;
  /** What the live element was built to claim; rebuild only when this changes. */
  private userMarkerPrecision: UserPositionPrecision | null = null;
  private userMarkerIdentityKey: string | null = null;
  private userMarkerAccuracyKey: number | null = null;
  /** The route as last asked for, so a style rebuild can restore it. */
  private routeCoords: RouteGeometry | null = null;
  private routeTint: RouteTint = "accent";
  /**
   * Whether the live style will accept a source or a layer. See applyRoute for
   * why neither `isStyleLoaded()` nor `getStyle()` answers this.
   *
   * False from construction and again from the moment setTheme swaps the style,
   * true from each `style.load`. It mirrors Mapbox's private `_loaded`.
   */
  private styleReady = false;
  /** Current style generation produced a later render on a structurally live context. */
  private styleUsable = false;
  private styleLifecycleListener: MapStyleLifecycleListener | null = null;
  private styleReadyListener: (() => void) | null = null;
  private styleRenderListener: (() => void) | null = null;
  /** Exact Map that owns the style listeners; never infer it from mapInstance. */
  private styleListenerOwner: MapboxMap | null = null;
  private styleInstalledGeneration: number | null = null;
  /** A mutation-safe event emitted synchronously by the active setStyle call. */
  private pendingMutationSafeGeneration: number | null = null;
  /** Non-null only while the matching setStyle call is on the JavaScript stack. */
  private styleInstallInProgressGeneration: number | null = null;
  private styleLoadTimer: number | null = null;
  private styleFrameTimer: number | null = null;
  private styleLoadAttempt = 0;
  private styleGeneration = 0;
  private styleErrorObserved = false;
  private rendererErrorObserved = false;
  private contextLost = false;
  private contextRecoveryStyleWasReady = false;
  private routeIsolationFailed = false;
  /** Safe, generation-local renderer evidence; never contains request or location data. */
  private frameEvidence: FrameEvidence = "pending";
  private blackFrameGeneration: number | null = null;
  private blackFrameSamples = 0;
  private automaticMapReconstructions = 0;
  private lastFailureReason: "context" | "error" | "probe" | "renderer" | "timeout" | null = null;
  /**
   * Kept only if the old Map has already been removed but constructing its
   * replacement throws. Explicit Retry can then start a fresh bounded episode
   * without inventing a camera or losing DOM overlay identity.
   */
  private detachedRecoverySnapshot: MapRecoverySnapshot | null = null;
  private accessToken: string;
  /** Theme the live style already reflects; see setTheme. */
  private currentTheme: "light" | "dark" = "light";
  /**
   * The occlusion the camera is currently compensating for. Held here rather
   * than read back off the map so that padding set before `initialize` (the
   * adapter is created asynchronously — see MapboxCanvas) is not lost, and so
   * every camera call has one source of truth to pass along.
   */
  private padding: MapPadding = { ...ZERO_PADDING };
  /**
   * Holder for the theme-swap snapshot overlay (see theme-transition.ts for
   * why it exists). Removal stays owned by the lifecycle seam here: faded on
   * "ready", instantly on "failed" so it can never mask the failure surface.
   */
  private readonly overlay = new ThemeSnapshotOverlay();
  /**
   * Theme the user most recently asked for while a snapshot capture is
   * awaiting its render tick. The capture callback swaps to the LATEST value,
   * so rapid toggles collapse into one setStyle instead of queueing several.
   */
  private pendingThemeSwap: "light" | "dark" | null = null;

  constructor(accessToken?: string) {
    this.accessToken = accessToken || process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || "";
  }

  /** The map is the app's base layer, so its style has to track the app theme. */
  public static styleFor(theme: "light" | "dark"): string {
    return theme === "dark"
      ? "mapbox://styles/mapbox/dark-v11"
      : "mapbox://styles/mapbox/streets-v12";
  }

  /**
   * The name each styleFor style reports once it is actually live. Paired
   * with styleFor and only meaningful beside it: change one, change both.
   *
   * This exists because "the current style is loaded" and "the current style
   * is the one this attempt installed" are different facts, and mapbox-gl v3
   * splits them: a cross-style setStyle first tries to DIFF, keeping the
   * OUTGOING style current while the replacement downloads, and only tears
   * down when the diff fails ("Unimplemented: setSprite" — every dark/light
   * swap here). In that window the old style is loaded, idle can fire and
   * isStyleLoaded() returns true — all describing the style being replaced.
   * Accepting that evidence completed the attempt, replayed cartography into
   * the dying style and detached the listeners, so the real style landed
   * bare: stock POI colours, no route, no glow, lifecycle lying "ready".
   * The name is the public discriminator for which style is answering.
   */
  private static styleNameFor(theme: "light" | "dark"): string {
    return theme === "dark" ? "Mapbox Dark" : "Mapbox Streets";
  }

  /**
   * Whether the style currently answering is the one this attempt intends.
   * Fail-open on a missing name: custom styles and test doubles that do not
   * model names must not be locked out of readiness — the gate exists only
   * to reject KNOWN-stale identity, never to demand identity be modelled.
   */
  private liveStyleMatchesIntent(map: MapboxMap): boolean {
    const name = map.getStyle()?.name;
    if (!name) return true;
    return name === MapboxAdapter.styleNameFor(this.currentTheme);
  }

  public setStyleLifecycleListener(listener: MapStyleLifecycleListener | null): void {
    this.styleLifecycleListener = listener;
  }

  public initialize(
    container: HTMLDivElement,
    center: { lat: number; lng: number },
    zoom: number,
    theme: "light" | "dark" = "light",
    padding: MapPadding = ZERO_PADDING
  ): void {
    if (this.mapInstance) return;

    // Cast the window global context to our typed interface
    const mapboxgl = (window as unknown as WindowWithMapboxgl).mapboxgl || null;

    if (!mapboxgl) {
      console.warn("Mapbox GL JS library not loaded. Falling back to static map canvas.");
      return;
    }

    mapboxgl.accessToken = this.accessToken;
    guardMarkerFogOpacity(mapboxgl);
    this.mapboxgl = mapboxgl;
    this.mapContainer = container;
    this.currentTheme = theme;
    this.padding = { ...padding };
    this.automaticMapReconstructions = 0;
    this.lastFailureReason = null;
    const map = new mapboxgl.Map({
      container,
      style: MapboxAdapter.styleFor(theme),
      center: [center.lng, center.lat],
      zoom,
      attributionControl: false,
    });
    this.mapInstance = map;
    const epoch = ++this.mapEpoch;
    this.attachMapLifecycleListeners(map, epoch);
    this.beginStyleAttempt(theme, 1, false);
    // Applied as a camera call rather than a constructor option so the very
    // first frame is already padded: the opening centre must sit above the
    // sheet, not behind it.
    map.easeTo({ padding: this.padding, essential: true, duration: 0 });
  }

  private attachMapLifecycleListeners(map: MapboxMap, epoch: number): void {
    this.detachMapLifecycleListeners();
    const contextLostListener = () => {
      this.handleContextLost(map, epoch);
    };
    const contextRestoredListener = () => {
      this.handleContextRestored(map, epoch);
    };
    this.mapLifecycleOwner = map;
    this.mapErrorListener = null;
    this.mapContextLostListener = contextLostListener;
    this.mapContextRestoredListener = contextRestoredListener;
    map.on("webglcontextlost", contextLostListener);
    map.on("webglcontextrestored", contextRestoredListener);
  }

  private installGenerationErrorListener(map: MapboxMap, epoch: number, generation: number): void {
    const owner = this.mapLifecycleOwner;
    if (owner && this.mapErrorListener) {
      owner.off("error", this.mapErrorListener);
    }
    const errorListener = (event: MapboxErrorEvent) => {
      this.handleMapError(event, map, epoch, generation);
    };
    this.mapErrorListener = errorListener;
    map.on("error", errorListener);
  }

  private detachMapLifecycleListeners(): void {
    const map = this.mapLifecycleOwner;
    if (!map) return;
    if (this.mapErrorListener) map.off("error", this.mapErrorListener);
    if (this.mapContextLostListener) {
      map.off("webglcontextlost", this.mapContextLostListener);
    }
    if (this.mapContextRestoredListener) {
      map.off("webglcontextrestored", this.mapContextRestoredListener);
    }
    this.mapLifecycleOwner = null;
    this.mapErrorListener = null;
    this.mapContextLostListener = null;
    this.mapContextRestoredListener = null;
  }

  /**
   * Re-draw everything the style owns, because the style just replaced itself.
   *
   * This fires twice over, and BOTH are load-bearing:
   *
   *   · The FIRST style load. A source or layer added before the style is ready
   *     throws outright, and setRoute can be called from a React effect that
   *     wins the race against the network. applyRoute bails while the style is
   *     unloaded, and this brings it back — so the bail is a deferral, never a
   *     silent drop.
   *   · EVERY setTheme. setStyle tears the whole style down and rebuilds it, and
   *     custom sources and layers are NOT carried across — they are simply gone,
   *     with no error and no event of their own. The theme is user-togglable at
   *     runtime, so without this the route would vanish the first time anyone
   *     touched the toggle and never come back.
   *
   * Markers need none of this: mapboxgl.Marker is a DOM element parked over the
   * canvas, so it is not part of the style and a style swap cannot touch it.
   *
   * Each attempt installs its own generation-bound listeners. Removing the old
   * listeners stops ordinary superseded events; the generation check also makes
   * an already-queued callback harmless after a rapid theme change.
   */
  private styleAttemptIsInstalled(generation: number): boolean {
    return generation === this.styleGeneration && this.styleInstalledGeneration === generation;
  }

  /**
   * `style.load`/`idle` or a positive isStyleLoaded probe make style mutation
   * safe. That is deliberately separate from visible readiness: production
   * Safari can emit all three while presenting a completely black WebGL frame.
   */
  private completeMutationSafeStyleAttempt(
    generation: number,
    theme: "light" | "dark",
    attempt: number,
    map: MapboxMap,
    epoch: number
  ): boolean {
    if (!this.currentMapIs(map, epoch) || !this.styleAttemptIsInstalled(generation)) {
      return false;
    }
    // Evidence from the outgoing style is not readiness — see styleNameFor.
    // Rejecting keeps this generation's listeners attached, so the intended
    // style's own style.load still completes the attempt.
    if (!this.liveStyleMatchesIntent(map)) return false;

    this.clearStyleLoadTimer();
    this.clearStyleMutationListeners();
    // Set BEFORE the applies: this event IS the fact they guard on.
    this.styleReady = true;
    this.pendingMutationSafeGeneration = null;
    this.applyCartography();
    this.armStyleFrameTimer(generation, map, epoch);
    // This requests evidence; it is never evidence itself.
    map.triggerRepaint();
    return true;
  }

  /**
   * Mapbox's `error` event also covers recoverable tile failures, so treating
   * every event as fatal would replace a usable map with an error card. Once a
   * current-generation usable render arrives, errors stay recoverable. Before
   * that, retain only the fact an error happened; never log its message, which
   * may contain request details that do not belong in diagnostics.
   */
  private handleMapError(
    event: MapboxErrorEvent,
    map: MapboxMap,
    epoch: number,
    generation: number
  ): void {
    if (!this.currentMapIs(map, epoch) || generation !== this.styleGeneration || this.styleUsable) {
      return;
    }
    this.styleErrorObserved = true;
    const message = event.error?.message?.toLowerCase() ?? "";
    if (message.includes("webgl") || message.includes("context") || message.includes("shader")) {
      this.rendererErrorObserved = true;
      this.armStyleFrameTimer(this.styleGeneration, map, epoch);
    }
  }

  private currentMapIs(map: MapboxMap, epoch: number): boolean {
    return this.mapInstance === map && this.mapEpoch === epoch;
  }

  private emitStyleLifecycle(state: MapStyleLifecycleState): void {
    this.setSafeDiagnostic("data-map-lifecycle", state.status);
    if (state.status === "failed") {
      this.setSafeDiagnostic("data-map-failure-reason", state.reason);
      // The failure surface (MapFailed, Retry) must never sit behind a
      // healthy-looking photograph of the previous theme.
      this.overlay.remove(false);
    } else {
      this.clearSafeDiagnostic("data-map-failure-reason");
    }
    if (state.status === "ready") {
      // The new style has produced a usable frame under the overlay;
      // cross-fade the old ground away.
      this.overlay.remove(true);
    }
    this.styleLifecycleListener?.(state);
  }

  private setSafeDiagnostic(name: string, value: string): void {
    const container = this.mapContainer;
    if (!container || typeof container.setAttribute !== "function") return;
    container.setAttribute(name, value);
  }

  private clearSafeDiagnostic(name: string): void {
    const container = this.mapContainer;
    if (!container || typeof container.removeAttribute !== "function") return;
    container.removeAttribute(name);
  }

  private recordFrameEvidence(evidence: FrameEvidence): void {
    this.frameEvidence = evidence;
    this.setSafeDiagnostic("data-map-frame-evidence", evidence);
  }

  private clearStyleLoadTimer(): void {
    if (this.styleLoadTimer === null) return;
    window.clearTimeout(this.styleLoadTimer);
    this.styleLoadTimer = null;
  }

  private clearStyleFrameTimer(): void {
    if (this.styleFrameTimer === null) return;
    window.clearTimeout(this.styleFrameTimer);
    this.styleFrameTimer = null;
  }

  private clearStyleReadinessListeners(): void {
    this.clearStyleMutationListeners();
    this.clearStyleRenderListener();
  }

  private clearStyleMutationListeners(): void {
    const map = this.styleListenerOwner;
    if (!map) return;
    if (this.styleReadyListener) {
      map.off("style.load", this.styleReadyListener);
      map.off("idle", this.styleReadyListener);
      this.styleReadyListener = null;
    }
    if (!this.styleRenderListener) this.styleListenerOwner = null;
  }

  private clearStyleRenderListener(): void {
    const map = this.styleListenerOwner;
    if (!map || !this.styleRenderListener) return;
    map.off("render", this.styleRenderListener);
    this.styleRenderListener = null;
    if (!this.styleReadyListener) this.styleListenerOwner = null;
  }

  /**
   * Read a bounded diagnostic grid while readiness is pending.
   * `preserveDrawingBuffer` remains false, so Safari is allowed to return black,
   * transparent or failed readback for a frame it presents. The result may
   * diagnose a renderer but never independently controls the user-visible
   * overlay.
   */
  private inspectFrameEvidence(map: MapboxMap): FrameReadEvidence {
    let gl: WebGLRenderingContext | WebGL2RenderingContext | null = null;
    let width = 0;
    let height = 0;
    try {
      const canvas = map.getCanvas();
      // Asking for the already-established context returns that context. Safari
      // may let Mapbox operate through WebGL1 after a WebGL2 allocation failure,
      // so WebGL2-only inspection would misclassify a visible map as missing.
      gl =
        (canvas.getContext("webgl2") as WebGL2RenderingContext | null) ??
        (canvas.getContext("webgl") as WebGLRenderingContext | null);
      if (!gl) return "context-unavailable";
      if (gl.isContextLost()) return "context-lost";
      width = gl.drawingBufferWidth;
      height = gl.drawingBufferHeight;
      if (width <= 0 || height <= 0) return "zero-buffer";
    } catch {
      return "gl-error";
    }

    const pixel = new Uint8Array(4);
    let opaqueBlackSamples = 0;
    let transparentSamples = 0;
    try {
      for (const xFraction of FRAME_SAMPLE_FRACTIONS) {
        for (const yFraction of FRAME_SAMPLE_FRACTIONS) {
          const x = Math.min(width - 1, Math.max(0, Math.floor(width * xFraction)));
          const y = Math.min(height - 1, Math.max(0, Math.floor(height * yFraction)));
          pixel.set(FRAME_READ_SENTINEL);
          gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
          if (FRAME_READ_SENTINEL.every((channel, index) => pixel[index] === channel)) {
            return "read-error";
          }
          if (
            pixel[3] > 0 &&
            Math.max(pixel[0], pixel[1], pixel[2]) >= VISIBLE_FRAME_CHANNEL_FLOOR
          ) {
            return "visible";
          }
          if (pixel[3] === 0) transparentSamples += 1;
          else opaqueBlackSamples += 1;
        }
      }
      if (opaqueBlackSamples === FRAME_SAMPLE_FRACTIONS.length ** 2) {
        return "black-sample";
      }
      if (transparentSamples > 0) return "read-error";
    } catch {
      try {
        if (gl?.isContextLost()) return "context-lost";
      } catch {
        // Context inspection can itself fail while Safari tears the GPU state down.
      }
      return "read-error";
    }
    return "read-error";
  }

  private corroborateFrameEvidence(
    generation: number,
    evidence: FrameReadEvidence
  ): FrameEvidence {
    if (evidence !== "black-sample") {
      this.blackFrameGeneration = null;
      this.blackFrameSamples = 0;
      return evidence;
    }
    if (this.blackFrameGeneration !== generation) {
      this.blackFrameGeneration = generation;
      this.blackFrameSamples = 1;
      return "pending";
    }
    this.blackFrameSamples += 1;
    return this.blackFrameSamples >= BLACK_FRAME_CORROBORATION_SAMPLES
      ? "genuinely-black"
      : "pending";
  }

  private completeUsableFrame(
    generation: number,
    theme: "light" | "dark",
    attempt: number,
    map: MapboxMap,
    epoch: number
  ): boolean {
    if (
      !this.currentMapIs(map, epoch) ||
      generation !== this.styleGeneration ||
      !this.styleReady ||
      this.contextLost ||
      this.routeIsolationFailed
    ) {
      return false;
    }
    const evidence = this.corroborateFrameEvidence(
      generation,
      this.inspectFrameEvidence(map)
    );
    this.recordFrameEvidence(evidence);
    if (evidence === "context-lost") this.contextLost = true;
    // A read failure remains diagnostic-only: it must never be promoted to
    // black or spend reconstruction. Visible pixels, or a current render whose
    // default framebuffer cannot be read reliably, may uncover the map.
    if (
      evidence === "pending" ||
      evidence === "genuinely-black" ||
      evidence === "context-unavailable" ||
      evidence === "context-lost" ||
      evidence === "zero-buffer" ||
      evidence === "gl-error"
    ) {
      return false;
    }

    const wasUsable = this.styleUsable;
    this.styleUsable = true;
    this.lastFailureReason = null;
    this.rendererErrorObserved = false;
    this.clearStyleFrameTimer();
    this.clearStyleRenderListener();
    // Replay only after the current style's subsequent usable render;
    // applyRoute still requires styleReady, so mutation safety is unchanged.
    // Route before glow: the glow anchors beneath the route layer when one
    // exists, so the route must already be in the stack.
    this.applyRoute();
    this.applyPlacesGlow();
    if (!wasUsable) {
      this.emitStyleLifecycle({
        status: "ready",
        generation,
        theme,
        attempt,
      });
    }
    return true;
  }

  /**
   * `style.load` and `idle` are definitive mutation-safe events. A later render
   * may recover a missed mutation-safe event, then exposes the map only while
   * the current established WebGL context remains present, non-lost and
   * non-zero.
   */
  private recognizeLoadedStyle(
    generation: number,
    theme: "light" | "dark",
    attempt: number,
    map: MapboxMap,
    epoch: number
  ): boolean {
    if (
      !this.currentMapIs(map, epoch) ||
      generation !== this.styleGeneration ||
      !map.isStyleLoaded()
    ) {
      return false;
    }
    return this.completeMutationSafeStyleAttempt(generation, theme, attempt, map, epoch);
  }

  /**
   * Observe either the constructor-owned initial style (`replaceStyle=false`)
   * or an in-place theme/retry swap. No map reconstruction is allowed here:
   * `setStyle` is precisely the seam that preserves camera and DOM markers.
   */
  private beginStyleAttempt(theme: "light" | "dark", attempt: number, replaceStyle: boolean): void {
    const map = this.mapInstance;
    if (!map) return;
    const epoch = this.mapEpoch;

    this.clearStyleLoadTimer();
    this.clearStyleFrameTimer();
    this.clearStyleReadinessListeners();
    const generation = ++this.styleGeneration;
    this.installGenerationErrorListener(map, epoch, generation);
    this.currentTheme = theme;
    this.styleReady = false;
    this.styleUsable = false;
    this.styleLoadAttempt = attempt;
    this.styleErrorObserved = false;
    this.rendererErrorObserved = false;
    this.contextLost = false;
    this.contextRecoveryStyleWasReady = false;
    this.routeIsolationFailed = false;
    this.frameEvidence = "pending";
    this.blackFrameGeneration = null;
    this.blackFrameSamples = 0;
    this.setSafeDiagnostic("data-map-frame-evidence", "pending");
    this.lastFailureReason = null;
    this.styleInstalledGeneration = replaceStyle ? null : generation;
    this.pendingMutationSafeGeneration = null;
    this.styleInstallInProgressGeneration = null;
    this.emitStyleLifecycle({
      status: "loading",
      generation,
      theme,
      attempt,
      continuity: this.overlay.active,
    });

    const readyListener = () => {
      if (!this.currentMapIs(map, epoch) || generation !== this.styleGeneration) {
        return;
      }
      if (this.styleInstallInProgressGeneration === generation) {
        // JavaScript cannot interleave an older queued event while setStyle is
        // on the stack. A synchronous style.load/idle here is therefore
        // causally owned by this exact replacement, but it cannot mutate or
        // uncover the map until setStyle returns successfully.
        this.pendingMutationSafeGeneration = generation;
        return;
      }
      // style.load and idle are Mapbox's public mutation-safe authorities.
      // Unlike isStyleLoaded(), style.load does not wait for every visible tile,
      // so it may replay cartography/routes before later tile content settles.
      this.completeMutationSafeStyleAttempt(generation, theme, attempt, map, epoch);
    };
    const renderListener = () => {
      if (!this.currentMapIs(map, epoch) || generation !== this.styleGeneration) {
        return;
      }
      if (!this.styleReady) {
        this.recognizeLoadedStyle(generation, theme, attempt, map, epoch);
      }
      if (this.styleReady) {
        this.completeUsableFrame(generation, theme, attempt, map, epoch);
      }
    };
    this.styleListenerOwner = map;
    this.styleReadyListener = readyListener;
    this.styleRenderListener = renderListener;
    map.on("style.load", readyListener);
    map.on("idle", readyListener);
    map.on("render", renderListener);
    this.styleLoadTimer = window.setTimeout(
      () => this.handleStyleLoadTimeout(generation),
      STYLE_LOAD_TIMEOUT_MS
    );

    if (replaceStyle) {
      this.styleInstallInProgressGeneration = generation;
      try {
        map.setStyle(MapboxAdapter.styleFor(theme));
        this.styleInstalledGeneration = generation;
      } catch {
        // A synchronous style rejection follows the same bounded retry policy
        // as an asynchronous resource error; it must not escape to React or
        // admit the still-loaded old theme.
        this.styleErrorObserved = true;
        this.styleInstallInProgressGeneration = null;
        this.pendingMutationSafeGeneration = null;
        this.clearStyleReadinessListeners();
        this.handleStyleLoadTimeout(generation, false);
        return;
      }
      this.styleInstallInProgressGeneration = null;
    }

    if (
      this.pendingMutationSafeGeneration === generation &&
      this.completeMutationSafeStyleAttempt(generation, theme, attempt, map, epoch)
    ) {
      return;
    }

    // setStyle can complete before its asynchronous event reaches this
    // listener. Recognize that state now instead of waiting for the timeout.
    if (!this.recognizeLoadedStyle(generation, theme, attempt, map, epoch)) {
      // Guarantees a post-install render signal even when a cached style emitted
      // its data/load events synchronously inside setStyle.
      map.triggerRepaint();
    }
  }

  private handleStyleLoadTimeout(generation: number, recognizeAlreadyLoaded = true): void {
    if (generation !== this.styleGeneration) return;
    this.clearStyleLoadTimer();
    const map = this.mapInstance;
    if (!map || this.styleReady || this.styleUsable) return;
    const epoch = this.mapEpoch;
    if (
      recognizeAlreadyLoaded &&
      this.recognizeLoadedStyle(generation, this.currentTheme, this.styleLoadAttempt, map, epoch)
    ) {
      return;
    }

    if (this.rendererErrorObserved) {
      this.handleStyleFrameTimeout(generation, map, epoch);
      return;
    }

    if (this.styleLoadAttempt < STYLE_LOAD_MAX_ATTEMPTS) {
      // This generation is being superseded by a retry, so detach it before
      // installing the next generation's listener.
      this.clearStyleReadinessListeners();
      this.beginStyleAttempt(this.currentTheme, this.styleLoadAttempt + 1, true);
      return;
    }

    // Failure is observable after the bounded attempts, but it is not terminal.
    // A slow, otherwise valid style may still become ready; keeping this final
    // generation's readiness listeners lets that state clear the failure
    // overlay and restore cartography/routes without rebuilding the map. A
    // manual retry or theme switch clears them and increments the generation.
    const reason = this.styleErrorObserved ? "error" : "timeout";
    this.lastFailureReason = reason;
    this.emitStyleLifecycle({
      status: "failed",
      generation,
      theme: this.currentTheme,
      attempt: this.styleLoadAttempt,
      reason,
    });
  }

  private armStyleFrameTimer(generation: number, map: MapboxMap, epoch: number): void {
    this.clearStyleFrameTimer();
    this.styleFrameTimer = window.setTimeout(
      () => this.handleStyleFrameTimeout(generation, map, epoch),
      STYLE_FRAME_TIMEOUT_MS
    );
  }

  private handleStyleFrameTimeout(generation: number, map: MapboxMap, epoch: number): void {
    if (!this.currentMapIs(map, epoch) || generation !== this.styleGeneration || this.styleUsable) {
      return;
    }
    this.clearStyleFrameTimer();

    const hasReconstructionEvidence =
      this.contextLost ||
      this.frameEvidence === "context-lost" ||
      this.frameEvidence === "genuinely-black";

    if (
      hasReconstructionEvidence &&
      this.automaticMapReconstructions < MAX_AUTOMATIC_MAP_RECONSTRUCTIONS
    ) {
      this.automaticMapReconstructions += 1;
      this.reconstructMap(map, epoch);
      return;
    }

    const reason = hasReconstructionEvidence
      ? this.contextLost ||
        this.frameEvidence === "context-lost"
        ? "context"
        : "renderer"
      : this.rendererErrorObserved
        ? "renderer"
        : "probe";
    this.lastFailureReason = reason;
    this.emitStyleLifecycle({
      status: "failed",
      generation,
      theme: this.currentTheme,
      attempt: this.styleLoadAttempt,
      reason,
    });
  }

  private installContextRenderListener(generation: number, map: MapboxMap, epoch: number): void {
    this.clearStyleRenderListener();
    const renderListener = () => {
      this.completeUsableFrame(generation, this.currentTheme, this.styleLoadAttempt, map, epoch);
    };
    this.styleListenerOwner = map;
    this.styleRenderListener = renderListener;
    map.on("render", renderListener);
  }

  private handleContextLost(map: MapboxMap, epoch: number): void {
    if (!this.currentMapIs(map, epoch)) return;
    const styleWasReady = this.styleReady;
    const styleWasUsable = this.styleUsable;
    this.clearStyleLoadTimer();
    this.clearStyleFrameTimer();
    this.clearStyleReadinessListeners();
    const generation = ++this.styleGeneration;
    this.installGenerationErrorListener(map, epoch, generation);
    this.styleReady = false;
    this.styleUsable = false;
    this.styleInstalledGeneration = generation;
    this.styleLoadAttempt = 1;
    this.styleErrorObserved = false;
    this.rendererErrorObserved = true;
    this.contextLost = true;
    this.contextRecoveryStyleWasReady = styleWasReady;
    this.routeIsolationFailed = false;
    this.frameEvidence = "context-lost";
    this.blackFrameGeneration = null;
    this.blackFrameSamples = 0;
    this.setSafeDiagnostic("data-map-frame-evidence", "context-lost");
    if (styleWasUsable) this.automaticMapReconstructions = 0;
    this.lastFailureReason = null;
    this.emitStyleLifecycle({
      status: "loading",
      generation,
      theme: this.currentTheme,
      attempt: 1,
      // A lost context has no trustworthy last frame to hold; the skeleton is
      // the honest surface while the renderer reconstructs.
      continuity: false,
    });
    this.armStyleFrameTimer(generation, map, epoch);
  }

  private handleContextRestored(map: MapboxMap, epoch: number): void {
    if (!this.currentMapIs(map, epoch) || !this.contextLost) return;
    const styleWasReady = this.contextRecoveryStyleWasReady;
    this.contextLost = false;
    this.contextRecoveryStyleWasReady = false;
    this.rendererErrorObserved = false;
    if (!styleWasReady) {
      this.beginStyleAttempt(this.currentTheme, 1, true);
      return;
    }

    const generation = this.styleGeneration;
    this.styleReady = true;
    this.styleInstalledGeneration = generation;
    this.routeIsolationFailed = !this.removeRouteForRendererProbe(map);
    this.applyCartography();
    this.installContextRenderListener(generation, map, epoch);
    this.armStyleFrameTimer(generation, map, epoch);
    map.triggerRepaint();
  }

  private reconstructMap(map: MapboxMap, epoch: number): void {
    if (!this.currentMapIs(map, epoch) || !this.mapboxgl || !this.mapContainer) {
      return;
    }

    let camera: MapRecoverySnapshot["camera"] | undefined;
    try {
      camera = {
        center: map.getCenter(),
        zoom: map.getZoom(),
        bearing: map.getBearing(),
        pitch: map.getPitch(),
      };
    } catch {
      // Rebuilding without the user's actual camera would falsify map state.
    }
    if (!camera) {
      this.failRendererRecovery();
      return;
    }

    const markers = new Set<MapboxMarker>([
      ...this.markersMap.values(),
      ...this.sharedUserMarkers.values(),
    ]);
    if (this.userMarker) markers.add(this.userMarker);
    const popup = this.activeUserPopup?.isOpen() ? this.activeUserPopup : null;
    const snapshot: MapRecoverySnapshot = { camera, markers, popup };
    this.detachedRecoverySnapshot = snapshot;

    this.styleGeneration += 1;
    this.clearStyleLoadTimer();
    this.clearStyleFrameTimer();
    this.clearStyleReadinessListeners();
    this.detachMapLifecycleListeners();
    this.mapEpoch += 1;
    try {
      map.remove();
    } catch {
      // Keep ownership of a Map that may still occupy the container. Explicit
      // Retry can attempt the same teardown again; constructing beside it
      // would create a duplicate canvas and make destroy unable to collect it.
      this.failRendererRecovery();
      return;
    }
    this.mapInstance = null;

    this.installReplacementMap(snapshot);
  }

  private installReplacementMap(snapshot: MapRecoverySnapshot): void {
    const mapboxgl = this.mapboxgl;
    const container = this.mapContainer;
    if (!mapboxgl || !container) {
      this.failRendererRecovery();
      return;
    }
    const theme = this.currentTheme;
    let replacement: MapboxMap;
    try {
      replacement = new mapboxgl.Map({
        container,
        style: MapboxAdapter.styleFor(theme),
        center: [snapshot.camera.center.lng, snapshot.camera.center.lat],
        zoom: snapshot.camera.zoom,
        bearing: snapshot.camera.bearing,
        pitch: snapshot.camera.pitch,
        attributionControl: false,
      });
    } catch {
      this.failRendererRecovery();
      return;
    }

    this.mapInstance = replacement;
    const replacementEpoch = ++this.mapEpoch;
    this.styleReady = false;
    this.styleUsable = false;
    this.contextLost = false;
    this.contextRecoveryStyleWasReady = false;
    this.routeIsolationFailed = false;
    this.frameEvidence = "pending";
    this.blackFrameGeneration = null;
    this.blackFrameSamples = 0;
    this.setSafeDiagnostic("data-map-frame-evidence", "pending");
    this.lastFailureReason = null;
    this.detachedRecoverySnapshot = null;
    this.attachMapLifecycleListeners(replacement, replacementEpoch);
    for (const marker of snapshot.markers) {
      try {
        marker.addTo(replacement);
      } catch {
        // One stale DOM marker must not prevent the basemap from recovering.
      }
    }
    if (snapshot.popup) {
      try {
        snapshot.popup.addTo(replacement);
        // Removing the old Map may synchronously fire Popup's close listener,
        // clearing this field. Reclaim ownership after the successful re-add.
        this.activeUserPopup = snapshot.popup;
      } catch {
        // The popup is optional; camera, basemap and markers remain authoritative.
      }
    }
    this.beginStyleAttempt(theme, 1, false);
    replacement.easeTo({
      padding: this.padding,
      essential: true,
      duration: 0,
    });
  }

  private failRendererRecovery(): void {
    const reason =
      this.contextLost ||
      this.frameEvidence === "context-unavailable" ||
      this.frameEvidence === "context-lost"
        ? "context"
        : "renderer";
    this.lastFailureReason = reason;
    this.emitStyleLifecycle({
      status: "failed",
      generation: this.styleGeneration,
      theme: this.currentTheme,
      attempt: this.styleLoadAttempt || 1,
      reason,
    });
  }

  /**
   * The cartography itself lives in cartography.ts; the guard stays here
   * because `mapInstance`/`styleReady` are adapter lifecycle state, and the
   * style overrides must never run against an unloaded style (an unguarded
   * write throws and nothing in this file catches it).
   */
  private applyCartography(): void {
    if (!this.mapInstance || !this.styleReady) return;
    applyCartographyToStyle(this.mapInstance, this.currentTheme);
  }

  /**
   * Swap basemaps in place when the theme changes, keeping camera and markers.
   *
   * Guarded on the currently-applied theme. Calling setStyle with the style the
   * map already has still tears the style down and rebuilds it from scratch —
   * and if that lands before the first style has finished loading, the map is
   * left blank. Since the theme effect fires once on mount with the initial
   * theme, an unguarded call blanked the map on every load.
   */
  public setTheme(theme: "light" | "dark"): void {
    if (!this.mapInstance) return;
    if (this.pendingThemeSwap !== null) {
      // A capture is already awaiting its render tick. Update the destination
      // and let that one callback do the single swap; toggling back to the
      // current theme cancels the swap in the callback.
      this.pendingThemeSwap = theme;
      return;
    }
    if (theme === this.currentTheme) return;
    this.automaticMapReconstructions = 0;
    if (this.lastFailureReason === "context" || this.lastFailureReason === "renderer") {
      const map = this.mapInstance;
      const epoch = this.mapEpoch;
      this.currentTheme = theme;
      this.lastFailureReason = null;
      this.reconstructMap(map, epoch);
      return;
    }
    if (!this.canPhotographCurrentFrame()) {
      // Nothing worth photographing is on screen. Swap directly, exactly as
      // before this overlay existed.
      this.setSafeDiagnostic("data-map-theme-snapshot", "skipped-not-photographable");
      this.beginStyleAttempt(theme, 1, true);
      return;
    }
    if (typeof document !== "undefined" && document.visibilityState === "hidden") {
      // A hidden document gets no animation frames, so the capture's render
      // tick cannot arrive — and nobody can see the rebuild anyway. Swapping
      // directly is both the fast path and the honest one (OS-scheduled theme
      // changes land while the tab is backgrounded).
      this.setSafeDiagnostic("data-map-theme-snapshot", "skipped-hidden");
      this.beginStyleAttempt(theme, 1, true);
      return;
    }
    const map = this.mapInstance;
    const epoch = this.mapEpoch;
    this.pendingThemeSwap = theme;
    captureThemeSnapshot(map, (dataUrl, outcome) => {
      const target = this.pendingThemeSwap;
      this.pendingThemeSwap = null;
      if (target === null || !this.currentMapIs(map, epoch)) return;
      // The user toggled back before the capture landed; the map is already
      // showing the theme they want.
      if (target === this.currentTheme) {
        this.setSafeDiagnostic("data-map-theme-snapshot", "cancelled-toggle-back");
        return;
      }
      // Same contract as data-map-frame-evidence: a safe record of what the
      // transition machinery decided, for drivers and refuters. It never
      // contains image data or location.
      this.setSafeDiagnostic("data-map-theme-snapshot", outcome);
      if (dataUrl) this.overlay.install(map, dataUrl);
      this.beginStyleAttempt(target, 1, true);
    });
  }

  /**
   * Photographable means pixels plausibly exist, NOT that the probe proved
   * them. `styleUsable` is the wrong gate here: environments whose default
   * framebuffer cannot be read (the probe reports `pending`/`read-error` and
   * the attempt eventually fails as "probe"/"timeout") still PAINT correctly —
   * that exact false-negative is why frame reads are diagnostic-only in
   * completeUsableFrame. The only states that make a photograph worse than the
   * bare background are a corroborated black canvas and a lost context.
   */
  private canPhotographCurrentFrame(): boolean {
    const map = this.mapInstance;
    if (!map || map.constructor.name === "FakeMap") return false;
    return (
      this.styleReady &&
      !this.contextLost &&
      this.frameEvidence !== "genuinely-black" &&
      this.frameEvidence !== "context-lost" &&
      this.frameEvidence !== "context-unavailable" &&
      this.frameEvidence !== "zero-buffer"
    );
  }

  /**
   * Style/network failures retry in place. Renderer/context failures require a
   * new WebGL context, so explicit Retry begins a fresh bounded reconstruction
   * episode rather than repainting the same broken canvas.
   */
  public retryStyle(): void {
    this.automaticMapReconstructions = 0;
    if (!this.mapInstance) {
      if (
        this.detachedRecoverySnapshot &&
        (this.lastFailureReason === "context" || this.lastFailureReason === "renderer")
      ) {
        this.lastFailureReason = null;
        this.installReplacementMap(this.detachedRecoverySnapshot);
      }
      return;
    }
    if (this.lastFailureReason === "context" || this.lastFailureReason === "renderer") {
      const map = this.mapInstance;
      const epoch = this.mapEpoch;
      this.lastFailureReason = null;
      this.reconstructMap(map, epoch);
      return;
    }
    this.beginStyleAttempt(this.currentTheme, 1, true);
  }

  /**
   * Tell the camera how much of the viewport is covered.
   *
   * The camera is usually still when this is called (the sheet moved, the map
   * did not), and the geographic centre must not change — only where on screen
   * that centre is drawn. `easeTo` with nothing but padding does exactly that:
   * it holds `center`, `zoom` and `bearing` and slides the map so the same point
   * sits in the middle of the new, smaller visible box. A `jumpTo` here would
   * teleport the world sideways under a sheet that is itself animating, which
   * reads as a glitch; the ease reads as the map making room.
   */
  public setPadding(padding: MapPadding, options?: { animate?: boolean }): void {
    this.padding = { ...padding };
    if (!this.mapInstance) return;
    this.mapInstance.easeTo({
      padding: this.padding,
      essential: true,
      duration: options?.animate === false ? 0 : duration(PADDING_DURATION_MS),
    });
  }

  public getPadding(): MapPadding {
    return { ...this.padding };
  }

  /**
   * Fly to a point, keeping the current zoom.
   *
   * The padding is what makes this correct. Without it Mapbox centres on the
   * full viewport, so with the sheet up at medium the target landed 26% of the
   * screen height BELOW the sheet's top edge — i.e. the app "centred" on
   * something the user could not see. See MapboxCanvas for where padding
   * comes from.
   */
  public setCenter(lat: number, lng: number): void {
    if (!this.mapInstance) return;
    this.mapInstance.flyTo({
      center: [lng, lat],
      padding: this.padding,
      essential: true,
      duration: duration(FLY_DURATION_MS),
    });
  }

  /**
   * RECENTER — put a point back under the user's eye at a legible zoom.
   *
   * Distinct from setCenter: this asserts a zoom as well as a centre, which is
   * what "take me back to where I am" means after the user has pinched out to
   * the whole city. Padding-aware for the same reason as everything else here.
   */
  public recenterTo(lat: number, lng: number, zoom: number = 14.5): void {
    if (!this.mapInstance) return;
    this.mapInstance.flyTo({
      center: [lng, lat],
      zoom,
      padding: this.padding,
      essential: true,
      duration: duration(FLY_DURATION_MS),
    });
  }

  /**
   * FIT — frame a whole route so both ends stay on the visible map.
   *
   * The camera used to ignore the route completely: `setRoute` drew the line
   * and nothing moved, so a seller far from the user ran the line straight off
   * the viewport and neither end was guaranteed to be visible.
   *
   * Three things make this correct rather than merely close:
   *
   *   · IT FITS THE GEOMETRY, NOT THE TWO ENDPOINTS. A real road route detours
   *     — around a creek, around Festac's grid — and a box drawn from origin
   *     and destination alone leaves that corridor hanging outside the frame.
   *     Every coordinate is bounded.
   *   · IT IS PADDING-AWARE, which is the whole point of the ask. "Keep both in
   *     view above the sheet" means the pair must fit in the ~48% of the screen
   *     the sheet is not covering at the medium detent, not in the full canvas.
   *     `this.padding` already models exactly that, so fitBounds solves the zoom
   *     against the visible band and both ends land where they can be seen.
   *   · IT CAPS THE ZOOM. Two points a few metres apart would otherwise fit at
   *     z22, i.e. the camera slamming into the pavement because the seller is
   *     next door. The cap keeps "very close" reading as a map.
   *
   * Deliberately NOT `fitBounds` on a bare pair: see above. Deliberately not a
   * zoom computed from a distance either — the projection is Mapbox's business.
   */
  public fitRoute(coords: RouteGeometry, options?: { maxZoom?: number }): void {
    if (!this.mapInstance) return;

    // Snapshot before validation and reduction. RouteGeometry is an array
    // supplied by a caller; if that array is mutated or exposes changing
    // coordinate accessors, Mapbox must still never see a partial/NaN bounds.
    let safeCoords: unknown;
    try {
      if (!Array.isArray(coords)) return;
      const snapshot: unknown[] = [];
      for (let index = 0; index < coords.length; index += 1) {
        const point: unknown = coords[index];
        if (!Array.isArray(point)) {
          snapshot.push(point);
          continue;
        }

        const snapshotPoint: unknown[] = [];
        for (let coordinate = 0; coordinate < point.length; coordinate += 1) {
          snapshotPoint.push(point[coordinate]);
        }
        snapshot.push(snapshotPoint);
      }
      safeCoords = snapshot;
    } catch {
      return;
    }
    if (!isRenderableRoute(safeCoords)) return;

    let west = safeCoords[0][0];
    let east = safeCoords[0][0];
    let south = safeCoords[0][1];
    let north = safeCoords[0][1];
    for (const [lng, lat] of safeCoords) {
      if (lng < west) west = lng;
      if (lng > east) east = lng;
      if (lat < south) south = lat;
      if (lat > north) north = lat;
    }

    // Keep the provider boundary fail-closed. Mapbox throws an uncaught
    // "Invalid LngLat object" for NaN bounds; a bad route should disappear,
    // not take down the whole React tree. Padding is checked too because it is
    // part of the same camera request and can come from measured layout state.
    if (![west, east, south, north].every(Number.isFinite) || !isRenderablePadding(this.padding)) {
      return;
    }

    try {
      const canvas = this.mapInstance.getCanvas();
      const containerWidth = canvas?.clientWidth || (typeof window !== "undefined" ? window.innerWidth : 800);
      const containerHeight = canvas?.clientHeight || (typeof window !== "undefined" ? window.innerHeight : 600);
      const isMobile = containerWidth < 768;

      const effectivePadding = {
        top: Math.max(this.padding.top || 0, 80),
        // A snapped mobile sheet occupies most of the lower canvas. Reserve a
        // larger route viewport than ordinary map movement so both endpoints
        // and the full line are framed together above the sheet, rather than
        // leaving the user to zoom out and pan after every selection.
        bottom: Math.max(this.padding.bottom || 0, isMobile ? Math.round(containerHeight * 0.64) : 80),
        left: Math.max(this.padding.left || 0, isMobile ? 30 : Math.min(460, Math.round(containerWidth * 0.42))),
        right: Math.max(this.padding.right || 0, 30),
      };

      this.mapInstance.fitBounds(
        [
          [west, south],
          [east, north],
        ],
        {
          padding: effectivePadding,
          maxZoom: options?.maxZoom ?? FIT_MAX_ZOOM,
          essential: true,
          duration: duration(FLY_DURATION_MS),
        }
      );
    } catch {
      // Mapbox can reject a camera request at runtime even after local
      // validation (for example while the map is being torn down). Route
      // framing is optional; keeping the map mounted is the required outcome.
    }
  }

  /**
   * Where a coordinate currently lands on screen, in canvas pixels.
   *
   * Exists so occlusion can be asserted rather than eyeballed — a caller (or a
   * test harness) can check that a target sits above the sheet's top edge.
   */
  public projectPoint(lat: number, lng: number): ScreenPoint | null {
    if (!this.mapInstance) return null;
    return this.mapInstance.project([lng, lat]);
  }

  public addMarker(options: MapMarkerOptions): void {
    if (!this.mapInstance) return;

    const mapboxgl = (window as unknown as WindowWithMapboxgl).mapboxgl;
    if (!mapboxgl) return;

    // A second add under an id this map already holds used to overwrite the
    // markersMap entry and orphan the prior Marker's DOM node — reproduced as
    // 60 → 72 pin elements across five search cycles (QA sweep D1). Upstream
    // can legitimately publish duplicate ids (multi-offer places out of
    // useHomePage — that root belongs to another lane), so the adapter must
    // stay leak-free regardless of what arrives: retire the whole prior
    // identity, parallel-state entries included, before installing the new one.
    const duplicate = this.markersMap.get(options.id);
    if (duplicate) {
      duplicate.remove();
      this.markersMap.delete(options.id);
      this.markerEls.delete(options.id);
      this.markerPlaces.delete(options.id);
    }

    // Create custom borderless marker element following Apple HIG
    const el = document.createElement("div");
    el.className = `h-9 w-9 rounded-full shadow-md flex items-center justify-center cursor-pointer transition-transform hover:scale-105 active:scale-95 duration-micro`;
    el.style.outlineOffset = "3px";

    // Status colors conforming to Section 17.3 (Borderless)
    if (options.status === "confirmed") {
      el.className += " bg-status-confirmed text-onStatus";
    } else if (options.status === "caution") {
      el.className += " bg-status-caution text-onStatus";
    } else if (options.status === "unavailable") {
      el.className += " bg-status-unavailable text-onStatus";
    } else {
      // Neutral startup market pins (Apple HIG gray style)
      el.className += " bg-fillSecondary text-accent";
    }

    const placeType = options.placeType ?? "";
    const symbol = PLACE_TYPE_SYMBOLS[placeType];
    const symbolLabel = PLACE_TYPE_LABELS[placeType];

    // Use a deterministic semantic symbol where the domain provides one.
    el.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        ${symbol ?? '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>'}
      </svg>
    `;
    const accessibleLabel = symbolLabel ? `${options.label}, ${symbolLabel}` : options.label;
    MapboxAdapter.applyMarkerSelection(el, accessibleLabel, options.selected === true);

    if (options.onClick) {
      const activate = () => {
        options.onClick?.();
      };
      el.addEventListener("click", activate);
      // A pointer-only pin fails WCAG 2.1.1: a plain div is not focusable and
      // claims no key semantics. role/tabIndex arrive only WITH a handler —
      // an inert "button" would be a worse lie than a plain div. Enter and
      // Space run the exact click body; only Space needs its default stopped,
      // because Space scrolls the page and Enter does nothing on a div.
      el.setAttribute("role", "button");
      el.tabIndex = 0;
      el.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        if (event.key === " ") event.preventDefault();
        activate();
      });
      // Focus visibility is managed by hand for the same reason the ring
      // constant exists: the selection path writes inline outlines, and an
      // inline "none" also erases the UA's :focus-visible indicator.
      el.addEventListener("focus", () => {
        el.style.outline = MapboxAdapter.markerOutlineFor(
          el.getAttribute("aria-current") === "true",
          true
        );
      });
      el.addEventListener("blur", () => {
        el.style.outline = MapboxAdapter.markerOutlineFor(
          el.getAttribute("aria-current") === "true",
          false
        );
      });
    }

    const markerInstance = new mapboxgl.Marker(el)
      .setLngLat([options.lng, options.lat])
      .addTo(this.mapInstance);

    this.markersMap.set(options.id, markerInstance);
    this.markerEls.set(options.id, { el, label: accessibleLabel });
    if (options.selected === true) this.selectedMarkerId = options.id;

    if (PLACES_GLOW_TYPES.has(placeType)) {
      // Recorded only. The glow reconciliation is deliberately NOT run per
      // add — that made a batch of N adds O(N²), each one re-serialising the
      // whole collection through setData. The canvas signals the end of its
      // loop via markersBatchComplete, and the style-swap replay in
      // completeUsableFrame reads this same map, so nothing recorded here is
      // ever dropped.
      this.markerPlaces.set(options.id, { lng: options.lng, lat: options.lat });
    }
  }

  /**
   * The ONE selected-pin treatment, shared by addMarker (initial state) and
   * setMarkerSelected (in-place restyle) so the two paths cannot drift: the
   * QA sweep asserts the 3px accent outline, scale 1.16, aria-current and the
   * ", selected" label suffix verbatim, and a second copy of any of those is
   * how one path silently stops matching. The base label is a parameter
   * rather than read back off the element so the suffix can never stack.
   */
  private static applyMarkerSelection(
    el: HTMLDivElement,
    baseLabel: string,
    selected: boolean
  ): void {
    el.setAttribute("aria-current", selected ? "true" : "false");
    // The scale is written only while the element is still ours. A custom
    // element handed to mapboxgl.Marker has its inline transform OWNED by
    // mapbox from addTo onwards — positioning writes translate(...) into it
    // on every camera render, which is also why the 1.16 has never visibly
    // survived on a mounted pin (measured: the selected pin renders at the
    // same 36px as its neighbours, before and after this refactor). Writing
    // transform on a LIVE marker would teleport the pin to the canvas origin
    // until the next camera render; skipping it preserves the exact terminal
    // state the old clear-and-rebuild path produced.
    if (!el.style.transform.includes("translate")) {
      el.style.transform = selected ? "scale(1.16)" : "scale(1)";
    }
    el.setAttribute("aria-label", selected ? `${baseLabel}, selected` : baseLabel);
    const focused = typeof document !== "undefined" && document.activeElement === el;
    el.style.outline = MapboxAdapter.markerOutlineFor(selected, focused);
  }

  /**
   * Selection beats focus: a selected pin shows the 3px outline whether or
   * not it holds focus (the states coincide the moment Enter activates a
   * pin), and an unselected focused pin keeps a visible ring — see
   * MARKER_FOCUS_OUTLINE for why the UA's own indicator cannot survive here.
   */
  private static markerOutlineFor(selected: boolean, focused: boolean): string {
    if (selected) return "3px solid var(--color-accent)";
    return focused ? MARKER_FOCUS_OUTLINE : "none";
  }

  /**
   * Restyle the selection in place, tearing nothing down.
   *
   * MapboxCanvas used to carry selectedPlaceId in its marker effect's deps,
   * so every selection change cleared and re-added all N markers — DOM,
   * listeners, glow records — to change the styling of at most two of them.
   * The rebuild now belongs to the candidate list alone; selection travels
   * through here and touches only the outgoing and the incoming pin, through
   * the same private addMarker uses, so the two paths render identically.
   *
   * An id with no live element is recorded, not rejected: the canvas may set
   * a selection the next rebuild will materialise (addMarker's `selected`
   * option reads the same intent), and recording it keeps the repeat call
   * after that rebuild an honest no-op.
   */
  public setMarkerSelected(id: string | null): void {
    if (id === this.selectedMarkerId) return;
    const previous =
      this.selectedMarkerId !== null ? this.markerEls.get(this.selectedMarkerId) : undefined;
    if (previous) MapboxAdapter.applyMarkerSelection(previous.el, previous.label, false);
    this.selectedMarkerId = id;
    const next = id !== null ? this.markerEls.get(id) : undefined;
    if (next) MapboxAdapter.applyMarkerSelection(next.el, next.label, true);
  }

  /**
   * The end-of-batch signal for the canvas's add loop: one glow
   * reconciliation for the whole collection, instead of one per addMarker
   * (see the note in addMarker for the O(N²) this retires). Safe to call
   * before the style is usable — applyPlacesGlow defers exactly as it always
   * has, and the completeUsableFrame replay covers the deferred case.
   */
  public markersBatchComplete(): void {
    this.applyPlacesGlow();
  }

  public clearMarkers(): void {
    this.markersMap.forEach((marker) => marker.remove());
    this.markersMap.clear();
    this.markerEls.clear();
    // Only touch the style when there is something to retract: clearMarkers
    // also runs during destroy, where an idle glow must not become a style
    // mutation on the way out.
    if (this.markerPlaces.size > 0) {
      this.markerPlaces.clear();
      this.applyPlacesGlow();
    }
  }

  /**
   * The user's own fresh-device indicator.
   *
   * Styled with inline custom properties rather than Tailwind classes, unlike
   * addMarker above. Not a preference — a correctness constraint: this file
   * lives in src/integrations, which is NOT in tailwind.config's `content`
   * globs, so a class named here is only ever emitted if some scanned file
   * happens to use the same one. addMarker's `shadow-md`, `hover:scale-105` and
   * `active:scale-95` resolve to nothing today for exactly that reason. The
   * tokens below are read from the cascade at paint time, so they cannot be
   * tree-shaken out from under this element.
   */
  public setUserPosition(options: UserPositionOptions | null): void {
    if (!options) {
      this.userMarker?.remove();
      this.userMarker = null;
      this.userMarkerEl = null;
      this.userMarkerPrecision = null;
      this.userMarkerIdentityKey = null;
      this.userMarkerAccuracyKey = null;
      return;
    }

    if (!this.mapInstance) return;
    const mapboxgl = (window as unknown as WindowWithMapboxgl).mapboxgl;
    if (!mapboxgl) return;

    // Move the existing element when only the coordinate changed. A device fix
    // updates far more often than its precision does, and rebuilding the node
    // each time would churn the DOM for no visible gain.
    const identityName = options.identity?.name.trim() || "Me";
    const accessibleLabel = `${identityName}; ${options.label}`;
    const identityKey = `${options.identity?.name ?? ""}\u0000${options.identity?.avatarUrl ?? ""}`;
    const accuracyKey = userAccuracyHaloSize(options.accuracyM);
    if (
      this.userMarker &&
      this.userMarkerPrecision === options.precision &&
      this.userMarkerIdentityKey === identityKey &&
      this.userMarkerAccuracyKey === accuracyKey
    ) {
      this.userMarkerEl?.setAttribute("aria-label", accessibleLabel);
      this.userMarker.setLngLat([options.lng, options.lat]);
      return;
    }

    this.userMarker?.remove();
    const el = MapboxAdapter.buildUserPositionElement(
      options.precision,
      options.accuracyM,
      accessibleLabel,
      options.identity
    );
    this.userMarker = new mapboxgl.Marker(el)
      .setLngLat([options.lng, options.lat])
      .addTo(this.mapInstance);
    this.userMarkerEl = el;
    this.userMarkerPrecision = options.precision;
    this.userMarkerIdentityKey = identityKey;
    this.userMarkerAccuracyKey = accuracyKey;
  }

  public setSharedUserMarkers(users: SharedUserLocation[]): void {
    const map = this.mapInstance;
    if (!map) return;
    const mapboxgl = (window as unknown as WindowWithMapboxgl).mapboxgl;
    if (!mapboxgl) return;

    // 1. Remove markers that are no longer in the list
    const activeIds = new Set(users.map((u) => u.userId));
    this.sharedUserMarkers.forEach((marker, id) => {
      if (!activeIds.has(id)) {
        marker.remove();
        this.sharedUserMarkers.delete(id);
      }
    });

    // 2. Add or update markers
    users.forEach((user) => {
      const existing = this.sharedUserMarkers.get(user.userId);
      if (existing) {
        existing.setLngLat([user.longitude, user.latitude]);
      } else {
        const el = document.createElement("div");
        el.className = "shared-user-marker";
        el.style.width = "40px";
        el.style.height = "40px";
        el.style.borderRadius = "12px"; // Apple HIG continuous-like squircle
        el.style.boxShadow = "var(--shadow-raised)";
        el.style.border = "2px solid #FFFFFF";
        el.style.backgroundColor = "var(--color-status-info)";
        el.style.display = "flex";
        el.style.alignItems = "center";
        el.style.justifyContent = "center";
        el.style.cursor = "pointer";
        el.style.overflow = "hidden";
        el.style.transition = "transform 0.2s ease-in-out";

        el.addEventListener("mouseenter", () => {
          el.style.transform = "scale(1.1)";
        });
        el.addEventListener("mouseleave", () => {
          el.style.transform = "scale(1)";
        });

        if (user.avatarUrl) {
          const img = document.createElement("img");
          img.src = user.avatarUrl;
          img.style.width = "100%";
          img.style.height = "100%";
          img.style.objectFit = "cover";
          el.appendChild(img);
        } else {
          // Initials fallback
          const initials =
            user.name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .substring(0, 2)
              .toUpperCase() || "?";

          const text = document.createElement("span");
          text.textContent = initials;
          text.style.color = "#FFFFFF";
          text.style.fontWeight = "bold";
          text.style.fontSize = "13px";
          el.appendChild(text);
        }

        el.title = user.name;

        // ADR-016: community presence interaction belongs to a ModalSheet
        // Community Presence Card (Wave / Block / Report / Close), and
        // contact-channel UI (call, SMS, WhatsApp) is prohibited. No popup is
        // built here; the MapboxPopup plumbing (activeUserPopup,
        // MapRecoverySnapshot.popup) remains only so renderer recovery can
        // re-add a popup that survives reconstruction.
        const activate = (e: Event) => {
          e.stopPropagation(); // Avoid triggering map clicks

          this.recenterTo(user.latitude, user.longitude, 14.5);
        };
        el.addEventListener("click", activate);
        // Same WCAG 2.1.1 treatment as addMarker: the click above is a real
        // action (ADR-016 reduced it to recenter, it did not remove it), so
        // the keyboard mirrors it. Presence markers never carry the place
        // pins' selection outline, so the plain focus ring needs no
        // selected-state arbitration here.
        el.setAttribute("role", "button");
        el.setAttribute("aria-label", `Recenter on ${user.name}`);
        el.tabIndex = 0;
        el.addEventListener("keydown", (event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          if (event.key === " ") event.preventDefault();
          activate(event);
        });
        el.addEventListener("focus", () => {
          el.style.outline = MARKER_FOCUS_OUTLINE;
          el.style.outlineOffset = "3px";
        });
        el.addEventListener("blur", () => {
          el.style.outline = "none";
        });

        const markerInstance = new mapboxgl.Marker(el)
          .setLngLat([user.longitude, user.latitude])
          .addTo(map);

        this.sharedUserMarkers.set(user.userId, markerInstance);
      }
    });
  }

  /**
   * Two shapes, because there are two different claims to make.
   *
   * Both are systemBlue and neither carries a glyph, so they read as one family
   * and as a different KIND of thing from a place marker — which is 36px, opaque,
   * green/orange/red-or-grey, and has a pin inside it. That confusion is the bug
   * this exists to end: the map had never drawn the user at all, so a place
   * marker was the only candidate for "me".
   *
   * The identity orb is stable for both precise and approximate fixes. Accuracy
   * is a separate fading sibling whose relative size follows the browser's
   * reported radius; it never replaces or blurs the identity.
   */
  private static buildUserPositionElement(
    precision: UserPositionPrecision,
    accuracyM: number,
    label: string,
    identity: UserPositionOptions["identity"]
  ): HTMLDivElement {
    const el = document.createElement("div");
    el.setAttribute("role", "img");
    const identityName = identity?.name.trim() || "Me";
    el.setAttribute("aria-label", label);
    // The indicator is never a target. Without this the area disc would swallow
    // taps across 48px of map, including any place marker underneath it.
    el.style.pointerEvents = "none";

    const size = userAccuracyHaloSize(accuracyM);
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.display = "grid";
    el.style.placeItems = "center";
    el.style.position = "relative";
    el.style.borderRadius = "50%";

    // Accuracy and identity are siblings. A large uncertainty region can never
    // blur, replace, or masquerade as the user's avatar/initials orb.
    const halo = document.createElement("span");
    halo.setAttribute("aria-hidden", "true");
    halo.style.position = "absolute";
    halo.style.inset = "0";
    halo.style.borderRadius = "50%";
    halo.style.background =
      "radial-gradient(circle closest-side, var(--color-status-info-bg) 0%," +
      " var(--color-status-info-bg) 58%, transparent 100%)";
    halo.style.opacity = precision === "precise" ? "0.72" : "1";
    el.appendChild(halo);

    const orb = document.createElement("span");
    orb.style.width = `${USER_ORB_SIZE}px`;
    orb.style.height = `${USER_ORB_SIZE}px`;
    orb.style.display = "grid";
    orb.style.placeItems = "center";
    orb.style.position = "relative";
    orb.style.borderRadius = "50%";
    orb.style.overflow = "hidden";
    orb.style.background = "var(--color-status-info)";
    orb.style.color = "var(--color-text-on-accent, #FFFFFF)";
    orb.style.boxShadow = "var(--shadow-raised)";

    const fallback = document.createElement("span");
    fallback.textContent =
      identityName === "Me"
        ? "Me"
        : identityName
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((part) => part[0]?.toUpperCase() ?? "")
            .join("") || "Me";
    fallback.style.fontSize = "11px";
    fallback.style.fontWeight = "700";
    fallback.style.lineHeight = "1";
    fallback.style.position = "absolute";
    fallback.style.inset = "0";
    fallback.style.display = "grid";
    fallback.style.placeItems = "center";
    fallback.style.zIndex = "0";
    orb.appendChild(fallback);

    if (identity?.avatarUrl) {
      const image = document.createElement("img");
      image.alt = "";
      image.style.position = "absolute";
      image.style.inset = "0";
      image.style.width = "100%";
      image.style.height = "100%";
      image.style.objectFit = "cover";
      image.style.zIndex = "1";
      // Initials exist until the image proves it loaded. Success removes them
      // even for a transparent avatar; failure removes only the image and keeps
      // the local, accessible fallback visible.
      image.onload = () => fallback.remove();
      image.onerror = () => image.remove();
      image.src = identity.avatarUrl;
      orb.appendChild(image);
    }

    el.appendChild(orb);
    return el;
  }

  /**
   * Draw a route from geometry someone else computed.
   *
   * Deliberately NOT a provider request. This takes coordinates and nothing else
   * — no origin, no destination, no profile, no API, no key — so whoever
   * computes the line is invisible from here and replaceable without touching
   * the render layer. That is the only reason this file has no opinion to
   * revise now that ADR-001 has ruled fulfilment out of scope: the decision
   * removed a candidate SOURCE, and a seam that only ever accepted geometry
   * never depended on which source it was.
   *
   * The whole route state is set in one call: omitting `options` resets the tint
   * to the default rather than leaving the last one applied, so a caller cannot
   * inherit a colour it never asked for.
   */
  public setRoute(coords: RouteGeometry | null, options?: { tint?: RouteTint }): void {
    // Copied, not held: the caller's array is theirs to mutate, and this one has
    // to survive until the next style rebuild replays it.
    this.routeCoords = isRenderableRoute(coords)
      ? coords.map(([lng, lat]): [number, number] => [lng, lat])
      : null;
    this.routeTint = options?.tint ?? "accent";
    this.applyRoute();
  }

  /**
   * Context restoration retains the JavaScript style, including our route and
   * the places glow. Remove that custom paint before probing the restored
   * framebuffer so a bright route — or amber glow pixels that clear the
   * channel floor — over a black basemap cannot certify the basemap as
   * usable. Both replay from completeUsableFrame once the probe passes.
   */
  private removeRouteForRendererProbe(map: MapboxMap): boolean {
    try {
      if (map.getLayer(ROUTE_LAYER_ID)) map.removeLayer(ROUTE_LAYER_ID);
      if (map.getSource(ROUTE_SOURCE_ID)) map.removeSource(ROUTE_SOURCE_ID);
      if (map.getLayer(PLACES_GLOW_LAYER_ID)) map.removeLayer(PLACES_GLOW_LAYER_ID);
      if (map.getSource(PLACES_SOURCE_ID)) map.removeSource(PLACES_SOURCE_ID);
      return true;
    } catch {
      // If isolation itself is unsafe, keep the overlay and take the bounded
      // renderer recovery path instead of trusting contaminated pixels.
      this.rendererErrorObserved = true;
      return false;
    }
  }

  /**
   * Reconcile the live style with `routeCoords`.
   *
   * Existence is asked of the map every time rather than tracked in a field.
   * That is the trap this avoids: setStyle destroys custom layers and sources
   * silently, so any flag we kept would still say "added" over a style that no
   * longer has them, and the next call would try to update a layer that is gone.
   * The map is the only thing that knows.
   */
  private applyRoute(): void {
    const map = this.mapInstance;
    if (!map) return;

    /**
     * `styleReady` tracks the ONE fact addSource/addLayer actually require, and
     * neither Mapbox predicate expresses it. Both alternatives were tried here
     * and both are wrong in opposite directions:
     *
     *   `isStyleLoaded()` is TOO STRICT. It calls `Style.loaded()`, which also
     *   demands every source cache have tiles and the sprite have arrived. At the
     *   instant `style.load` fires, the sprite is still in flight — so it is
     *   FALSE inside the very handler that exists to re-add the route. The replay
     *   became a permanent drop: toggle the theme and the line never returns.
     *
     *   `getStyle()` is TOO LOOSE. It returns a style object before the style has
     *   loaded, so the adds it lets through throw "Style is not done loading" —
     *   which crashed the whole app to its error boundary, because a Mapbox throw
     *   is not caught by anything here.
     *
     * The predicate we want is Mapbox's internal `_loaded`, which is true from
     * `style.load` and false again the moment `setStyle` begins a new one. It is
     * private, so we keep our own — set in the load handler, cleared in setTheme.
     * We are not guessing at Mapbox's state; we are recording the event it tells
     * us about.
     */
    if (!this.styleReady || !this.styleUsable) return;

    const hasLayer = Boolean(map.getLayer(ROUTE_LAYER_ID));
    const hasSource = Boolean(map.getSource(ROUTE_SOURCE_ID));
    const coords = this.routeCoords;

    if (!coords) {
      // Layer first, always: removing a source that a layer still references
      // throws. The reverse order is the classic way to strand a broken style.
      if (hasLayer) map.removeLayer(ROUTE_LAYER_ID);
      if (hasSource) map.removeSource(ROUTE_SOURCE_ID);
      return;
    }

    const colour = readToken(ROUTE_TINT_TOKEN[this.routeTint]);
    if (!colour) return;

    const data: RouteFeature = {
      type: "Feature",
      properties: {},
      geometry: { type: "LineString", coordinates: coords },
    };

    if (hasSource) map.getSource(ROUTE_SOURCE_ID)?.setData(data);
    else map.addSource(ROUTE_SOURCE_ID, { type: "geojson", data });

    if (hasLayer) {
      map.setPaintProperty(ROUTE_LAYER_ID, "line-color", colour);
      return;
    }

    map.addLayer(
      {
        id: ROUTE_LAYER_ID,
        type: "line",
        source: ROUTE_SOURCE_ID,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": colour, "line-width": ROUTE_WIDTH_PX },
      },
      this.firstSymbolLayerId(map)
    );
  }

  /**
   * The layer to slot the route BENEATH: the first text LABEL, not the first
   * symbol of any kind. This is the anchor, and getting it wrong is what made
   * the light route read as a hollow outline.
   *
   * The route has to sit ABOVE the roads (or the roads paint over it) and BELOW
   * the labels (or it scribbles over every street name). "First symbol layer"
   * looked like it meant "below the labels", and in dark-v11 it happens to —
   * its first symbol IS `road-label-simple`, above every road. But streets-v12
   * is a full reference map, and ITS first symbol is `tunnel-oneway-arrow-blue`,
   * a road-network glyph sitting BELOW 52 more road line layers. Anchoring there
   * dropped the route beneath the whole road stack, so the opaque light roads
   * painted over the 4px line and left only the slivers between them showing —
   * a solid line rendered as a broken outline, in light only, because dark never
   * had roads above the anchor to occlude it.
   *
   * The honest anchor is the first LABEL. Verified against both live styles:
   * the first symbol whose id contains "label" (streets-v12 `building-number-
   * label`, dark-v11 `road-label-simple`) has ZERO road line layers above it in
   * either, so the route lands on top of every road, and every real label still
   * draws over the route. Road-network symbols — arrows, shields — never carry
   * "label" in their id, so they do not falsely match.
   *
   * Falls back to the first symbol of any kind, then to undefined (top of stack)
   * — a style with no label layer has nothing for the route to hide beneath, so
   * drawing on top is harmless.
   *
   * Re-read on every apply, never cached: the layer stack belongs to the style,
   * and setTheme replaces the style with a different one.
   */
  private firstSymbolLayerId(map: MapboxMap): string | undefined {
    const layers = map.getStyle()?.layers;
    if (!layers) return undefined;
    const firstLabel = layers.find(
      (layer) => layer.type === "symbol" && layer.id.includes("label")
    );
    if (firstLabel) return firstLabel.id;
    return layers.find((layer) => layer.type === "symbol")?.id;
  }

  /**
   * Reconcile the live style with `markerPlaces` — the market ground glow.
   *
   * Same discipline as applyRoute, for the same reasons: existence is asked
   * of the map every time (setStyle destroys custom layers silently), the
   * styleReady/styleUsable gate defers rather than drops (the replay in
   * completeUsableFrame brings the glow back after every style rebuild, which
   * is also how a theme change re-resolves colour and opacity — both read
   * `currentTheme` at apply time), and an empty collection updates in place
   * rather than removing the layer, because clearMarkers/addMarker churn on
   * every search and add/remove churn would rebuild the layer each keystroke.
   *
   * The method-presence checks have no Mapbox counterpart in applyRoute and
   * exist for the FakeMap seam: test doubles owned by other lanes stub only
   * the surface their contract exercises, and a glow that assumes the full
   * Map API would make marker admission throw under them.
   */
  private applyPlacesGlow(): void {
    const map = this.mapInstance;
    if (!map || !this.styleReady || !this.styleUsable) return;
    if (
      typeof map.getSource !== "function" ||
      typeof map.addSource !== "function" ||
      typeof map.getLayer !== "function" ||
      typeof map.addLayer !== "function" ||
      typeof map.setPaintProperty !== "function"
    ) {
      return;
    }

    const data: PlacesFeatureCollection = {
      type: "FeatureCollection",
      features: Array.from(this.markerPlaces.values(), ({ lng, lat }): PlaceFeature => ({
        type: "Feature",
        properties: {},
        geometry: { type: "Point", coordinates: [lng, lat] },
      })),
    };

    const source = map.getSource(PLACES_SOURCE_ID);
    if (source) source.setData(data);
    else map.addSource(PLACES_SOURCE_ID, { type: "geojson", data });

    const colour = PLACES_GLOW_COLOR[this.currentTheme];
    const opacity = PLACES_GLOW_OPACITY[this.currentTheme];
    if (map.getLayer(PLACES_GLOW_LAYER_ID)) {
      // Context restoration retains the layer while the theme may have moved
      // on; repaint rather than trust what a previous theme resolved.
      map.setPaintProperty(PLACES_GLOW_LAYER_ID, "circle-color", colour);
      map.setPaintProperty(PLACES_GLOW_LAYER_ID, "circle-opacity", opacity);
      // Same contract as data-map-frame-evidence: a safe record of what the
      // glow reconciliation last did, for drivers and refuters. Counts only,
      // never coordinates.
      this.setSafeDiagnostic("data-map-places-glow", `repainted:${data.features.length}`);
      return;
    }

    // BENEATH the route, which is itself beneath the labels: ground, then
    // route, then ink. Anchoring on the route when it exists keeps that order
    // exact; otherwise the glow takes the route's own anchor and a later
    // route insert at the first label still lands above it.
    map.addLayer(
      {
        id: PLACES_GLOW_LAYER_ID,
        type: "circle",
        source: PLACES_SOURCE_ID,
        paint: {
          "circle-color": colour,
          "circle-blur": PLACES_GLOW_BLUR,
          "circle-radius": PLACES_GLOW_RADIUS,
          "circle-opacity": opacity,
        },
      },
      map.getLayer(ROUTE_LAYER_ID) ? ROUTE_LAYER_ID : this.firstSymbolLayerId(map)
    );
    this.setSafeDiagnostic("data-map-places-glow", `layer-added:${data.features.length}`);
  }

  public resize(): void {
    if (this.mapInstance) {
      this.mapInstance.resize();
    }
  }

  public destroy(): void {
    this.styleGeneration += 1;
    this.mapEpoch += 1;
    // Dropped BEFORE clearMarkers below, not only in the field reset at the
    // end: clearMarkers retracts the places glow through applyPlacesGlow,
    // whose styleReady gate is what keeps that retraction from reaching into
    // a style this method is about to tear down whole.
    this.styleReady = false;
    this.styleUsable = false;
    this.pendingThemeSwap = null;
    this.overlay.remove(false);
    this.clearStyleLoadTimer();
    this.clearStyleFrameTimer();
    this.clearStyleReadinessListeners();
    this.detachMapLifecycleListeners();
    if (this.mapInstance) {
      this.clearMarkers();
      this.setUserPosition(null);
      // No removeLayer/removeSource here. `remove()` destroys the style whole,
      // and reaching into a style mid-teardown is how you throw on the way out.
      // Markers are the exception above precisely because they are NOT the
      // style's — they are DOM nodes, and nothing else would collect them.
      try {
        this.mapInstance.remove();
      } catch {
        // Teardown is best-effort after listeners and epochs are invalidated.
        // Never create a replacement during destroy and never let a provider
        // teardown exception escape into React unmount.
      }
      this.mapInstance = null;
    }
    this.styleReady = false;
    this.styleUsable = false;
    this.styleLoadAttempt = 0;
    this.styleReadyListener = null;
    this.styleRenderListener = null;
    this.styleListenerOwner = null;
    this.styleInstalledGeneration = null;
    this.pendingMutationSafeGeneration = null;
    this.styleInstallInProgressGeneration = null;
    this.styleErrorObserved = false;
    this.rendererErrorObserved = false;
    this.contextLost = false;
    this.contextRecoveryStyleWasReady = false;
    this.routeIsolationFailed = false;
    this.frameEvidence = "pending";
    this.blackFrameGeneration = null;
    this.blackFrameSamples = 0;
    this.automaticMapReconstructions = 0;
    this.lastFailureReason = null;
    this.detachedRecoverySnapshot = null;
    this.mapboxgl = null;
    this.clearSafeDiagnostic("data-map-frame-evidence");
    this.clearSafeDiagnostic("data-map-failure-reason");
    this.clearSafeDiagnostic("data-map-lifecycle");
    this.clearSafeDiagnostic("data-map-places-glow");
    this.mapContainer = null;
    this.styleLifecycleListener = null;
    this.routeCoords = null;
    this.routeTint = "accent";
    this.markerPlaces.clear();
    this.markerEls.clear();
    this.selectedMarkerId = null;
  }
}
