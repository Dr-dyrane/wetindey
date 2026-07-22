# WetinDey database guide

[ADR-014](../adr/014-pillar-baselines-and-release-migrations.md) is the decision authority
for desired-state pillars, release migrations, baselines, Neon rollout, restoration, and
ledger reconciliation.

Use these audience-specific guides:

- [SCHEMA.md](SCHEMA.md): canonical desired-state pillars and dependencies.
- [MIGRATIONS.md](MIGRATIONS.md): contributor workflow and release-delta lifecycle.
- [NEON.md](NEON.md): exact-target rollout, verification, failure, and restore.
- [DATABASE-BOOTSTRAP.md](../architecture/DATABASE-BOOTSTRAP.md): blank reconstruction and
  disposable-validation safety.

## Rollout evidence status

**Status timestamp: 2026-07-21. Shared-target migration PASS; product controls remain
fail closed.** Independent operational evidence proves Production `main`
(`br-flat-band-aui9waf5`) and Preview `preview/wetindey-presence`
(`br-steep-dust-auhcmjk8`) in project `wild-rain-23091788`, database `neondb`, role
`neondb_owner`, have the exact immutable `0000`-`0014` ledger and migration hashes.

Both targets have result fingerprint
`a0126839bc0671fff9b9ad3bc4954e3dfb2286fccdbb352651a199f74b23ab03`.
Migration `0014` has SHA-256
`ed532eab5f7941245cfebb66463a2194ab9df235b30f9fd678e1c0e1065008bf`.
Direct evidence also proves default-off controls, empty allowlist and active Presence state,
and temporary owner-privilege cleanup. Preview physical inheritance is supported by parent
LSN `0/7368FF50`, `xmin` `228412`, and relfilenode `368692`.

The applied lineage is immutable and duplicate execution is forbidden. This migration PASS
does not enable Presence runtime, populate an allowlist, authorize pilot traffic, satisfy
privacy/safety/legal review, deploy application code, or authorize public rollout. No
documentation statement, Git commit, generated snapshot, or ledger edit substitutes for
target-specific operational evidence.

## Authority order

1. Accepted ADRs.
2. The architecture of record.
3. These operational guides.
4. Release manifests and archived target evidence for a specific rollout.

Code and actual database evidence still outrank aspirational prose when describing what
exists. A contradiction is a stop condition, not permission to choose the convenient
version.
