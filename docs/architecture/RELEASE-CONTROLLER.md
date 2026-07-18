# WetinDey Git Release Controller

## Purpose and authority

The Git Release Controller is an autonomous, fail-closed review harness for integrating
already completed WetinDey work. It reviews the repository once per hour, reconciles
path ownership, records evidence, creates narrowly scoped documentation checkpoints when
needed, and decides `PUSH` or `NO PUSH`.

The controller does not make a feature correct by merging it, does not replace an
independent refuter, and does not gain ownership of implementation paths. Its exclusive
standing write scope is:

- `LANES.md`
- `docs/architecture/RELEASE-CONTROLLER.md`

Any implementation edit requires a separately claimed lane. Shared or production database
access, migrations, destructive data work, manual deployment, and force operations always
remain outside the autonomous controller's authority.

## Hourly autonomous harness

Each hourly run uses one immutable review candidate and completes this sequence:

1. Record UTC time, local `HEAD`, `origin/main`, branch, divergence, and porcelain status.
2. Stop with `NO PUSH` if the branch is not `main`, the worktree is dirty, the branch has
   diverged, the remote base changed during review, or repository state cannot be proven.
3. Enumerate every commit between `origin/main` and the candidate `HEAD`, including the
   exact paths changed by each commit.
4. Match every changed path to its current `LANES.md` owner, completion state, handoff,
   exclusions, and independent evidence.
5. Detect migration files, schema declarations, migration-dependent application code,
   deployment configuration, secrets, destructive operations, and unresolved safety or
   legal claims. Any uncertainty is a blocker.
6. Apply the migration compatibility gate below whenever database behavior may differ.
7. Run the single planned **Release verification + Q1 refutation** gate when its separately
   authorized harness exists. The refuter defaults to `REFUTED` when evidence is thin.
8. Record the decision and evidence. A `NO PUSH` is a successful safety result, not a
   failed controller run.
9. Push direct to `main` only when every criterion in this document is affirmatively
   proven at the same candidate commit. Re-read the remote ref immediately before push;
   if it changed, discard the decision and start a later hourly review from step 1.

The controller never force-pushes, amends, rebases, resets, stashes, deploys manually, or
absorbs another lane's dirty work. It never runs `next build` against a live development
`.next`.

## Strict push and no-push criteria

### `PUSH`

Every condition must be true:

- Candidate branch is clean, non-diverged `main`, based on the recorded `origin/main`.
- Every included path has one unambiguous lane and that lane explicitly released the path.
- Every included substantive claim has fresh independent evidence tied to the exact
  candidate commit. Self-review, static type acceptance, and a green build are not proof
  of behavior.
- The merged Release verification + Q1 gate is `NOT_REFUTED` for all applicable migration,
  provenance, trust, Server Action, category/filter, map/sheet, browser, accessibility,
  PWA, legal, and production-build claims.
- Required evidence is complete, immutable, hash-addressed where practical, and available
  for later audit.
- No secret, generated local artifact, unrelated change, destructive operation, or
  unauthorized deployment action is included.
- The migration compatibility gate is either not applicable or passes for the exact shared
  target and exact release order.
- The push itself is authorized by the standing controller policy and no narrower owner
  instruction pauses it.

### `NO PUSH`

One blocker is enough:

- Dirty, detached, stale, ambiguous, or diverged repository state.
- Active, overlapping, orphaned, or unreleased path ownership.
- Missing independent refutation or evidence not tied to the exact candidate tree.
- Static-only verification where executable behavior is required.
- Any unresolved privacy, safety, authorization, legal, data-integrity, or rollback risk.
- Any unapplied, unauthorized, order-dependent, or unverified shared-target migration.
- Any migration-dependent application code whose compatible schema is not already proven
  on the exact deployment target.
- Any required gate marked `REFUTED`, skipped, flaky, incomplete, or merely inferred.

Documentation-only commits do not bypass these criteria because a push may deploy all of
the current `HEAD`.

## Migration compatibility gate

ADR-014 governs database evolution. The controller preserves the exact applied
`0000`-`0008` lineage, treats `0009` and `0010` as unapplied until exact shared-target
evidence says otherwise, and never uses a new migration to repair an unapplied `0010`.

Before any migration-sensitive push, record and prove:

- Exact target project, branch, endpoint, database, role, server version, and authorization.
- Exact currently applied ledger rows and SQL hashes on that target.
- Exact candidate migration order and compatibility of application code before, during,
  and after rollout.
- Blank-lineage, upgrade, second-pass idempotence, policy, trigger, foreign-key, ledger,
  rollback/cleanup, and final-schema equivalence evidence where applicable.
- Whether automatic deployment is enabled and whether a code push can race ahead of its
  required migration.
- A forward-repair plan for any migration already applied to a shared environment.

Disposable proof establishes source behavior only. It never authorizes shared migration or
proves compatibility with a shared target.

At bootstrap, migration `0010` is independently `NOT_REFUTED` at clean `c6f304b`. The
manifest is `/tmp/wetindey-refute-0010-c6f304b-9bb58f7891d7.evidence.json`, SHA-256
`7b1038bb15516425ad2164c21edfcd73e331bef5775cad1ae9773821110b930c`.
It records passing exact blank and `0009`-upgrade paths, idempotence, policy and foreign-key
probes, cleanup, final schema/ledger equivalence, and exclusion of `0011`. Because nearby
presence later introduced `0011`, exact shared-target compatibility and ordering across
`0009`, `0010`, and `0011` remain unverified. The bootstrap decision is therefore
`NO PUSH`.

## Path-scoped documentation commits

The controller may update its two owned documentation paths to reconcile facts, release
completed paths, add containment lanes, or record a decision. Each documentation commit:

- Stages only `LANES.md` and/or `docs/architecture/RELEASE-CONTROLLER.md` by exact path.
- Uses no broad staging command such as `git add -A` or `git add .`.
- Names the evidence and decision it records.
- Preserves concurrent changes and stops rather than overwriting an unexpected edit.
- Does not imply that the resulting repository is safe to push.

Unrelated implementation work is never included, reformatted, reverted, or claimed by a
controller documentation commit.

## Evidence record

Each hourly record must be sufficient for another session to refute the decision without
trusting the controller. Record:

- Review time, candidate and parent commit hashes, branch, remote ref, divergence, and
  worktree status.
- Included commits and exact changed paths.
- Lane owners, completion/release handoffs, dependencies, and exclusions.
- Refuter identity, verdict, commands or driven flows, environment identity, results,
  failures, and residual unverified behavior.
- Evidence artifact paths and SHA-256 hashes.
- Migration target identity, ledger hashes, order, compatibility result, cleanup result,
  and explicit authorization boundaries.
- Final `PUSH` or `NO PUSH` decision with every blocker named.
- If pushed, the pre-push remote ref, pushed commit, resulting remote ref, and deployment
  consequence known at decision time.

Volatile `/tmp` evidence must be copied into an authorized durable evidence location before
it is required for a future push. A missing artifact fails closed even when its hash was
previously recorded.

## Rollback and incident handling

Rollback is not the primary safety mechanism: a revert is another deployment and cannot
erase an outage that already occurred.

- Before push, abandon an unsafe candidate and record `NO PUSH`; do not rewrite history.
- After a bad application push, stop further integration, preserve evidence, identify the
  last independently verified state, and prepare a new reviewed path-scoped revert commit.
- Never force-push, reset, rebase, amend, or silently drop commits to simulate rollback.
- Never reverse an applied shared migration by editing its bytes or ledger. Preserve
  evidence and repair forward with a separately reviewed migration.
- Re-establish every release and migration gate before pushing a rollback or repair.
- Record deployment and data consequences separately from Git state.

## Completed-task archive policy

A task leaves active ownership only after its implementation commit is identified,
independent evidence is recorded, dependencies are reconciled, and every owned path is
explicitly released. The controller then:

1. Replaces the active claim with a concise completed record naming commit, verdict,
   evidence, exclusions, and released paths.
2. Removes the path from hot-file ownership or marks it released and requiring a new narrow
   claim.
3. Moves verbose historical detail out of active queues during the next authorized
   documentation reconciliation while preserving one auditable pointer.
4. Never archives a task merely because code landed, a build passed, a lane went quiet, or
   an owner disappeared.

Containment and integrity work remains active or planned even when the implementation that
created the risk has landed. Nearby-user presence and reviews therefore retain explicit
safety/integrity lanes until their separate gates are independently satisfied.

## Bootstrap reconciliation: 2026-07-18

- Aboki FX commit `37fa33d` is independently VERIFIED; its three UI paths are released.
- Search commit `c6f304b` is statically VERIFIED; `src/app/actions.ts` remains actively
  claimed only for disposable SQL execution proof.
- Migration `0010` stable disposable proof is independently `NOT_REFUTED`; its former
  implementation paths are released.
- Nearby-user presence has an explicit safety-containment lane.
- Reviews have an explicit containment-and-integrity lane.
- Release verification and Q1 refutation are one planned adversarial gate.
- Current decision: **NO PUSH** because exact shared-target `0009`/`0010`/`0011`
  compatibility and rollout order are unverified.
