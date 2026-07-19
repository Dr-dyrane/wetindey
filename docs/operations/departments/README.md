# Department Worklogs

These files preserve durable functional memory so another branch can continue without chat
context. They are not teams, path locks, ADRs, architecture, release evidence, or runtime
truth. Ownership comes only from [`LANES.md`](../../../LANES.md). Follow the
[protocol](../DEPARTMENT-WORKLOG-PROTOCOL.md) and
[handoff template](../BRANCH-HANDOFF-TEMPLATE.md).

## Functional-home index

| Department ID | File |
|---|---|
| `executive-product` | [executive-product.md](executive-product.md) |
| `program-release` | [program-release.md](program-release.md) |
| `human-interface` | [human-interface.md](human-interface.md) |
| `maps-location` | [maps-location.md](maps-location.md) |
| `presence-safety` | [presence-safety.md](presence-safety.md) |
| `contribution-integrity` | [contribution-integrity.md](contribution-integrity.md) |
| `trust-data-governance` | [trust-data-governance.md](trust-data-governance.md) |
| `catalog-stewardship` | [catalog-stewardship.md](catalog-stewardship.md) |
| `seller-identity-access` | [seller-identity-access.md](seller-identity-access.md) |
| `security-privacy` | [security-privacy.md](security-privacy.md) |
| `quality-release` | [quality-release.md](quality-release.md) |
| `client-reliability-offline` | [client-reliability-offline.md](client-reliability-offline.md) |
| `operations-field-data` | [operations-field-data.md](operations-field-data.md) |
| `legal-policy` | [legal-policy.md](legal-policy.md) |
| `community-growth` | [community-growth.md](community-growth.md) |
| `developer-experience` | [developer-experience.md](developer-experience.md) |

## Rules

Append only under an exact log-path lane. Use `UNKNOWN`/`UNASSIGNED` rather than guessing.
Bind review to base SHA, canonical candidate-tree SHA-256, and sorted paths. Report the
commit SHA afterward. Receiver acknowledgement is a separate lane-owned follow-up after
receipt, never an edit-unlock. Store no secrets, personal data, raw location traces, or
privileged legal material.

## Bootstrap candidate evidence

- Evidence ID: `WD-DEVREL-WORKLOG-20260719-FWD1`
- Refuter ID: `independent-codex-refuter-forward-20260719-07`
- Base SHA: `2e76199e40b4e42a324420f49398e9f228099316`
- Candidate tree SHA-256: `829fcb2dd6130475e57c9af52cbb446c8a4752fb5dc970d1ae8a62fab075b3a8`
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

The worker/controller reports the final commit SHA after commit. `LANES.md` remains
separately owned coordination evidence outside this manifest.
