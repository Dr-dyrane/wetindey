# Branch Handoff Packet

Use only in a separately lane-approved artifact or append-only functional-home record.
Replace bracketed template fields or write `UNKNOWN - exact scope, owner, and resolution action`.
This packet grants no authority.

Before review, replace every instructional placeholder with concrete transfer evidence.
Within each append-only worklog entry, write every required label exactly once; repeated
labels are valid only when they belong to separate entries. Generic values and vague
actions are not handoff evidence.

## 1. Pre-commit evidence tuple

- Evidence ID: [stable ID]
- Refuter ID: [independent ID]
- Repository: [canonical identity]
- Source branch: [branch or detached]
- Base SHA: [full 40-character SHA]
- Candidate tree SHA-256: [full 64-character SHA-256]
- Candidate paths (sorted):

```text
[one exact repository-relative path per line]
```

- Verdict: REFUTED | NOT_REFUTED
- Verdict tuple match: [base + hash + sorted paths]

The verdict binds to this tuple, not a predicted commit SHA.

## 2. Post-commit transfer identity

- Head SHA: [full SHA reported after commit]
- Head parent/base result: MATCH | REFUTED
- Candidate-tree recomputation: MATCH | REFUTED
- Exact changed paths: MATCH | REFUTED
- Source worktree: [exact]

Any changed base, candidate byte, or path requires a new tuple and review.

## 3. Authority and lane

- Exact `LANES.md` heading: [including punctuation and status]
- Lane owner: [identity]
- Owned paths (sorted): [must equal candidate paths]
- Excluded paths: [every unowned path; high-risk exclusions explicit]
- Dependencies and owners: [exact]
- Push/deploy/migration/external access authority: NONE unless separately recorded

## 4. Decisions and implementation

- Accepted ADRs and architecture basis: [exact]
- Proposed/rejected decisions: [non-authorizing]
- Alternatives/assumptions: [owner and resolution]
- Claimed result and live call sites: [specific or documentation-only]
- Non-goals and generated artifacts: [exact]

## 5. Evidence, failures, and gates

- Evidence artifacts/checks not run/behavior not proven: [exact]
- Known failures/rejected claims/conflicts: [severity and owner]
- Migration state: [paths, order, target, ledger/schema/RPC/RLS/grants, backup, role]
- Provider/deployment state: [IDs, config, flags, secret names, scheduler, rollout]
- Unknown scope: [semicolon-delimited subjects repeated exactly in the failure narrative and resolution action]
- Unknown owner: [authorized resolving owner]
- Unknown resolution action: [concrete evidence-producing action covering every scope subject]

## 6. Integration and rollback

- Integration order and stop conditions: [exact]
- Containment/disable and forward repair: [owner]
- Irreversible data/provider effects: [exact]

## 7. Exact next action

- Actor: [one actor]
- Action: [one action]
- Target: [one target]
- Completion: [one observable condition]

## 8. Receiver read-only reconciliation

- Object/base/head/ancestry: PASS | REFUTED
- Candidate hash and full diff paths: MATCH | REFUTED
- Receiver worktree and current lane: MATCH | REFUTED
- Migration/provider/deployment state: MATCH | UNKNOWN | REFUTED
- Independent verdict tuple: MATCH | REFUTED
- ADR/architecture drift and other conflicts: [exact]

## 9. Separate receiver acknowledgement follow-up

Do not modify this received packet. Acknowledgement is a later append-only record/commit
under a separate exact worklog lane after receipt. It is not a pre-edit requirement and
never unlocks product paths. Record receiver ID/time, received tuple/head, reconciliation,
disposition, first authorized action, and the follow-up commit SHA reported afterward.
Current `LANES.md` and applicable safety gates remain the only edit authority.
