#!/usr/bin/env node
// @ts-nocheck
/**
 * WetinDey pilot coverage daily packet (READ-ONLY).
 *
 * Seat: Operations and Field Data (Food Operations).
 * Register: WD-I-002 "Pilot coverage cockpit", smallest learning step only.
 *   "Define a read-only daily packet from existing admissible data before
 *    building a dashboard. Run it manually with Food Operations."
 *
 * WHAT THIS IS
 *   One SELECT-only report over the immutable observation log that tells an
 *   operator, for the bounded pilot geography and the freshness windows already
 *   in force, which cells have fresh admissible coverage and where gaps,
 *   conflicts, and corrections are accumulating. A cell is one
 *   (item variant, unit, place) subject, the natural key the app already uses
 *   across `observations` and `offers_current`.
 *
 * WHAT THIS IS NOT
 *   Not a dashboard, BI platform, command center, or automation. It writes no
 *   file, opens no network except the one database read, changes no row, and
 *   makes no decision. Running it is a separate operator step with the
 *   operator's own read-only DSN. See docs/operations/COVERAGE-PACKET.md.
 *
 * HARD BOUNDARIES (ADR-012 / ADR-015 admissibility, ADR-006 freshness)
 *   - Only provenance = 'observed' AND moderation_status = 'approved' rows count
 *     as live coverage. synthetic (demo), partner (quarantined), reference
 *     (context only), and inferred (quarantined) rows are NEVER live coverage.
 *   - Unknown stays unknown. The packet never invents a covered cell and never
 *     enumerates the whole catalog x place grid as if it ought to be covered.
 *     Places and subjects with no admissible evidence are reported as explicit
 *     UNKNOWN counts, shown rather than hidden.
 *   - "distinct sources" is a count of SOURCE ROWS, which today are largely
 *     category rows, not people (ADR-003 / ADR-006). A multi-source cell is a
 *     lower bound on independence, never proof that N people reported. The
 *     single-source vs multi-source split is read that way and nothing else.
 *
 * SAFETY
 *   - SELECT-only by construction. Every query is scanned by assertReadOnly()
 *     before it runs; any mutation keyword aborts the whole run.
 *   - Each query runs inside a database-enforced READ ONLY transaction, so even
 *     a hypothetical write would be rejected by the server.
 *   - DATABASE_URL is read from the environment at runtime only. If it is unset
 *     the script prints guidance and exits 0 WITHOUT connecting to anything.
 */

// --- Policy constants -------------------------------------------------------
// ADR-006: freshness windows are 24h (stale) and 72h (expired), flat, in force.
// The single source of truth in the app is FRESHNESS_POLICY in src/lib/trust.ts
// (staleHours: 24, expirationHours: 72). This ops script cannot import a .ts
// module and must not edit src/**, so the numbers are mirrored here with this
// citation. If ADR-006 / trust.ts changes the windows, this file must follow.
const STALE_HOURS = 24;
const EXPIRE_HOURS = 72;

// Admissibility, per ADR-012 / ADR-015. Only these two facts admit a row.
const ADMISSIBLE_PROVENANCE = "observed";
const ADMISSIBLE_MODERATION = "approved";

// Default bounded pilot geography (south-west Lagos), from src/db/lagosSouthWest.ts.
// Used only when the operator does not supply PILOT_AREA_SLUGS and no area is
// marked coverage_status = 'active'. Bounded by decision, never Lagos-wide.
const DEFAULT_PILOT_AREA_SLUGS = ["festac", "amuwo-odofin", "satellite-town", "ojo"];

// --- Read-only self-guard ---------------------------------------------------
// Refuse to run if any query is not a plain read. Word-boundary matching so that
// column names like updated_at / created_at / last_observed_at do not trip the
// UPDATE / CREATE tokens.
const FORBIDDEN_KEYWORDS = [
  "INSERT", "UPDATE", "DELETE", "UPSERT", "MERGE", "REPLACE",
  "TRUNCATE", "DROP", "ALTER", "CREATE", "RENAME",
  "GRANT", "REVOKE", "COPY", "CALL", "EXECUTE", "PREPARE",
  "VACUUM", "REINDEX", "CLUSTER", "COMMENT", "LOCK",
  "SET", "RESET", "INTO", "NEXTVAL", "SETVAL",
  "COMMIT", "ROLLBACK", "SAVEPOINT", "BEGIN", "START",
];

function assertReadOnly(name, text) {
  const trimmed = text.trim();
  if (!/^(select|with)\b/i.test(trimmed)) {
    throw new Error(`query "${name}" does not begin with SELECT or WITH; refusing to run`);
  }
  if (trimmed.includes(";")) {
    throw new Error(`query "${name}" contains a semicolon (statement chaining); refusing to run`);
  }
  for (const kw of FORBIDDEN_KEYWORDS) {
    const re = new RegExp(`\\b${kw}\\b`, "i");
    if (re.test(trimmed)) {
      throw new Error(`query "${name}" contains forbidden keyword "${kw}"; refusing to run`);
    }
  }
}

// --- Queries (all SELECT-only) ---------------------------------------------
// Parameters, in order, for every query below:
//   $1 pilotAreaSlugs : text[] or NULL  (NULL => fall back to coverage_status='active')
//   $2 expireCutoff   : timestamp       (now - EXPIRE_HOURS; the 72h admissible window)
//   $3 staleCutoff    : timestamp       (now - STALE_HOURS;  the 24h fresh window)

const PILOT_CTE = `
  pilot_areas as (
    select a.id, a.slug, a.name, a.type
    from areas a
    where ($1::text[] is null and a.coverage_status = 'active')
       or (a.slug = any($1::text[]))
  ),
  pilot_places as (
    select p.id, p.slug, p.name, p.place_type, pa.id as area_id, pa.slug as area_slug, pa.name as area_name
    from places p
    join pilot_areas pa on pa.id = p.area_id
  ),
  admissible as (
    select o.item_variant_id, o.unit_id, o.place_id, o.source_id,
           o.availability_state, o.price_amount, o.observed_at
    from observations o
    join pilot_places pp on pp.id = o.place_id
    where o.provenance = '${ADMISSIBLE_PROVENANCE}'
      and o.moderation_status = '${ADMISSIBLE_MODERATION}'
      and o.observed_at >= $2
  )
`;

// Q_CELLS: one classified row per (variant, unit, place) cell that has at least
// one admissible observation inside the 72h window. States: fresh, stale,
// weak_single_source, conflicting. (Absent/unknown are separate queries because
// an absent cell has, by definition, no admissible row to group.)
const Q_CELLS = `
with ${PILOT_CTE},
  cell as (
    select
      ad.item_variant_id, ad.unit_id, ad.place_id,
      max(ad.observed_at) as last_observed_at,
      count(*) as obs_count,
      count(distinct ad.source_id) as distinct_source_count,
      count(*) filter (where ad.observed_at >= $3) as fresh_obs_count,
      count(distinct ad.source_id) filter (where ad.observed_at >= $3) as fresh_distinct_sources,
      count(distinct ad.availability_state) filter (where ad.observed_at >= $3) as fresh_distinct_availability,
      min(ad.price_amount) filter (where ad.observed_at >= $3 and ad.availability_state = 'available') as fresh_price_min,
      max(ad.price_amount) filter (where ad.observed_at >= $3 and ad.availability_state = 'available') as fresh_price_max
    from admissible ad
    group by ad.item_variant_id, ad.unit_id, ad.place_id
  )
select
  pp.area_slug, pp.area_name, pp.slug as place_slug, pp.name as place_name,
  it.slug as item_slug, it.canonical_name as item_name,
  iv.slug as variant_slug, iv.display_name as variant_name,
  un.code as unit_code, un.display_name as unit_name,
  c.last_observed_at, c.obs_count, c.distinct_source_count,
  c.fresh_obs_count, c.fresh_distinct_sources, c.fresh_distinct_availability,
  c.fresh_price_min, c.fresh_price_max,
  case
    when c.fresh_obs_count = 0 then 'stale'
    when c.fresh_distinct_availability > 1 then 'conflicting'
    when c.fresh_distinct_sources <= 1 then 'weak_single_source'
    else 'fresh'
  end as state
from cell c
join pilot_places pp on pp.id = c.place_id
join item_variants iv on iv.id = c.item_variant_id
join items it on it.id = iv.item_id
join units un on un.id = c.unit_id
order by pp.area_slug, pp.slug, it.slug, iv.slug, un.code
`;

// Q_ABSENT: known subjects whose newest admissible observation is now older than
// the 72h window. "Was covered, now unknown." Grouped over ALL admissible rows
// (no window filter) so the max age can exceed the window.
const Q_ABSENT = `
with
  pilot_areas as (
    select a.id from areas a
    where ($1::text[] is null and a.coverage_status = 'active')
       or (a.slug = any($1::text[]))
  ),
  pilot_places as (
    select p.id from places p join pilot_areas pa on pa.id = p.area_id
  ),
  admissible_all as (
    select o.item_variant_id, o.unit_id, o.place_id, o.observed_at
    from observations o
    join pilot_places pp on pp.id = o.place_id
    where o.provenance = '${ADMISSIBLE_PROVENANCE}'
      and o.moderation_status = '${ADMISSIBLE_MODERATION}'
  ),
  subject as (
    select item_variant_id, unit_id, place_id, max(observed_at) as last_observed_at
    from admissible_all
    group by item_variant_id, unit_id, place_id
  )
select count(*)::int as expired_subject_count
from subject
where last_observed_at < $2
`;

// Q_UNKNOWN_PLACES: pilot places with zero admissible observations ever. These
// are unknown by default, reported as a count and a list, never as covered.
const Q_UNKNOWN_PLACES = `
with
  pilot_areas as (
    select a.id, a.slug, a.name from areas a
    where ($1::text[] is null and a.coverage_status = 'active')
       or (a.slug = any($1::text[]))
  ),
  pilot_places as (
    select p.id, p.slug, p.name, pa.slug as area_slug
    from places p join pilot_areas pa on pa.id = p.area_id
  ),
  observed_place as (
    select distinct o.place_id
    from observations o
    where o.provenance = '${ADMISSIBLE_PROVENANCE}'
      and o.moderation_status = '${ADMISSIBLE_MODERATION}'
  )
select pp.area_slug, pp.slug as place_slug, pp.name as place_name
from pilot_places pp
left join observed_place op on op.place_id = pp.id
where op.place_id is null
order by pp.area_slug, pp.slug
`;

// Q_PILOT_SHAPE: how many areas / places the pilot geography covers, so the
// packet can state its own denominator honestly.
const Q_PILOT_SHAPE = `
with
  pilot_areas as (
    select a.id, a.slug from areas a
    where ($1::text[] is null and a.coverage_status = 'active')
       or (a.slug = any($1::text[]))
  )
select
  (select count(*)::int from pilot_areas) as area_count,
  (select count(*)::int from places p join pilot_areas pa on pa.id = p.area_id) as place_count
`;

// Q_CORRECTIONS: correction observations (corrects_observation_id is set) in the
// pilot, split by moderation status. Pending corrections are open corrections.
const Q_CORRECTIONS = `
with
  pilot_areas as (
    select a.id from areas a
    where ($1::text[] is null and a.coverage_status = 'active')
       or (a.slug = any($1::text[]))
  ),
  pilot_places as (
    select p.id from places p join pilot_areas pa on pa.id = p.area_id
  )
select
  count(*)::int as correction_total,
  count(*) filter (where o.moderation_status = 'pending')::int as correction_open,
  count(*) filter (where o.moderation_status = 'approved')::int as correction_approved,
  count(*) filter (where o.moderation_status = 'rejected')::int as correction_rejected
from observations o
join pilot_places pp on pp.id = o.place_id
where o.corrects_observation_id is not null
`;

// Q_PENDING_ADMISSION: observed rows awaiting moderation in the pilot. These are
// contributed evidence not yet admissible; a gap the operator can clear.
const Q_PENDING_ADMISSION = `
with
  pilot_areas as (
    select a.id from areas a
    where ($1::text[] is null and a.coverage_status = 'active')
       or (a.slug = any($1::text[]))
  ),
  pilot_places as (
    select p.id from places p join pilot_areas pa on pa.id = p.area_id
  )
select count(*)::int as pending_observed_count
from observations o
join pilot_places pp on pp.id = o.place_id
where o.provenance = '${ADMISSIBLE_PROVENANCE}'
  and o.moderation_status = 'pending'
`;

// Q_PROBLEM_REPORTS: free-text "something is wrong" reports by kind. These have
// no status column (they are read by hand), so every one is treated as open.
// Nullable place_id with no FK: reports may be contextless, so we count all of
// them and, separately, the subset tied to a pilot place.
const Q_PROBLEM_REPORTS = `
with
  pilot_areas as (
    select a.id from areas a
    where ($1::text[] is null and a.coverage_status = 'active')
       or (a.slug = any($1::text[]))
  ),
  pilot_places as (
    select p.id from places p join pilot_areas pa on pa.id = p.area_id
  )
select
  pr.kind,
  count(*)::int as total,
  count(*) filter (where pp.id is not null)::int as tied_to_pilot_place
from problem_reports pr
left join pilot_places pp on pp.id = pr.place_id
group by pr.kind
order by pr.kind
`;

const QUERIES = [
  ["pilot_shape", Q_PILOT_SHAPE],
  ["cells", Q_CELLS],
  ["expired_subjects", Q_ABSENT],
  ["unknown_places", Q_UNKNOWN_PLACES],
  ["corrections", Q_CORRECTIONS],
  ["pending_admission", Q_PENDING_ADMISSION],
  ["problem_reports", Q_PROBLEM_REPORTS],
];

// --- Helpers ----------------------------------------------------------------
function nairaFromKobo(amount) {
  if (amount === null || amount === undefined) return "-";
  // price_amount is stored in the minor unit; render whole naira for the packet.
  return `NGN ${(amount / 100).toLocaleString("en-NG")}`;
}

function tallyStates(cellRows) {
  const counts = { fresh: 0, stale: 0, weak_single_source: 0, conflicting: 0 };
  for (const r of cellRows) counts[r.state] = (counts[r.state] || 0) + 1;
  return counts;
}

function rollup(cellRows, keyFields) {
  const map = new Map();
  for (const r of cellRows) {
    const key = keyFields.map((f) => r[f]).join(" · ");
    if (!map.has(key)) {
      map.set(key, { key, fresh: 0, stale: 0, weak_single_source: 0, conflicting: 0, total: 0 });
    }
    const row = map.get(key);
    row[r.state] += 1;
    row.total += 1;
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
}

function buildPacket(results, anchorNow, pilotSlugsUsed) {
  const cells = results.cells;
  const states = tallyStates(cells);
  const conflicts = cells.filter((r) => r.state === "conflicting");
  const priceDispersion = cells.filter(
    (r) => r.state !== "conflicting" && r.fresh_price_min !== null && r.fresh_price_max !== null && r.fresh_price_max > r.fresh_price_min,
  );
  return {
    generated_at: anchorNow.toISOString(),
    kind: "wetindey-pilot-coverage-daily-packet",
    read_only: true,
    policy: {
      freshness: { stale_hours: STALE_HOURS, expire_hours: EXPIRE_HOURS, source: "ADR-006 / src/lib/trust.ts FRESHNESS_POLICY" },
      admissibility: {
        provenance: ADMISSIBLE_PROVENANCE,
        moderation_status: ADMISSIBLE_MODERATION,
        source: "ADR-012 / ADR-015",
        excluded: ["synthetic", "partner", "reference", "inferred"],
      },
      independence_caveat:
        "distinct_source_count counts source ROWS (largely categories, not people; ADR-003). Multi-source is a lower bound on independence, not proof.",
      unknown_rule: "Unknown stays unknown. Absent and never-observed cells are shown as explicit counts, never inferred as covered.",
    },
    pilot_geography: {
      area_slugs: pilotSlugsUsed ?? "coverage_status='active'",
      area_count: results.pilot_shape.area_count,
      place_count: results.pilot_shape.place_count,
    },
    coverage_states: {
      ...states,
      absent_expired_subjects: results.expired_subjects.expired_subject_count,
      unknown_places_never_observed: results.unknown_places.length,
      note: "fresh/stale/weak_single_source/conflicting count cells with admissible evidence inside 72h. absent_expired_subjects = subjects last seen >72h ago. unknown_places = pilot places with no admissible evidence ever.",
    },
    rollup_by_area: rollup(cells, ["area_slug"]),
    rollup_by_item: rollup(cells, ["item_slug"]),
    rollup_by_place: rollup(cells, ["area_slug", "place_slug"]),
    conflicts: conflicts.map((r) => ({
      area: r.area_slug, place: r.place_slug, item: r.item_slug, variant: r.variant_slug, unit: r.unit_code,
      fresh_obs: r.fresh_obs_count, fresh_sources: r.fresh_distinct_sources,
      note: "availability disagreement inside the fresh window; needs a human read, not a verdict",
    })),
    price_dispersion_soft_signal: priceDispersion.map((r) => ({
      area: r.area_slug, place: r.place_slug, item: r.item_slug, variant: r.variant_slug, unit: r.unit_code,
      min: r.fresh_price_min, max: r.fresh_price_max,
      note: "fresh available prices disagree in amount; informational, not a coverage state",
    })),
    corrections: {
      total: results.corrections.correction_total,
      open_pending: results.corrections.correction_open,
      approved: results.corrections.correction_approved,
      rejected: results.corrections.correction_rejected,
    },
    pending_admission_observed: results.pending_admission.pending_observed_count,
    problem_reports_open: results.problem_reports,
    unknown_places: results.unknown_places.map((r) => ({ area: r.area_slug, place: r.place_slug, name: r.place_name })),
  };
}

function printText(packet) {
  const L = [];
  L.push("WetinDey pilot coverage daily packet (READ-ONLY)");
  L.push(`generated_at: ${packet.generated_at}`);
  L.push("");
  L.push("Admissibility: provenance='observed' AND moderation_status='approved' only.");
  L.push("Excluded from live coverage: synthetic, partner, reference, inferred.");
  L.push(`Freshness (ADR-006): fresh <= ${STALE_HOURS}h, stale <= ${EXPIRE_HOURS}h, then expired/unknown.`);
  L.push("Unknown stays unknown: absent and never-observed cells are shown, not inferred as covered.");
  L.push("");
  L.push(`Pilot geography: areas=${packet.pilot_geography.area_count}, places=${packet.pilot_geography.place_count} (${Array.isArray(packet.pilot_geography.area_slugs) ? packet.pilot_geography.area_slugs.join(", ") : packet.pilot_geography.area_slugs})`);
  L.push("");
  L.push("== Coverage states (cells = variant x unit x place) ==");
  const s = packet.coverage_states;
  L.push(`  fresh (>=2 source rows):     ${s.fresh}`);
  L.push(`  weak / single source row:    ${s.weak_single_source}`);
  L.push(`  stale (24h-72h):             ${s.stale}`);
  L.push(`  conflicting (availability):  ${s.conflicting}`);
  L.push(`  absent (subject expired>72h): ${s.absent_expired_subjects}`);
  L.push(`  unknown places (never obs):  ${s.unknown_places_never_observed}`);
  L.push("");
  L.push("== By area ==");
  for (const r of packet.rollup_by_area) {
    L.push(`  ${r.key}: total ${r.total} | fresh ${r.fresh} weak ${r.weak_single_source} stale ${r.stale} conflict ${r.conflicting}`);
  }
  L.push("");
  L.push("== By item ==");
  for (const r of packet.rollup_by_item) {
    L.push(`  ${r.key}: total ${r.total} | fresh ${r.fresh} weak ${r.weak_single_source} stale ${r.stale} conflict ${r.conflicting}`);
  }
  L.push("");
  L.push("== Corrections and open issues ==");
  L.push(`  correction observations: total ${packet.corrections.total}, open/pending ${packet.corrections.open_pending}, approved ${packet.corrections.approved}, rejected ${packet.corrections.rejected}`);
  L.push(`  observed rows pending admission: ${packet.pending_admission_observed}`);
  if (packet.problem_reports_open.length === 0) {
    L.push("  problem reports: none");
  } else {
    for (const pr of packet.problem_reports_open) {
      L.push(`  problem report [${pr.kind}]: ${pr.total} (tied to pilot place: ${pr.tied_to_pilot_place})`);
    }
  }
  L.push("");
  L.push("== Conflicts (availability disagreement, fresh window) ==");
  if (packet.conflicts.length === 0) L.push("  none");
  for (const c of packet.conflicts) {
    L.push(`  ${c.area}/${c.place} ${c.item}/${c.variant} @ ${c.unit} (fresh_obs ${c.fresh_obs}, sources ${c.fresh_sources})`);
  }
  L.push("");
  L.push("== Price dispersion (soft signal, not a state) ==");
  if (packet.price_dispersion_soft_signal.length === 0) L.push("  none");
  for (const d of packet.price_dispersion_soft_signal) {
    L.push(`  ${d.area}/${d.place} ${d.item}/${d.variant} @ ${d.unit}: ${nairaFromKobo(d.min)} .. ${nairaFromKobo(d.max)}`);
  }
  L.push("");
  L.push("== Unknown places (no admissible evidence ever) ==");
  if (packet.unknown_places.length === 0) L.push("  none");
  for (const u of packet.unknown_places) {
    L.push(`  ${u.area}/${u.place} (${u.name})`);
  }
  L.push("");
  L.push("Note: distinct sources count SOURCE ROWS, largely categories not people (ADR-003).");
  L.push("A multi-source cell is a lower bound on independence, never proof N people reported.");
  process.stdout.write(L.join("\n") + "\n");
}

// --- Main -------------------------------------------------------------------
async function main() {
  const args = new Set(process.argv.slice(2));
  const asJson = args.has("--json");

  // Guard every query before we even think about connecting.
  for (const [name, text] of QUERIES) assertReadOnly(name, text);

  const dsn = process.env.DATABASE_URL;
  if (!dsn) {
    process.stdout.write(
      [
        "WetinDey pilot coverage daily packet (READ-ONLY)",
        "",
        "DATABASE_URL is not set. This packet does not carry or guess a connection.",
        "The operator must supply a READ-ONLY DSN for the exact target, e.g.:",
        "",
        "  DATABASE_URL='postgres://readonly_user:...@host/db?sslmode=require' \\",
        "    node scripts/operations/coverage-daily-packet.mjs",
        "",
        "Use a role with SELECT-only privileges. Running this is a separate,",
        "authorized operator step. See docs/operations/COVERAGE-PACKET.md.",
        "",
      ].join("\n"),
    );
    process.exit(0);
  }

  // Anchor "now": overridable for reproducible packets, else the wall clock.
  const anchorNow = process.env.PACKET_NOW_ISO ? new Date(process.env.PACKET_NOW_ISO) : new Date();
  if (Number.isNaN(anchorNow.getTime())) {
    process.stderr.write("PACKET_NOW_ISO is not a valid ISO timestamp; refusing to run.\n");
    process.exit(1);
  }
  const expireCutoff = new Date(anchorNow.getTime() - EXPIRE_HOURS * 3600 * 1000);
  const staleCutoff = new Date(anchorNow.getTime() - STALE_HOURS * 3600 * 1000);

  const envSlugs = process.env.PILOT_AREA_SLUGS
    ? process.env.PILOT_AREA_SLUGS.split(",").map((s) => s.trim()).filter(Boolean)
    : null;
  // NULL lets the query fall back to coverage_status='active'. If the operator
  // wants the documented default set explicitly, they pass PILOT_AREA_SLUGS.
  const pilotSlugs = envSlugs && envSlugs.length ? envSlugs : null;
  const pilotSlugsForReport = pilotSlugs ?? (process.env.PILOT_AREA_SLUGS === "" ? DEFAULT_PILOT_AREA_SLUGS : null);

  // Dynamic import so the no-DSN path needs no dependency at all.
  const pgModule = await import("pg");
  const { Pool } = pgModule.default ?? pgModule;
  const pool = new Pool({
    connectionString: dsn,
    ssl: { rejectUnauthorized: false }, // matches src/db/index.ts for serverless SSL
    max: 1,
  });

  const results = {};
  let client;
  try {
    client = await pool.connect();
    // Database-enforced read-only transaction: defense in depth beyond the
    // static self-guard. A write attempted here would be rejected by Postgres.
    await client.query("start transaction read only");
    const params = [pilotSlugs, expireCutoff, staleCutoff];
    for (const [name, text] of QUERIES) {
      const res = await client.query(text, params);
      if (name === "cells" || name === "unknown_places" || name === "problem_reports") {
        results[name] = res.rows;
      } else {
        results[name] = res.rows[0] ?? {};
      }
    }
    await client.query("rollback");
  } catch (err) {
    process.stderr.write(`coverage packet failed: ${err && err.message ? err.message : String(err)}\n`);
    if (client) {
      try { await client.query("rollback"); } catch { /* already closing */ }
    }
    process.exitCode = 1;
  } finally {
    if (client) client.release();
    await pool.end();
  }

  if (process.exitCode === 1) return;

  const packet = buildPacket(results, anchorNow, pilotSlugsForReport ?? pilotSlugs);
  if (asJson) {
    process.stdout.write(JSON.stringify(packet, null, 2) + "\n");
  } else {
    printText(packet);
  }
}

main().catch((err) => {
  process.stderr.write(`coverage packet aborted: ${err && err.message ? err.message : String(err)}\n`);
  process.exit(1);
});
