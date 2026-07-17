#!/usr/bin/env node
/**
 * One-off: recompute every stored price band from the observations that are
 * still admissible under the freshness policy.
 *
 * ─── Why a script, and not just a code fix ──────────────────────────────────
 *
 * `offers_current.price_min` / `price_max` are STORED, not derived
 * (src/db/schema/index.ts:281-282). Windowing the read/write path fixes only
 * what happens NEXT. A band already pinned by an ancient observation stays
 * pinned until that exact (variant, unit, place) triple is observed again —
 * which for a stall nobody revisits may be never.
 *
 * That is not hypothetical. `submitObservation` (src/app/actions.ts:361-372)
 * selects the supporting prices with NO time bound, NO moderation filter, and
 * takes min()/max() over ALL of history. So today's floor can be set by a price
 * from a week ago. Measured against the live database at the time of writing:
 * 79 of 398 offers with fresh evidence carry a band the fresh evidence does not
 * support.
 *
 * Fixing the write path ships the corrupt present. This backfills it. The two
 * changes are a pair; neither is sufficient alone.
 *
 * ─── The window ────────────────────────────────────────────────────────────
 *
 * IMPORTED from `FRESHNESS_POLICY` in src/lib/trust.ts — deliberately not
 * copied. The 72h number already exists in three places (FoodModule's orphaned
 * policy, `EXPIRATION_HOURS` in src/db/seed.ts:30, and a bare `72 * 3600 * 1000`
 * at src/app/actions.ts:357/:624). A fourth copy in this file is how the backfill
 * and the app silently come to disagree about what "fresh" means. It reads the
 * policy at runtime; if the policy moves, this moves with it.
 *
 * Admissible, matching what the trust model will count:
 *   (a) observed_at within FRESHNESS_POLICY.expirationHours
 *   (b) availability_state = 'available'   — a sold-out report carries no price
 *   (c) price_amount is not null
 *   (d) moderation_status = 'approved'
 *
 * The band itself is min()/max() with kind 'Range' when they differ and 'Exact'
 * when they do not — the same shape submitObservation writes (actions.ts:377-386),
 * so this backfill and the live path agree on what a band IS. Only the window
 * differs, which is the entire bug.
 *
 * ─── What it does NOT touch, on purpose ────────────────────────────────────
 *
 * Only price_min / price_max / price_kind. Not freshness_state, not trust_level,
 * not last_observed_at, not expires_at, not supporting_observation_count. Those
 * are the trust model's answers (src/lib/trust.ts), they are being wired
 * separately, and a script that rewrote them from a different derivation would
 * be a second trust model competing with the first.
 *
 * ─── The empty case: triples with NO admissible observation ────────────────
 *
 * This is the decision in this script, so it is made explicitly and out loud.
 *
 * Such a triple has no band. There is no fresh evidence for any price. The three
 * things that could be done about it:
 *
 *   1. Null the band.     NOT AVAILABLE. `price_min` is NOT NULL
 *                         (schema/index.ts:281). "No band" is not a state this
 *                         table can hold. That constraint is load-bearing, and
 *                         relaxing it is a schema decision this script does not
 *                         get to make on the way past.
 *
 *   2. Delete the row.    OUT OF SCOPE, and it is not a recompute — it is a
 *                         reap. It removes the offer from the map, the item
 *                         pickers and every aggregate, and blanks it from the UI
 *                         entirely. Different blast radius, different decision,
 *                         and reversible only by re-deriving from observations.
 *                         It deserves its own change and its own argument.
 *
 *   3. Leave it, say so.  WHAT THIS DOES.
 *
 * Option 3 is chosen because the stale band on these rows is NOT the same lie as
 * a wrong band on a live offer. The row already carries metadata that says it is
 * not current, and `offerSignal` (src/app/_components/ItemDetailSheet.tsx:135-153)
 * already honours it — deriving expiry from `expires_at` rather than trusting the
 * stored `freshness_state`. Against the live database, all 76 empty triples are
 * already marked: 62 have `expires_at` in the past and render "Needs checking";
 * 14 are `availability_state = 'unavailable'` and render "Not dey" with the price
 * struck through. A last-known price labelled "needs checking" is a defensible
 * thing to show. An unlabelled wrong number is not.
 *
 * THE HONEST CAVEAT, because it is the reason to keep reading rather than a
 * reason to relax: that label only exists on the DETAIL surface. The aggregate
 * read paths — `min(price_min)` at src/app/actions.ts:823 and :841 — filter on
 * neither `expires_at` nor `availability_state`, so an expired or sold-out row's
 * stale price still sets the "from ₦X" on a landing card with no caveat at all.
 * That is a real defect and this script cannot fix it: it is a missing WHERE
 * clause in a read, not a wrong number in a write. Nulling or deleting these rows
 * to route around it would blank live UI to paper over a query bug, and would
 * throw away the last thing anybody actually reported. Empty triples are counted
 * and listed below so the number is never a surprise; fixing the reads is the
 * follow-up this hands off.
 *
 * ─── Timestamps: why this file never says now() ────────────────────────────
 *
 * `observations.observed_at` and `offers_current.expires_at` are `timestamp
 * WITHOUT time zone` (schema/index.ts:232, :287). A naive timestamp has no
 * instant attached to it — it means whatever the reader's timezone says it
 * means. node-postgres serialises a JS Date into one using the WRITING process's
 * local zone, and parses one back using the READING process's. Those agree only
 * as long as it is the same machine.
 *
 * This is not theoretical here. An earlier draft of THIS FILE passed the cutoff
 * as a JS Date parameter — the obvious way to write it. Same data, same second,
 * only the runner's zone changed:
 *
 *   TZ=UTC                   398 offers with fresh evidence, 79 bands change
 *   TZ=America/Los_Angeles   411 offers with fresh evidence, 69 bands change
 *   TZ=Africa/Lagos          397 offers with fresh evidence, 78 bands change
 *
 * Ten bands' difference decided by the laptop's clock settings. A script that
 * rewrites every price in the product may not be that script. Those numbers are
 * what this file DEFENDS AGAINST, not what it does — as written it now returns
 * the UTC row from any zone, which is the point of everything below.
 *
 * So the window is fixed in ONE frame, explicitly: both bounds are formatted as
 * naive UTC strings and compared naive-against-naive. No `now()`, no
 * `::timestamptz`, no JS Date parameters — every one of those routes an ambient
 * timezone into the answer.
 *
 * UTC is not a preference here; the DATA SAYS SO. Read as UTC, the newest
 * observation is 3.8h in the past and no observation is future-dated. Read as
 * PDT, the same rows put the newest observation 3.2h into the FUTURE — which
 * nobody can report — and trip `ageHoursOf`'s future-skew guard on 29 of 949
 * rows. Only one of those two readings describes a world that can exist, so UTC
 * is the zone these naive values were written in, and reading them any other way
 * is simply reading them wrong. It is also what production does.
 *
 * DO NOT "simplify" this to `now() - interval '72 hours'`. It reads cleaner and
 * it is wrong: `now()` is a timestamptz, and comparing it to a naive column casts
 * through the SESSION timezone, silently shifting the window by that offset.
 * Measured on this database (session GMT, laptop PDT), that one substitution moved
 * the admissible-observation count from 764 to 726.
 *
 * THE REAL FIX IS NOT HERE. These columns should be `timestamptz`, which is the
 * only type that stores an instant rather than a rumour of one. That is a schema
 * migration with a data-rewrite and app-wide blast radius, it collides with work
 * in flight, and it is emphatically not something a band backfill should do on
 * the way past. Flagged in the handover; this file pins its own frame and says so.
 *
 * ─── Running it ────────────────────────────────────────────────────────────
 *
 *   node --env-file=.env.local scripts/recompute-bands.mjs           # DRY RUN
 *   node --env-file=.env.local scripts/recompute-bands.mjs --apply   # writes
 *
 * DRY RUN IS THE DEFAULT and --apply is the only way to write. This touches every
 * price in the product; a script that writes by default is a loaded gun.
 *
 * Idempotent: the band is a pure function of the observations in the window, so a
 * second run against unchanged data reports zero changes. Re-runnable by design —
 * the window slides with wall-clock time, which is correct, not drift.
 *
 * Reads the policy from src/lib/trust.ts via Node's type stripping (Node >= 22.18;
 * trust.ts is types-and-constants only, so there is nothing to transpile).
 */
import { Pool } from "pg";
import { FRESHNESS_POLICY } from "../src/lib/trust.ts";

const APPLY = process.argv.includes("--apply");

/**
 * Render an instant as the naive UTC wall-clock string Postgres will compare
 * against a `timestamp without time zone` column: "2026-07-14 04:33:13.600".
 *
 * `toISOString()` is always UTC regardless of the process zone — that is the
 * whole point. Dropping the "T" and the "Z" hands Postgres a literal with no
 * offset to interpret, so nothing can be re-interpreted on the way in.
 */
const naiveUtc = (date) => date.toISOString().replace("T", " ").replace("Z", "");

/**
 * One instant for the whole run, and one window derived from it — both frozen
 * before the first query.
 *
 * Frozen so that within an --apply run the rows PRINTED are exactly the rows
 * WRITTEN: the bands are computed once, reported from that result, and written
 * from that same result. A boundary re-evaluated per statement could let an
 * observation cross it mid-run, and the report would then describe a write that
 * did not happen.
 *
 * It does NOT make a dry run and a later --apply identical, and nothing can —
 * they are separate processes and the window slides between them. A band that
 * changes in the interval is a band a new observation moved, which is the system
 * working. Re-read the --apply run's own output; it is the authoritative one.
 */
const startedAt = new Date();
const nowUtc = naiveUtc(startedAt);
const cutoffUtc = naiveUtc(
  new Date(startedAt.getTime() - FRESHNESS_POLICY.expirationHours * 3_600_000)
);

const naira = (kobo) =>
  kobo === null || kobo === undefined
    ? "—"
    : `₦${(kobo / 100).toLocaleString("en-NG", { maximumFractionDigits: 2 })}`;

/** How a band reads to a person. `null` max means an exact price, not a range. */
const band = (min, max, kind) =>
  max === null || max === undefined ? `${naira(min)} (${kind})` : `${naira(min)}–${naira(max)} (${kind})`;

const run = async () => {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL environment variable is missing.");
    console.error("Run with: node --env-file=.env.local scripts/recompute-bands.mjs");
    process.exit(1);
  }

  const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });

  try {
    /**
     * Every offer, with the band its admissible observations actually support.
     * LEFT JOIN LATERAL, not INNER: a triple with no admissible observation must
     * come back with nulls so it can be COUNTED and REPORTED. An inner join would
     * silently drop exactly the rows the empty case is about — the failure mode
     * would be a clean-looking report that had quietly stopped looking.
     */
    const { rows } = await pool.query(
      `
      SELECT
        oc.id,
        iv.display_name                          AS variant,
        u.display_name                           AS unit,
        pl.name                                  AS place,
        oc.price_min                             AS old_min,
        oc.price_max                             AS old_max,
        oc.price_kind                            AS old_kind,
        oc.availability_state                    AS availability_state,
        -- Judged in SQL, in the same naive-UTC frame as the window. Parsing
        -- expires_at into a JS Date and comparing to Date.now() would route the
        -- runner's timezone back into the answer through the back door.
        (oc.expires_at <= $2::timestamp)         AS is_expired,
        f.new_min,
        f.new_max,
        f.new_kind,
        COALESCE(f.n, 0)::int                    AS fresh_observations
      FROM offers_current oc
      JOIN item_variants iv ON iv.id = oc.item_variant_id
      JOIN units u          ON u.id  = oc.unit_id
      JOIN places pl        ON pl.id = oc.place_id
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*)::int                                        AS n,
          MIN(o.price_amount)::int                             AS new_min,
          CASE WHEN MAX(o.price_amount) > MIN(o.price_amount)
               THEN MAX(o.price_amount)::int END               AS new_max,
          CASE WHEN MAX(o.price_amount) > MIN(o.price_amount)
               THEN 'Range' ELSE 'Exact' END                   AS new_kind
        FROM observations o
        WHERE o.item_variant_id = oc.item_variant_id
          AND o.unit_id         = oc.unit_id
          AND o.place_id        = oc.place_id
          AND o.observed_at     >= $1::timestamp
          AND o.availability_state = 'available'
          AND o.price_amount IS NOT NULL
          AND o.moderation_status  = 'approved'
        HAVING COUNT(*) > 0
      ) f ON TRUE
      ORDER BY iv.display_name, pl.name
      `,
      [cutoffUtc, nowUtc]
    );

    const empty = rows.filter((r) => r.fresh_observations === 0);
    const supported = rows.filter((r) => r.fresh_observations > 0);
    const changed = supported.filter(
      (r) => r.old_min !== r.new_min || r.old_max !== r.new_max || r.old_kind !== r.new_kind
    );

    console.log(`recompute-bands — ${APPLY ? "APPLY" : "DRY RUN"}`);
    console.log(
      `window: ${FRESHNESS_POLICY.expirationHours}h (FRESHNESS_POLICY, src/lib/trust.ts) ` +
        `— observations from ${cutoffUtc} to ${nowUtc} (UTC, naive)`
    );
    console.log("");
    console.log(`  offers_current rows            ${rows.length}`);
    console.log(`  with admissible observations   ${supported.length}`);
    console.log(`  bands that CHANGE              ${changed.length}`);
    console.log(`  bands already correct          ${supported.length - changed.length}`);
    console.log(`  NO admissible observations     ${empty.length}   (left untouched — see below)`);

    if (changed.length > 0) {
      const sample = changed.slice(0, 15);
      console.log("");
      console.log(`── Bands that change ${changed.length > sample.length ? `(first ${sample.length} of ${changed.length})` : ""}`);
      for (const r of sample) {
        console.log(`  ${r.variant} · ${r.unit} · ${r.place}`);
        console.log(
          `      ${band(r.old_min, r.old_max, r.old_kind)}  ->  ${band(r.new_min, r.new_max, r.new_kind)}` +
            `   (${r.fresh_observations} fresh obs)`
        );
      }
    }

    if (empty.length > 0) {
      /**
       * Split by what the UI can already tell the user, because the two classes
       * are not equally defensible and a single count would hide that.
       */
      const expired = empty.filter((r) => r.is_expired);
      const soldOut = empty.filter((r) => !r.is_expired && r.availability_state === "unavailable");
      const unmarked = empty.filter((r) => !r.is_expired && r.availability_state !== "unavailable");

      console.log("");
      console.log(`── No admissible observations: ${empty.length} rows, NOT modified`);
      console.log(`     ${expired.length} already expired (expires_at in the past) — detail UI says "Needs checking"`);
      console.log(`     ${soldOut.length} reported sold out — detail UI says "Not dey" and strikes the price`);
      console.log(`     ${unmarked.length} marked neither expired nor sold out`);
      if (unmarked.length > 0) {
        console.log("");
        console.log(
          `     ^ These ${unmarked.length} are the bad ones: no fresh evidence, and nothing on the row`
        );
        console.log(`       tells the UI to caveat the price. Worth a look — this class was empty when`);
        console.log(`       the script was written, so its appearance is new information.`);
        for (const r of unmarked.slice(0, 10)) {
          console.log(`       ${r.variant} · ${r.unit} · ${r.place} — ${band(r.old_min, r.old_max, r.old_kind)}`);
        }
      }
      console.log("");
      console.log(`     Their stored band stays as the last thing anybody reported. price_min is NOT NULL,`);
      console.log(`     so "no band" cannot be written; deleting the rows is a reap, not a recompute.`);
      console.log(`     NOTE: min(price_min) at actions.ts:823/:841 filters on neither expires_at nor`);
      console.log(`     availability_state, so these still set "from ₦X" on landing cards uncaveated.`);
      console.log(`     That is a read-path fix, not a backfill.`);
    }

    if (changed.length === 0) {
      console.log("");
      console.log("Nothing to change. Every supported band already matches its fresh observations.");
      return;
    }

    if (!APPLY) {
      console.log("");
      console.log(`DRY RUN — nothing was written. ${changed.length} row(s) would change.`);
      console.log("Re-run with --apply to write.");
      return;
    }

    /**
     * One transaction, only the rows that change, addressed by primary key. The
     * band is recomputed from the values already SELECTed rather than by
     * re-querying: the apply must write the bands that were just reported, not
     * whatever a second read of a live table happens to say.
     */
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const r of changed) {
        await client.query(
          // updated_at takes the run's pinned instant, not now(): `updated_at` is
          // naive too, so now() would land through the session timezone and stamp
          // a different wall-clock depending on how the connection was configured.
          `UPDATE offers_current
             SET price_min = $2, price_max = $3, price_kind = $4, updated_at = $5::timestamp
           WHERE id = $1`,
          [r.id, r.new_min, r.new_max ?? null, r.new_kind, nowUtc]
        );
      }
      await client.query("COMMIT");
      console.log("");
      console.log(`APPLIED — ${changed.length} band(s) rewritten from observations inside the ${FRESHNESS_POLICY.expirationHours}h window.`);
      console.log(`${empty.length} row(s) with no admissible observation were left alone.`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
};

run().catch((error) => {
  console.error("recompute-bands failed:", error);
  process.exit(1);
});
