/**
 * Nigeria's administrative tree, as far down as WetinDey covers.
 *
 * This exists because `areas.parentAreaId` has been in the schema since the
 * first migration and was never written — every area sat flat with a NULL
 * parent (docs/APP-MAP.md lists it under "columns with ZERO references
 * anywhere"). The column was right; nothing filled it.
 *
 * It matters for how a person actually says where they are. Nobody in Lagos
 * thinks "6.4641, 3.2753". They think Lagos → Amuwo Odofin → Festac. A
 * coordinate field is an engineer's idea of manual entry; this is a shopper's.
 *
 * COVERAGE IS THE POINT, NOT COMPLETENESS. Nigeria has 36 states and 774 LGAs.
 * Only what the pilot actually serves is here, so the picker can never offer a
 * place with nothing behind it. Country and state are single-child on purpose:
 * they are shown as settled facts, not as choices — a select with one option is
 * a lie about the freedom you have.
 *
 * LGA assignments are real. Festac Town and Satellite Town are both in Amuwo
 * Odofin; Bariga is in Somolu, not in itself; Yaba and Ebute Metta are both in
 * Lagos Mainland.
 */

export type AdminLevel = "country" | "state" | "lga" | "neighborhood";

export interface AdminNode {
  slug: string;
  name: string;
  level: AdminLevel;
  /** Parent's slug. Null only for the root. */
  parent: string | null;
  /** Rough centre. Only neighbourhoods carry a real, sourced point — see
   *  lagosSouthWest.ts. These are for framing the map when you pick an LGA. */
  center: { lat: number; lng: number };
  source: string;
}

export const NIGERIA_ADMIN: AdminNode[] = [
  {
    slug: "ng", name: "Nigeria", level: "country", parent: null,
    center: { lat: 9.082, lng: 8.6753 },
    source: "geographic centre of Nigeria; framing only"
  },
  {
    slug: "ng-lagos", name: "Lagos", level: "state", parent: "ng",
    center: { lat: 6.5244, lng: 3.3792 },
    source: "Lagos state centre; framing only"
  },

  // ── LGAs the pilot serves ──
  {
    slug: "lga-amuwo-odofin", name: "Amuwo Odofin", level: "lga", parent: "ng-lagos",
    center: { lat: 6.46858, lng: 3.28266 },
    source: "osm: Amowo-Odofin"
  },
  {
    slug: "lga-ojo", name: "Ojo", level: "lga", parent: "ng-lagos",
    center: { lat: 6.46493, lng: 3.18887 },
    source: "osm: Ojo"
  },
  {
    slug: "lga-lagos-mainland", name: "Lagos Mainland", level: "lga", parent: "ng-lagos",
    center: { lat: 6.5061, lng: 3.3792 },
    source: "derived: midpoint of the Yaba and Ebute Metta anchors"
  },
  {
    slug: "lga-somolu", name: "Somolu", level: "lga", parent: "ng-lagos",
    center: { lat: 6.5332, lng: 3.3934 },
    source: "derived: the Bariga anchor; Bariga sits in Somolu LGA"
  },
  {
    slug: "lga-surulere", name: "Surulere", level: "lga", parent: "ng-lagos",
    center: { lat: 6.5028, lng: 3.3592 },
    source: "derived: the Surulere anchor"
  },
  {
    slug: "lga-mushin", name: "Mushin", level: "lga", parent: "ng-lagos",
    center: { lat: 6.5262, lng: 3.3533 },
    source: "derived: the Mushin anchor"
  },
];

/**
 * Which LGA each covered neighbourhood belongs to.
 *
 * Keyed by the area slugs the seed already writes, so this maps onto existing
 * rows rather than introducing a parallel set. Adding an area without adding it
 * here fails the assertion below rather than silently orphaning it in the
 * picker.
 */
export const NEIGHBOURHOOD_LGA: Record<string, string> = {
  // Amuwo Odofin LGA
  "festac": "lga-amuwo-odofin",
  "amuwo-odofin": "lga-amuwo-odofin",
  "satellite-town": "lga-amuwo-odofin",
  // Ojo LGA
  "ojo": "lga-ojo",
  // Lagos Mainland LGA
  "yaba": "lga-lagos-mainland",
  "ebute-metta": "lga-lagos-mainland",
  // Somolu LGA — Bariga is in Somolu, not its own LGA
  "bariga": "lga-somolu",
  // Surulere LGA
  "surulere": "lga-surulere",
  // Mushin LGA
  "mushin": "lga-mushin",
};

/** Fail the seed on an orphan rather than shipping a picker with a dead branch. */
export function assertAdminTree(areaSlugs: string[]): void {
  const problems: string[] = [];
  const known = new Set(NIGERIA_ADMIN.map((n) => n.slug));

  for (const n of NIGERIA_ADMIN) {
    if (n.parent && !known.has(n.parent)) problems.push(`"${n.slug}" has parent "${n.parent}", which is not in the tree`);
  }
  for (const slug of areaSlugs) {
    const lga = NEIGHBOURHOOD_LGA[slug];
    if (!lga) problems.push(`area "${slug}" has no LGA in NEIGHBOURHOOD_LGA — it would be unreachable in the picker`);
    else if (!known.has(lga)) problems.push(`area "${slug}" claims LGA "${lga}", which is not in the tree`);
  }
  if (problems.length) {
    throw new Error(`Administrative tree is inconsistent:\n  - ${problems.join("\n  - ")}`);
  }
}
