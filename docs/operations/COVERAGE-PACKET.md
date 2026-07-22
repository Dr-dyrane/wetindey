# Pilot coverage daily packet (read-only contract)

**Status:** Read-only definition. Smallest learning step for register entry
[`WD-I-002` Pilot coverage cockpit](PORTFOLIO-AND-IDEA-REGISTER.md).
**Owner:** Operations and Field Data (Food Operations).
**Script:** [`scripts/operations/coverage-daily-packet.mjs`](../../scripts/operations/coverage-daily-packet.mjs)

This document defines the coverage-state contract the packet reports and how an
operator runs it read-only. It builds the definition and the script only. It
does not authorize a dashboard, a command center, automation, partner ingestion,
or any public coverage claim, and it does not connect this repository to any
live or production database.

## 1. What the packet answers

For the bounded pilot geography and the freshness windows already in force, it
answers: which cells have fresh admissible coverage, and where are gaps,
conflicts, and corrections accumulating.

A **cell** is one subject: a tuple of

| Dimension | Column source |
|---|---|
| Geography (bounded pilot LGAs / areas) | `places.area_id` → `areas` (`slug`, `name`, `type`, `coverage_status`) |
| Place (market, stall, kiosk, shop) | `places` (`id`, `slug`, `name`, `place_type`) |
| Item | `item_variants.item_id` → `items` (`slug`, `canonical_name`) |
| Variant | `item_variants` (`slug`, `display_name`) |
| Unit | `units` (`code`, `display_name`, `dimension`) |
| Time window | `observations.observed_at` against the freshness windows |

The cell key `(item_variant_id, unit_id, place_id)` is the same natural key the
app already uses across `observations` and `offers_current`.

## 2. Admissibility (ADR-012 / ADR-015)

A row counts as **live coverage** only when both are true:

- `observations.provenance = 'observed'`, and
- `observations.moderation_status = 'approved'`.

Everything else is excluded from live coverage, per ADR-012 and the ADR-015
admissibility matrix:

| Provenance | Treatment in this packet |
|---|---|
| `observed` | Admissible, after the moderation gate above |
| `synthetic` | Demo only. Zero coverage. Never counted. |
| `partner` | Quarantined. Zero coverage. |
| `reference` | Context only. Zero coverage. |
| `inferred` | Quarantined. Zero coverage. |

Moderation, source identity, collection method, and provenance stay independent.
A reputable source does not convert an inadmissible provenance class into
evidence, and an `observed` row still has to pass moderation.

## 3. Freshness windows (ADR-006)

Flat windows, in force, measured from `observed_at`:

- **fresh:** age ≤ 24h (`staleHours`)
- **stale:** 24h < age ≤ 72h
- **expired:** age > 72h (`expirationHours`)

The single source of truth in the app is `FRESHNESS_POLICY` in
`src/lib/trust.ts` (`staleHours: 24`, `expirationHours: 72`). This ops script
cannot import a `.ts` module and must not edit `src/**`, so it mirrors the two
numbers with an ADR-006 citation. If ADR-006 or `trust.ts` changes the windows,
the script constants `STALE_HOURS` / `EXPIRE_HOURS` must be changed to match.

## 4. Coverage states, exactly

Each cell that has at least one admissible observation inside the 72h window is
classified into exactly one state. `absent` and the `unknown` classes are
reported separately because an absent cell has, by definition, no admissible row
to classify.

| State | Exact rule | Meaning |
|---|---|---|
| **fresh** | ≥ 1 admissible observation with age ≤ 24h, availability agrees, and ≥ 2 distinct source rows in the fresh window | Fresh, corroborated by more than one source row |
| **weak_single_source** | Fresh (age ≤ 24h) and availability agrees, but ≤ 1 distinct source row in the fresh window | Fresh but uncorroborated |
| **stale** | Newest admissible observation is 24h-72h old (no admissible row inside 24h) | Ageing; confirm before relying |
| **conflicting** | Inside the fresh window, both `available` and `unavailable` appear for the cell | Hard availability disagreement; needs a human read, not a verdict |
| **absent (expired)** | The cell was known, but its newest admissible observation is now older than 72h | Was covered, now unknown |
| **unknown place** | A pilot place with no admissible observation ever | Unknown by default |

Notes bound to these states:

- **Unknown stays unknown.** The packet never enumerates the whole catalog ×
  place grid as if every cell ought to be covered. Absent and never-observed
  cells are reported as explicit counts and lists, never inferred as covered.
  A blank is a blank, not a green.
- **`weak_single_source` and `fresh` split on `distinct_source_count`, which
  counts SOURCE ROWS.** Today those rows are largely category rows, not people
  (ADR-003, ADR-006). A multi-source cell is therefore a *lower bound* on
  independence, never proof that N people reported. The packet states this on
  every run. No hidden worker ranking is produced.
- **Price dispersion is a soft signal, not a state.** When fresh `available`
  prices disagree in amount, the packet lists it separately as informational.
  It is not a coverage state and is not a false-precision heatmap.

## 5. Corrections and open issues

| Metric | Source | Meaning |
|---|---|---|
| Correction observations | `observations.corrects_observation_id is not null`, split by `moderation_status` | Corrections in the log; `pending` are open corrections |
| Observed rows pending admission | `provenance = 'observed' and moderation_status = 'pending'` | Contributed evidence not yet admissible; a clearable gap |
| Problem reports (by kind) | `problem_reports.kind` (`price_wrong`, `place_wrong`, `app_bug`, `other`) | Free-text "something is wrong"; no status column, so every one is treated as open and read by hand |

`problem_reports.place_id` is nullable with no foreign key, so reports may be
contextless; the packet counts all of them and, separately, the subset tied to a
pilot place.

## 6. Bounded pilot geography

The pilot is bounded by decision, never Lagos-wide. The script selects pilot
areas as follows:

1. If the operator sets `PILOT_AREA_SLUGS` (comma-separated), those exact area
   slugs are the pilot.
2. Otherwise it falls back to `areas.coverage_status = 'active'`, the schema's
   own pilot marker.

The documented default south-west Lagos set (from `src/db/lagosSouthWest.ts`) is
`festac, amuwo-odofin, satellite-town, ojo`. Widening the pilot is a separate
decision, not a flag change made in passing.

## 7. How to run it (read-only)

Running the packet is a **separate, authorized operator step** using the
operator's **own read-only DSN**. This repository ships no DSN and connects to
nothing on its own.

```sh
# Preferred: a role with SELECT-only privileges on the pilot tables.
DATABASE_URL='postgres://readonly_user:...@host/db?sslmode=require' \
  node scripts/operations/coverage-daily-packet.mjs

# JSON instead of text:
DATABASE_URL='...' node scripts/operations/coverage-daily-packet.mjs --json

# Explicit pilot geography and a reproducible clock:
PILOT_AREA_SLUGS='festac,amuwo-odofin,satellite-town,ojo' \
PACKET_NOW_ISO='2026-07-22T08:00:00Z' \
DATABASE_URL='...' node scripts/operations/coverage-daily-packet.mjs
```

If `DATABASE_URL` is unset the script prints guidance and exits `0` **without
connecting**. It never writes a file and opens no network except the one
database read.

### Read-only guarantees

1. **Static self-guard.** Every query string is scanned before it runs. Any
   mutation keyword (`INSERT`, `UPDATE`, `DELETE`, `UPSERT`, `MERGE`, `TRUNCATE`,
   `DROP`, `ALTER`, `CREATE`, `GRANT`, `REVOKE`, `COPY`, `CALL`, `SET`, …), any
   semicolon, or any query not beginning with `SELECT`/`WITH` aborts the whole
   run. Matching is word-bounded so `updated_at` / `created_at` /
   `last_observed_at` do not trip the guard.
2. **Database-enforced transaction.** Queries run inside
   `START TRANSACTION READ ONLY`, so even a hypothetical write is rejected by
   Postgres.
3. **Least privilege.** Use a role that only has `SELECT`. The two guards above
   are defense in depth on top of that, not a substitute for it.

## 8. Environment variables

| Variable | Required | Meaning |
|---|---|---|
| `DATABASE_URL` | To connect | Operator's read-only DSN. Unset → guidance + exit 0. |
| `PILOT_AREA_SLUGS` | No | Comma-separated area slugs. Unset → `coverage_status='active'`. |
| `PACKET_NOW_ISO` | No | Anchor "now" for a reproducible packet. Unset → wall clock. |

## 9. Non-goals (explicit)

- Not a dashboard, BI platform, command center, or automation.
- No writes, no file output, no network beyond the single database read.
- No synthetic, reference, partner, or quarantined row counted as live coverage.
- No public operator data, no precise contributor traces, no hidden worker
  ranking, no auto-approval, no false-precision heatmap.
- No inferred coverage: unknown stays unknown and is shown, not hidden.
- No pilot widening, partner ingestion, reputation scoring, or public coverage
  promise. Those need their own decisions and lanes.
