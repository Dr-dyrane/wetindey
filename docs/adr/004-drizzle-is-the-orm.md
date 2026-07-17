# ADR-004: Drizzle is the ORM

**Date:** 2026-07-16
**Status:** Accepted
**Owners:** Dr Dyrane Alexander

## Context

This is a retroactive ADR. The decision was made in code, has been load-bearing since
`d6a126d` ("Configure Drizzle ORM, design PostGIS schema, and seed database"), and was
never written down.

The hazard being closed is documentary. `WETINDEY_BIBLE.md:4397` lists **"ORM."** under
*40.2 Open decisions*. It is not open. Drizzle owns the entire data layer:

- `drizzle-orm` `^0.45.2` and `drizzle-kit` `^0.31.10` (`package.json:22`, `:39`), over
  `pg` `^8.22.0` (`:25`).
- `src/db/index.ts` builds the one client the app has: `drizzle(pool, { schema })` on a
  `node-postgres` `Pool`, re-exporting the schema.
- `drizzle.config.ts` points `drizzle-kit` at `./src/db/schema/*` → `./src/db/migrations`,
  dialect `postgresql`.
- `package.json:11-13` wires the lifecycle: `db:generate` (`drizzle-kit generate`),
  `db:migrate` (`drizzle-kit migrate`), `db:seed` (`tsx src/db/seed.ts`).
- `src/db/schema/index.ts` declares all nine tables with `pgTable`, plus indexes via
  `index()` / `uniqueIndex()`. Four migrations exist: `0000_careless_piledriver.sql`
  through `0003_condemned_sally_floyd.sql`.
- `src/app/actions.ts` — the only query surface in the product — makes 24 `.select()` calls
  through the builder and exactly one `db.execute` of a hand-written CTE (`:109-163`).

An agent that reads "ORM — open" believes the choice is its to make, and rewrites a working
data layer. That is precisely the failure this repo is trying to cure.

## Decision

Drizzle ORM is the ORM of record for WetinDey, with `drizzle-kit` as the migration tool and
`node-postgres` as the driver. Schema is declared in TypeScript at `src/db/schema/index.ts`;
migrations are **generated** from it, never hand-written. PostGIS predicates are expressed
through Drizzle's `sql` template escape hatch.

The escape hatch is not an exception to the decision — it is the reason the decision holds.
PostGIS is where this product's queries live, and none of it is expressible in a typed query
builder: `ST_DWithin` on the geography column (`actions.ts:117`, `:1117`, `:1174`),
`ST_DistanceSphere` on a `::geometry` cast (`:812`, `:873`), `ST_Distance` for ordering
(`:1118`, `:1169`). Drizzle interpolates these into otherwise-typed queries — `sql<number>`
carries a return type — so the spatial predicates sit inside the builder rather than forcing
a raw-SQL fork of the read path.

## Alternatives considered

Reconstructed after the fact. **The original reasoning is not recorded anywhere in the repo
or its history** — `d6a126d` states the outcome, not the deliberation. What follows is what
the code supports, not what was argued at the time.

- **Prisma.** The plausible default, and the plausible rejection: its PostGIS story is weak
  — `geography` is unsupported natively, and spatial predicates land in `$queryRaw`, outside
  the type system. Given that `ST_DWithin` sits on the hot read path, that cost is
  structural rather than incidental. Whether this was actually weighed is not recorded.
- **Raw `pg` / `postgres.js`.** Would have handled PostGIS perfectly and given up
  everything else: no generated migrations, no typed rows, no schema as a single source.
  `db:generate` existing at all is evidence the migration story mattered.
- **Kysely.** The closest competitor on the same axis — typed builder, first-class raw SQL.
  No evidence it was evaluated.

## Consequences

**The known cost is real and has already been paid once.** A `geography` column has no
Drizzle primitive, so it needs `customType` — `geographyPoint` at `src/db/schema/index.ts:40`.
`node-postgres` returns hex-encoded EWKB for a geography column, not the WKT
`POINT(3.37 6.51)` the original `fromDriver` regex expected. The regex never matched, and the
fallback returned `{ lng: 0, lat: 0 }`: **every place in the app silently became (0,0)**, a
point in the Gulf of Guinea, for the life of the project until `6f465d1` ("Fix every location
in the app being (0,0)"). A custom type is a hand-written driver boundary, and this one was
wrong in a way no type checker could see.

The fix is now the rule: `fromDriver` decodes EWKB, accepts WKT for explicit `ST_AsText()`
selects, and **throws** on anything else rather than defaulting. `assertCoordinate`
(`src/app/_components/GetItSheet.tsx:76-83`, called at `:398` and `:421`) is the same
principle at the far end of the pipe. Both exist because a plausible default hid a total
failure.

Otherwise: schema is one file, migrations are generated and reviewable as SQL, and rows are
typed end to end. Reversal is expensive — the ORM is not behind an interface, and every read
in `actions.ts` imports it directly. That is the coupling this ADR ratifies rather than
laments.

## Validation and review

Validated by the code as it stands: the app builds, queries, and migrates through Drizzle
today, and there is no second data path.

Reconsider only on a concrete trigger, not on taste:
- Drizzle's PostGIS story changes such that `geographyPoint` can be deleted (an improvement,
  not a reason to switch).
- `customType` boundaries produce a second silent mis-parse — evidence the escape hatch costs
  more than it buys.
- The serverless driver story forces a change of client (`src/db/index.ts` uses `pg.Pool`
  with `rejectUnauthorized: false`; that is a driver decision, not an ORM one).

Until then: **this decision is closed.** `WETINDEY_BIBLE.md:4397` is the bug — the code is
the record. Do not re-decide the ORM.
