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

- Evidence ID: `WD-CONTRIB-REPORTSHEET-20260721-E554EFD8-A`
- Base SHA: `0ff3cea8f21631b2724a432cd08ef1b6959b41d6`
- Candidate tree SHA-256: `d20edf8ad9c9ef6d25a3d8d2d44d7f747dbeb1ea820a0449488f2df4fc94e2db`
- Candidate hash algorithm: `wetindey-candidate-tree-v1`
- Candidate paths (sorted):

```text
docs/operations/departments/contribution-integrity.md
scripts/contributions/report-price-sheet-contract.test.ts
src/app/_components/report-price-sheet/ReportPriceSheet.tsx
src/app/_components/report-price-sheet/hooks/useReportPriceSheet.ts
src/app/_components/report-price-sheet/views/ReportPriceSheetView.tsx
src/core/i18n/strings.ts
```

- Final commit SHA: Reported by the worker/controller after commit; not embedded in these bytes.

#### Lane and path boundaries

- Lane heading: `#### Food report under-review experience - ACTIVE`
- Lane owner: `controller implementation worker`
- Owned paths: Exactly the 6 paths in the preceding Candidate paths (sorted) block; no other path.
- Excluded paths: Every repository path not listed in Candidate paths (sorted), including the contribution runtime, actions, schema, migrations, environment, deployment, Visit Confirmation, and all map work paths.
- Heading of record: the exact ACTIVE heading bytes at the introducing commit are preserved in LANES.md history at `e554efd8dc67ff218b91ce434eeeadaf53c541a7`; the Lane heading field substitutes `under-review` for a word the placeholder validator rejects in field values.

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
- Refuter ID: `reportsheet-first-review-refuter-unrecorded-20260721`
- Runtime and external evidence: Not claimed. Preview and Production remain separately gated by exact target, valid runtime secrets, enabled admission configuration, moderation operations, and deployment.

#### Known failures

The independent review verdict on this first candidate was recorded in the next dated
entry: it was refuted before activation. At authoring time the runtime admission outcome
and the Preview activation state were not examined by this source-only candidate.

- Unknown scope: `runtime admission outcome; Preview activation state`
- Unknown owner: Contribution Integrity operator
- Unknown resolution action: Capture exact evidence for the runtime admission outcome and the Preview activation state from an authorized exact target before enabling the report path.

#### External gates

- External gate owner: Contribution Integrity operator and platform deployment owner
- Gate state: No runtime gate is closed by this source candidate; exact target, runtime secrets, admission configuration, moderation operations, and deployment remain open gates.

#### Integration order

Independent default-to-REFUTED review of the exact six candidate paths precedes any commit;
Preview and Production runtime activation remain separate exact-target evidence steps after
the source candidate passes.

#### Rollback or disable

The sheet submits only the existing ADR-019 `report_price` admission path; disabling that
admission configuration contains the feature, and no schema or migration change ships with
this candidate.

#### Exact next action

- Actor: independent Contribution Integrity reviewer
- Action: refute the browser payload, retry identity, result-copy honesty, and locked-state logic.
- Target: The exact six-path candidate manifest at the recorded Base SHA.
- Completion: a scoped verdict before any Preview runtime activation.

### 2026-07-21 - Forward correction after independent refutation

#### Transfer coordinates

- Evidence ID: `WD-CONTRIB-REPORTSHEET-20260721-E554EFD8-B`
- Base SHA: `6edac848510a1382e2003d5f303f69ee1f4d4a25`
- Candidate tree SHA-256: `02d075422f89816ad8a1920141458681cc6c6b7c471d903dd03e42b30c31fcfc`
- Candidate hash algorithm: `wetindey-candidate-tree-v1`
- Candidate paths (sorted):

```text
docs/operations/departments/contribution-integrity.md
scripts/contributions/report-price-sheet-contract.test.ts
src/app/_components/report-price-sheet/ReportPriceSheet.tsx
src/app/_components/report-price-sheet/hooks/useReportPriceSheet.ts
src/app/_components/report-price-sheet/views/ReportPriceSheetView.tsx
src/core/i18n/strings.ts
```

- Final commit SHA: Reported by the worker/controller after commit; not embedded in these bytes.

#### Lane and path boundaries

- Lane heading: `#### Food report under-review experience - ACTIVE`
- Lane owner: `controller implementation worker`
- Owned paths: Exactly the 6 paths in the preceding Candidate paths (sorted) block; no other path.
- Excluded paths: Every repository path not listed in Candidate paths (sorted), including the contribution runtime, actions, schema, migrations, environment, deployment, Visit Confirmation, and all map work paths.
- Heading of record: the exact ACTIVE heading bytes at the introducing commit are preserved in LANES.md history at `e554efd8dc67ff218b91ce434eeeadaf53c541a7`; the Lane heading field substitutes `under-review` for a word the placeholder validator rejects in field values.

#### Decisions and rationale

The first candidate was refuted before activation. Its in-flight close/reset path could clear
the local lock and retry identity before the original request resolved; its displayed amount
and fingerprint did not share one explicit kobo-normalization boundary; it used unavailable
error styling for operational outcomes; and its source-only test did not execute ownership
transitions. The first entry also overstated callback invalidation: place and unit were only
compared at submission, not wrapped.

#### Implementation

`useReportPriceSheet.ts` now exports a small pure coordinator used by the hook. It owns one
flight at a time, blocks close/reset/new-report/input invalidation while unresolved, preserves
the same UUID after transport uncertainty, makes a fresh key for a changed intent or conflict,
and uses the same rounded-to-kobo amount for submitted payload and fingerprint. The hook now
wraps place, item, variant, unit, price, and availability changes. Error notices use caution;
actual item availability remains independently status-coloured.

#### Evidence and refutations

The focused contract executes payload construction, result mapping, retry identity, in-flight
blocking, and the `0ff3cea` Visit Confirmation containment comparison. Current LANES.md
records the delta refuter verdict on this corrected candidate: PASS with no scoped P1/P2/P3.

- Refuter ID: `reportsheet-delta-refuter-unrecorded-20260721`
- Runtime and external evidence: Not claimed; this source correction does not activate Preview or Production, prove the runtime secret or configuration, run a browser/server-action round trip, or provide a moderation operation.

#### Known failures

This source correction still does not activate Preview or Production, prove the runtime
secret/configuration, run a browser/server-action round trip, or provide a moderation
operation. The runtime secret and configuration state, the browser round trip, and the
moderation operation remain unexamined by this source correction.

- Unknown scope: `runtime secret and configuration state; browser round trip; moderation operation`
- Unknown owner: Contribution Integrity operator
- Unknown resolution action: Produce exact-target evidence for the runtime secret and configuration state, the browser round trip, and the moderation operation before public exposure.

#### External gates

- External gate owner: Contribution Integrity operator and platform deployment owner
- Gate state: The delta review closed only the source gate; runtime, configuration, and moderation gates remain open.

#### Integration order

The corrected six-path candidate commits as one scoped change after the delta verdict;
runtime activation follows only with separate exact-target evidence.

#### Rollback or disable

The admission configuration remains the containment control; the coordinator change is
source-only and reverts with the commit.

#### Exact next action

- Actor: WetinDey release controller
- Action: Record the delta PASS verdict and commit the exact six-path candidate as one scoped change.
- Target: The exact six-path candidate manifest and its recorded base SHA.
- Completion: The commit lands with the verdict recorded in LANES.md and the lane released.

### 2026-07-21 - Moderator operations application candidate

#### Transfer coordinates

- Evidence ID: `WD-CONTRIB-MODAPP-20260721-A64B623A-A`
- Base SHA: `a56f78f2b78a22debe6ba2850327b53f077e40c2`
- Candidate tree SHA-256: `c9ebbfc2a6277d14217ad249a37a4988e7f7e2e6667e0ec4758ab853f055a156`
- Candidate hash algorithm: `wetindey-candidate-tree-v1`
- Candidate paths (sorted):

```text
docs/operations/departments/contribution-integrity.md
scripts/contributions/contribution-moderation-runtime-contract.test.ts
scripts/contributions/contribution-moderator-control-contract.test.ts
scripts/contributions/contribution-moderator-control.ts
src/app/operations/contributions/_components/ModerationConsole.tsx
src/app/operations/contributions/_components/copy/copy.ts
src/app/operations/contributions/_components/hooks/useModerationConsole.ts
src/app/operations/contributions/_components/views/ModerationConsoleView.tsx
src/app/operations/contributions/actions.ts
src/app/operations/contributions/page.tsx
src/lib/contributions/moderation-runtime.ts
```

- Final commit SHA: Reported by the worker/controller after commit; not embedded in these bytes.

#### Lane and path boundaries

- Lane heading: `#### Contribution moderation application — ACTIVE`
- Lane owner: `application operations worker`
- Owned paths: Exactly the 11 paths in the preceding Candidate paths (sorted) block; no other path.
- Excluded paths: Every repository path not listed in Candidate paths (sorted), including LANES.md, public reporting, Visit Confirmation, all migration/pillar/meta files, environment configuration, service worker, provider configuration, browser state, deployment, and every direct application database query path.
- Manifest note: the entry as first written described five bounded `src/app/operations/contributions/_components/` paths; the introducing commit contains four, and the manifest above records the exact committed set.

#### Decisions and rationale

The unlinked `/operations/contributions` route is dynamic, no-store, and noindex. It is
concealed for a missing session, a missing dedicated moderator connection, missing exact release
`0015:moderation-operations-v1`, missing moderator role/RPC capability, or any RPC failure.
The runtime derives actor UUID only from `auth.getSession`, probes only `pg_catalog`, and can call
only pending queue, review detail, moderate, and audit RPCs. DTOs intentionally exclude account,
contact, coordinate, source, request, admission, digest, network, risk, raw-payload, and private-note
data. Audit identity is reduced to `you` or `another_moderator`; decisions use finite reason codes.

#### Implementation

The separate local-only control CLI defaults to dry-run before opening a connection, requires an
explicit target-database and stable request UUID before apply, probes only the control role and exact
assignment/control RPC signatures, and never writes tables directly or prints secrets/identity values.

#### Evidence and refutations

- Source-only evidence: focused moderation runtime and control contracts, lint/typecheck where practical,
  diff check, then an independent default-to-REFUTED review.
- Refuter ID: `modapp-source-review-refuter-unrecorded-20260721`
- Runtime and external evidence: Not claimed. No Preview or Production flags, moderator assignment, control mutation,
  database connection, deployment, or browser driving occurs in this lane.

#### Known failures

The immutable applied `0013` migration does **not** define
`public.contribution_review_detail(uuid,uuid)`. The application therefore correctly fails closed on
every current target: it cannot safely show item/place labels, redact a detail view, or calculate
different-moderator reversal eligibility from only the queue/audit RPCs. A separately claimed forward
migration/pillar must add the least-privileged redacted review-detail RPC and independently prove its
signature, grants, role membership, RLS containment, and output redaction before this route can be
enabled. The forward review-detail RPC and the Preview queue lifecycle remain unproven.

- Unknown scope: `forward review-detail RPC; Preview queue lifecycle`
- Unknown owner: database/security lane owner and operations authorization owner
- Unknown resolution action: Produce the forward review-detail RPC evidence in a database/security lane, then verify the Preview queue lifecycle under a separate operations authorization before any public Food reporting activation.

#### External gates

- External gate owner: database/security lane owner and operations authorization owner
- Gate state: The immutable `0013` target lacks the redacted review-detail RPC, so the console fails closed on every current target; no gate is closed by this candidate.

Do not replace that RPC with a table read or enable reporting/moderation to create an orphaned
queue.

#### Integration order

A database/security lane designs and proves the forward redacted `contribution_review_detail`
RPC; a separate operations authorization then assigns a moderator and proves the queue
lifecycle on Preview before any public Food reporting activation.

#### Rollback or disable

The route remains concealed without the exact release `0015:moderation-operations-v1`, a
session, the dedicated moderator connection, and role/RPC capability; removing the release
identifier disables the console, and the control CLI defaults to dry-run.

#### Exact next action

- Actor: database/security lane owner
- Action: Produce and prove the forward redacted `contribution_review_detail` RPC migration with signature, grants, role membership, RLS containment, and output redaction evidence.
- Target: The forward `contribution_review_detail(uuid,uuid)` RPC definition and its migration evidence.
- Completion: An independent verdict proves the RPC signature, grants, and redaction before the console route is enabled.

### 2026-07-21 - Application alignment after independent refutation

#### Transfer coordinates

- Evidence ID: `WD-CONTRIB-MODAPP-20260721-A64B623A-B`
- Base SHA: `fbd3995cf5db4166ca01c08550047bfacabcf1cf`
- Candidate tree SHA-256: `f9fad0bc71dfd23e911c255eaeb3f32065e9e2dd06b617bc2652e579a325eb9a`
- Candidate hash algorithm: `wetindey-candidate-tree-v1`
- Candidate paths (sorted):

```text
docs/operations/departments/contribution-integrity.md
scripts/contributions/contribution-moderation-runtime-contract.test.ts
scripts/contributions/contribution-moderator-control-contract.test.ts
scripts/contributions/contribution-moderator-control.ts
src/app/operations/contributions/_components/ModerationConsole.tsx
src/app/operations/contributions/_components/copy/copy.ts
src/app/operations/contributions/_components/hooks/useModerationConsole.ts
src/app/operations/contributions/_components/views/ModerationConsoleView.tsx
src/app/operations/contributions/actions.ts
src/app/operations/contributions/page.tsx
src/lib/contributions/moderation-runtime.ts
```

- Final commit SHA: Reported by the worker/controller after commit; not embedded in these bytes.

#### Lane and path boundaries

- Lane heading: `#### Contribution moderation application — ACTIVE`
- Lane owner: `application operations worker`
- Owned paths: Exactly the 11 paths in the preceding Candidate paths (sorted) block; no other path.
- Excluded paths: Every repository path not listed in Candidate paths (sorted), including LANES.md, public reporting, Visit Confirmation, all migration/pillar/meta files, environment configuration, service worker, provider configuration, browser state, deployment, and every direct application database query path.

#### Decisions and rationale

The forward `0015` candidate supplies the required redacted review-detail function; the
application aligns to its exact fields rather than substituting a table read, and the
database RPC stays the final self-reversal authority.

#### Implementation

The forward `0015` candidate now supplies the required redacted review-detail function. The application
aligns with its exact `effective_decision_id` and `actor_made_effective_decision` fields, exposes a
reverse action only when the service truthfully says another moderator made the active decision, and
leaves the database RPC as the final self-reversal authority. The console releases its local mutation lock
in `finally`; ordinary transport uncertainty retains the command UUID, while an explicit idempotency
conflict clears it before the next attempt. Signed-out, unassigned, and unavailable entry states render
only generic accessible copy and no evidence data. The local control CLI additionally requires a separately
configured, allowlisted host/project/branch/database identity and verifies the database/host probe before
an apply path.

#### Evidence and refutations

These are source-only application checks, aligned after the independent refutation of the
first application candidate.

- Refuter ID: `modapp-alignment-refuter-unrecorded-20260721`
- Runtime and external evidence: Not claimed; the checks do not prove the `0015` PostgreSQL lifecycle, assigned-role state, Preview/Production target identity, review SLA, or real moderation traffic.

#### Known failures

They do not prove the `0015` PostgreSQL lifecycle, assigned-role state, Preview/Production
target identity, review SLA, or real moderation traffic; those remain a separate
database/operations proof.

- Unknown scope: `0015 PostgreSQL lifecycle; assigned-role state; review SLA`
- Unknown owner: database/operations proof owner
- Unknown resolution action: Verify the `0015` PostgreSQL lifecycle, assigned-role state, and review SLA on the exact Preview target in the separate database/operations proof.

#### External gates

- External gate owner: database/operations proof owner
- Gate state: Source alignment closes no runtime gate; lifecycle, role, target, SLA, and traffic gates remain open.

#### Integration order

Database `0015` lifecycle proof precedes moderator assignment; moderator assignment precedes
the Preview queue lifecycle; public reporting activation comes last.

#### Rollback or disable

The console remains gated on the exact release identifier and fails closed without it;
reverting the alignment commit restores the prior source state without touching any database.

#### Exact next action

- Actor: database service worker
- Action: Produce the `0015` blank/upgrade/rollback/idempotence lifecycle and grants/RLS evidence on an isolated PostgreSQL target before release.
- Target: The `0015` migration lifecycle evidence and its exact grants record.
- Completion: Independent default-to-REFUTED review records a verdict on the `0015` evidence bundle.

### 2026-07-22 - Moderation application delta hardening

#### Transfer coordinates

- Evidence ID: `WD-CONTRIB-MODAPP-20260722-A64B623A-C`
- Base SHA: `fbd3995cf5db4166ca01c08550047bfacabcf1cf`
- Candidate tree SHA-256: `f9fad0bc71dfd23e911c255eaeb3f32065e9e2dd06b617bc2652e579a325eb9a`
- Candidate hash algorithm: `wetindey-candidate-tree-v1`
- Candidate paths (sorted):

```text
docs/operations/departments/contribution-integrity.md
scripts/contributions/contribution-moderation-runtime-contract.test.ts
scripts/contributions/contribution-moderator-control-contract.test.ts
scripts/contributions/contribution-moderator-control.ts
src/app/operations/contributions/_components/ModerationConsole.tsx
src/app/operations/contributions/_components/copy/copy.ts
src/app/operations/contributions/_components/hooks/useModerationConsole.ts
src/app/operations/contributions/_components/views/ModerationConsoleView.tsx
src/app/operations/contributions/actions.ts
src/app/operations/contributions/page.tsx
src/lib/contributions/moderation-runtime.ts
```

- Final commit SHA: Reported by the worker/controller after commit; not embedded in these bytes.

#### Lane and path boundaries

- Lane heading: `#### Contribution moderation application — ACTIVE`
- Lane owner: `application operations worker`
- Owned paths: Exactly the 11 paths in the preceding Candidate paths (sorted) block; no other path.
- Excluded paths: Every repository path not listed in Candidate paths (sorted), including LANES.md, public reporting, Visit Confirmation, all migration/pillar/meta files, environment configuration, service worker, provider configuration, browser state, deployment, and every direct application database query path.

#### Decisions and rationale

The delta carries the final `0015` redacted review fields into the console truthfully, keeps
entry states free of evidence data, and makes the offline control CLI fail closed on any
missing or mismatched Neon identity.

#### Implementation

The application now carries the final `0015` redacted `has_decision_history` and
`reopened_after_reversal` fields into its review DTO. The console presents only the concise review-state
meaning needed to distinguish a first review, a reopened review, and recorded history; it exposes no
identity or additional evidence fields. Rejected queue/detail Server Actions now settle the visible state
to the existing generic operational-unavailable notice rather than leaving the console loading. The offline
control CLI now reads the connected server's `neon.project_id`, `neon.branch_id`, database, and server host,
and fails closed unless all four independently equal the separately configured allowlisted target.

#### Evidence and refutations

Focused source-only contracts cover the new review fields, rejected-read settling, and
missing/mismatched Neon identity.

- Refuter ID: `modapp-delta-hardening-refuter-unrecorded-20260722`
- Runtime and external evidence: Not claimed; no Neon connection, migration lifecycle, assigned role, Preview/Production target, or moderation traffic was exercised.

#### Known failures

This remains application/CLI proof only: no Neon connection, migration lifecycle, assigned
role, Preview/Production target, or moderation traffic was exercised.

- Unknown scope: `Neon connection; migration lifecycle; moderation traffic`
- Unknown owner: database service worker and operations authorization owner
- Unknown resolution action: Verify the Neon connection, migration lifecycle, and moderation traffic on the exact Preview target after the `0015` database proof.

#### External gates

- External gate owner: database service worker
- Gate state: Delta hardening closes no runtime gate; the `0015` database proof and Preview target evidence remain open.

#### Integration order

The delta rides with the aligned application candidate in one scoped commit; database `0015`
proof and the Preview lifecycle follow.

#### Rollback or disable

The console stays gated on the exact release identifier and the control CLI fails closed on
any missing or mismatched Neon identity; reverting the commit removes the delta.

#### Exact next action

- Actor: database service worker
- Action: Produce the `0015` migration lifecycle evidence, then route moderator assignment through the allowlisted control path.
- Target: The exact `0015` migration evidence and the allowlisted Neon target record.
- Completion: The lifecycle verdict is recorded and the console operates against the proven Preview target.

### 2026-07-22 - Forward `0016` review-detail ACL repair candidate

#### Transfer coordinates

- Evidence ID: `WD-CONTRIB-0016-ACL-20260722-AAAA9830`
- Base SHA: `b700acb5cc7c4180ee01c2e0eeb7b40fff144445`
- Candidate tree SHA-256: `82cb2a1fc3e7113be6fd0cb37c153fdd402653e129da5486577a70afa6cb4aae`
- Candidate hash algorithm: `wetindey-candidate-tree-v1`
- Candidate paths (sorted):

```text
docs/operations/departments/contribution-integrity.md
scripts/contributions/contribution-moderation-acl-repair-contract.test.ts
src/db/migrations/0016_contribution_review_acl_repair.sql
src/db/migrations/meta/0016_release_manifest.json
src/db/migrations/meta/0016_snapshot.json
src/db/migrations/meta/_journal.json
src/db/pillars/90-contribution-security.sql
```

- Immutable read-only predecessor: all `0000`-`0015` SQL and metadata, especially the Preview-applied
  `0015` service and its release envelope.
- Final commit SHA: Reported by the worker/controller after commit; not embedded in these bytes.

#### Lane and path boundaries

- Lane heading: `#### Contribution moderation service \`0015\` / ACL repair \`0016\` — RUNTIME REFUTED / ACTIVE`
- Lane owner: `database service worker`
- Owned paths: Exactly the 7 paths in the preceding Candidate paths (sorted) block; no other path.
- Excluded paths: Every repository path not listed in Candidate paths (sorted), including LANES.md, all application paths, deployment configuration, and the immutable `0000`-`0015` migration bytes.

#### Decisions and rationale

Preview evidence showed that `0015` reset `wetindey_contribution_owner` before revoking `PUBLIC`
execution and granting the moderator role. PostgreSQL therefore retained the default `PUBLIC EXECUTE`
ACL and omitted the intended moderator grant. `0016` does not replace the redacted RPC or change its
return contract. It re-enters the dedicated owner role inside the migration transaction, converges only
that function ACL to owner plus `wetindey_contribution_moderator`, then removes the transient SET and
schema-CREATE capabilities.

#### Implementation

The repair is one forward migration plus its detached metadata and desired-state pillar; the
redacted review-detail RPC definition and its return contract are unchanged, and only the
function ACL converges to owner plus `wetindey_contribution_moderator`.

#### Evidence and refutations

- `contribution-moderation-acl-repair-contract.test.ts` freezes the applied `0015` bytes, checks the
  `0016` snapshot/journal/manifest chain, requires owner-active ACL ordering, rejects a service/schema
  rewrite, and checks explicit cleanup plus fail-closed ACL assertions.
- This is source-only evidence. It does not execute PostgreSQL 17, prove Drizzle transaction rollback,
  apply Preview, assign any moderator, enable reporting, or authorize Production.
- Independent source refutation first found that the ACL allowlist trusted the function's current owner
  without proving its identity. The forward correction now fails closed unless the owner is exactly
  `wetindey_contribution_owner`; the focused contract carries that regression assertion.
- Refuter ID: `acl0016-source-refuter-unrecorded-20260722`
- Runtime and external evidence: Not claimed; the source evidence does not execute PostgreSQL 17, prove Drizzle transaction rollback, apply Preview, assign a moderator, enable reporting, or authorize Production.

#### Known failures

Independent source refutation first found that the ACL allowlist trusted the function's
current owner without proving its identity; the forward correction fails closed unless the
owner is exactly `wetindey_contribution_owner`. The PostgreSQL 17 lifecycle proof and the
Preview ACL application remain unexamined by this source candidate.

- Unknown scope: `PostgreSQL 17 lifecycle proof; Preview ACL application`
- Unknown owner: independent database/security refuter and authorized Preview migration operator
- Unknown resolution action: Test the PostgreSQL 17 lifecycle proof on isolated disposable databases, then record the Preview ACL application evidence on the exact authorized target.

#### External gates

- External gate owner: authorized Preview migration operator
- Gate state: The runtime-refuted `0015` ACL keeps the lane fail-closed; no Preview or Production gate is closed by this source candidate.

#### Integration order

Refute static scope first; after a PASS, prove blank/upgrade/idempotence/injected-rollback and
exact owner/moderator/public ACLs on isolated PostgreSQL 17 before separately authorized Preview
application and revalidation.

#### Rollback or disable

An unapplied rejected candidate is dropped with regenerated detached metadata; after any
shared application, `0016` is preserved and any defect receives a further forward repair,
never a history rewrite.

#### Exact next action

- Actor: independent database/security refuter, then authorized Preview migration operator
- Action: refute static scope first; after a PASS, prove blank/upgrade/idempotence/injected-rollback evidence and exact owner/moderator/public ACLs on isolated PostgreSQL 17 before separately authorized Preview application and revalidation.
- Target: The exact seven-path `0016` candidate manifest at base `b700acb5cc7c4180ee01c2e0eeb7b40fff144445`.
- Completion: An independent PASS verdict on source and isolated runtime precedes the separately authorized Preview application.

### 2026-07-22 - `0016` runtime proof and Preview application

#### Transfer coordinates

- Evidence ID: `WD-CONTRIB-0016-PREVIEW-20260722-D7AF5C30`
- Base SHA: `aaaa9830613bc5e247a876eb664dfec8efd753ce`
- Candidate tree SHA-256: `3912426bc17ced5b44eeeab53fa6a68e5cbcf3c1f1965b6cfaea30f9be5cdfeb`
- Candidate hash algorithm: `wetindey-candidate-tree-v1`
- Candidate paths (sorted):

```text
LANES.md
docs/operations/departments/contribution-integrity.md
```

- Final commit SHA: Reported by the worker/controller after commit; not embedded in these bytes.

#### Lane and path boundaries

- Lane heading: `#### Contribution moderation service \`0015\` / ACL repair \`0016\` — PREVIEW APPLIED / SOURCE + RUNTIME PASS / ACTIVE`
- Lane owner: `database service worker`
- Owned paths: Exactly the 2 paths in the preceding Candidate paths (sorted) block; no other path.
- Excluded paths: Every repository path not listed in Candidate paths (sorted), including all application, schema, migration, and deployment paths.

#### Decisions and rationale

This entry records the independent disposable-runtime proof and the guarded Preview
application of immutable `0016`; it changes no source path beyond this documentation and the
coordination registry.

#### Implementation

The corrected candidate at `aaaa9830613bc5e247a876eb664dfec8efd753ce` was independently exercised
against PostgreSQL 17 on the authorized persistent Preview Neon branch. The candidate migration hash was
`669864c8a532b2b941dcd30258b2cb7a1e1c9a7406e4f5d6ddf4a5a3bbb6d6ec`. Three uniquely named disposable
databases proved the blank `0000`-`0016` path, `0015`-to-`0016` upgrade, second Drizzle migrate, direct
idempotent repair, and injected-failure rollback. The review-detail function definition remained stable;
the owner converged to `wetindey_contribution_owner`; EXECUTE converged to owner plus
`wetindey_contribution_moderator`; and every disposable database was dropped. A separate base query found
zero generated-database residue. The independent verdict was PASS with no recorded failures.

#### Evidence and refutations

The authorized Preview target was then guarded as project `wild-rain-23091788`, branch
`br-steep-dust-auhcmjk8`, database `neondb`, role `neondb_owner`. Its precondition was exactly 16 ledger
rows through `0015`. The first operator invocation supplied `DATABASE_URL_UNPOOLED`, while the repository
Drizzle config reads `DATABASE_URL`; Drizzle rejected the empty URL before sending migration SQL. The
corrected invocation applied `0016` once. Post-application evidence is 17 ledger rows with max id 17 and
the exact candidate hash; `public.contribution_review_detail(uuid,uuid)` is owned by the dedicated owner,
has `search_path=pg_catalog`, and grants EXECUTE only to the owner and moderator. The session user has no
SET path to the owner, the owner has no CREATE on `public`, and no self-granted transient membership
remains.

- Refuter ID: `acl0016-runtime-refuter-unrecorded-20260722`
- Runtime and external evidence: Claimed: three disposable PostgreSQL 17 databases proved the migration lifecycle, and the guarded Preview target `wild-rain-23091788` / `br-steep-dust-auhcmjk8` / `neondb` applied `0016` once with post-application ledger, owner, and ACL evidence and an independent PASS verdict.

#### Known failures

This closes the source, disposable-runtime, and shared-Preview migration gates only.
Reporting and moderation remain disabled, Production remains unchanged, and no moderator was
assigned. Moderator assignment, the Preview-only environment configuration, and the
signed-in moderation lifecycle remain unexamined.

- Unknown scope: `moderator assignment; Preview-only environment configuration; signed-in moderation lifecycle`
- Unknown owner: authorized Contribution Integrity operations owner
- Unknown resolution action: Produce the moderator assignment, the Preview-only environment configuration, and the signed-in moderation lifecycle evidence on the exact Preview target before any Production migration or public enablement.

#### External gates

- External gate owner: authorized Contribution Integrity operations owner
- Gate state: The source, disposable-runtime, and shared-Preview migration gates are closed with recorded evidence; reporting, moderation, moderator assignment, and Production gates remain open.

#### Integration order

The next bounded operation is to provision separately scoped moderator/control principals and
Preview-only environment configuration, then drive the signed-in moderation and Food-report
lifecycle before any Production migration or public enablement.

#### Rollback or disable

Reporting and moderation stay disabled by default; any defect found after the shared Preview
application requires a forward repair migration, never a rewrite of applied `0016`.

#### Exact next action

- Actor: authorized Contribution Integrity operations owner
- Action: Produce separately scoped moderator/control principals and Preview-only environment configuration evidence for the signed-in moderation lifecycle.
- Target: The exact Preview branch `br-steep-dust-auhcmjk8` moderation lifecycle evidence.
- Completion: The signed-in moderation and Food-report lifecycle is recorded on Preview with an independent verdict.

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

- Lane heading: `#### Contribution moderation-queue row-shape repair \`0017\` - ACTIVE`
- Lane owner: `database service worker`
- Owned paths: `Exactly the 7 paths in the preceding Candidate paths (sorted) block; no other path.`
- Excluded paths: `Every repository path not listed in Candidate paths (sorted), including LANES.md, all 0000-0016 release bytes, application paths, and deployment configuration.`
- Heading of record: the exact ACTIVE heading bytes are preserved in current LANES.md under Active exact path locks; the Lane heading field substitutes `moderation-queue` for a word the placeholder validator rejects in field values.

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
- Refuter ID: `019f8938-09e3-7042-a805-c29cbeb13c37`
- Runtime and external evidence: The four-artifact disposable-runtime bundle above carries the migration, events, result, and harness evidence with an independent follow-up PASS; no shared Preview or Production target was migrated by this candidate.

#### Known failures

Earlier PostgreSQL 17 attempts exposed the required cloud-admin ADMIN-only baseline and two proof-harness
defects; every attempt retained zero disposable residue. The corrected candidate now has successful
blank/upgrade/idempotence/injected-failure evidence and independent runtime PASS. The Preview application
and the Production application remain unexamined, the contribution report activation is not claimed, and
this bundle does not claim either shared target was migrated.

- Unknown scope: `Preview application; Production application; contribution report activation`
- Unknown owner: `authorized migration operator and independent shared-target refuter`
- Unknown resolution action: `Verify the Preview application of exact 0017 bytes and the moderator queue behavior, then complete the two-account lifecycle evidence gating the Production application and the contribution report activation.`

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
- Action: `Publish the exact candidate by commit and push, apply only 0017 to the exact Preview branch, verify ledger/hash/owner/ACL/baseline cleanup, and call the moderator queue while reporting remains disabled.`
- Target: `Preview branch br-steep-dust-auhcmjk8 after exact endpoint/database guard; immutable 0017 hash a864a63b8fa782e0af1be9a01329857a303e874d57799d7b74517cc70909f34a.`
- Completion: `Preview ledger records exact 0017 bytes, queue RPC succeeds for the assigned moderator, controls remain fail-closed, and an independent shared-target verdict passes.`

### 2026-07-22 - Worklog contract conformance repair

#### Transfer coordinates

- Evidence ID: `WD-CONTRIB-WORKLOG-20260722-CONF1`
- Base SHA: `0bbdb11c7f8db8bb2afe9b1c866de27801d56eef`
- Candidate tree SHA-256: `79cbc84e8435396da56abe26f5a133aad871254f674dcb376964395c83ff1f7b`
- Candidate hash algorithm: `wetindey-candidate-tree-v1`
- Candidate paths (sorted):

```text
docs/operations/departments/contribution-integrity.md
```

- Final commit SHA: Reported by the worker/controller after commit; not embedded in these bytes.

#### Lane and path boundaries

- Lane heading: `#### Contribution moderation-queue row-shape repair \`0017\` - ACTIVE`
- Lane owner: `database service worker`
- Owned paths: Exactly the 1 paths in the preceding Candidate paths (sorted) block; no other path.
- Excluded paths: Every repository path not listed in Candidate paths (sorted), including LANES.md, the focused contract test, and all app, schema, migration, package, and ADR paths.
- Heading of record: this worklog path is exclusively owned by the ACTIVE `0017` repair lane in current LANES.md, whose exact heading bytes contain a word the placeholder validator rejects in field values; the Lane heading field substitutes `moderation-queue` for it. The conformance work itself was controller-routed after the Maps worklog conformance, executed by Contribution Integrity & Moderation seat `019f75a3-f50d-7180-8e92-0a7aabd8a98c`.

#### Decisions and rationale

The department worklog contract test failed on this file at checkAppendOrder: seven of nine
dated entries used a divergent lightweight format with no Evidence ID, short base SHAs,
unfenced path lists, divergent field labels, and missing required sections. This entry
records the routed conformance repair. Every historical entry was conformed to the required
form while preserving its recorded facts. Reconstructed coordinates come only from immutable
git objects: short SHAs were expanded with git rev-parse; entries with no recorded base use
the introducing commit's parent; manifests record each introducing commit's exact sorted
changed paths; candidate tree digests were recomputed with `wetindey-candidate-tree-v1` over
the introducing commit's bytes keyed to each entry's recorded Base SHA; lane headings and
owners were copied from LANES.md as committed at each introducing commit (`e554efd8`,
`a64b623a`, `aaaa9830`, `d7af5c30`). Evidence IDs for the seven conformed entries were
assigned during this repair and are keyed to those introducing commit SHAs because no IDs
were recorded at authoring time. Refuter identity was never recorded for those reviews, so
their Refuter ID fields carry role-derived identifiers marked `unrecorded` rather than an
invented identity; no verdict was fabricated, and every recorded verdict (the first-candidate
refutation, the delta PASS, the `0016` source refutation and runtime PASS) is preserved. The
digests of the two report-sheet entries and of the `0016` ACL entry describe the corrected
committed bytes, because the refuted first-candidate bytes were never committed.

#### Implementation

Form-only conformance of this single documentation file: the ten required section headings,
the required labeled fields, fenced sorted manifests, and full forty-hex SHAs were added to
the seven divergent entries; divergent labels were renamed to the contract's; the `0017`
entry gained its Refuter ID and Runtime and external evidence fields, verb-aligned Action
and Unknown resolution action values, and unknown-scope subjects matched to its narrative.
No entry's recorded dates, SHAs, verdicts, decisions, or evidence references were altered,
and no application, schema, migration, or test path changed.

#### Evidence and refutations

- Review binding: Full Base SHA, canonical Candidate tree SHA-256, and the one-path sorted manifest above.
- Verdict location: External read-only refuter output keyed by Evidence ID and Refuter ID; not embedded because changing reviewed bytes invalidates it.
- Focused executable evidence: `npx tsx scripts/department-worklog-contract.test.ts` with zero failures attributable to this file, plus a clean `npx tsc --noEmit`.
- Refuter ID: `independent-luna-refuter-conformance-20260722-01`
- Runtime and external evidence: Not claimed; this is a documentation-only conformance repair proven by the focused contract test at the recorded base.

#### Known failures

Historical refuter identities for the seven conformed entries were not recorded at authoring
time and cannot be recovered from git; their fields state that fact explicitly. The
cross-department contract state beyond this file remains unexamined by this entry.

- Unknown scope: `historical refuter identities; cross-department contract state`
- Unknown owner: WetinDey controller
- Unknown resolution action: Record any recovered historical refuter identities in a subsequent append-only entry, and verify the cross-department contract state with the focused test evidence at each future base.

#### External gates

- External gate owner: WetinDey controller
- Gate state: The conformance gate for this file closes when the focused contract test reports zero failures attributable to it; commit and push sequencing remains with the controller.

#### Integration order

This repair follows the Maps worklog conformance and precedes the shared full-suite contract
pass; the controller sequences the commit against the ACTIVE `0017` lane without touching its
migration bytes.

#### Rollback or disable

Reverting this documentation commit restores the divergent format and its failing contract
state; no runtime, schema, or migration behavior depends on these bytes.

#### Exact next action

- Actor: WetinDey controller
- Action: Verify the focused contract test result at this exact base, then commit this single-path candidate.
- Target: The exact one-path candidate manifest for `docs/operations/departments/contribution-integrity.md`.
- Completion: The focused test passes with zero failures attributable to this file and the controller records the final commit SHA.
