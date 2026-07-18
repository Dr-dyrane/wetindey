# ADR-014: Pillar baselines and release migrations

**Status:** Accepted
**Date:** 2026-07-17
**Decision owner:** WetinDey owner
**Scope:** Desired database state, Drizzle release lineage, Neon rollout, restoration, and exceptional ledger reconciliation

## Context

WetinDey currently uses Drizzle schema declarations, generated SQL migrations, snapshots,
the migration journal, and Neon PostgreSQL. Numbered files have been asked to serve two
different purposes: describe the schema the product wants and prove the sequence a
particular database executed. Treating those as the same thing causes either unbounded
pre-release repair migrations or dangerous deletion and rewriting of applied history.

The safe lesson is to separate canonical desired state from rollout deltas without erasing
execution evidence.

Current evidence is deliberately narrow:

- `0000` through `0008` are preserved applied lineage whose repository SQL fingerprints
  were reconciled with the configured Drizzle ledger.
- `0009` was independently validated on disposable databases, including complete
  `0000`-`0009` reconstruction, provenance invariants, seed compatibility, second-run
  idempotence, and cleanup. It has not been applied to a shared or production database.
- final ingestion migration `0010` is unapplied. Its presence does not make ingestion
  tables or behavior live.

## Decision

WetinDey adopts canonical desired-state pillars plus short-lived release migrations.

The pillar sources describe the schema WetinDey intends to exist. A numbered release
migration describes one forward transition from an exact parent fingerprint to an exact
result fingerprint. The Drizzle ledger records what a database actually executed; it is
not made truthful by editing repository files.

This ADR is the decision authority. Contributor guides, runbooks, architecture documents,
and lane records must link here rather than restating a competing policy.

## Invariants

1. Every schema object belongs to one desired-state pillar.
2. Every release delta has one exact parent fingerprint and one expected result
   fingerprint.
3. A draft or unapplied release delta may be regenerated until its first application to
   a supported shared environment.
4. Before that first shared application, all corrections remain in the same numbered
   release. A defect in unapplied `0010` does not create `0011` or `0012`.
5. A migration applied to any shared environment is immutable. SQL, journal metadata,
   snapshots, checksums, and execution evidence are preserved exactly.
6. A defect discovered after shared application is corrected by a new forward migration,
   not by rewriting history.
7. A fresh database executes the latest proven baseline plus releases after its cutoff.
8. An existing database executes pending release deltas only. It never executes a
   baseline.
9. A baseline cut does not delete release evidence or rewrite an existing Drizzle ledger.
10. Ledger reconciliation is exceptional metadata recovery after equivalence proof. It is
    never routine deployment, rollback, or history cleanup.

## Canonical desired-state pillars

| Order | Pillar | Owns |
|---|---|---|
| `00` | Foundation and extensions | PostgreSQL extensions, PostGIS prerequisites, shared schemas and foundational types |
| `10` | Identity and profile | WetinDey-owned identity references and profiles; never provider-owned Neon Auth internals |
| `20` | Geography and places | Areas, places, coordinates, coverage, geographic constraints and indexes |
| `30` | Catalog | Categories, items, variants, units, aliases and catalog constraints |
| `40` | Observations, provenance and offers | Immutable observations, provenance, evidence-derived current offers and their constraints |
| `50` | Ingestion and evidence | Source registry, capture, extraction, deduplication, review staging and evidence boundaries |
| `60` | Trust and moderation | Verification assertions, moderation state and future earned-trust storage approved by its own ADR |
| `70` | Reviews and community | Reviews, community relationships and events without conflating subjective review with current-state evidence |
| `80` | Services and RPCs | Database functions, views and service-facing database contracts |
| `90` | RLS and grants | Row-level security, policies, roles, grants and revocations after protected objects exist |

Drizzle declarations remain the desired source for objects Drizzle models. Reviewed pillar
SQL owns extensions, functions, policies, grants, triggers, or other objects Drizzle does
not fully express. Generated baseline SQL and release migrations are artifacts; they are
not alternate hand-edited desired-state sources.

Pillar order is a topological contract. A lane may own one pillar while its release
manifest declares dependencies on earlier pillars. Pillars do not authorize premature
Trust Graph, reviews, RLS, ingestion promotion, or category expansion.

## Release migration lifecycle

1. Claim the exact desired-state, migration, snapshot, journal, manifest, and documentation
   paths. One schema lane owns the release.
2. Establish the parent as the latest published baseline plus every release after its
   cutoff. Compute and record its schema/RPC/RLS fingerprint.
3. Change the owned desired-state pillar.
4. Generate one numbered delta from that exact parent to the intended state.
5. While the delta is unapplied, fold review corrections into the same number and
   regenerate its SQL, snapshot, journal metadata, checksums, and manifest together.
6. Validate both an existing-parent upgrade and a blank reconstruction on isolated
   disposable PostgreSQL with required extensions.
7. Obtain independent refutation. Generation, compilation, or a clean build alone is not
   execution proof.
8. Freeze the release candidate and archive its exact bytes before rollout.
9. Authorize each Neon target separately, apply the delta once to that target, and capture
   post-apply ledger and fingerprint evidence.
10. After every supported environment is proven equivalent, publish a new immutable
    baseline and advance the latest-baseline marker.

The first application to a supported shared environment is the immutability boundary.
Disposable executions are validation evidence and may be discarded after proven cleanup;
they do not force a defective candidate to remain unchanged.

## Baseline lifecycle

A baseline is an immutable executable realization of all desired-state pillars at one
release cutoff. Its manifest records:

- baseline ID and parent baseline ID;
- incorporated release cutoff;
- checksums for every pillar and executable artifact;
- normalized schema/RPC/RLS/grant fingerprint;
- source commit and immutable release reference;
- PostgreSQL, Drizzle ORM, Drizzle Kit, and extension versions;
- journal and snapshot checksums where applicable;
- generation, fresh-install, existing-upgrade, and independent-refutation evidence;
- and compatible later release range.

The repository latest-baseline marker points to a manifest by ID and checksum. Advancing
that marker is allowed only after all supported environments have the expected equivalent
schema, RPC, RLS, and grant fingerprint and every recognized lineage is archived.

Folding a release into a baseline changes the preferred fresh-install path. The release
SQL, old baseline, manifests, checksums, and target execution evidence remain durable.
Lagging existing databases must still be able to retrieve every missing delta.

## Fresh and existing database paths

| Target | Permitted path |
|---|---|
| Empty fresh database | Prove emptiness and identity; execute the latest baseline; record its real execution; apply releases after its cutoff |
| Existing recognized database | Verify complete ledger and current fingerprint; apply only missing archived deltas |
| Existing database with unknown or divergent lineage | Stop. Restore a recognized state or complete exceptional reconciliation before rollout |

An existing database is never made current by inserting a baseline marker. A fresh
baseline ledger entry is valid because that database actually executed the baseline.

## Neon and Drizzle semantics

Neon is the PostgreSQL provider. Drizzle owns generated migration ordering and records
executions in `drizzle.__drizzle_migrations`. This policy does not assume a Supabase
`migration repair` command or Supabase migration semantics.

Editing local SQL, snapshots, or `_journal.json` does not change a Neon schema and does not
repair a remote Drizzle ledger. Drizzle's ordinary migrator must not be assumed to
revalidate every historical hash, so WetinDey requires an explicit complete-lineage
preflight against the durable archive.

Rollout uses an explicitly supplied, independently confirmed target connection suitable
for DDL. Ambient shell variables must not silently override the reviewed target. No
credential is stored in a manifest or log.

## Exact-target rollout gates

Before DDL, the owner must have:

- exact Neon project, branch, database, and role identity;
- a recognized complete ledger with exact migration checksums;
- a pre-release schema/RPC/RLS/grant fingerprint matching the declared parent;
- an exact pending-release list and reviewed immutable release artifact;
- extension and privilege proof;
- release-specific backfill, lock, duration, and compatibility analysis;
- a provider-appropriate backup, branch, or restore point plus a proven restore procedure;
- primary authorization and independent evidence ownership;
- and confirmation that no destructive seed is part of shared rollout.

After DDL, the gate requires the new ledger row and checksum, expected result fingerprint,
release-specific data invariants, application compatibility evidence, and archived
primary plus independent records.

## Failure and restore

If preflight identity, ledger, fingerprint, privilege, or restore evidence differs, do not
start.

If execution fails or its transactional outcome is ambiguous:

1. Stop deployment and do not rerun blindly.
2. Capture actual ledger and schema state read-only.
3. Classify the target as unchanged, fully applied, or partially changed.
4. Restore the verified pre-release Neon state or issue a separately reviewed forward
   repair.
5. Prove restored target identity, ledger checksums, and schema/RPC/RLS/grant fingerprint
   before traffic or migration resumes.

Application rollback is not database rollback. Direct ledger edits must not conceal
partial DDL.

## Release manifest and archive

Every release archive contains the exact SQL, journal and snapshots, desired-state pillar
checksums, parent and result fingerprints, source commit, toolchain versions, validation
results, target authorization, redacted pre/post ledger evidence, backup/restore
references, rollout outcome, and independent verdict.

Git history is required but not sufficient. The release must also have a protected,
content-addressed artifact outside ephemeral working directories. `/tmp` evidence is not
a durable archive.

## Exceptional ledger reconciliation

Remote ledger reconciliation is allowed only when independent evidence proves:

- the actual database already equals one archived result fingerprint;
- the corresponding SQL execution or exact provider restore is established;
- the mismatch is limited to ledger checksum or metadata;
- no DDL or backfill is being skipped;
- a tested backup and restore path exists;
- and two owners approve the exact ledger mutation.

Repository edits alone never prove equivalence. If equivalence is uncertain, the result is
NO-GO followed by restore or a forward repair migration.

## Consequences

This policy prevents infinite pre-release migration growth while preserving every shared
execution fact. It adds manifest, fingerprint, archive, and baseline-publication work.
Drizzle's default commands remain useful for generation and execution, but they are not by
themselves a complete release controller.

## Non-goals

This ADR does not apply `0009` or `0010`, authorize ingestion promotion, change Drizzle,
modify any schema, introduce down migrations, seed a shared database, or authorize a
production deployment.
