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

interface MapProviderAdapter {
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
 * How close `fitRoute` is allowed to pull in. 16.5 is a street, not a doorway.
 * Without a cap, a seller 40m away frames at maximum zoom and the map reads as
 * a bug rather than as good news.
 */
const FIT_MAX_ZOOM = 16.5;

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

/**
 * A Mapbox style value: a literal, or an expression tree of them.
 *
 * Deliberately structural rather than a union of every property's real type.
 * These values are handed to a style spec this file does not own and cannot
 * import types for, so the honest description is "JSON the renderer validates",
 * not a lie about compile-time safety. It is NOT `any`: a function, undefined,
 * or an object still fail to type here, which catches the mistakes that are
 * actually made when hand-writing expressions.
 */
type StyleValue = string | number | boolean | null | StyleValue[];
type Expression = StyleValue[];

/**
 * ─────────────────────────────────────────────────────────────────────────
 * CARTOGRAPHY — the basemap is a product surface, not a backdrop.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Everything below overrides layers that ALREADY EXIST in the stock styles.
 * Nothing here adds a layer or a source. It is replayed on every `style.load`
 * beside the route, for the same reason the route is (see handleStyleLoad):
 * setStyle tears the style down and these overrides go with it.
 *
 * Two independent problems are being fixed, and conflating them is how you
 * get this wrong:
 *
 *   1. THE STYLE. dark-v11 is monochrome BY CONSTRUCTION — 74 of its 76
 *      colour values are pure grey and the most saturated value anywhere in
 *      the style is 2%. It is not a dark street map, it is Mapbox's Light/Dark
 *      DATA-VIZ backdrop, designed to disappear under someone else's data.
 *      (dark-v11 and light-v11 are byte-identical once colours are scrubbed.)
 *      We paired it with streets-v12, a full reference street map. That
 *      mismatch, not a paint bug, is why light feels informative and dark dead.
 *
 *   2. THE DATA. Medical POIs are 86% of the real z14 Festac tile. At our zoom
 *      of 14.5 dark drew 5 medical labels out of 6, and light drew 22 out of 24
 *      — LIGHT IS WORSE. The extra labels a denser style buys are almost all
 *      hospitals, because Lagos OSM has named hospitals and unnamed everything
 *      else. No colour can fix that; only the filter below can.
 *
 * THE ORDERING IS A DEPENDENCY, NOT A PREFERENCE: giving POI labels their class
 * colour while medical is still 83% of what draws would paint the densest
 * category on the map `hsl(0,70%,58%)` red. That is not a fix, it is a vivid
 * hospital map. POI_FILTER ships in the same commit as the colour, always.
 */

/**
 * How many POI labels each category may spend, per zoom. Lower `filterrank` is
 * MORE prominent, so this is a ceiling: `filterrank <= budget`.
 *
 * The mechanism is not invented here — Mapbox's own `navigation-night-v1` gates
 * `poi-label` with exactly this shape (a `match` on class resolving to a rank
 * ceiling), promoting `motorist` to 3 and demoting `medical` to 1 because a
 * driver wants petrol, not clinics. WetinDey inverts the same expression: a
 * shopper wants markets.
 *
 * Budget 0 means "never", because filterrank is 1-5 in practice. That is why
 * medical is a `step` and not a flat 0: at neighbourhood zoom a hospital is not
 * the story, but by z15.5 you are looking at a street and it is a landmark
 * people navigate by. Suppressed at a glance, present on inspection.
 *
 * `filterrank` is ZOOM-RELATIVE — the same POI is rank 5 at z14 and rank 1 at
 * z16. Any reasoning about this expression has to name a zoom or it means
 * nothing. (Obuzu Market is rank 5 at z14 and rank 1 at z16. Reading ranks at
 * the wrong zoom is the easiest way to be confidently wrong about this map.)
 */
const POI_BUDGET: Expression = [
  "match",
  ["get", "class"],
  // Level 2 — markets, groceries, supermarkets. The product. `amenity=marketplace`
  // lands here (verified: Obuzu Market → food_and_drink_stores/grocery/"Marketplace").
  "food_and_drink_stores",
  ["step", ["zoom"], 1, 12, 3, 14, 5],
  // Level 3 — the rest of commerce.
  ["food_and_drink", "store_like"],
  ["step", ["zoom"], 0, 13, 2, 15, 4],
  // Level 4 — how Lagos actually orients. Fuel and churches are landmarks here.
  ["motorist", "landmark", "religion"],
  ["step", ["zoom"], 0, 14, 1, 16, 2],
  // Level 5 — hospitals. Demoted, not deleted. See above.
  "medical",
  ["step", ["zoom"], 0, 15.5, 1, 17, 3],
  // Level 6/7.
  [
    "education",
    "park_like",
    "sport_and_leisure",
    "lodging",
    "commercial_services",
    "public_facilities",
    "arts_and_entertainment",
    "historic"
  ],
  ["step", ["zoom"], 0, 16, 1, 17, 2],
  0
];

const POI_FILTER: Expression = ["<=", ["get", "filterrank"], POI_BUDGET];

/**
 * Who wins when two labels want the same pixels. Lower places first, and the
 * first placed wins — so 0 is the strongest position on the map.
 *
 * NEITHER streets-v12 NOR navigation-night-v1 sets this; both leave it null,
 * which means Mapbox resolves POI collisions by screen position. A hospital one
 * pixel higher than a market currently wins, arbitrarily. This is the cheapest
 * prominence lever in the whole style and nobody is using it.
 *
 * It is also the ELEGANT one: it does not make markets louder, it makes the
 * other thing yield. `filterrank` breaks ties inside a class, so the class
 * ordering is coarse (×10) and prominence is the remainder.
 */
const POI_SORT_KEY: Expression = [
  "+",
  [
    "*",
    [
      "match",
      ["get", "class"],
      "food_and_drink_stores",
      0,
      ["food_and_drink", "store_like"],
      1,
      ["motorist", "landmark", "religion"],
      2,
      "medical",
      4,
      3
    ],
    10
  ],
  ["get", "filterrank"]
];

/**
 * Restore POI symbols in dark. dark-v11 sets `icon-image: ""` on all six
 * icon-capable layers, so no sprite pixel ever draws — that absence is most of
 * what reads as "dead", more than the colour is.
 *
 * Safe on dark's sprite: it carries 119 icons to streets-v12's 440, so this
 * could have produced missing-image gaps. Checked every maki value Lagos
 * actually uses — grocery, shop, hospital, school, fuel, religious-christian,
 * religious-muslim, tennis, restaurant, marker and thirteen more. All present.
 * The `marker` coalesce is the backstop anyway: Mapbox gives every nameless POI
 * `maki: "marker"`, and that icon exists in both sprites.
 */
const POI_ICON: Expression = [
  "case",
  ["has", "maki_beta"],
  ["coalesce", ["image", ["get", "maki_beta"]], ["image", ["get", "maki"]], ["image", "marker"]],
  ["coalesce", ["image", ["get", "maki"]], ["image", "marker"]]
];

/**
 * Text geometry that assumes an icon is present, copied from streets-v12.
 *
 * Load-bearing, not cosmetic: dark-v11 carries `text-offset: [0,0]` because it
 * has no icons to clear. Restoring icons without this stacks the label on top
 * of its own symbol. Every Lagos POI is a point, and a point is always
 * `sizerank` 16, so in practice these both resolve to the >=13 branch.
 */
const POI_TEXT_OFFSET: Expression = [
  "step",
  ["zoom"],
  ["step", ["get", "sizerank"], ["literal", [0, 0]], 5, ["literal", [0, 0.8]]],
  17,
  ["step", ["get", "sizerank"], ["literal", [0, 0]], 13, ["literal", [0, 0.8]]]
];

/**
 * POI ink for the dark ground, and the market identity.
 *
 * Two deliberate departures from streets-v12:
 *
 *   · MARKETS GET THEIR OWN COLOUR. streets-v12 lumps `food_and_drink_stores`
 *     in with `store_like` and paints both blue, so a market currently looks
 *     like a phone shop. Split out and given the warmest, brightest ink on the
 *     map. Warmth is not arbitrary — amber is simply what survives on a dark
 *     ground, and it measures 8.09:1 here, the highest of any class.
 *
 *   · MEDICAL LOSES THE ALARM, NOT THE LEGIBILITY. The first draft demoted it
 *     to a dim red at 3.46:1, which is an accessibility bug wearing a design
 *     decision's clothes: a label drawn at all must be readable. The FILTER
 *     demotes hospitals; the colour only stops them shouting. So medical is a
 *     near-neutral at 4.82:1 — quiet, and legible.
 *
 * Every value here clears 4.5:1 against the land below. Mapbox's own palettes
 * do not: streets-v12's amber is 2.38:1 and dark-v11's flat grey is ~4.0:1.
 */
const DARK_POI_COLOR: Expression = [
  "match",
  ["get", "class"],
  "food_and_drink_stores",
  "hsl(38, 92%, 60%)", // markets — 8.09:1
  "food_and_drink",
  "hsl(40, 85%, 55%)", // 7.55:1
  "store_like",
  "hsl(210, 70%, 62%)", // 5.28:1
  "park_like",
  "hsl(120, 45%, 48%)", // 5.44:1
  "education",
  "hsl(30, 45%, 55%)", // 5.08:1
  "medical",
  "hsl(0, 12%, 60%)", // 4.82:1 — quiet, legible
  "sport_and_leisure",
  "hsl(190, 55%, 52%)", // 5.96:1
  ["commercial_services", "motorist", "lodging"],
  "hsl(260, 55%, 72%)", // 5.54:1
  ["arts_and_entertainment", "historic", "landmark"],
  "hsl(320, 60%, 66%)", // 5.17:1
  "hsl(210, 10%, 58%)" // 4.83:1
];

/**
 * Light keeps streets-v12's palette except for the two classes the audit
 * indicted. Both replacements are MORE legible than what they replace:
 * markets were blue at 2.85:1 and are amber at 4.55:1; medical was red at
 * 3.62:1 and is neutral at 5.17:1.
 */
const LIGHT_POI_COLOR: Expression = [
  "match",
  ["get", "class"],
  "food_and_drink_stores",
  "hsl(32, 90%, 34%)", // markets — 4.55:1, was store_like blue at 2.85:1
  "food_and_drink",
  "hsl(40, 95%, 43%)",
  "store_like",
  "hsl(210, 70%, 58%)",
  "park_like",
  "hsl(110, 70%, 28%)",
  "education",
  "hsl(30, 50%, 43%)",
  "medical",
  "hsl(0, 10%, 42%)", // 5.17:1, was a saturated red at 3.62:1
  "sport_and_leisure",
  "hsl(190, 60%, 48%)",
  ["commercial_services", "motorist", "lodging"],
  "hsl(260, 70%, 63%)",
  ["arts_and_entertainment", "historic", "landmark"],
  "hsl(320, 70%, 63%)",
  "hsl(210, 20%, 46%)"
];

/**
 * dark-v11's landuse filter, with ONE class added: `commercial_area`.
 *
 * This is the single highest-leverage change in the file, and it is a FILTER
 * change rather than a paint change — which is the part that is easy to get
 * wrong. Commercial districts are not dimmed in dark, they are excluded: the
 * stock filter admits only agriculture/wood/grass/scrub/park/airport/glacier/
 * pitch/sand. `commercial_area`, `school`, `hospital`, `cemetery`, `facility`
 * and `industrial` never reach the renderer at all, so there is nothing to
 * recolour until they are let in.
 *
 * It tints whole districts rather than dotting points, which is why it does
 * more for "this area is active" than any label can: the eye finds the busy
 * part of a neighbourhood before it reads a word.
 *
 * The two sizerank clauses are dark-v11's own and are reproduced verbatim —
 * they are what stops small parcels drawing at low zoom. setFilter REPLACES,
 * so dropping them would flood the map.
 */
const DARK_LANDUSE_FILTER: Expression = [
  "all",
  [">=", ["to-number", ["get", "sizerank"]], 0],
  [
    "match",
    ["get", "class"],
    [
      "agriculture",
      "wood",
      "grass",
      "scrub",
      "park",
      "airport",
      "glacier",
      "pitch",
      "sand",
      "commercial_area"
    ],
    true,
    "residential",
    ["step", ["zoom"], true, 12, false],
    false
  ],
  [
    "<=",
    [
      "-",
      ["to-number", ["get", "sizerank"]],
      ["interpolate", ["exponential", 1.5], ["zoom"], 12, 0, 18, 14]
    ],
    8
  ]
];

/** One flat grey becomes a landuse that means something. */
const DARK_LANDUSE_COLOR: Expression = [
  "match",
  ["get", "class"],
  ["park", "grass", "agriculture", "scrub", "wood", "pitch"],
  "hsl(140, 24%, 21%)",
  "commercial_area",
  "hsl(36, 30%, 21%)", // the warm wash that says "commerce lives here"
  "sand",
  "hsl(45, 15%, 22%)",
  "airport",
  "hsl(220, 12%, 19%)",
  "glacier",
  "hsl(200, 12%, 26%)",
  "hsl(30, 6%, 17%)"
];

/**
 * The dark ground.
 *
 * `land` keeps a trace of warmth (8% saturation) rather than the stock
 * `hsl(0,0%,16%)`. That still reads as neutral — the brief asked for neutral
 * land and this honours it — but a considered neutral and an unconsidered grey
 * are not the same thing, and the difference is most of why the stock style
 * feels like a spreadsheet at night.
 *
 * WATER IS LIGHTER THAN LAND, and that is the whole fix for "water loses
 * identity". Stock dark paints water `hsl(0,0%,12%)` against land at 16%: water
 * is DARKER than the land with no hue at all, so the lagoon is not tinted, it
 * is subtracted. Every rich night basemap inverts this — Mapbox's own
 * navigation-night-v1 runs land 31% / water 43% — because at night water reads
 * by being the brighter, cooler surface.
 */
const DARK_LAND = "hsl(35, 8%, 15%)";
const DARK_WATER = "hsl(205, 32%, 27%)";
const DARK_PARK = "hsl(140, 24%, 21%)";

/**
 * Neighbourhood labels. Structurally these are ALREADY identical between the
 * two styles — same font, same size ramp, same uppercase, same letter-spacing.
 * Only the colour differs (`hsl(220,30%,40%)` in light versus a flat grey in
 * dark), so neighbourhood identity in dark costs exactly one value.
 */
const DARK_SUBDIVISION_LABEL = "hsl(220, 15%, 62%)";

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

/** `[[west, south], [east, north]]` — Mapbox's own LngLatBounds tuple form. */
type BoundsTuple = [[number, number], [number, number]];

interface FitBoundsOptions {
  padding?: MapPadding;
  maxZoom?: number;
  essential?: boolean;
  duration?: number;
}

interface MapboxMap {
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
    // Set BEFORE the applies: this event IS the fact they guard on.
    this.styleReady = true;
    this.applyCartography();
    this.applyRoute();
  };

  /**
   * Re-cut the basemap into WetinDey's map.
   *
   * Every call here targets a layer the stock style already ships, so this adds
   * nothing to the style and cannot leak: a style swap wipes it, and this runs
   * again on the next `style.load`. That is also why it must live on that hook
   * rather than in `initialize` — the theme toggle would otherwise restore the
   * stock cartography and never come back.
   *
   * EVERY WRITE IS GUARDED BY `getLayer`, and that is not defensive padding.
   * The two styles do not share a layer list: dark-v11 has `road-simple` and
   * `road-label-simple` where streets-v12 has ~24 road layers and `road-label`,
   * and dark has no `transit-label` at all. An unguarded `setPaintProperty`
   * against a missing layer THROWS, and a Mapbox throw is not caught by
   * anything in this file — it takes the app to its error boundary. Guarding
   * turns "wrong style" into "no-op", which is the only safe failure here.
   */
  private applyCartography(): void {
    const map = this.mapInstance;
    if (!map || !this.styleReady) return;

    const dark = this.currentTheme === "dark";

    const paint = (layer: string, name: string, value: StyleValue) => {
      if (map.getLayer(layer)) map.setPaintProperty(layer, name, value);
    };
    const layout = (layer: string, name: string, value: StyleValue) => {
      if (map.getLayer(layer)) map.setLayoutProperty(layer, name, value);
    };
    const filter = (layer: string, value: Expression) => {
      if (map.getLayer(layer)) map.setFilter(layer, value);
    };

    // ── Problem 2: the hospital map. BOTH themes, and light needs it MORE.
    // This is deliberately first. It is the change that has to exist before the
    // colour below is anything other than a nicer-looking hospital map.
    filter("poi-label", POI_FILTER);
    layout("poi-label", "symbol-sort-key", POI_SORT_KEY);
    paint("poi-label", "text-color", dark ? DARK_POI_COLOR : LIGHT_POI_COLOR);

    if (!dark) return;

    // ── Problem 1: the grey map. Dark only — light is already a street map.

    // Symbols return. `text-font` off Italic: dark-v11 italicises POI labels,
    // which reads as an aside. A market is not an aside.
    layout("poi-label", "icon-image", POI_ICON);
    layout("poi-label", "text-offset", POI_TEXT_OFFSET);
    layout("poi-label", "text-font", ["DIN Pro Medium", "Arial Unicode MS Regular"]);

    // The ground.
    paint("land", "background-color", DARK_LAND);
    paint("water", "fill-color", DARK_WATER);
    paint("waterway", "line-color", DARK_WATER);

    // Parks stop being painted invisible. Stock is `hsl(0,2%,15%)` at 0.2
    // opacity over 16% land — roughly one value step, which is not a park, it
    // is a rumour of one. The opacity is raised with the colour because either
    // alone still resolves to nothing.
    paint("national-park", "fill-color", DARK_PARK);
    paint("national-park", "fill-opacity", [
      "interpolate",
      ["linear"],
      ["zoom"],
      5,
      0,
      6,
      0.6,
      12,
      0.45
    ]);

    // Commercial districts appear at all — filter first, then colour.
    filter("landuse", DARK_LANDUSE_FILTER);
    paint("landuse", "fill-color", DARK_LANDUSE_COLOR);

    // Neighbourhoods get their identity back for one value.
    paint("settlement-subdivision-label", "text-color", DARK_SUBDIVISION_LABEL);
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
    if (!this.mapInstance || coords.length < 2) return;

    let west = coords[0][0];
    let east = coords[0][0];
    let south = coords[0][1];
    let north = coords[0][1];
    for (const [lng, lat] of coords) {
      if (lng < west) west = lng;
      if (lng > east) east = lng;
      if (lat < south) south = lat;
      if (lat > north) north = lat;
    }

    this.mapInstance.fitBounds(
      [
        [west, south],
        [east, north]
      ],
      {
        padding: this.padding,
        maxZoom: options?.maxZoom ?? FIT_MAX_ZOOM,
        essential: true,
        duration: duration(FLY_DURATION_MS)
      }
    );
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
