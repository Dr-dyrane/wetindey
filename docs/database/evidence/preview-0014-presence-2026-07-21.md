# Preview Presence `0014` execution handoff

**Status: NO-GO.** This code is an audit candidate, not target evidence or migration
authorization. The frozen manifest deliberately keeps `preview_execution=false`, approved
project/database/role identity null, parent/result fingerprints null, backup/restorability
proof null, and independent authorization null. Therefore execute mode is structurally
unreachable until direct Preview audit evidence is independently reviewed and those fields
are populated and approved in a separately claimed atomic change. Production remains
forbidden.

## Authority boundary

`src/db/migrations/meta/0014_release_manifest.json` is the sole expected-state authority.
Operator environment cannot define an expected project, database, role, branch, endpoint,
fingerprint, backup, restore owner, or verifier. It may supply only:

- `PRESENCE_0014_PREVIEW_DATABASE_URL_UNPOOLED`: the secret connection used for audit and,
  only after manifest authorization, migration;
- `PRESENCE_0014_EXECUTE_CONFIRMATION=EXECUTE_PREVIEW_0014`: an additional execute guard,
  never a substitute for manifest approval.

Ambient `DATABASE_URL` is rejected. The connection's database and role, provider-derived
Neon project/branch settings, and SHA-256 of its hostname must match the frozen approved
manifest before execution. Hostname, URL, password, process output, errors, and nested
incident details are redacted before emission.

## Audit-only invocation

```sh
unset DATABASE_URL
export PRESENCE_0014_PREVIEW_DATABASE_URL_UNPOOLED='<authorized Preview audit URL>'
node scripts/presence/presence-0014-preview-preflight.mjs \
  > preview-0014-audit.private.ndjson
```

Audit mode remains useful while manifest approvals are absent. It recomputes every parent
migration hash plus `0014` SQL, snapshot, and journal hashes; proves the journal has exactly
`0000` through `0014` with `0014` at its head; then uses a bounded `BEGIN READ ONLY`
transaction to collect provider/database/role identity, ledger, controls, active Presence
counts, role options, owner-capability cleanup, and a deterministic
schema/RPC/RLS/grant fingerprint. It emits incremental newline-delimited JSON events and
finishes `NO_GO_AUDIT_ONLY`. An audit packet is evidence input, not self-authorization.

## Manifest population gate

Execute remains impossible until a separately reviewed manifest change records all of:

- approved exact Preview project, branch name/ID, database, migration role, endpoint-host
  hash, and provider identity evidence hash;
- independently accepted parent and result fingerprints plus evidence hashes;
- approved provider backup ID, exact source project/branch/database, creation timestamp,
  separate restore target project/branch/database, named restore owner, successful restore
  test timestamp, evidence hash, `restorable=true`, and a freshness limit no greater than
  one hour. A provider-safe child restore may use the same project and database, but its
  restore branch ID must differ from the source branch ID;
- an independent owner different from the restore owner, `PASS` verdict, exact
  `preview-0014-execution` scope, authorization timestamp, packet hash, and freshness limit
  no greater than one hour;
- `authorization.preview_execution=true`, while Production remains false.

Null, malformed, stale, mismatched, or unapproved fields deny execution. Backup and
independent timestamps cannot be future-dated by more than five minutes and must remain
inside their frozen freshness windows at the instant of execution.

## Controlled execution

Only after that separate approval change:

```sh
unset DATABASE_URL
export PRESENCE_0014_PREVIEW_DATABASE_URL_UNPOOLED='<authorized Preview migration URL>'
export PRESENCE_0014_EXECUTE_CONFIRMATION='EXECUTE_PREVIEW_0014'
node scripts/presence/presence-0014-preview-preflight.mjs --execute \
  > preview-0014-execution.private.ndjson
```

The wrapper requires the remote ledger to equal frozen `0000`-`0013`, the repository
journal to contain exactly one pending entry (`0014`), and the collected parent fingerprint
to equal the frozen accepted parent fingerprint. Immediately before invoking the existing
`npm run db:migrate` mechanism it re-reads and re-hashes every frozen migration artifact.
The child receives a process-local `DATABASE_URL` copied only from the dedicated secret.

Afterward, including after a nonzero or interrupted subprocess, the wrapper attempts a new
read-only postflight and emits the observed ledger, fingerprint, controls, roles, counts,
and incident classification. A zero exit is insufficient: exact `0000`-`0014` ledger,
expected capability relation, default-off controls, empty active state, owner cleanup, and
the frozen accepted result fingerprint are mandatory. Successful acceptance also repeats
every exact provider project, branch ID/name, endpoint-host hash, database, and migration
role identity check against the frozen manifest.

## Incremental evidence and stop conditions

The private NDJSON stream records phase starts and completed artifact audit, database
preflight, subprocess outcome, database postflight, and incidents as they occur. Unknown or
duplicate arguments are rejected without echoing their values. Review output privately
before durable redacted archival; no automated redaction claim permits publishing an
operational packet.

Stop on any missing approval, target/GUC/hostname mismatch, hash or journal mismatch,
extra/missing/reordered ledger row, role/control/data mismatch, stale backup or independent
authorization, parent/result fingerprint mismatch, timeout, disconnect, nonzero exit, or
uncertain postflight. Do not rerun, edit the ledger, enable flags, deploy dependent code,
or claim rollback.

## Restore and independent verdict

There is no down migration. On failure, capture actual state read-only and classify it as
unchanged, fully applied, or partial. The named restore owner restores the frozen provider
backup into its separately identified safe target and proves parent ledger, fingerprint,
roles, controls, and empty active state before any separately authorized traffic cutover.
Otherwise only a newly reviewed forward repair is allowed.

The independent owner must reproduce identity, artifact, ledger, fingerprint, role,
control, postflight, and restorability evidence and default to `REFUTED` when anything is
thin or ambiguous. A Preview PASS still authorizes no Production work, runtime flag,
private pilot, deployment, or public rollout.
