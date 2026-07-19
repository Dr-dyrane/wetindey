/**
 * South-west Lagos pilot: Festac / Amuwo Odofin / Satellite Town / Ojo.
 *
 * Coordinates are not invented. Each was resolved against live map data and
 * recorded with its provenance:
 *
 *   [tilequery]  Mapbox Streets POI, confirmed by tilequery at the coordinate
 *   [osm]        OpenStreetMap via Nominatim, bounded to the Festac viewbox
 *   [derived]    interpolated from confirmed neighbours — see the note below
 *
 * "D Close, 6th Avenue, Festac" is a real address but 6th Avenue is NOT in
 * Mapbox Streets or OSM — a grid sweep of the whole of Festac returns only
 * 1st, 2nd, 4th, 5th and 7th Avenue; 3rd and 6th are gaps in the data. Festac's
 * avenues run north-south with longitude falling as the number rises (7th at
 * ~3.2716, 5th at ~3.2789), so 6th interpolates to ~3.2753. That block-level
 * estimate remains useful provenance for nearby derived demo places, but it is
 * not an honest default for the user's approximate identity: it is not a GPS
 * fix or a choice the user made, and it landed 5.96 m from 24 Road Stalls.
 *
 * Do NOT "correct" it with a geocoder. They answer this address confidently and
 * wrongly: Mapbox puts "D Close, Lagos 10" at 6.4634, 3.4562 — 20km east of
 * Festac — and "6th Avenue" at 6.4466, 3.5108, 26km away; Nominatim returns
 * nothing at all. Taking either would corrupt any derived demo-place evidence
 * still anchored to that block. For those places, block-level interpolation is
 * the honest limit; it is simply no longer used as the user's default.
 */

export interface SeedArea {
  slug: string;
  name: string;
  center: { lat: number; lng: number };
  source: string;
}

export interface SeedPlace {
  slug: string;
  name: string;
  area: string;
  placeType: "open_market" | "supermarket" | "kiosk";
  location: { lat: number; lng: number };
  address: string;
  verified: boolean;
  source: string;
}

/**
 * The default represents only "somewhere around Festac". Use the same sourced
 * area centre as manual Festac selection, never a block-level address that can
 * be mistaken for the user's position or for a place at that address.
 */
const FESTAC_AREA_CENTER = { lat: 6.4655, lng: 3.279 };

/** Default map centre for the pilot. */
export const PRIMARY_LOCATION = {
  label: "Festac Town area centre",
  ...FESTAC_AREA_CENTER,
  source: "osm: Festac avenue grid",
};

export const SW_LAGOS_AREAS: SeedArea[] = [
  { slug: "festac", name: "Festac Town", center: FESTAC_AREA_CENTER, source: "osm: Festac avenue grid" },
  { slug: "amuwo-odofin", name: "Amuwo Odofin", center: { lat: 6.46858, lng: 3.28266 }, source: "osm: Amowo-Odofin" },
  { slug: "satellite-town", name: "Satellite Town", center: { lat: 6.44093, lng: 3.25719 }, source: "osm: Nwankwo Street" },
  { slug: "ojo", name: "Ojo", center: { lat: 6.46493, lng: 3.18887 }, source: "osm: Ojo" },
];

export const SW_LAGOS_PLACES: SeedPlace[] = [
  // ── Festac Town ──
  { slug: "festac-market", name: "Festac Market", area: "festac", placeType: "open_market",
    location: { lat: 6.47615, lng: 3.27436 }, address: "4th Avenue, Festac Town",
    verified: true, source: "tilequery: Marketplace POI" },
  { slug: "festac-24-road-stalls", name: "24 Road Stalls", area: "festac", placeType: "open_market",
    location: { lat: 6.46408, lng: 3.27525 }, address: "24 Road, off 6th Avenue, Festac",
    verified: false, source: "derived: 52m from 24 Rd (tilequery)" },
  { slug: "festac-5th-avenue-kiosk", name: "5th Avenue Kiosk", area: "festac", placeType: "kiosk",
    location: { lat: 6.46926, lng: 3.27891 }, address: "5th Avenue, Festac Town",
    verified: false, source: "tilequery: 5th Ave centreline (0.4m)" },
  { slug: "festac-7th-avenue-shop", name: "7th Avenue Corner Shop", area: "festac", placeType: "supermarket",
    location: { lat: 6.45889, lng: 3.27159 }, address: "7th Avenue, Festac Town",
    verified: false, source: "tilequery: 7th Ave centreline (0.1m)" },

  // ── Amuwo Odofin ──
  { slug: "obuzu-market", name: "Obuzu Market", area: "amuwo-odofin", placeType: "open_market",
    location: { lat: 6.46263, lng: 3.28562 }, address: "2nd Avenue, Amuwo Odofin",
    verified: true, source: "tilequery: Marketplace POI" },
  { slug: "mile-2-market", name: "Mile 2 Market", area: "amuwo-odofin", placeType: "open_market",
    location: { lat: 6.45988, lng: 3.31163 }, address: "Lagos-Badagry Expressway, Mile 2",
    verified: true, source: "osm: Mile 2 station" },
  { slug: "navy-town-stalls", name: "Navy Town Stalls", area: "amuwo-odofin", placeType: "open_market",
    location: { lat: 6.44486, lng: 3.28338 }, address: "Navy Town Road, Amuwo Odofin",
    verified: true, source: "osm: Navy Town" },
  { slug: "amuwo-housing-kiosk", name: "Amuwo Housing Kiosk", area: "amuwo-odofin", placeType: "kiosk",
    location: { lat: 6.46858, lng: 3.28266 }, address: "Amuwo Odofin Housing Estate",
    verified: false, source: "osm: area centre" },

  // ── Satellite Town ──
  { slug: "trade-fair-complex", name: "Trade Fair Complex", area: "satellite-town", placeType: "open_market",
    location: { lat: 6.46368, lng: 3.24687 }, address: "Lagos-Badagry Expressway, Satellite Town",
    verified: true, source: "osm: Trade Fair Complex (retail)" },
  { slug: "satellite-town-market", name: "Satellite Town Market", area: "satellite-town", placeType: "open_market",
    location: { lat: 6.44093, lng: 3.25719 }, address: "Nwankwo Street, Satellite Town",
    verified: true, source: "osm: Nwankwo Street" },
  { slug: "satellite-town-kiosk", name: "Satellite Junction Kiosk", area: "satellite-town", placeType: "kiosk",
    location: { lat: 6.44560, lng: 3.25240 }, address: "Satellite Town Junction",
    verified: false, source: "derived: near area centre" },

  // ── Ojo ──
  { slug: "alaba-international", name: "Alaba International Market", area: "ojo", placeType: "open_market",
    location: { lat: 6.46054, lng: 3.19032 }, address: "Alaba International Market, Ojo",
    verified: true, source: "tilequery: Retail Area POI" },
  { slug: "ojo-market", name: "Ojo Market", area: "ojo", placeType: "open_market",
    location: { lat: 6.46493, lng: 3.18887 }, address: "Ojo Road, Ojo",
    verified: true, source: "osm: Ojo" },
  { slug: "ojo-alaba-rago", name: "Alaba Rago Stalls", area: "ojo", placeType: "open_market",
    location: { lat: 6.45788, lng: 3.18850 }, address: "Alaba Rago, Ojo",
    verified: false, source: "derived: near Alaba International" },
  { slug: "ojo-cantonment-shop", name: "Ojo Cantonment Shop", area: "ojo", placeType: "supermarket",
    location: { lat: 6.46900, lng: 3.19600 }, address: "Ojo Cantonment Road",
    verified: false, source: "derived: near area centre" },
];
