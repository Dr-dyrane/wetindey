# WetinDey database bootstrap and lineage runbook

**Date:** 2026-07-17  
**Status:** Operational requirement  
**Scope:** Blank-database migration and disposable seed validation

## Purpose

WetinDey migration `0000` creates PostGIS `geography` columns. A newly created database
must therefore have PostGIS before Drizzle applies the migration lineage.

This bootstrap requirement is outside the applied migration history. Do not rewrite
`0000`, delete Drizzle ledger rows, or add a compensating migration merely to provision an
extension.

## Safety boundary

`src/db/seed.ts` is destructive. It provisions PostGIS, runs migrations, and truncates
application tables before inserting demonstration data. The seed has no built-in
disposable-database guard.

Never run it against production, a shared database, or the normal configured database.

Before any migration or seed validation:

1. Create a uniquely named disposable database.
2. Construct its connection URL by replacing only the database-name path.
3. Connect and assert that `current_database()` exactly equals the generated disposable
   name.
4. Verify that the target role may create extensions.
5. Do not proceed when any identity or privilege check is uncertain.

`CREATEDB` permission alone does not prove that PostGIS can be installed.

## Blank migration

Provision PostGIS in the confirmed disposable target:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

Then run:

```bash
DATABASE_URL="$D1_DISPOSABLE_DATABASE_URL" npm run db:migrate
```

Confirm:

- migrations `0000` through `0008` appear once and in order;
- SQL fingerprints match the expected Drizzle ledger;
- journal entries and snapshots form one chain;
- tables, columns, and explicit indexes match the current TypeScript schema and final
  snapshot;
- and the only expected PostGIS-owned public table outside the application snapshot is
  `spatial_ref_sys`.

Run migration a second time and prove the ledger and schema are unchanged:

```bash
DATABASE_URL="$D1_DISPOSABLE_DATABASE_URL" npm run db:migrate
```

## Disposable seed validation

Only after the disposable database identity assertion succeeds:

```bash
DATABASE_URL="$D1_DISPOSABLE_DATABASE_URL" npm run db:seed
```

Seed counts are not a reproducibility guarantee because the current seed uses randomness.
The required proof is that the seed completes against the recreated schema without an
undocumented manual database edit.

## Cleanup

Disconnect every client, drop the disposable database, and query database names by the
generated prefix to prove that none remain.

Do not use a schema inside a shared database as a substitute. The seed's truncation
behavior makes that boundary insufficient.

## D1 evidence

The D1 lineage reconciliation on 2026-07-17 established:

- all applied SQL fingerprints from `0000` through `0008` matched repository SQL;
- a guarded blank disposable database migrated through `0008`;
- catalog, journal, snapshots, and TypeScript schema agreed at the checked table, column,
  nullability, type, and explicit-index level;
- the destructive seed completed only on the disposable target;
- a second migration pass was idempotent;
- and a clean pre-repair `HEAD` reproduced the missing `items.category` seed failure.

An independent refuter repeated the migration, seed, idempotence, and clean-`HEAD` failure
checks. Every generated disposable database was dropped and the final prefix query returned
no remaining names.

Full foreign-key and default-expression equivalence was not exhaustively compared. Treat
that as a stated residual risk, not as inferred proof.
