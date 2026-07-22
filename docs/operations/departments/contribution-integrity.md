---
department_id: contribution-integrity
department_name: Contribution Integrity
worklog_contract_version: 1
authority: durable-memory-only
---

# Contribution Integrity Department Worklog

## Scope and authority

This home preserves contribution admission, idempotency, moderation, correction, abuse,
and projection-integrity rationale. It does not approve evidence, moderate a person, apply
a migration, or reopen a public write path.

## Append-only entries

### 2026-07-19 - Conservative initialization

#### Transfer coordinates

- Base SHA: `2e76199e40b4e42a324420f49398e9f228099316`
- Candidate tree SHA-256: `829fcb2dd6130475e57c9af52cbb446c8a4752fb5dc970d1ae8a62fab075b3a8`
- Candidate hash algorithm: `wetindey-candidate-tree-v1`
- Candidate paths (sorted):

```text
AGENTS.md
docs/CONTRIBUTING.md
docs/operations/BRANCH-HANDOFF-TEMPLATE.md
docs/operations/DEPARTMENT-WORKLOG-PROTOCOL.md
docs/operations/WETINDEY-OPERATING-SYSTEM.md
docs/operations/departments/README.md
docs/operations/departments/catalog-stewardship.md
docs/operations/departments/client-reliability-offline.md
docs/operations/departments/community-growth.md
docs/operations/departments/contribution-integrity.md
docs/operations/departments/developer-experience.md
docs/operations/departments/executive-product.md
docs/operations/departments/human-interface.md
docs/operations/departments/legal-policy.md
docs/operations/departments/maps-location.md
docs/operations/departments/operations-field-data.md
docs/operations/departments/presence-safety.md
docs/operations/departments/program-release.md
docs/operations/departments/quality-release.md
docs/operations/departments/security-privacy.md
docs/operations/departments/seller-identity-access.md
docs/operations/departments/trust-data-governance.md
scripts/department-worklog-contract.test.ts
```

- Final commit SHA: Reported by the worker/controller after commit; not embedded in these bytes.

#### Lane and path boundaries

- Lane heading: `#### Developer Relations & Engineering Enablement: department worklog protocol — active exact claim`
- Lane owner: `019f7995-5b7b-7ee1-81ef-2c3a3c57b836`
- Owned paths: Exactly the 23 paths in the preceding Candidate paths (sorted) block; no other path.
- Excluded paths: Every repository path not listed in Candidate paths (sorted), including LANES.md and all app, schema, migration, package, and ADR paths.
- Concurrent dependencies: Market, Community, Contribution, Maps, Catalog, and `LANES.md` work remain separately owned.

#### Decisions and rationale

[ADR-019](../../adr/019-contribution-integrity-and-moderation.md) accepts a transactional,
moderated, fail-closed architecture but does not itself claim implementation or rollout.
Pending evidence, durable idempotency, moderation, append-only decisions, and projection
separation remain the governing rationale.

#### Implementation

No contribution or moderation behavior changed. This bootstrap is documentation-only.

#### Evidence and refutations

- Evidence ID: `WD-DEVREL-WORKLOG-20260719-FWD1`
- Refuter ID: `independent-codex-refuter-forward-20260719-07`
- Review binding: Full Base SHA, canonical Candidate tree SHA-256, and sorted Candidate paths.
- Verdict location: External read-only refuter output keyed by Evidence ID and Refuter ID; not embedded because changing reviewed bytes invalidates it.
- Runtime and external evidence: Not claimed by this documentation-only bootstrap.

#### Known failures

`UNKNOWN` for current public write and moderation behavior because this entry did not
exercise or inspect those surfaces.

- Unknown scope: `public write; moderation behavior`
- Unknown owner: Contribution Integrity and Platform/Database/SRE
- Unknown resolution action: Capture exact evidence for unknown scope `public write; moderation behavior` from an authorized target in the next lane-owned Contribution Integrity entry.

#### External gates

- External gate owner: Contribution Integrity and Platform/Database/SRE
- Gate state: No gate is inferred closed by this bootstrap.

Migration ordering, exact target, authorization roles, rate limits, moderation operations,
privacy, abuse evidence, public-write flags, deployment, and independent refutation remain
separate gates.

#### Integration order

Reconcile predecessor migrations and exact target before contribution migration, then
runtime flags, guarded smoke, moderation/projection evidence, and exposure.

#### Rollback or disable

Documentation cannot contain contribution traffic. A later implementation must name its
fail-closed flag, forward repair, and data consequences.

#### Exact next action

- Actor: Contribution Integrity operator
- Action: Complete the authorized exact-environment activation evidence.
- Target: The current pathless operational gate recorded in LANES.md.
- Completion: Preview then Production evidence has an independent verdict without claiming a source path.

### 2026-07-21 - Pending-review Food report sheet candidate

#### Transfer coordinates

- Base SHA: `0ff3cea`
- Candidate paths: `src/app/_components/report-price-sheet/ReportPriceSheet.tsx`,
  `src/app/_components/report-price-sheet/hooks/useReportPriceSheet.ts`,
  `src/app/_components/report-price-sheet/views/ReportPriceSheetView.tsx`,
  `src/core/i18n/strings.ts`, `scripts/contributions/report-price-sheet-contract.test.ts`,
  and this worklog only.
- Excluded paths: contribution runtime, actions, schema, migrations, environment, deployment,
  Visit Confirmation, and all map work.

#### Decisions and rationale

The sheet sends only the existing ADR-019 `report_price` admission payload. A browser UUID is
reused for the same normalized intent so a timeout retries safely; changing any report input
invalidates that key. Unavailable reports omit price entirely. A received result means only
pending review, never public, approved, or projected.

#### Implementation

The previously paused fields become usable when the existing runtime admits them. The UI keeps
one in-flight submit, client-side required-ID and ₦5..₦5,000,000 checks, error recovery, rate
interval feedback, and a concise received-for-review state with Done/New report actions.

#### Evidence and refutations

- Focused executable evidence: `scripts/contributions/report-price-sheet-contract.test.ts`.
- Required independent review: default-to-REFUTED review of the exact six candidate paths.
- Runtime evidence: not claimed. Preview and Production remain separately gated by exact target,
  valid runtime secrets, enabled admission configuration, moderation operations, and deployment.

#### Exact next action

- Actor: independent Contribution Integrity reviewer.
- Action: refute the browser payload, retry identity, result-copy honesty, and locked-state logic.
- Completion: a scoped verdict before any Preview runtime activation.

### 2026-07-21 - Forward correction after independent refutation

#### Refutation received

The first candidate was refuted before activation. Its in-flight close/reset path could clear
the local lock and retry identity before the original request resolved; its displayed amount
and fingerprint did not share one explicit kobo-normalization boundary; it used unavailable
error styling for operational outcomes; and its source-only test did not execute ownership
transitions. The first entry also overstated callback invalidation: place and unit were only
compared at submission, not wrapped.

#### Forward correction

`useReportPriceSheet.ts` now exports a small pure coordinator used by the hook. It owns one
flight at a time, blocks close/reset/new-report/input invalidation while unresolved, preserves
the same UUID after transport uncertainty, makes a fresh key for a changed intent or conflict,
and uses the same rounded-to-kobo amount for submitted payload and fingerprint. The hook now
wraps place, item, variant, unit, price, and availability changes. Error notices use caution;
actual item availability remains independently status-coloured.

#### Evidence and remaining gate

The focused contract executes payload construction, result mapping, retry identity, in-flight
blocking, and the `0ff3cea` Visit Confirmation containment comparison. This source correction
still does not activate Preview or Production, prove the runtime secret/configuration, run a
browser/server-action round trip, or provide a moderation operation.

### 2026-07-21 - Moderator operations application candidate

#### Transfer coordinates

- Base SHA: `a56f78f`
- Candidate paths: `src/lib/contributions/moderation-runtime.ts`,
  `src/app/operations/contributions/actions.ts`,
  `src/app/operations/contributions/page.tsx`, the five bounded
  `src/app/operations/contributions/_components/` paths, the three
  `scripts/contributions/contribution-moderator*` paths, and this worklog.
- Excluded paths: `LANES.md`, public reporting, Visit Confirmation, all migration/pillar/meta
  files, environment configuration, service worker, provider configuration, browser state,
  deployment, and every direct application database query.

#### Implementation and containment

The unlinked `/operations/contributions` route is dynamic, no-store, and noindex. It is
concealed for a missing session, a missing dedicated moderator connection, missing exact release
`0015:moderation-operations-v1`, missing moderator role/RPC capability, or any RPC failure.
The runtime derives actor UUID only from `auth.getSession`, probes only `pg_catalog`, and can call
only pending queue, review detail, moderate, and audit RPCs. DTOs intentionally exclude account,
contact, coordinate, source, request, admission, digest, network, risk, raw-payload, and private-note
data. Audit identity is reduced to `you` or `another_moderator`; decisions use finite reason codes.

The separate local-only control CLI defaults to dry-run before opening a connection, requires an
explicit target-database and stable request UUID before apply, probes only the control role and exact
assignment/control RPC signatures, and never writes tables directly or prints secrets/identity values.

#### Hard operational gate

The immutable applied `0013` migration does **not** define
`public.contribution_review_detail(uuid,uuid)`. The application therefore correctly fails closed on
every current target: it cannot safely show item/place labels, redact a detail view, or calculate
different-moderator reversal eligibility from only the queue/audit RPCs. A separately claimed forward
migration/pillar must add the least-privileged redacted review-detail RPC and independently prove its
signature, grants, role membership, RLS containment, and output redaction before this route can be
enabled. Do not replace that RPC with a table read or enable reporting/moderation to create an orphaned
queue.

#### Evidence and next action

- Source-only evidence: focused moderation runtime and control contracts, lint/typecheck where practical,
  diff check, then an independent default-to-REFUTED review.
- Runtime evidence: not claimed. No Preview or Production flags, moderator assignment, control mutation,
  database connection, deployment, or browser driving occurs in this lane.
- Exact next action: a database/security lane designs and proves the forward redacted
  `contribution_review_detail` RPC; a separate operations authorization then assigns a moderator and
  proves the queue lifecycle on Preview before any public Food reporting activation.

### 2026-07-21 - Application alignment after independent refutation

The forward `0015` candidate now supplies the required redacted review-detail function. The application
aligns with its exact `effective_decision_id` and `actor_made_effective_decision` fields, exposes a
reverse action only when the service truthfully says another moderator made the active decision, and
leaves the database RPC as the final self-reversal authority. The console releases its local mutation lock
in `finally`; ordinary transport uncertainty retains the command UUID, while an explicit idempotency
conflict clears it before the next attempt. Signed-out, unassigned, and unavailable entry states render
only generic accessible copy and no evidence data. The local control CLI additionally requires a separately
configured, allowlisted host/project/branch/database identity and verifies the database/host probe before
an apply path.

These are source-only application checks. They do not prove the `0015` PostgreSQL lifecycle, assigned-role
state, Preview/Production target identity, review SLA, or real moderation traffic; those remain a separate
database/operations proof.

### 2026-07-22 - Moderation application delta hardening

The application now carries the final `0015` redacted `has_decision_history` and
`reopened_after_reversal` fields into its review DTO. The console presents only the concise review-state
meaning needed to distinguish a first review, a reopened review, and recorded history; it exposes no
identity or additional evidence fields. Rejected queue/detail Server Actions now settle the visible state
to the existing generic operational-unavailable notice rather than leaving the console loading. The offline
control CLI now reads the connected server's `neon.project_id`, `neon.branch_id`, database, and server host,
and fails closed unless all four independently equal the separately configured allowlisted target.

Focused source-only contracts cover the new review fields, rejected-read settling, and missing/mismatched
Neon identity. This remains application/CLI proof only: no Neon connection, migration lifecycle, assigned
role, Preview/Production target, or moderation traffic was exercised.

### 2026-07-22 - Forward `0016` review-detail ACL repair candidate

#### Transfer coordinates

- Base SHA: `b700acb5cc7c4180ee01c2e0eeb7b40fff144445`
- Candidate paths: `src/db/pillars/90-contribution-security.sql`,
  `src/db/migrations/0016_contribution_review_acl_repair.sql`,
  `src/db/migrations/meta/0016_snapshot.json`,
  `src/db/migrations/meta/0016_release_manifest.json`,
  `src/db/migrations/meta/_journal.json`,
  `scripts/contributions/contribution-moderation-acl-repair-contract.test.ts`, and this worklog only.
- Immutable read-only predecessor: all `0000`-`0015` SQL and metadata, especially the Preview-applied
  `0015` service and its release envelope.

#### Problem and forward decision

Preview evidence showed that `0015` reset `wetindey_contribution_owner` before revoking `PUBLIC`
execution and granting the moderator role. PostgreSQL therefore retained the default `PUBLIC EXECUTE`
ACL and omitted the intended moderator grant. `0016` does not replace the redacted RPC or change its
return contract. It re-enters the dedicated owner role inside the migration transaction, converges only
that function ACL to owner plus `wetindey_contribution_moderator`, then removes the transient SET and
schema-CREATE capabilities.

#### Source evidence and limits

- `contribution-moderation-acl-repair-contract.test.ts` freezes the applied `0015` bytes, checks the
  `0016` snapshot/journal/manifest chain, requires owner-active ACL ordering, rejects a service/schema
  rewrite, and checks explicit cleanup plus fail-closed ACL assertions.
- This is source-only evidence. It does not execute PostgreSQL 17, prove Drizzle transaction rollback,
  apply Preview, assign any moderator, enable reporting, or authorize Production.
- Independent source refutation first found that the ACL allowlist trusted the function's current owner
  without proving its identity. The forward correction now fails closed unless the owner is exactly
  `wetindey_contribution_owner`; the focused contract carries that regression assertion.

#### Exact next action

- Actor: independent database/security refuter, then authorized Preview migration operator.
- Action: refute static scope first; after a PASS, prove blank/upgrade/idempotence/injected-rollback and
  exact owner/moderator/public ACLs on isolated PostgreSQL 17 before separately authorized Preview
  application and revalidation.

### 2026-07-22 - `0016` runtime proof and Preview application

The corrected candidate at `aaaa9830613bc5e247a876eb664dfec8efd753ce` was independently exercised
against PostgreSQL 17 on the authorized persistent Preview Neon branch. The candidate migration hash was
`669864c8a532b2b941dcd30258b2cb7a1e1c9a7406e4f5d6ddf4a5a3bbb6d6ec`. Three uniquely named disposable
databases proved the blank `0000`-`0016` path, `0015`-to-`0016` upgrade, second Drizzle migrate, direct
idempotent repair, and injected-failure rollback. The review-detail function definition remained stable;
the owner converged to `wetindey_contribution_owner`; EXECUTE converged to owner plus
`wetindey_contribution_moderator`; and every disposable database was dropped. A separate base query found
zero generated-database residue. The independent verdict was PASS with no recorded failures.

The authorized Preview target was then guarded as project `wild-rain-23091788`, branch
`br-steep-dust-auhcmjk8`, database `neondb`, role `neondb_owner`. Its precondition was exactly 16 ledger
rows through `0015`. The first operator invocation supplied `DATABASE_URL_UNPOOLED`, while the repository
Drizzle config reads `DATABASE_URL`; Drizzle rejected the empty URL before sending migration SQL. The
corrected invocation applied `0016` once. Post-application evidence is 17 ledger rows with max id 17 and
the exact candidate hash; `public.contribution_review_detail(uuid,uuid)` is owned by the dedicated owner,
has `search_path=pg_catalog`, and grants EXECUTE only to the owner and moderator. The session user has no
SET path to the owner, the owner has no CREATE on `public`, and no self-granted transient membership
remains.

This closes the source, disposable-runtime, and shared-Preview migration gates only. Reporting and
moderation remain disabled, Production remains unchanged, and no moderator was assigned. The next bounded
operation is to provision separately scoped moderator/control principals and Preview-only environment
configuration, then drive the signed-in moderation and Food-report lifecycle before any Production
migration or public enablement.

### 2026-07-22 - Baseline-preserving `0017` pending-queue result-shape repair candidate

#### Transfer coordinates

- Evidence ID: `WD-CONTRIB-0017-SHAPE-20260722-TERRA5`
- Base SHA: `4b937260b21ddd7ad94663454626b33441de1976`
- Candidate tree SHA-256: `12c63f5e98382bd29470bb2f09339c37b5ed8d0f2ab46e5b952218b06e9f0fda`
- Candidate hash algorithm: `wetindey-candidate-tree-v1`
- Candidate paths (sorted):
```text
docs/operations/departments/contribution-integrity.md
scripts/contributions/contribution-pending-queue-shape-repair-contract.test.ts
src/db/migrations/0017_contribution_pending_queue_shape_repair.sql
src/db/migrations/meta/0017_release_manifest.json
src/db/migrations/meta/0017_snapshot.json
src/db/migrations/meta/_journal.json
src/db/pillars/80-contribution-services.sql
```
- Final commit SHA: `Reported by the worker/controller after commit; not embedded in these bytes.`

#### Lane and path boundaries

- Lane heading: `#### Contribution pending-queue row-shape repair \`0017\` — ACTIVE`
- Lane owner: `database service worker`
- Owned paths: `Exactly the 7 paths in the preceding Candidate paths (sorted) block; no other path.`
- Excluded paths: `Every repository path not listed in Candidate paths (sorted), including LANES.md, all 0000-0016 release bytes, application paths, and deployment configuration.`

#### Decisions and rationale

The live Preview queue RPC fails because its declared `text` result columns receive persisted varchar
expressions without explicit coercion. This forward repair changes only
`observation.availability_state::text` and `observation.collection_method::text`; it preserves the
signature, moderator assignment check, limit validation, admission and effective-decision predicates,
ordering, owner, and moderator-only execute ACL.

#### Implementation

The focused contract derives the immutable predecessor queue definition directly from `0013`, performs
exactly the two required bare-expression substitutions, and requires both the desired-state pillar and
forward migration to equal that result. It also freezes every ordered `0000`-`0016` SQL hash, journal tag,
snapshot ID, and snapshot predecessor link; deep-compares the normalized `0017` snapshot with immutable
`0016`; and freezes every pillar byte outside the queue function against base
`4b937260b21ddd7ad94663454626b33441de1976`. The migration temporarily activates the existing dedicated
definer role solely to replace that function, then proves the existing owner and execute ACL. Before the
first GRANT, the migration captures exact direct membership rows including grantor and all option bits, plus
MEMBER, USAGE, SET, and owner schema-CREATE states. It fails closed unless baseline USAGE, SET, and CREATE
are false. After cleanup, symmetric set comparison and state equality must restore that baseline exactly,
preserving the required cloud-admin ADMIN grant without permitting `0017` to add a direct or transitive
usable path. The detached snapshot advances metadata only; no table, type, RLS, policy, direct table grant,
or application call site changes.

#### Evidence and refutations

- Source refuter ID: `019f8938-09e3-7042-a805-c29cbeb13c37`; verdict **PASS**, no P1/P2/P3.
- Runtime bundle: `/var/folders/n9/d2z6ybln5vb34xvzpqrwj4wr0000gn/T/wetindey-0017-runtime-1784717772800-508629ffd3`.
- Bundle SHA-256: migration `a864a63b8fa782e0af1be9a01329857a303e874d57799d7b74517cc70909f34a`;
  events `1e253182713a059ae228575c5e09b8580457c42a1cf059eef33f96d4782bc1f0`; result
  `cdda80501b0fa34c88bd92cc3407b7eb742ab2dc1f9724622b5069f505285394`; harness
  `11df3be832110712d3a0d93544c2049e84f9f0d9bbb7198d60dce4e38ce7e0e5`.
- Runtime result: exact Neon project `wild-rain-23091788`, branch `br-flat-band-aui9waf5`, endpoint
  `ep-jolly-band-auyq1uv1`, base database `neondb`, PostgreSQL `170010`, non-superuser
  `neondb_owner` with CREATEDB/CREATEROLE. Blank and upgraded ledgers contain the ordered 18 migration
  rows ending in the exact `0017` hash. The staged 17-row predecessor reproduces SQLSTATE `42804` and
  the varchar-to-text mismatch; the repaired queue returns successfully. Injected SQLSTATE `P0001`
  rolls back to byte-equal function/ACL/membership/capability evidence. Second Drizzle and manual
  idempotence are unchanged. Exact disposable names are absent after cleanup.
- Runtime refuter ID: `019f8938-09e3-7042-a805-c29cbeb13c37`; initial summary-only bundle was
  **REFUTED** with three P2 evidence gaps. The strengthened four-artifact bundle resolves all three;
  follow-up verdict **PASS**, with no required artifact or field missing.

#### Known failures

Earlier PostgreSQL 17 attempts exposed the required cloud-admin ADMIN-only baseline and two proof-harness
defects; every attempt retained zero disposable residue. The corrected candidate now has successful
blank/upgrade/idempotence/injected-failure evidence and independent runtime PASS. Preview and Production
application remain unexamined; this bundle does not claim either shared target was migrated.

- Unknown scope: `Preview application; Production application; contribution report activation`
- Unknown owner: `authorized migration operator and independent shared-target refuter`
- Unknown resolution action: `Apply and verify exact 0017 bytes on Preview, re-run the moderator queue, then complete the two-account Preview lifecycle before any Production application or report activation.`

#### External gates

- External gate owner: `authorized migration operator`
- Gate state: `Standing Founder/controller authorization permits guarded exact-target Preview application. The candidate itself grants no Production migration, report activation, or deployment authority; those remain sequenced after Preview proof.`

#### Integration order

Independent source and strengthened runtime refutation both pass. Commit and push the exact candidate,
then hand those immutable bytes to the guarded Preview operator. Production and report activation remain
later independent gates after Preview queue and two-account lifecycle proof.

#### Rollback or disable

If the candidate is rejected before a shared apply, drop the unapplied `0017` candidate and regenerate its
detached metadata. After any shared application, preserve these bytes and issue a separate forward repair;
never rewrite `0000`-`0017` history.

#### Exact next action

- Actor: `authorized Preview migration operator`
- Action: `Commit and push the exact candidate, apply only 0017 to the exact Preview branch, verify ledger/hash/owner/ACL/baseline cleanup, and call the moderator queue while reporting remains disabled.`
- Target: `Preview branch br-steep-dust-auhcmjk8 after exact endpoint/database guard; immutable 0017 hash a864a63b8fa782e0af1be9a01329857a303e874d57799d7b74517cc70909f34a.`
- Completion: `Preview ledger records exact 0017 bytes, queue RPC succeeds for the assigned moderator, controls remain fail-closed, and an independent shared-target verdict passes.`
