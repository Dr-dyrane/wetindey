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

**Status timestamp: 2026-07-18. Fail closed.** Historical local migration identity and
current target state are separate claims. This evidence is not rollout authorization.

### Historical identity proof

External Preview evidence supplied a 12-row Drizzle ledger. Its final reported row labels
were shifted. Hash-and-timestamp mapping, rather than those labels, recognizes local
`0008`, `0009`, and `0010`, with local `0010` at the ledger head.

| Local migration | Local hash | Drizzle `when` | Preview ledger result |
|---|---|---:|---|
| `0009` | `34dd394d6d4f1aad24a73edee5eb88a93441449a1ff86985b60d3ba04f927b4c` | `1784329382289` | Recognized |
| `0010` | `9aa8cc511374010f1deb68ec330573a9c4940c2aff1188218d5f3e841fccd7fe` | `1784336532977` | Recognized ledger head |
| `0011` | `1ad4a33a06dfdc58affcfa92dc7085b5843478e09761ee26a24c7cd6b3c0151b` | `1784356204352` | Identity absent |

These matches prove historical identity only, not exact current schema equivalence.

### Current target status

- **Preview report, not proof:** Antigravity reported `observations.provenance` and the
  ingestion tables, but supplied no raw catalog output. Treat their presence as
  uncorroborated until direct target evidence is captured.
- **Preview:** `user_profiles.latitude` and `user_profiles.longitude` exist, effects
  consistent with `0011`, but the local `0011` ledger identity is absent and one of the 12
  ledger rows remains extra and unmapped. Preview therefore has schema/ledger drift.
- **Preview claim boundary:** do not claim that the current `0011` SQL executed or that
  Preview is exactly post-`0011` equivalent.
- **Production:** **UNKNOWN** because it was not directly queried. Deployment commit
  `b89ebba` and old documentation are not database execution evidence.

### Required handling

- Freeze `0011`; do not rewrite it in place or fabricate a ledger receipt.
- Quarantine Preview and replace it from recognized lineage, or perform an exceptional
  repair only after ADR-014 equivalence, restore, and two-owner gates pass.
- No push, deploy, shared migration, ledger repair, or database mutation is authorized by
  this evidence.

No migration may be described as live on a target without target-specific execution
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
