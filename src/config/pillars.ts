/**
 * ADR-031 farm-inputs (AGRICULTURE) pillar: app-layer foundation (lane 1).
 *
 * Option B, confirmed by the ADR-031 steward and recorded on the ADR: lane 1
 * ships NO migration. `places.place_type` and `items.category` are open
 * varchars, so `agro_dealer` and `agri` are already accepted at the database
 * layer, and ADR-014 forbids the pillar owning duplicate item/variant/unit
 * tables. The foundation is therefore only this: the two domain constants and a
 * default-off flag.
 *
 * The flag stays false until lanes 2 to 4 land and the shared-database
 * activation (credential-gated, exactly like every other pillar's) is done.
 * Lane 2 reads `PILLAR_FLAGS.agri` to gate the category selector; while it is
 * false nothing surfaces agri, in the selector or on the map. Lane 3 (the map
 * symbol, owned by the Maps seat) imports `AGRO_DEALER_PLACE_TYPE` from here so
 * the place-type string has one source of truth.
 */

/** The new agro-dealer place type, a value in the existing open `places.place_type`. */
export const AGRO_DEALER_PLACE_TYPE = "agro_dealer" as const;

/** The new farm-input catalog category, a value in the existing open `items.category`. */
export const AGRI_CATEGORY = "agri" as const;

/**
 * Per-pillar feature flags. `agri` is default-off and only lane 2 reads it; it
 * flips on only after the credential-gated shared-database activation, never as
 * a code default.
 */
export const PILLAR_FLAGS = {
  agri: false,
} as const;
