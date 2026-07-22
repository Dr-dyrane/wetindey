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
