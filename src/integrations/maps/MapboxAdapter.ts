export interface MapMarkerOptions {
  id: string;
  lat: number;
  lng: number;
  label: string;
  status: "confirmed" | "caution" | "unavailable" | "neutral";
  onClick?: () => void;
}

/**
 * How precisely we can honestly draw the user.
 *
 * Not a styling flag — a claim about the data, and the only reason this type
 * exists. `point` says "this coordinate is where you are". `area` says "this
 * coordinate is the middle of somewhere you are probably in", which is what an
 * area centre and an untouched default both are. Only a real device fix earns
 * `point`; drawing the other two as a point would claim a GPS precision we were
 * never given. The caller maps provenance onto this (see MapboxCanvas) — the
 * adapter only draws the claim it is handed.
 */
export type UserPositionPrecision = "point" | "area";

export interface UserPositionOptions {
  lat: number;
  lng: number;
  precision: UserPositionPrecision;
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

export interface MapProviderAdapter {
  initialize(
    container: HTMLDivElement,
    center: { lat: number; lng: number },
    zoom: number,
    theme?: "light" | "dark",
    padding?: MapPadding
  ): void;
  setTheme(theme: "light" | "dark"): void;
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
 * Honour the OS "reduce motion" setting by collapsing camera animations to a
 * cut. Read per call rather than cached — the setting can change mid-session.
 *
 * Note we do NOT drop `essential: true`. Mapbox's own reduced-motion handling
 * only fires for non-essential moves and it is all-or-nothing; keeping the move
 * essential and setting duration 0 gives the same result deterministically,
 * whether the move originated from a user tap or from a sheet detent change.
 */
function reducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const duration = (ms: number) => (reducedMotion() ? 0 : ms);

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
  unavailable: "--color-status-unavailable"
};

/** Diameter of the device-fix dot, px. Small on purpose: it is a point. */
const USER_POINT_SIZE = 16;
/**
 * Diameter of the area disc, px. Large on purpose — a region is not a point —
 * and deliberately not 36, which is the place marker's size.
 */
const USER_AREA_SIZE = 48;

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

/** The one GeoJSON shape this adapter ever builds. */
interface RouteFeature {
  type: "Feature";
  properties: Record<string, never>;
  geometry: { type: "LineString"; coordinates: RouteGeometry };
}

interface MapboxGeoJsonSource {
  setData(data: RouteFeature): void;
}

interface MapboxLineLayer {
  id: string;
  type: "line";
  source: string;
  layout: { "line-cap": "round"; "line-join": "round" };
  paint: { "line-color": string; "line-width": number };
}

interface MapboxMap {
  flyTo(options: MapboxCameraOptions): void;
  easeTo(options: MapboxCameraOptions): void;
  project(lnglat: [number, number]): ScreenPoint;
  setStyle(style: string): void;
  /** Only 'style.load' is used; narrow on purpose, like the rest of these. */
  on(type: "style.load", listener: () => void): void;
  off(type: "style.load", listener: () => void): void;
  isStyleLoaded(): boolean;
  getStyle(): { layers?: { id: string; type: string }[] } | undefined;
  addSource(id: string, source: { type: "geojson"; data: RouteFeature }): void;
  /**
   * Narrowed to the only source this adapter ever adds. Accurate rather than
   * optimistic: nothing else here calls addSource, so nothing else can come back.
   */
  getSource(id: string): MapboxGeoJsonSource | undefined;
  removeSource(id: string): void;
  addLayer(layer: MapboxLineLayer, beforeId?: string): void;
  getLayer(id: string): { id: string } | undefined;
  removeLayer(id: string): void;
  setPaintProperty(layer: string, name: "line-color", value: string): void;
  resize(): void;
  remove(): void;
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

interface WindowWithMapboxgl extends Window {
  mapboxgl?: {
    accessToken: string;
    Map: new (options: {
      container: HTMLDivElement;
      style: string;
      center: [number, number];
      zoom: number;
      attributionControl: boolean;
    }) => MapboxMap;
    Marker: new (element: HTMLDivElement) => MapboxMarker;
  };
}

export class MapboxAdapter implements MapProviderAdapter {
  private mapInstance: MapboxMap | null = null;
  private markersMap: Map<string, MapboxMarker> = new Map();
  /**
   * "You", held apart from markersMap on purpose. MapboxCanvas calls
   * clearMarkers() and re-adds every candidate whenever the list changes; a user
   * marker living in that map would be destroyed and rebuilt on each search.
   */
  private userMarker: MapboxMarker | null = null;
  private userMarkerEl: HTMLDivElement | null = null;
  /** What the live element was built to claim; rebuild only when this changes. */
  private userMarkerPrecision: UserPositionPrecision | null = null;
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

  constructor(accessToken?: string) {
    this.accessToken = accessToken || process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || "";
  }

  /** The map is the app's base layer, so its style has to track the app theme. */
  public static styleFor(theme: "light" | "dark"): string {
    return theme === "dark"
      ? "mapbox://styles/mapbox/dark-v11"
      : "mapbox://styles/mapbox/streets-v12";
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
    this.currentTheme = theme;
    this.padding = { ...padding };
    this.mapInstance = new mapboxgl.Map({
      container,
      style: MapboxAdapter.styleFor(theme),
      center: [center.lng, center.lat],
      zoom,
      attributionControl: false
    });
    this.mapInstance.on("style.load", this.handleStyleLoad);
    // Applied as a camera call rather than a constructor option so the very
    // first frame is already padded: the opening centre must sit above the
    // sheet, not behind it.
    this.mapInstance.easeTo({ padding: this.padding, essential: true, duration: 0 });
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
   * An arrow property, not a method — `off` in destroy() has to be handed the
   * identical reference, and a bound method would produce a new one per call.
   */
  private handleStyleLoad = (): void => {
    // Set BEFORE applyRoute: this event IS the fact applyRoute guards on.
    this.styleReady = true;
    this.applyRoute();
  };

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
    if (theme === this.currentTheme) return;
    this.currentTheme = theme;
    // The old style is gone from here until the new one's `style.load`. Anything
    // added in that window throws; `handleStyleLoad` re-opens the gate and
    // replays the route into the style that replaced it.
    this.styleReady = false;
    this.mapInstance.setStyle(MapboxAdapter.styleFor(theme));
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
      duration: options?.animate === false ? 0 : duration(PADDING_DURATION_MS)
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
      duration: duration(FLY_DURATION_MS)
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
      duration: duration(FLY_DURATION_MS)
    });
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

    // Create custom borderless marker element following Apple HIG
    const el = document.createElement("div");
    el.className = `h-9 w-9 rounded-full shadow-md flex items-center justify-center cursor-pointer transition-transform hover:scale-105 active:scale-95 duration-micro`;

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

    // Hairline marker pin svg
    el.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
        <circle cx="12" cy="10" r="3"/>
      </svg>
    `;

    if (options.onClick) {
      el.addEventListener("click", () => {
        options.onClick?.();
      });
    }

    const markerInstance = new mapboxgl.Marker(el)
      .setLngLat([options.lng, options.lat])
      .addTo(this.mapInstance);

    this.markersMap.set(options.id, markerInstance);
  }

  public clearMarkers(): void {
    this.markersMap.forEach((marker) => marker.remove());
    this.markersMap.clear();
  }

  /**
   * The user's own indicator, in one of two shapes.
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
      return;
    }

    if (!this.mapInstance) return;
    const mapboxgl = (window as unknown as WindowWithMapboxgl).mapboxgl;
    if (!mapboxgl) return;

    // Move the existing element when only the coordinate changed. A device fix
    // updates far more often than its precision does, and rebuilding the node
    // each time would churn the DOM for no visible gain.
    if (this.userMarker && this.userMarkerPrecision === options.precision) {
      this.userMarkerEl?.setAttribute("aria-label", options.label);
      this.userMarker.setLngLat([options.lng, options.lat]);
      return;
    }

    this.userMarker?.remove();
    const el = MapboxAdapter.buildUserPositionElement(options.precision, options.label);
    this.userMarker = new mapboxgl.Marker(el)
      .setLngLat([options.lng, options.lat])
      .addTo(this.mapInstance);
    this.userMarkerEl = el;
    this.userMarkerPrecision = options.precision;
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
   * What separates the two variants is SHAPE, and the shape is the honesty:
   *
   *   point — a small hard dot. "You, precisely." A real fix has an answer, so
   *           the indicator has an edge and a centre.
   *   area  — a wide disc that fades out, with NOTHING at its centre. An area
   *           centre is a REGION, and a dot is the wrong shape for a region: the
   *           coordinate is the middle of a neighbourhood, not a spot the user
   *           is standing on. The fade matters as much as the absence of the
   *           dot — a hard rim would assert a boundary we were never told, so
   *           the disc declines to say where it ends, and its plateau declines
   *           to say where it peaks. Neither claim is available, so neither is
   *           drawn.
   *
   * No stroke on either. The dot's separation is elevation (--shadow-raised);
   * the disc's is the fade itself.
   */
  private static buildUserPositionElement(
    precision: UserPositionPrecision,
    label: string
  ): HTMLDivElement {
    const el = document.createElement("div");
    el.setAttribute("role", "img");
    el.setAttribute("aria-label", label);
    // The indicator is never a target. Without this the area disc would swallow
    // taps across 48px of map, including any place marker underneath it.
    el.style.pointerEvents = "none";

    if (precision === "point") {
      el.style.width = `${USER_POINT_SIZE}px`;
      el.style.height = `${USER_POINT_SIZE}px`;
      el.style.borderRadius = "50%";
      el.style.background = "var(--color-status-info)";
      el.style.boxShadow = "var(--shadow-raised)";
      return el;
    }

    el.style.width = `${USER_AREA_SIZE}px`;
    el.style.height = `${USER_AREA_SIZE}px`;
    // No border-radius: the gradient reaches transparent at the closest side, so
    // the corners are already empty and a radius would only be decoration.
    el.style.background =
      "radial-gradient(circle closest-side," +
      " var(--color-status-info-bg) 0%," +
      " var(--color-status-info-bg) 58%," +
      " transparent 100%)";
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
    this.routeCoords =
      coords && coords.length >= 2 ? coords.map(([lng, lat]): [number, number] => [lng, lat]) : null;
    this.routeTint = options?.tint ?? "accent";
    this.applyRoute();
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
    if (!this.styleReady) return;

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
      geometry: { type: "LineString", coordinates: coords }
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
        paint: { "line-color": colour, "line-width": ROUTE_WIDTH_PX }
      },
      this.firstSymbolLayerId(map)
    );
  }

  /**
   * The lowest symbol layer in the live style, if it has one.
   *
   * addLayer appends to the TOP of the stack, which would draw the route over
   * every street name and place label on the basemap. Slotting it beneath the
   * first symbol layer keeps those readable and makes the line read as part of
   * the map rather than scribbled on the glass above it.
   *
   * Re-read on every apply, never cached: the layer stack belongs to the style,
   * and setTheme replaces the style with a different one.
   */
  private firstSymbolLayerId(map: MapboxMap): string | undefined {
    return map.getStyle()?.layers?.find((layer) => layer.type === "symbol")?.id;
  }

  public resize(): void {
    if (this.mapInstance) {
      this.mapInstance.resize();
    }
  }

  public destroy(): void {
    if (this.mapInstance) {
      this.clearMarkers();
      this.setUserPosition(null);
      this.mapInstance.off("style.load", this.handleStyleLoad);
      // No removeLayer/removeSource here. `remove()` destroys the style whole,
      // and reaching into a style mid-teardown is how you throw on the way out.
      // Markers are the exception above precisely because they are NOT the
      // style's — they are DOM nodes, and nothing else would collect them.
      this.mapInstance.remove();
      this.mapInstance = null;
    }
    this.routeCoords = null;
    this.routeTint = "accent";
  }
}
