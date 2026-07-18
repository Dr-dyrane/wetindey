# Neon rollout and restoration

This runbook applies [ADR-014](../adr/014-pillar-baselines-and-release-migrations.md) to
Neon PostgreSQL. It grants no standing database authorization.

## Exact-target preflight

Every rollout authorization names one Neon project, branch, database, role, release
artifact, and expected parent fingerprint. Before DDL:

1. Supply the reviewed target explicitly; do not rely on an ambient `DATABASE_URL`.
2. Assert project, branch, `current_database()`, role, and expected environment.
3. Read the complete `drizzle.__drizzle_migrations` ledger.
4. Match its ordering, timestamps, and SQL hashes to one archived recognized lineage.
5. Match the current schema/RPC/RLS/grant fingerprint to that lineage's expected state.
6. Confirm the exact pending releases. Existing databases receive deltas only.
7. Confirm extensions, privileges, lock/backfill analysis, and application compatibility.
8. Create a provider-appropriate backup, branch, or restore point and prove who can restore
   it.
9. Assign a separate independent evidence owner.

Any mismatch is NO-GO. Do not apply a baseline to a non-empty database and do not insert a
baseline marker into an existing ledger.

Use a connection explicitly approved for migration DDL. The pooled application connection
must not be assumed suitable. Never print, archive, or replace credentials blindly.

## Fingerprint

The normalized pre/post fingerprint covers:

- PostgreSQL and required extension versions;
- schemas, enums and enum ordering;
- tables, columns, types, nullability, defaults, generated/identity expressions;
- primary, foreign, unique, check, and exclusion constraints;
- indexes, views, materialized views, sequences, and triggers;
- function and RPC signatures, return types, volatility, security mode, `search_path`, and
  normalized body checksum;
- RLS enablement, policy command, roles, permissiveness, `USING`, and `WITH CHECK`;
- grants and revocations;
- and the Drizzle ledger independently from schema objects.

Release-specific data proofs, such as provenance backfills and NOT NULL invariants, are
recorded beside the structural fingerprint rather than hidden inside it.

## Apply and verify

A release is applied once per exact target. After execution:

1. Capture the new ledger row, timestamp, and SQL hash.
2. Recompute the complete fingerprint and compare it to the release manifest.
3. Check all release-specific backfill and constraint invariants.
4. Confirm compatible application behavior using the release acceptance evidence.
5. Archive redacted primary evidence.
6. Require an independent comparison before marking the environment equivalent.

Do not seed a shared target. Random disposable seed counts are not rollout evidence.

## Failure

On an error, timeout, disconnect, or uncertain transaction outcome:

1. Stop. Do not rerun the migration or deploy dependent application code.
2. Capture actual ledger and schema state read-only.
3. Determine whether the target is unchanged, fully applied, or partially changed.
4. Choose either provider restore or a new reviewed forward repair.
5. Do not edit the ledger to make a partial schema appear complete.

## Restore

Restore into the provider-supported safe target, then prove:

- exact project, branch, database, and role;
- pre-release ledger rows and hashes;
- pre-release schema/RPC/RLS/grant fingerprint;
- release-specific data invariants;
- and authorized traffic cutover.

An application rollback without this database proof is not a database restore.

## Exceptional ledger reconciliation

Neon does not add Supabase migration-repair semantics to Drizzle. Editing local files never
repairs the remote ledger. A direct ledger mutation is allowed only under ADR-014's
two-owner exceptional-recovery gate after checksum and schema equivalence are independently
proven.
