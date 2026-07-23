# WetinDey migration rulebook

This is the operational rulebook for preparing, applying, verifying, and promoting a
WetinDey database migration. [ADR-014](../adr/014-pillar-baselines-and-release-migrations.md)
is the authority. This rulebook grants no database access and never substitutes for an
exact rollout authorization.

Read this with:

- [MIGRATIONS.md](MIGRATIONS.md) for contributor workflow.
- [NEON.md](NEON.md) for Neon targeting, restoration, and evidence.
- [SCHEMA.md](SCHEMA.md) for desired-state pillar ownership.
- [DATABASE-BOOTSTRAP.md](../architecture/DATABASE-BOOTSTRAP.md) for blank reconstruction.

## Non-negotiable rules

1. Applied migration bytes are immutable.
2. An unapplied candidate may be corrected in place; regenerate its hashes and manifest.
3. Existing databases receive numbered deltas, never a baseline.
4. Preview must pass before Production is touched.
5. A migration credential is a physical capability, not application configuration.
6. Use a direct, non-pooled, explicitly selected migration-owner connection.
7. Never print, paste into logs, commit, or persist a credential outside an approved
   secret store or a temporary `0600` file.
8. Git state, a manifest, and a green build are not proof of shared database state.
9. Schema installation and product activation are separate operations.
10. A failed or uncertain apply is a stop condition, not permission to retry blindly.

## The golden path

### 1. Claim and freeze the release boundary

Claim every schema declaration, desired-state pillar, numbered SQL migration, snapshot,
journal, manifest, contract, evidence, and documentation path before editing.

Record:

- exact parent migration;
- exact candidate migration;
- expected SQL hashes and journal timestamps;
- snapshot `id` and `prevId`;
- generator versions;
- lock, backfill, compatibility, and rollback analysis;
- Preview and Production target identities;
- activation controls that must remain off during DDL.

Do not generate a compensating migration for a defect in an unapplied candidate. Correct
that candidate and all of its content-addressed evidence as one unit.

### 2. Prove the candidate locally

Run the release-specific contracts. Prefer both:

- a fresh reconstruction through the candidate; and
- an exact-parent upgrade through the candidate.

Static contracts are useful but do not prove PostgreSQL execution. If disposable
PostgreSQL is unavailable, the first authorized Preview apply becomes the real execution
boundary and must retain transactional rollback plus independent refutation.

### 3. Recover the physical key privately

Obtain the exact migration-owner credential from the authorized provider or secret store.
Do not infer it from a similarly named environment variable.

Before connection, parse the credential without printing it and assert:

- exact hostname;
- exact database;
- exact migration role;
- direct endpoint, not a pooler;
- required TLS mode.

Keep temporary credentials under `/private/tmp` with mode `0600`, then remove them after
the rollout evidence is complete.

### 4. Run the server-side exact-target guard

Begin read-only. Assert:

- Neon project ID;
- Neon branch ID;
- Neon endpoint ID;
- `current_database()`;
- `current_user` and `session_user`;
- PostgreSQL version;
- expected environment and parent release.

Read the complete `drizzle.__drizzle_migrations` ledger. Match each row to the local
journal by ordered timestamp and SQL SHA-256.

The ledger `id` is a surrogate sequence value, not the release number. Rolled-back
inserts can consume sequence values, so gaps are valid. IDs must remain increasing; the
authoritative lineage comparison is ordered timestamp plus SQL hash.

Any target, role, parent, timestamp, or hash mismatch is `NO-GO`.

### 5. Apply Preview once

Apply only the exact pending releases. Keep every product, admission, moderation, media,
presence, and deletion control fail closed during DDL.

Use the repository migration runner with the exact environment variable consumed by
`drizzle.config.ts`. Do not assume a similarly named variable is wired.

Do not expose the connection in shell tracing, process output, or command history.

### 6. Handle failure before retry

On any error, timeout, disconnect, or non-zero exit:

1. Stop.
2. Read the ledger and affected objects without mutation.
3. Classify the target as unchanged, fully applied, or partially changed.
4. Capture the nested PostgreSQL error code and message.
5. Fix an unapplied candidate in place, or use a new reviewed forward repair if any shared
   target already applied it.
6. Re-run focused contracts and independent review.
7. Retry only after exact preflight proves the expected parent again.

Never edit the ledger to conceal a failure. Never assume a transaction rolled back:
prove it.

### 7. Prove Preview postconditions

Verify:

- complete ordered ledger hashes and timestamps;
- expected table, type, function, index, trigger, and constraint shapes;
- object owners;
- RLS enablement and `FORCE ROW LEVEL SECURITY`;
- policy roles, commands, `USING`, and `WITH CHECK`;
- grants and revocations;
- release-specific data invariants;
- zero residual temporary privilege;
- empty/default-off state where required;
- compatible application behavior;
- and a second independent default-to-refuted verdict.

Do not promote while any postcondition is inferred rather than observed.

### 8. Activate Preview separately

Migration DDL does not enable a feature.

Use the narrow control plane owned by that feature:

- database controls change through their approved least-privilege RPC and dedicated
  operator login;
- server flags change only in the Preview environment;
- public client flags change only after the server boundary is enabled and proved;
- allowlists, rate budgets, safety responders, retention, and kill switches remain
  independently enforced.

Never use the migration-owner credential for routine feature control. Never replace a
scoped control RPC with a direct table update.

Exercise both enable and rollback-to-off on Preview. Confirm the information/read path
continues to work when the feature is disabled.

### 9. Promote to Production

Recover and validate the Production credential independently. Do not reuse or derive the
Preview target.

Production preflight must prove its own exact parent lineage. If Production has additional
pending releases, stop and reconcile them explicitly; do not silently apply more than the
authorized set.

Apply once, repeat every postcondition, obtain independent refutation, then activate only
the separately approved Production controls.

### 10. Record and clean up

Archive redacted evidence containing:

- target project, branch, endpoint, database, and role names;
- preflight and postflight ledger hashes and timestamps;
- candidate commit and artifact hashes;
- schema, RLS, policy, ACL, and release-specific proof;
- failure and recovery evidence;
- activation and rollback evidence;
- independent verdict;
- and final control state.

Do not archive credentials, connection strings, tokens, user data, or precise private
location data.

Remove temporary credential files, release the lane, and update manifests and operational
status without rewriting applied SQL.

## PostgreSQL ownership choreography

Dedicated owner roles are intentional. They prevent the application and operator logins
from owning protected objects.

For newly generated objects:

1. Create or normalize the dedicated `NOLOGIN NOBYPASSRLS` owner.
2. Give the migration session a transaction-scoped `SET` path to that owner.
3. Give the new owner temporary `CREATE` on the containing schema.
4. Transfer object ownership while the migration session still owns the objects.
5. `SET LOCAL ROLE` to the new owner.
6. Install RLS, policies, grants, and revocations as the actual owner.
7. `RESET ROLE`.
8. Revoke schema `CREATE` and only the temporary membership grant.
9. Fail the transaction if any `SET`, inheritable membership, or owner `CREATE` remains.

Do not `SET ROLE` before ownership transfer. The future owner cannot alter a table it does
not yet own.

## Cross-owner foreign keys

Creating a foreign key requires `REFERENCES` on the referenced table. A migration owner
may correctly lack that privilege when the referenced table belongs to another isolated
domain owner.

The safe bridge is:

1. Obtain a transaction-scoped `SET` path to the referenced table's owner.
2. As that owner, grant the migration session `REFERENCES` on only the exact table.
3. Reset to the migration session.
4. Create the exact foreign key.
5. As the referenced-table owner, revoke the temporary `REFERENCES`.
6. Remove only the temporary `SET` grant.
7. Fail the transaction if either capability remains.

Never grant broad DML, inherit the domain owner, transfer the referenced table, drop the
foreign key, or leave a persistent migration backdoor.

## Release checklist

- [ ] Exact lane and paths claimed.
- [ ] Applied/unapplied status proven from shared targets.
- [ ] Parent lineage, hashes, timestamps, and snapshots exact.
- [ ] Focused contracts pass.
- [ ] Disposable reconstruction/upgrade passes, or authorized Preview is the declared
      execution boundary.
- [ ] Credential is direct, private, and exact-target guarded.
- [ ] Preview preflight passes.
- [ ] Preview apply outcome is certain.
- [ ] Preview ledger, schema, ownership, RLS, policies, ACLs, and data invariants pass.
- [ ] Temporary privileges are absent.
- [ ] Independent Preview refutation passes.
- [ ] Preview activation and rollback are proved separately.
- [ ] Production preflight proves its own exact parent.
- [ ] Production apply and postflight pass.
- [ ] Production activation is separately authorized and proved.
- [ ] Redacted evidence is archived.
- [ ] Temporary credentials are removed.

## Incident lessons recorded 22 July 2026

Preview safely caught three mistakes before Production:

- `0018` assumed the future deletion owner could configure RLS before it owned the table.
- `0019` attempted a foreign key without temporary `REFERENCES` on the separately owned
  moderation table.
- failed transactional attempts consumed migration-ledger sequence IDs, creating harmless
  gaps even though schema and ledger rows rolled back.

The response was to stop, prove rollback read-only, correct the unapplied candidates and
their contracts/manifests, then reapply from the exact unchanged parent. That is the
required pattern for every future migration.
