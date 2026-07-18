# WetinDey database bootstrap and lineage runbook

**Date:** 2026-07-17  
**Status:** Operational requirement under [ADR-014](../adr/014-pillar-baselines-and-release-migrations.md)  
**Scope:** Blank-database reconstruction, disposable validation, and lineage evidence

## Current truth

- `0000` through `0008` are the preserved applied lineage.
- `0009` has independent compiler, blank-lineage, seed, idempotence, provenance, and
  cleanup evidence. No shared or production database rollout occurred.
- final ingestion migration `0010` is unapplied. It does not make ingestion live.

Do not describe `0009` or `0010` as live until exact-target rollout evidence says so.
Until the first pillar baseline is deliberately cut, the complete numbered lineage remains
the fresh-install reconstruction path. Cutting a baseline must not rewrite these artifacts
or the ledger of an existing database.

## Foundation requirement

Migration `0000` creates PostGIS `geography` columns. A blank database must have PostGIS
before Drizzle applies that lineage. Extension provisioning belongs to the
foundation/extensions desired-state pillar; it is not a reason to rewrite `0000`, delete
ledger rows, or invent a compensating release.

## Safety boundary

`src/db/seed.ts` is destructive. It provisions PostGIS, runs migrations, truncates
application tables, and inserts demonstration data. It has no built-in
disposable-database guard. Never run it against production, a shared database, or the
normal configured database.

Before authorized disposable validation:

1. Generate a unique disposable database name.
2. Build its URL by replacing only the database-name path in the authorized source URL.
3. Neutralize ambient environment precedence and assert `current_database()`, Neon
   project/branch identity, and expected role before DDL.
4. Verify extension privileges and required PostGIS version.
5. Stop when target identity, privilege, parent ledger, or restore ownership is uncertain.

`CREATEDB` permission does not prove PostGIS can be installed. A schema inside a shared
database is not an acceptable disposable boundary because the seed truncates tables.

## Reconstruction paths

### Fresh database

Today, an authorized disposable fresh database replays the preserved lineage because no
new pillar baseline has been published. After an ADR-014 baseline cut, a fresh database
executes the exact baseline identified by the repository `LATEST` manifest, records that
real execution, then applies only later release deltas.

### Existing database

An existing database never executes a baseline. A read-only preflight must match its
complete Drizzle ledger to an archived recognized lineage and match its schema, RPC, RLS,
and grant fingerprint to the expected state at its last release. It then receives only
pending deltas.

## Disposable proof

An authorized reconstruction must prove:

- expected SQL checksums, journal ordering, breakpoints, and snapshot chain;
- one ledger row per executed migration in order;
- schema, extension, enum, constraint, index, function, policy, and grant fingerprint;
- release-specific backfill and data invariants;
- second-run ledger and schema idempotence;
- destructive seed behavior only when separately authorized;
- and exact cleanup by both primary executor and independent refuter.

Random seed counts are non-semantic. A successful seed proves compatibility with the
recreated schema, not deterministic data identity or permission to seed a shared target.

## Cleanup

Disconnect every client, drop every generated disposable database, and query the exact
generated prefix to prove none remain. Preserve redacted manifests before removing
temporary working directories.

## Historical evidence

D1 proved exact configured-ledger correspondence and disposable reconstruction for applied
`0000` through `0008`. D2 independently proved the complete candidate `0000` through
`0009` path, provenance invariants, seed compatibility, second-run idempotence, the
separate `0008` sentinel upgrade, and exact cleanup. These are reproducibility proofs, not
shared rollout records.

The D2 session manifests were written under `/tmp`; they are evidence references, not the
durable archive required for a release. See [Database migrations](../database/MIGRATIONS.md)
and [Neon rollout](../database/NEON.md).
