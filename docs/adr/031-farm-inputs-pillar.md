# ADR-031: Farm inputs is a pillar, and it rides the existing truth engine

**Status:** Accepted (Founder-directed shape and Founder acceptance both given
in-session, 2026-07-22; acceptance amends ADR-008's pillar set to seven, adding
AGRICULTURE, inputs first, with the mapping rule intact)
**Deciders:** Dr. Dyrane Alexander (final product authority)
**Framed by:** Private Contractor, Maps Delivery, acting for Product & Portfolio
**Phase discipline:** The sole launch phase remains WetinDey Food Truth & Pilot
Operations. This ADR creates no launch promise, no pillar flag, no schema, and no lane.

## Context

WetinDey answers one question well: what does this thing cost near me right now, and
should I trust that answer. Today it answers it for food, with Money (Aboki FX) as a
parked adjacent pillar. The Founder directed an agriculture lane this session and chose
its shape from framed alternatives: a farm inputs pillar.

A farmer buying inputs faces the food shopper's exact problem, sharpened by season and
distance: fertilizer, seed, agrochemicals, and feed prices swing hard, the nearest
agro-dealer may be a long trip away, and a wasted trip costs a working day plus
transport during a planting window that does not wait. Nigeria's farm-input market has
the same structure WetinDey already models: named sellers at physical places, priced
items in standard units, freshness that decays, and claims that deserve admission rules
rather than blind trust.

The alternatives considered and not chosen: extending Food toward farm-gate produce
(rejected as the primary shape because the user and the trip are different: a farmer
buying NPK is not a cook buying garri, and conflating them muddies both catalogs);
a full two-sided agri vertical with produce selling (rejected for now as unbounded
scope requiring its own phase thinking).

## Decision

Farm inputs (working name: Agri) becomes a WetinDey pillar, carried by the existing
truth engine with no engine changes.

**This decision amends ADR-008.** Accepted ADR-008 fixes six core pillars of daily
uncertainty (FOOD, HOME, HEALTH, MONEY, TRANSPORT, COMMUNITY) and binds every category
to one of them. Farm inputs maps honestly to none of the six: a farmer buying NPK is
not resolving a FOOD uncertainty (nobody eats fertilizer) and forcing it under FOOD
would muddy both catalogs, the exact conflation this ADR's rejected alternative names.
Acceptance of this ADR (given 2026-07-22) amends ADR-008's pillar set to seven,
adding AGRICULTURE (inputs first), with ADR-008's mapping rule otherwise intact.

The pillar's shape:

- **The user** is a farmer or farm buyer purchasing inputs.
- **The places** are agro-dealers: a new `place_type` in the existing places model, the
  way `open_market` and `supermarket` are types today. A stall that sells both food and
  inputs remains one place with offers in two pillars.
- **The catalog** is input items with real units: 50kg bag of NPK 15-15-15, 1L knapsack
  herbicide, 25kg layer feed, seed by variety and weight. Item, variant, unit, price
  band, observation, freshness: all existing semantics, no new claim types.
- **The truth rules do not fork.** Admission, provenance, freshness decay, conflict
  visibility, moderation status gates on public reads (ADR-019), and the
  no-paid-trust rules apply to Agri claims identically. Synthetic or sample data can
  never become evidence of live Agri truth, exactly as for Food.
- **The map treatment follows the map's existing language:** agro-dealers get a place
  symbol like every other place type. The own-markets glow remains market-family only;
  any Agri glow treatment is a separate future map decision, not implied here.

## What this ADR does not do

It does not create a pillar flag, route, screen, schema migration, seed data, or
coverage promise. It does not amend the launch phase: no Agri capability may become a
public promise before the Food Truth gates pass and the Founder separately authorizes
Agri exposure. It does not authorize data collection from any agro-dealer.

## Consequences and queued implementation shape

When accepted, implementation proceeds as separately claimed, independently refuted
lanes in this order, each blocked on the one before it:

1. **Catalog and place-type foundation** (schema lane): `agro_dealer` place type;
   input catalog tables reusing the item/variant/unit model; migration with its own
   ledger discipline; default-off pillar flag.
2. **Pillar surface** (spine lane): `CategoryPillar` gains `agri` behind the flag;
   category selector, search, and offer list reuse the Food components with Agri copy
   (no native-language copy invented by agents; owner-supplied strings only).
3. **Map surface** (maps lane): agro-dealer symbol in the existing `PLACE_TYPE_SYMBOLS`
   vocabulary; POI budget review so agro-dealers neither vanish nor dominate.
4. **Field truth** (operations, human-led): bounded agro-dealer coverage in the pilot
   geography before any user-facing exposure, per the same evidence standards as Food.

Risks recorded: seasonality makes freshness windows differ from food (fertilizer prices
can be stable for weeks then move daily in planting season): the freshness model's
decay parameters may need per-pillar tuning, flagged for the Data/Truth home. Input
adulteration is a trust problem food does not have in the same form (fake agrochemicals
are endemic): verified-seller signals for Agri must not be conflated with price
freshness, flagged for Trust & Safety before any Agri trust surface ships.

## Implementation note (2026-07-23, steward confirmation, decision unchanged)

Lane 1's scout found the live schema already open: `places.place_type` and
`items.category` are unconstrained varchars, so `agro_dealer` and `agri` are
accepted at the database layer today and ADR-014 already forbids the pillar
owning duplicate item/variant/unit tables. Lane 1 therefore ships APP-LAYER
ONLY: the default-off pillar registry entry, the `agro_dealer` and `agri`
constants, and a contract test. No migration exists because no DDL exists;
this corrects the consequence section's assumption above, not the decision.
If a category CHECK is ever wanted as data-integrity hardening, it is a
separate, deliberate migration lane coordinated with the migration-tree
owner, never bundled into a pillar lane; and any agri migration sequences
after in-flight migration work settles so it appends to a stable journal.

## Register linkage

Register entry WD-I-006 records the same decision with review cadence; the register
never authorizes work, and this ADR grants none either: accepted, it governs the
decision, and implementation begins only when LANES.md grants exact paths.
