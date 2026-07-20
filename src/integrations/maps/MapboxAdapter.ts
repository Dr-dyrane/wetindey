import type { SharedUserLocation } from "@/app/_actions/actions";

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
  unavailable: "--color-status-unavailable",
};

const PLACE_TYPE_SYMBOLS: Record<string, string> = {
  open_market: '<path d="M4 10h16l-1-5H5l-1 5Z"/><path d="M5 10v9h14v-9"/><path d="M9 19v-5h6v5"/>',
  supermarket:
    '<path d="M4 5h2l2 10h9l2-7H7"/><circle cx="9" cy="19" r="1"/><circle cx="17" cy="19" r="1"/>',
  kiosk: '<path d="M5 10h14v9H5z"/><path d="M4 10 6 5h12l2 5M8 14h3M13 14h3"/>',
  bank: '<path d="m3 9 9-5 9 5"/><path d="M5 10v7M9 10v7M15 10v7M19 10v7M3 19h18"/>',
  bureau_de_change: '<path d="M7 5h10v14H7z"/><path d="M10 9h4M10 12h4M10 15h4"/>',
};

const PLACE_TYPE_LABELS: Record<string, string> = {
  open_market: "open market",
  supermarket: "supermarket",
  kiosk: "kiosk",
  bank: "bank",
  bureau_de_change: "bureau de change",
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
    "historic",
  ],
  ["step", ["zoom"], 0, 16, 1, 17, 2],
  0,
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
      3,
    ],
    10,
  ],
  ["get", "filterrank"],
];

/**
 * Markets are two points bigger than everything else. Both themes.
 *
 * This is the "larger symbol" lever, and it is expressed as an OFFSET on top of
 * the stock size ramp rather than as a replacement for it, deliberately: the
 * stock expression already handles the case where a POI came from a big polygon
 * (`sizerank` < 5 earns 18px), and rewriting it wholesale to add two pixels
 * would quietly drop that. `+2` keeps their cartography and adds ours.
 *
 * Two points, not six. Every Lagos POI is a point, so `sizerank` is always 16
 * and everything lands on the same 12px — which means markets currently have no
 * way to be more important than a petrol station, and also means a small nudge
 * is legible against a perfectly uniform field. The brief asked for "slightly
 * larger" and slightly is doing real work in that sentence: the prominence here
 * is carried by colour and by winning collisions, and the size is the whisper
 * that confirms it, not the shout that delivers it.
 */
const MARKET_SIZE_BUMP: Expression = [
  "case",
  ["==", ["get", "class"], "food_and_drink_stores"],
  2,
  0,
];

/**
 * THE `+` IS INSIDE THE ZOOM STEP, and it has to be. Mapbox allows `["zoom"]`
 * ONLY as the direct input of a top-level `step`/`interpolate`; wrapping that
 * step in arithmetic makes the whole expression invalid and throws at runtime,
 * taking the style with it. The first version of this did exactly that. It
 * typechecked and it linted and it would have blanked the map — caught by
 * running the patched style through Mapbox's own validator, which is the only
 * thing in reach that actually knows this grammar.
 */
const POI_TEXT_SIZE: Expression = [
  "step",
  ["zoom"],
  ["+", ["step", ["get", "sizerank"], 18, 5, 12], MARKET_SIZE_BUMP],
  17,
  ["+", ["step", ["get", "sizerank"], 18, 13, 12], MARKET_SIZE_BUMP],
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
  ["coalesce", ["image", ["get", "maki"]], ["image", "marker"]],
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
  ["step", ["get", "sizerank"], ["literal", [0, 0]], 13, ["literal", [0, 0.8]]],
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
  "hsl(210, 10%, 58%)", // 4.83:1
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
  "hsl(210, 20%, 46%)",
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
      "commercial_area",
    ],
    true,
    "residential",
    ["step", ["zoom"], true, 12, false],
    false,
  ],
  [
    "<=",
    [
      "-",
      ["to-number", ["get", "sizerank"]],
      ["interpolate", ["exponential", 1.5], ["zoom"], 12, 0, 18, 14],
    ],
    8,
  ],
];

/** One flat grey becomes a landuse that means something. */
const DARK_LANDUSE_COLOR: Expression = [
  "match",
  ["get", "class"],
  ["park", "grass", "agriculture", "scrub", "wood", "pitch"],
  "hsl(140, 22%, 18%)", // see DARK_PARK — a ground recedes, 1.20:1
  "commercial_area",
  "hsl(36, 30%, 21%)", // the warm wash that says "commerce lives here"
  "sand",
  "hsl(45, 15%, 22%)",
  "airport",
  "hsl(220, 12%, 19%)",
  "glacier",
  "hsl(200, 12%, 26%)",
  "hsl(30, 6%, 17%)",
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

/**
 * Park green, and the number is borrowed rather than chosen.
 *
 * A park is land that happens to be green. It is a GROUND, so it must recede —
 * the moment it competes with a label it has stopped doing its job. The first
 * version of this shipped at `hsl(140,24%,21%)`, which measured 1.37:1 against
 * the land and read on screen as a green slab sitting ON the map rather than
 * as part of it. Caught by looking at it, which is the only way this class of
 * mistake is ever caught: it typechecked and it validated.
 *
 * Two independent references agree on the restraint, so this is not taste:
 * streets-v12's own park sits at 1.21:1 against ITS land, and Mapbox's
 * navigation-night-v1 — the richest dark basemap they ship — sits at 1.25:1
 * against its land. 18% lightness lands at 1.20:1, i.e. the same restraint
 * light already exercises, which is exactly the answer: the dark park should
 * recede as much as the light one does.
 */
const DARK_PARK = "hsl(140, 22%, 18%)";

/**
 * Neighbourhood labels. Structurally these are ALREADY identical between the
 * two styles — same font, same size ramp, same uppercase, same letter-spacing.
 * Only the colour differs (`hsl(220,30%,40%)` in light versus a flat grey in
 * dark), so neighbourhood identity in dark costs exactly one value.
 */
const DARK_SUBDIVISION_LABEL = "hsl(220, 15%, 62%)";

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

type MapboxStyleReadinessEvent =
  "style.load" | "idle" | "render" | "webglcontextlost" | "webglcontextrestored";

interface MapboxLngLat {
  lng: number;
  lat: number;
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

  constructor(accessToken?: string) {
    this.accessToken = accessToken || process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || "";
  }

  /** The map is the app's base layer, so its style has to track the app theme. */
  public static styleFor(theme: "light" | "dark"): string {
    return theme === "dark"
      ? "mapbox://styles/mapbox/dark-v11"
      : "mapbox://styles/mapbox/streets-v12";
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
    } else {
      this.clearSafeDiagnostic("data-map-failure-reason");
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
    this.applyRoute();
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
    this.emitStyleLifecycle({ status: "loading", generation, theme, attempt });

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
    layout("poi-label", "text-size", POI_TEXT_SIZE);
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
      0.5,
      12,
      0.35,
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
    this.automaticMapReconstructions = 0;
    if (this.lastFailureReason === "context" || this.lastFailureReason === "renderer") {
      const map = this.mapInstance;
      const epoch = this.mapEpoch;
      this.currentTheme = theme;
      this.lastFailureReason = null;
      this.reconstructMap(map, epoch);
      return;
    }
    this.beginStyleAttempt(theme, 1, true);
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
        bottom: Math.max(this.padding.bottom || 0, isMobile ? Math.round(containerHeight * 0.45) : 80),
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

    // Create custom borderless marker element following Apple HIG
    const el = document.createElement("div");
    el.className = `h-9 w-9 rounded-full shadow-md flex items-center justify-center cursor-pointer transition-transform hover:scale-105 active:scale-95 duration-micro`;
    el.setAttribute("aria-current", options.selected ? "true" : "false");
    el.style.transform = options.selected ? "scale(1.16)" : "scale(1)";
    el.style.outline = options.selected ? "3px solid var(--color-accent)" : "none";
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
    el.setAttribute(
      "aria-label",
      options.selected ? `${accessibleLabel}, selected` : accessibleLabel
    );

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

        // Click interaction: smoothly glide camera and show premium HIG popup card
        el.addEventListener("click", (e) => {
          e.stopPropagation(); // Avoid triggering map clicks

          this.recenterTo(user.latitude, user.longitude, 14.5);

          // Close existing active popup first
          this.activeUserPopup?.remove();

          // Build custom Apple HIG-style popup card programmatically
          const popupEl = document.createElement("div");
          popupEl.style.padding = "16px";
          popupEl.style.display = "flex";
          popupEl.style.flexDirection = "column";
          popupEl.style.alignItems = "center";
          popupEl.style.gap = "12px";
          popupEl.style.minWidth = "220px";
          popupEl.style.fontFamily =
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

          // Squirclized popup styling overrides
          const styleTag = document.createElement("style");
          styleTag.textContent = `
            .apple-squircle-popup .mapboxgl-popup-content {
              border-radius: 24px !important;
              padding: 0 !important;
              box-shadow: 0 12px 36px rgba(0, 0, 0, 0.16) !important;
              background-color: var(--color-background-primary, #FFFFFF) !important;
              border: none !important;
            }
            .apple-squircle-popup .mapboxgl-popup-close-button {
              padding: 10px 14px !important;
              font-size: 18px !important;
              color: var(--color-text-secondary, #8E8E93) !important;
              outline: none !important;
              border: none !important;
              background: none !important;
            }
            .apple-squircle-popup .mapboxgl-popup-tip {
              border-top-color: var(--color-background-primary, #FFFFFF) !important;
              border-bottom-color: var(--color-background-primary, #FFFFFF) !important;
            }
          `;
          popupEl.appendChild(styleTag);

          // Avatar circular container
          const avatarContainer = document.createElement("div");
          avatarContainer.style.width = "52px";
          avatarContainer.style.height = "52px";
          avatarContainer.style.borderRadius = "14px";
          avatarContainer.style.overflow = "hidden";
          avatarContainer.style.backgroundColor = "var(--color-status-info, #007AFF)";
          avatarContainer.style.display = "flex";
          avatarContainer.style.alignItems = "center";
          avatarContainer.style.justifyContent = "center";
          avatarContainer.style.boxShadow = "var(--shadow-raised)";

          if (user.avatarUrl) {
            const avatarImg = document.createElement("img");
            avatarImg.src = user.avatarUrl;
            avatarImg.style.width = "100%";
            avatarImg.style.height = "100%";
            avatarImg.style.objectFit = "cover";
            avatarContainer.appendChild(avatarImg);
          } else {
            const initials =
              user.name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .substring(0, 2)
                .toUpperCase() || "?";
            const initialsSpan = document.createElement("span");
            initialsSpan.textContent = initials;
            initialsSpan.style.color = "#FFFFFF";
            initialsSpan.style.fontWeight = "700";
            initialsSpan.style.fontSize = "18px";
            avatarContainer.appendChild(initialsSpan);
          }
          popupEl.appendChild(avatarContainer);

          // User name & status info
          const infoContainer = document.createElement("div");
          infoContainer.style.textAlign = "center";

          const nameHeading = document.createElement("h3");
          nameHeading.textContent = user.name;
          nameHeading.style.margin = "0";
          nameHeading.style.fontSize = "15px";
          nameHeading.style.fontWeight = "600";
          nameHeading.style.color = "var(--color-text-primary, #000000)";
          infoContainer.appendChild(nameHeading);

          const statusBadge = document.createElement("span");
          statusBadge.textContent = "Sharing Location";
          statusBadge.style.display = "inline-block";
          statusBadge.style.marginTop = "4px";
          statusBadge.style.padding = "2px 8px";
          statusBadge.style.fontSize = "10px";
          statusBadge.style.fontWeight = "700";
          statusBadge.style.borderRadius = "9999px";
          statusBadge.style.backgroundColor = "var(--color-status-info-bg, rgba(0, 122, 255, 0.1))";
          statusBadge.style.color = "var(--color-status-info, #007AFF)";
          infoContainer.appendChild(statusBadge);
          popupEl.appendChild(infoContainer);

          // Interactive action button
          if (user.contactChannelKind && user.contactChannelValue) {
            const contactBtn = document.createElement("a");
            contactBtn.style.width = "100%";
            contactBtn.style.padding = "8px 16px";
            contactBtn.style.borderRadius = "12px";
            contactBtn.style.backgroundColor = "var(--color-status-info, #007AFF)";
            contactBtn.style.color = "#FFFFFF";
            contactBtn.style.fontSize = "13px";
            contactBtn.style.fontWeight = "600";
            contactBtn.style.textAlign = "center";
            contactBtn.style.textDecoration = "none";
            contactBtn.style.display = "block";
            contactBtn.style.boxShadow = "var(--shadow-raised)";
            contactBtn.style.transition = "transform 0.1s ease, opacity 0.2s ease";

            contactBtn.addEventListener("mouseenter", () => {
              contactBtn.style.opacity = "0.9";
            });
            contactBtn.addEventListener("mouseleave", () => {
              contactBtn.style.opacity = "1";
            });
            contactBtn.addEventListener("mousedown", () => {
              contactBtn.style.transform = "scale(0.98)";
            });
            contactBtn.addEventListener("mouseup", () => {
              contactBtn.style.transform = "scale(1)";
            });

            if (user.contactChannelKind === "whatsapp") {
              contactBtn.textContent = "WhatsApp Message";
              const cleanPhone = user.contactChannelValue.replace(/\D/g, "");
              contactBtn.href = `https://wa.me/${cleanPhone}`;
            } else if (user.contactChannelKind === "phone") {
              contactBtn.textContent = "Call Contributor";
              contactBtn.href = `tel:${user.contactChannelValue}`;
            } else {
              contactBtn.textContent = "Send SMS";
              contactBtn.href = `sms:${user.contactChannelValue}`;
            }
            contactBtn.target = "_blank";
            popupEl.appendChild(contactBtn);
          } else {
            const noContactLabel = document.createElement("span");
            noContactLabel.textContent = "No contact details shared";
            noContactLabel.style.fontSize = "11px";
            noContactLabel.style.color = "var(--color-text-secondary, #8E8E93)";
            noContactLabel.style.marginTop = "4px";
            popupEl.appendChild(noContactLabel);
          }

          const popup = new mapboxgl.Popup({
            closeButton: true,
            closeOnClick: true,
            offset: 25,
            className: "apple-squircle-popup",
          })
            .setLngLat([user.longitude, user.latitude])
            .setDOMContent(popupEl)
            .addTo(map);

          popup.on("close", () => {
            if (this.activeUserPopup === popup) {
              this.activeUserPopup = null;
            }
          });

          this.activeUserPopup = popup;
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
   * Context restoration retains the JavaScript style, including our route.
   * Remove that custom paint before probing the restored framebuffer so a
   * bright route over a black basemap cannot certify the basemap as usable.
   */
  private removeRouteForRendererProbe(map: MapboxMap): boolean {
    try {
      if (map.getLayer(ROUTE_LAYER_ID)) map.removeLayer(ROUTE_LAYER_ID);
      if (map.getSource(ROUTE_SOURCE_ID)) map.removeSource(ROUTE_SOURCE_ID);
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

  public resize(): void {
    if (this.mapInstance) {
      this.mapInstance.resize();
    }
  }

  public destroy(): void {
    this.styleGeneration += 1;
    this.mapEpoch += 1;
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
    this.mapContainer = null;
    this.styleLifecycleListener = null;
    this.routeCoords = null;
    this.routeTint = "accent";
  }
}
