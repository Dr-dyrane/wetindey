# Archived contribution migration-landing contracts

These three contracts are preserved here as a historical record. They are no
longer part of the live test suite: they were renamed from `*.test.ts` to
`*.archived.ts` and moved out of `scripts/contributions/` so that neither the
`scripts/quality/run-stage.mjs` static stage (an explicit allow-list that never
listed them) nor any `scripts/**/*.test.ts` glob discovers them. The moves were
done with `git mv`, so full history is preserved. Do not re-add them to any
runner and do not delete them.

## Why they were retired (founder-approved)

Each contract is a migration-landing proof: it self-hashes its own test file
inside that migration's APPLIED, immutable release manifest, and it also pins
the byte content of shared contribution pillars
(`src/db/pillars/40-contribution-integrity.sql`,
`60-contribution-moderation.sql`, `80-contribution-services.sql`,
`90-contribution-security.sql`). Later applied migrations legitimately rewrote
those shared pillars in place, so the frozen pillar assertions can no longer
match. They cannot be fixed without either:

- re-pinning an immutable, already-applied release manifest (forbidden by
  ADR-014), or
- reverting applied database state.

Both are off the table. The migrations themselves are applied on the shared
database and immutable, so these contracts must rot. Archiving is the sanctioned
resolution.

## What each proved

### `contribution-migration-contract.archived.ts` (migration 0013)

Full executable contract for `0013_contribution_integrity`. Using an in-memory
PGlite database it installed the schema from blank and via the 0000-0012 upgrade
paths, rolled it back, and verified the contribution-integrity result. It froze
the byte hashes of migrations 0000-0012, the parent snapshot and parent commit
lineage, and self-hashed its own file path against
`src/db/migrations/meta/0013_release_manifest.json` (`source_sha256`). Applied
and immutable. It rots because that manifest self-pins this file and the frozen
contribution pillars were superseded by 0015/0016/0017.

### `contribution-moderation-migration-contract.archived.ts` (migration 0015)

Contract for `0015_contribution_moderation_operations`. It proved 0015 is a
forward-only service delta with deterministic detached metadata, that the
review-detail definer contract adds no direct-data expansion, and that 0015
installs from blank and from the 0000-0014 upgrade paths, rolls back, and stays
executable only by an assigned moderator. Self-hashed inside the immutable
`0015_release_manifest.json`; it pins shared contribution pillars later
superseded by 0016/0017.

### `contribution-moderation-acl-repair-contract.archived.ts` (migration 0016)

Contract for `0016_contribution_review_acl_repair`. It proved 0016 preserves the
immutable 0015 release and advances detached metadata, converges only the
review-detail ACL while the owner role is active, and remains a transactional,
idempotent ACL repair rather than a service rewrite. Self-hashed inside the
immutable `0016_release_manifest.json`; it pins shared contribution pillars later
superseded by 0017.

## What still guarantees applied-migration immutability

Retiring these contracts does not weaken the immutability guarantee. It is now
carried by:

- ADR-014 (applied migrations and their manifests are immutable), plus
- the APPLIED release manifests themselves
  (`src/db/migrations/meta/0013_release_manifest.json`,
  `0015_release_manifest.json`, `0016_release_manifest.json`), which record the
  frozen SQL, snapshot, and lineage hashes, plus
- the forward-compat contracts that STAY in the live static gate and freeze the
  same lineage going forward:
  - `scripts/contributions/contribution-pending-queue-shape-repair-contract.test.ts`
    (0017), which freezes the applied 0000-0016 lineage and the immutable
    `0016_release_manifest.json`,
  - `scripts/presence/presence-0014-migration-contract.test.ts` (0014),
  - `scripts/contributions/contribution-evidence-media-p1-contract.test.ts`,
    freezing 0000-0018,
  - `scripts/deletion/deletion-saga-p1-contract.test.ts`, freezing 0000-0017.
