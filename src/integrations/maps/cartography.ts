import type { Expression, MapboxMap, StyleValue } from "./MapboxAdapter";

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
 * The dark road hierarchy, rebuilt from one grey.
 *
 * dark-v11 does not have road layers the way streets-v12 does — it carries
 * the whole network as a surface/bridge/tunnel trio (`road-simple`,
 * `bridge-simple`, `tunnel-simple`, all reading the `road` source-layer) and
 * paints every one flat `hsl(0,0%,24%)`. That one value IS the "roads lose
 * hierarchy" complaint:
 * the expressway that carries half the light map's life (streets-v12 paints
 * it orange) renders identical to a residential lane. Since the layer still
 * reads the `road` source-layer, the hierarchy the style discarded is still
 * in the data, and one match on `class` puts it back:
 *
 *   motorway/trunk  warm and unmistakable, the night echo of the light
 *                   expressway's orange, held dark enough (34%) that a white
 *                   route line and every label still dominate it
 *   primary         a warmer step above the base grey, arterial but calm
 *   secondary/
 *   tertiary        the stock hue, one lightness step up, so the grid reads
 *   everything else stock `hsl(0,0%,24%)`, byte-for-byte
 *
 * Subordination is the constraint (controller ruling, recorded in the lane):
 * these are grounds under the data layer, not signals. Nothing here competes
 * with markers, labels, or the route.
 */
const DARK_ROAD_COLOR: Expression = [
  "match",
  ["get", "class"],
  ["motorway", "trunk"],
  "hsl(28, 42%, 34%)",
  "primary",
  "hsl(30, 14%, 30%)",
  ["secondary", "tertiary"],
  "hsl(0, 0%, 27%)",
  "hsl(0, 0%, 24%)",
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

/**
 * The light ground. Three nudges, no repaint — streets-v12 is already a
 * street map, and the audit's complaint about light was flatness, not
 * illegibility. Every value here is a step from the stock value it replaces,
 * read from the live style, not from memory:
 *
 *   land   stock `hsl(20,18%,91%)` at our zoom → warmed to hue 33 (sand,
 *          the hue family the dark land already committed to at 35) with a
 *          little more saturation and the same lightness, so labels and
 *          roads keep exactly the contrast they were designed against.
 *
 *   water  stock `hsl(200,100%,80%)` is full-saturation sky — bright enough
 *          that against a warmer land it reads as decoration. Dropping to
 *          80% saturation and 72% lightness gives the lagoon weight instead
 *          of shine; hue stays, so it is unmistakably the same water.
 *
 *   park   stock colour is fine (`hsl(110,41%,78%)`) — the reason parks
 *          vanish in light is the opacity ramp ending at 0.2 by z12, the
 *          same starvation trick dark-v11 pulled with colour. The ramp's
 *          high-zoom stop rises to 0.32; the colour barely moves. Festac's
 *          green edge should be visible from the default camera without
 *          competing with a single label, the exact restraint the dark park
 *          note above measures at ~1.2:1.
 */
const LIGHT_LAND = "hsl(33, 26%, 92%)";
const LIGHT_WATER = "hsl(202, 80%, 72%)";
const LIGHT_PARK = "hsl(110, 40%, 76%)";
const LIGHT_PARK_OPACITY: Expression = [
  "interpolate",
  ["linear"],
  ["zoom"],
  5,
  0,
  6,
  0.6,
  12,
  0.32,
];

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
export function applyCartography(map: MapboxMap, theme: "light" | "dark"): void {
  const dark = theme === "dark";

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

  if (!dark) {
    // The light ground: warmth without repaint. See the LIGHT_* rationale.
    paint("land", "background-color", LIGHT_LAND);
    paint("water", "fill-color", LIGHT_WATER);
    paint("waterway", "line-color", LIGHT_WATER);
    paint("national-park", "fill-color", LIGHT_PARK);
    paint("national-park", "fill-opacity", LIGHT_PARK_OPACITY);
    return;
  }

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

  // The road network gets its hierarchy back. See DARK_ROAD_COLOR: dark-v11
  // ships one grey for every road class; the class data survives in the
  // source layer, so the fix is one data-driven colour — applied to the whole
  // surface/bridge/tunnel trio, because a Lagos expressway spends real
  // kilometres on bridges and a hierarchy with grey gaps at every overpass
  // is not a hierarchy (the refuter caught exactly this).
  paint("road-simple", "line-color", DARK_ROAD_COLOR);
  paint("bridge-simple", "line-color", DARK_ROAD_COLOR);
  paint("tunnel-simple", "line-color", DARK_ROAD_COLOR);

  // Neighbourhoods get their identity back for one value.
  paint("settlement-subdivision-label", "text-color", DARK_SUBDIVISION_LABEL);
}
