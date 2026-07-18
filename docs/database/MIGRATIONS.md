# Migration contributor workflow

[ADR-014](../adr/014-pillar-baselines-and-release-migrations.md) governs this workflow.
This guide explains how to contribute; it does not authorize database access or rollout.

## Before changing desired state

1. Read `AGENTS.md`, `LANES.md`, ADR-014, and [SCHEMA.md](SCHEMA.md).
2. Claim every intended Drizzle declaration, explicit pillar SQL, migration, snapshot,
   journal, manifest, and documentation path.
3. Establish whether the latest numbered release has been applied to any supported shared
   environment. Do not infer this from Git or local files.
4. Identify the latest baseline and every later release. Their combined result fingerprint
   is the parent for generation.

Stop when ownership, parent lineage, target status, or evidence is ambiguous.

## Desired state first

Change the canonical owned pillar source. For Drizzle-modeled objects that is the relevant
schema declaration. For extensions, RPCs, triggers, RLS, policies, or grants it is the
reviewed explicit pillar source established by the baseline tooling.

Do not hand-edit a generated baseline as a substitute for changing desired state.

## One release delta

Generate one numbered migration for the schema lane from the exact parent state.
Temporary local generations may be discarded. Before first shared application, review
corrections are folded into that same numbered release and its SQL, snapshot, journal
metadata, checksums, and manifest are regenerated as one unit.

The current concrete rule is:

- defects found before unapplied `0010` first rolls out must be corrected in `0010`;
- do not create `0011` or `0012` to compensate for an unapplied `0010`;
- after any shared environment applies `0010`, its bytes are immutable and the next
  correction is a forward release.

A candidate Git commit is not evidence of shared execution. Preserve superseded candidate
commits as review history, but publish one exact artifact for rollout.

## Required release review

Review must account for:

- SQL semantics and operation ordering;
- destructive or locking operations;
- nullability, defaults, enums, foreign keys and indexes;
- data backfills and fail-closed behavior;
- snapshot ID and `prevId` chain;
- journal index, timestamp, tag and breakpoint;
- parent and result schema/RPC/RLS/grant fingerprints;
- backward/forward application compatibility;
- exact toolchain and extension versions;
- and rollback by restore or forward repair.

## Validation

Under separate authorization, prove:

- exact-parent existing-database upgrade on a disposable target;
- fresh reconstruction through the current candidate head;
- a second migration pass leaves ledger and schema unchanged;
- any separately authorized destructive seed runs only on a confirmed disposable database;
- release-specific data invariants;
- primary cleanup;
- and independent reproduction and cleanup.

Compiler success and generated SQL are static evidence, not migration execution evidence.

## Manifest and archive

Before rollout, freeze a content-addressed release manifest containing:

- release ID and parent baseline/release;
- SQL, snapshot, journal, and desired-state checksums;
- parent and result fingerprints;
- source commit and tool versions;
- disposable validation and independent verdict;
- lock/backfill/compatibility analysis;
- target authorization template;
- backup and restore requirements;
- and redacted execution-evidence slots.

Store the exact release artifact under a protected immutable Git reference and durable
content-addressed archive. Ephemeral `/tmp` bundles are not the release archive.

## After rollout

Do not amend an applied migration. Record each exact target result in the archive. Only
after all supported environments are independently proven equivalent may a new baseline
be published and the latest-baseline marker advanced.

Folding removes the delta from the preferred fresh-install execution path, not from
history. Existing databases that have not applied it must still retrieve it from the
archive.

## Prohibited shortcuts

- Deleting or rewriting a shared-applied migration.
- Creating repair-number churn for a defect in an unapplied release.
- Running a baseline on an existing database.
- Treating `drizzle.__drizzle_migrations` edits as deployment.
- Marking a remote ledger repaired because repository files changed.
- Seeding a shared or production database.
- Assuming a clean build proves migration correctness.
- Applying against a target selected only by ambient shell environment.
