# Department Worklog Protocol

**Status:** Operating process contract  
**Owner:** Program Management and Quality/Release  
**Does not authorize:** Paths, decisions, migrations, provider actions, releases, pushes, or deployments

## 1. Purpose

Department worklogs let another WetinDey task or branch continue without chat context.
They preserve durable rationale, implementation memory, evidence, failures, gates, and the
next exact action. They are memory, not a second control plane.

## 2. Authority hierarchy

| Order | Artifact | Authority | Limit |
|---|---|---|---|
| 1 | Code | Final evidence of current implemented behavior | Code can be defective or violate an ADR |
| 2 | Accepted ADRs | Durable decision authority | An ADR does not implement itself or claim paths |
| 3 | Architecture of record | Current-system explanation beneath code and ADRs | Correct it when code disproves it |
| 4 | Git | Immutable identity, ancestry, and deltas | Git does not prove behavior or external state |
| 5 | Root `LANES.md` | Required authoritative human coordination claims and gates for current edits | Advisory to Git, filesystem, runtime, and platform enforcement; it is not a technical lock |
| 5a | Lane history archive | Historical lane evidence and source-snapshot receipts | It never grants a current human claim or approval |
| 6 | Department worklog | Durable functional memory and uncertainty | A log is never a lock or approval |
| 7 | Branch handoff packet | Exact evidence tuple and transfer state | It expires when relevant state changes |

Record and escalate conflicts; never edit a lower artifact to disguise them.

## 3. One append-only log per functional home

Use [`departments/README.md`](departments/README.md), not a repository-wide hot log. A file
is a memory address, not a staffed team. Its writer must own that exact path in current
`LANES.md`. Program Management sequences two efforts that need the same log.

Once committed, do not rewrite, reorder, or delete an entry. Correct it with a new entry.
Do not store chat transcripts, secrets, personal data, raw location traces, or privileged
legal material. Use `UNKNOWN` or `UNASSIGNED` with an owner instead of guessing.

## 4. Canonical pre-commit evidence

Independent pre-commit review binds to this tuple:

1. Full base SHA, which must remain the candidate commit's parent.
2. Canonical candidate-tree SHA-256.
3. Sorted exact candidate path list.
4. Stable evidence ID and independent refuter ID.

`wetindey-candidate-tree-v1` hashes the base SHA, each sorted UTF-8 path, and the complete
candidate bytes at that path. Every `Candidate tree SHA-256` evidence-field line is
normalized to one fixed token before hashing, removing only unavoidable self-reference.
When the focused contract itself is in the manifest, its one fixed reviewed-digest
assignment is normalized to the same token. The literal assignment remains the acceptance
value: a runtime-calculated digest MUST NOT be inserted into an allowlist or otherwise
accepted dynamically. The focused static contract implements the same algorithm.

After `NOT_REFUTED`, the worker changes no candidate byte, confirms the base is still
`HEAD`, stages only the sorted paths, and commits. The worker/controller reports the full
commit SHA afterward; it need not self-reference inside its own bytes. A moved base,
changed byte, or changed path requires a new tuple and fresh review.

### Entry-local field integrity

Each append-only entry is one self-contained record. Every required label, including
`Evidence ID`, MUST appear exactly once within that entry. A later append-only entry
MUST carry its own complete field set; identical label names in separate entries are not
duplicates in either record.

Each later entry carries its own evidence ID, base, candidate hash, path manifest, lane
snapshot, exclusions, and refuter. It MUST NOT inherit the bootstrap tuple or force older
entries to equal newer bytes. The static contract recomputes the bootstrap digest while
the logs contain only their bootstrap entries. After a legitimate append, it validates
each historical tuple independently for exact structure and relies on immutable Git
objects and branch reconciliation, not rewritten worklog bytes, for historical content.
The conservative initialization MUST remain the first dated entry with its original
bootstrap Evidence ID. Every dated entry heading is unique, and that bootstrap Evidence ID
occurs in exactly one entry; a later entry cannot replace or reclassify it.

Required values MUST identify concrete actors and concrete artifacts, paths, symbols,
commands, or evidence. Empty values; `TBD`, `TODO`, `N/A`, `none`, `later`,
bracketed prompts, generic values, and vague actions such as "Review relevant
documentation" are invalid. Where the protocol requires lane or path scope, copy the
exact `LANES.md` heading, owner, sorted candidate manifest, owned-path text, and
exclusion text rather than paraphrasing them.

## 5. Required frontmatter and entry contract

Every department log has exactly:

```yaml
---
department_id: unique-kebab-case-id
department_name: Human-readable name
worklog_contract_version: 1
authority: durable-memory-only
---
```

Every `### YYYY-MM-DD - Title` entry contains, in order:

### Transfer coordinates

Record `Evidence ID`, full `Base SHA`, full `Candidate tree SHA-256`, hash algorithm, and a
sorted exact `Candidate paths` block. A bootstrap entry does not record a future `Head
SHA`; the worker/controller reports it after commit.

### Lane and path boundaries

Record the exact `LANES.md` heading including punctuation/status, lane owner, sorted exact
owned paths, and exact exclusions. The entry grants none of them.

### Decisions and rationale

Record accepted decisions, clearly label non-authorizing proposals/rejections, and disclose
alternatives and assumptions.

### Implementation

Record what changed, what did not, and whether the work is documentation-only or reaches a
live call site.

### Evidence and refutations

Record evidence ID, independent refuter ID, exact tuple, external verdict location, checks
not run, and behavior not proven. Thin evidence defaults to `REFUTED`. A static contract is
not runtime, provider, database, deployment, accessibility, legal, or field proof.

### Known failures

Record defects, rejected claims, and conflicts; use `UNKNOWN` when not examined. Every entry MUST also contain exactly one `Unknown scope`, one `Unknown owner`, and one `Unknown resolution action`. `Unknown scope` is a semicolon-delimited list of entry-local uncertainty subjects. Every subject MUST appear in both the prose failure narrative and the resolution action; an adjacent or substitute concept does not satisfy the contract. An `UNKNOWN` or `UNASSIGNED` statement is invalid unless those fields identify its full scope, the resolving owner, and a concrete evidence-producing action.

### External gates

Name gate owner and state. Never access an external target merely to fill in a log.

### Integration order

Record dependencies, sequencing, stop conditions, and evidence checkpoints.

### Rollback or disable

Record containment, forward-repair owner, irreversible effects, and documentation limits.

### Exact next action

Use non-empty `Actor`, `Action`, `Target`, and `Completion` fields. Do not use placeholders,
`TODO`, `TBD`, "continue", "follow up", "later", "someone", or "as needed".

## 6. Refutation and commit

Freeze the candidate, generate the tuple, and give it with lane/claims/non-goals to a
separate default-to-`REFUTED` refuter. Commit only an unchanged `NOT_REFUTED` tuple. The
worker does not supply its own verdict. Report the final full commit SHA after commit.

## 7. Branch reconciliation

The receiver performs read-only reconciliation:

```bash
git cat-file -e "<base-sha>^{commit}"
git cat-file -e "<head-sha>^{commit}"
git merge-base --is-ancestor "<base-sha>" "<head-sha>"
git diff --name-status "<base-sha>" "<head-sha>"
git diff --stat "<base-sha>" "<head-sha>"
git status --short --branch
```

Prove object identity, direct parent/base and ancestry; recompute candidate-tree SHA-256;
match every sorted diff path; reconcile current root `LANES.md`, the archived lane-record locator when the received work is released, ADR/architecture drift,
receiver worktree conflicts, and other handoffs. Record exact migration target/ledger/
schema/RPC/RLS/grant state and provider/deployment/configuration/flag/scheduler state, or
`UNKNOWN` plus the authorized owner. Repository equivalence never proves external state.
Bind the independent verdict to evidence ID, refuter ID, base, candidate hash, and paths.
Any mismatch or missing evidence is `REFUTED`.

## 8. Receiver acknowledgement is a separate follow-up

Acknowledgement never unlocks editing and is never a pre-edit requirement. Current
`LANES.md` and applicable safety gates alone determine edit authority.

After receipt, Program Management may grant a separate exact lane for the functional log.
The receiver appends a follow-up record/commit with receiver ID/time, received base/head/
candidate hash, path/lane/external-state/verdict/conflict results, disposition, and first
authorized action. Do not edit the sender's committed entry or packet. The follow-up
records receipt; it grants no path or promotion authority.

## 9. Expiry and static limits

A changed base, head, hash, path list, lane, governing decision, external state, verdict,
or conflict posture invalidates the packet. Append a superseding record.

[`scripts/department-worklog-contract.test.ts`](../../scripts/department-worklog-contract.test.ts)
checks structure, exact lane/path/exclusion text, canonical hash, IDs, placeholders, and
next actions. It cannot validate runtime truth, Git history, live lane state, external
state, independence, verdict authenticity, or acknowledgement. Its bootstrap-only digest
recomputation is pre-commit evidence, not permission to compare every later entry with one
historical candidate.
