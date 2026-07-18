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

## Current evidence

| Lineage | Proven state |
|---|---|
| `0000`-`0008` | Preserved applied lineage |
| `0009` | Independently validated; no shared or production rollout |
| `0010` | Final ingestion release candidate; unapplied |

Neither `0009` nor `0010` may be described as live without target-specific execution
evidence. No documentation statement, Git commit, generated snapshot, or ledger edit
substitutes for execution.

## Authority order

1. Accepted ADRs.
2. The architecture of record.
3. These operational guides.
4. Release manifests and archived target evidence for a specific rollout.

Code and actual database evidence still outrank aspirational prose when describing what
exists. A contradiction is a stop condition, not permission to choose the convenient
version.
