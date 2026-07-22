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
