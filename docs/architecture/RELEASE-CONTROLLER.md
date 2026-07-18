# WetinDey Quality & Release Controller

## Purpose and authority

The Quality & Release Controller is a persistent, fail-closed employee for integrating
already completed WetinDey work. It replaces the deleted repeating Git Release Controller
automation. It operates only on explicit CEO-controller assignments, stays idle between
assignments, and never creates a timer, recurring automation, duplicate task, or child
task. For an assigned checkpoint it reconciles path ownership, records evidence, creates
narrowly scoped documentation checkpoints when needed, and decides `PUSH` or `NO PUSH`.

The controller does not make a feature correct by merging it, does not replace an
independent refuter, and does not gain ownership of implementation paths. Its exclusive
standing write scope is:

- `LANES.md`
- `docs/architecture/RELEASE-CONTROLLER.md`

Any implementation edit requires a separately claimed lane. Shared or production database
access, migrations, destructive data work, manual deployment, and force operations always
remain outside the persistent controller's authority.

Release readiness, Git hygiene, commit/push criteria, migration-before-code ordering, and
fail-closed `NO PUSH / NO DEPLOY` decisions are the primary duty. Event-driven upkeep of
the two owned documents after employee handoffs is secondary. A local path-scoped
documentation commit does not authorize a push, test, deployment, migration, or seed.

## Event-driven checkpoint harness

Each explicitly assigned checkpoint uses one immutable review candidate and completes
this sequence:

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
   failed controller checkpoint.
9. Push direct to `main` only when the Founder/CEO explicitly requested that checkpoint
   review and every criterion in this document is affirmatively proven at the same
   candidate commit. Re-read the remote ref immediately before push; if it changed,
   discard the decision and wait for a later explicit checkpoint assignment.

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
- The Founder/CEO explicitly requested the exact checkpoint review and push remains within
  that authorization; silence, a prior checkpoint, or standing employee status is not
  push authority.

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

Each checkpoint record must be sufficient for another session to refute the decision
without trusting the controller. Record:

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

## Persistent employee conversion checkpoint: 2026-07-18

- The deleted repeating Git Release Controller automation is replaced by the persistent
  Quality & Release Controller employee. It is event-driven, owns only `LANES.md` and this
  document, stays idle between explicit assignments, and creates no timer, recurring
  automation, duplicate task, or child task.
- HI Quality **REFUTED** Human Interface commit
  `4b572e0a666648dd3f9c016616e0c6b161cb981f`: required pixels were unavailable through
  its failed connector, and `src/app/page.tsx` retains confirmed 32x32 Add/Profile hit
  targets. Static category/Aboki changes otherwise had no scoped defect.
  `src/app/_components/CategorySelectorSheet.tsx` and
  `src/app/_components/ExchangePanel.tsx` have no current write claim but remain pending
  direct-pixel evidence.
- Exact one-file ownership of `src/app/page.tsx` transfers to Human Interface Design
  Engineer task `019f75a5-0fc6-7f40-9a0f-8097ead3b45d`. The forward correction must make
  Add/Profile hit regions at least 44x44 without changing visible icon/avatar scale.
  Path-scoped commit `d82b87e11faa643840c322e6b1d9fbafd2ee356d` changed exactly
  `src/app/page.tsx`, expanding the hit regions to 44x44 while leaving the visible
  circle/avatar 32x32. HI Quality is now assigned independent visible-Safari refutation of
  this exact commit and the remaining direct-pixel evidence for `4b572e0`. The path remains
  claimed and `NO PUSH` remains until verdict, PASS, and explicit handoff.
- HI Quality also visibly reproduced a Food search mismatch: home Rice shows a price
  range and seven places, while search `rice` returns `No price yet / Check am`. This is
  queued evidence intake only and owns no paths until HI Quality supplies its exact
  evidence and the controller reconciles scope. Do not infer a cause or activate a search
  lane yet. Keep it separate from category/Aboki and `src/app/page.tsx` hit-target
  ownership. The prior `c6f304b` static correction is not runtime closure.
- Product & Data Governance Architect task
  `019f7599-0eaa-7423-9ebf-a1bfea8efe37` owns the active two-path governance-only Aboki
  FX provider-policy correction lane over exactly
  `docs/adr/017-cbn-reference-rate-converter.md` and `WETINDEY_BIBLE.md`. Scope replaces
  CBN-only policy with a truthful Frankfurter reference model while preserving
  provider/date attribution, the Aboki FX category name, and a clear non-transaction
  boundary. No rate may be labelled CBN unless actually CBN-backed; blended corridors use
  `Frankfurter reference`. Curated USD, GBP, EUR, CAD, AUD, GHS, KES, ZAR, AED, CNY, INR,
  BRL, CHF, JPY, and SAR corridors remain subject to live server catalog availability.
  Local SVG flags and a searchable picker direction are approved without emoji or remote
  flags. No code, assets, tests, DB, ExchangePanel, currency path, push, or deploy is
  authorized. Require one path-scoped governance commit and independent read-only
  refutation before release; implementation paths remain unclaimed until governance lands.
- Nearby Presence governance completed in path-scoped commit
  `c96086007e6f379c1b686b8203deef2c7c5559c2` with independent PASS. Its exact paths were
  `WETINDEY_BIBLE.md` and `docs/adr/016-nearby-user-presence.md`, now released. ADR-016 is
  Accepted for implementation architecture only and authorizes no shared migration,
  deployment, pilot traffic, or public rollout.
- Presence Platform Engineer task `019f759f-3521-7ee1-90a3-5af3539d757e` now owns the
  reduced local-only Nearby Presence schema lane over exactly:
  `src/db/schema/presence.ts`, `src/db/schema/index.ts`,
  `src/db/pillars/80-presence-services.sql`,
  `src/db/pillars/90-presence-security.sql`,
  `src/db/migrations/0012_guarded_presence.sql`,
  `src/db/migrations/meta/0012_snapshot.json`,
  `src/db/migrations/meta/_journal.json`, and
  `scripts/presence/presence-migration-contract.test.ts`. Scope is a disabled seven-table
  core (`presence_control`, preferences, leases, blocks, waves, reports, rate buckets),
  nine RPCs, forced RLS with no `PUBLIC`, removal of unsafe `user_profiles` location
  fields, and forward `0012` while frozen `0011` remains byte-identical. No DB access,
  migration or test execution, shared repair/application, disposable execution,
  app/UI/actions/map changes, allowlist activation, pilot traffic, push, or deploy is
  authorized. Require one path-scoped local commit and independent static/diff refutation;
  disposable execution remains a separate future authorization. Contribution integrity
  follows as `0013` or later.
- Catalog Stewardship Engineer task
  `019f75a3-f38d-7893-9b82-2d6871a2563c` completed in path-scoped commit `32b15ae` over
  exactly `src/db/seed.ts` and `src/db/seedContent.ts`; an independent static refuter
  returned PASS with no P1/P2/P3. The source now uses a stable per-place PRNG, item-first
  `variants[0]`, one run timestamp, and a primary consumer contract. Catalog 48/85, all
  slugs/content, the single Spaghetti 500g ₦900–₦1,400 variant, and explicit synthetic
  provenance/Sample wording are preserved. Both paths are released. No DB access, seed
  execution, migration, push, or deploy occurred; connected stale data remains unchanged.
  `src/db/seed.ts` stays prohibited for recurring ingestion, and destructive refresh
  remains a separate explicit gate.
- Contribution Integrity & Moderation Engineer task
  `019f75a3-f50d-7180-8e92-0a7aabd8a98c` is queued read-only/pathless pending its exact
  containment plan. `src/app/page.tsx` remains withheld by the HI Add/Profile 44px lane
  until its independent visible-Safari PASS and release. Contribution migration work is
  `0013` or later, after presence-owned forward `0012`. Threat model, disposable
  integration evidence, and independent refutation remain prerequisites to implementation
  ownership.
- Preview schema/ledger drift remains proven and quarantined. Production identity, ledger,
  schema/RPC/RLS/grant fingerprint, migration state, compatibility, restore evidence, and
  deployment ordering remain unknown.
- Presence target authorization, counsel, safety-responder, rate-budget, two-account
  Festac allowlist, default-off application flag, database kill switch, retention, pilot,
  and public-rollout gates remain unresolved.
- Founder standing authorization dated 2026-07-18 covers recurring retrieval/review of
  current attributable Lagos/Nigeria food-price news and NBS Selected Food Price Watch.
  NBS review-only `active + fetch_and_stage` is standing-approved; no stale
  approval-pending gate remains, and this approval must not be requested again. Its
  evidence envelope includes source links, distinct timestamps, SHA-256 hashes,
  attribution, external raw pointers, deterministic review artifacts, append-only
  candidate staging, and a separate provenance-aware development-only current-food-news
  fixture. Source-backed evidence never uses `Sample`; that label is synthetic/demo only.
  Origin copy must name explicit source + geography + period grounded in the package, for
  example `Official data · NBS · Lagos State · May 2026`. Existing seed/demo bytes remain
  immutable; `src/db/seed.ts` is prohibited for recurring ingestion; availability may not
  be inferred and market/place coverage may not be overstated. Source prohibition or
  unverifiable terms, shared/production application of `0010`, live
  publication/promotion, push, and deployment remain separate blocked approvals. Daily
  automation `lagos-food-data-ingestion` is recorded as updated; the controller did not
  create or modify it.
- Sol provenance lead task `019f75a8-7eb2-7be2-9bbc-781e318bda0d` is active read-only to
  propose exact new paths, then advances to implementation only after those paths are
  claimed. Terra fixture engineer task
  `019f75a8-7d3b-7482-b7e2-ce8ed35b9491` and Luna source refuter task
  `019f75a8-8062-7330-93ee-1fb0d8d4fbc5` are queued/pathless. This is lane design only:
  no fixture or implementation path is claimed until Sol returns the exact proposal.
- Decision: **NO PUSH / NO DEPLOY**. This documentation checkpoint authorizes no test,
  push, deployment, migration, seed, shared-database access, or external change.

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

## Controller run: 2026-07-18T13:09:28Z

- Candidate: commit `4e25b8c7ac8a3ad598567e186575defd51113247`
  (tree `9b53d9a15fcb35b2e579da2dbd9cfd5be3ebfc53`, parent
  `a8871a1db0ffa0bda0343a65f078afa82a345d50`) on `main`; fetched `origin/main` was
  `b89ebba14e5ab7017b84e9dc9ddcd57aeb255c6e` (tree
  `4f2dd4e06def335ab4a8d80004c1c2a71d61c3bd`) and remained an ancestor at
  `0` behind / `28` ahead. Reviewed range:
  `b89ebba14e5ab7017b84e9dc9ddcd57aeb255c6e..4e25b8c7ac8a3ad598567e186575defd51113247`.
- Exact changed paths: `DECISIONS.md`, `LANES.md`, `WETINDEY_BIBLE.md`,
  `docs/adr/015-observation-provenance-admissibility.md`,
  `docs/adr/016-nearby-user-presence.md`,
  `docs/adr/017-cbn-reference-rate-converter.md`,
  `docs/architecture/LIVE-INFORMATION-AND-TRUST-EVOLUTION.md`,
  `docs/architecture/RELEASE-CONTROLLER.md`,
  `scripts/ingestion/ingestion-contract.test.ts`,
  `src/app/_components/CategorySelectorSheet.tsx`,
  `src/app/_components/ExchangePanel.tsx`, `src/app/_components/GetItSheet.tsx`,
  `src/app/_components/ManageProfileSheet.tsx`,
  `src/app/_data/exchange-sample-locations.ts`, `src/app/actions.ts`,
  `src/app/currency-actions.ts`, `src/app/item/[slug]/opengraph-image.tsx`,
  `src/app/item/[slug]/page.tsx`, `src/app/opengraph-image.tsx`,
  `src/app/page.tsx`, `src/app/place/[slug]/opengraph-image.tsx`,
  `src/app/place/[slug]/page.tsx`, `src/app/sitemap.ts`,
  `src/db/migrations/0010_public_source_ingestion_boundary.sql`,
  `src/db/migrations/0011_classy_the_stranger.sql`,
  `src/db/migrations/meta/0011_snapshot.json`,
  `src/db/migrations/meta/_journal.json`, `src/db/schema/index.ts`,
  `src/db/seedContent.ts`, `src/design-system/components/ItemCard.tsx`,
  `src/design-system/components/MapboxCanvas.tsx`,
  `src/integrations/maps/MapboxAdapter.ts`, `src/lib/og.tsx`,
  `src/lib/seo-queries.ts`, `src/lib/seo.tsx`, and `src/lib/validation.ts`.
- Worktree gate: **failed** after fetch because the active operating-model lane owns two
  preserved untracked files, `docs/operations/PORTFOLIO-AND-IDEA-REGISTER.md` and
  `docs/operations/WETINDEY-OPERATING-SYSTEM.md`. The controller did not read into,
  stage, edit, commit, or delete that lane's work.
- Lane/evidence gates: **failed**. Commit `4e25b8c` changes exactly the four paths still
  owned by the active nearby-presence containment lane, with no release handoff or
  independent evidence tied to that commit. The merged Release verification + Q1 harness
  and the reviews containment/integrity lane remain planned rather than executable.
  `git diff --check origin/main..HEAD` also reported nine trailing-whitespace defects.
- Migration gate: **failed**. The candidate modifies unapplied `0010`, adds `0011` plus
  its snapshot/journal/schema dependency, and contains provenance-aware application code.
  Exact shared-target identity, ledger, hashes, applied state, `0009`/`0010`/`0011`
  ordering, compatibility, authorization, rollback, and automatic-deployment state remain
  unproven. Disposable `0010` evidence at
  `/tmp/wetindey-refute-0010-c6f304b-9bb58f7891d7.evidence.json` still hashes to
  `7b1038bb15516425ad2164c21edfcd73e331bef5775cad1ae9773821110b930c`, but is volatile,
  tied to `c6f304b`, and explicitly excludes `0011`; it is not shared-target proof.
- Refutation: read-only subagent `/root/release_refuter` returned candidate
  **REFUTED** and the controller's **NO PUSH NOT_REFUTED**, independently confirming the
  dirty worktree, active containment claim, migration incompatibility gate, missing exact-
  HEAD release evidence, and open P0/P1 accessibility defects at `LANES.md:334-338`.
- Decision: **NO PUSH**. No deployment, migration, seed, external configuration change,
  destructive operation, history rewrite, or push occurred. Re-review only after the
  other lane leaves a clean tree; containment is independently verified and released;
  all applicable P0/P1/P2 and the integrated release gate pass at one exact candidate;
  durable evidence exists; and exact authorized shared-target migration compatibility or
  proven-disabled automatic deployment removes the migration-before-code race.

## Controller run: 2026-07-18T14:09:41Z

- Candidate: commit `4da4d5bea58a02feb088a00ae45b94f331a2dd40` (tree
  `0b182780a6db7c26bd77c85eb5915c9ba1bf4028`, parent
  `bb4dca448b177f5a30be168d5dcef25aab28da2a`) on clean `main`. After a fetch without
  rebasing, `origin/main` remained `b89ebba14e5ab7017b84e9dc9ddcd57aeb255c6e`
  (tree `4f2dd4e06def335ab4a8d80004c1c2a71d61c3bd`), an ancestor at `0` behind / `39`
  ahead. Reviewed range:
  `b89ebba14e5ab7017b84e9dc9ddcd57aeb255c6e..4da4d5bea58a02feb088a00ae45b94f331a2dd40`.
- The ten commits after the previous controller record were `611ad9c`, `95f6a37`,
  `295babf`, `0480182`, `893f167`, `a9a7c60`, `ef1455e`, `164a12c`, `bb4dca4`, and
  `4da4d5b`. The full candidate contains 39 linear commits and 39 changed paths:
  `DECISIONS.md`, `LANES.md`, `WETINDEY_BIBLE.md`,
  `docs/adr/015-observation-provenance-admissibility.md`,
  `docs/adr/016-nearby-user-presence.md`,
  `docs/adr/017-cbn-reference-rate-converter.md`,
  `docs/architecture/LIVE-INFORMATION-AND-TRUST-EVOLUTION.md`,
  `docs/architecture/RELEASE-CONTROLLER.md`, `docs/database/README.md`,
  `docs/operations/PORTFOLIO-AND-IDEA-REGISTER.md`,
  `docs/operations/WETINDEY-OPERATING-SYSTEM.md`,
  `scripts/ingestion/ingestion-contract.test.ts`,
  `src/app/_components/CategorySelectorSheet.tsx`,
  `src/app/_components/ExchangePanel.tsx`, `src/app/_components/GetItSheet.tsx`,
  `src/app/_components/ManageProfileSheet.tsx`,
  `src/app/_data/exchange-sample-locations.ts`, `src/app/actions.ts`,
  `src/app/currency-actions.ts`, `src/app/item/[slug]/opengraph-image.tsx`,
  `src/app/item/[slug]/page.tsx`, `src/app/opengraph-image.tsx`, `src/app/page.tsx`,
  `src/app/place/[slug]/opengraph-image.tsx`, `src/app/place/[slug]/page.tsx`,
  `src/app/sitemap.ts`, `src/db/migrations/0010_public_source_ingestion_boundary.sql`,
  `src/db/migrations/0011_classy_the_stranger.sql`,
  `src/db/migrations/meta/0011_snapshot.json`, `src/db/migrations/meta/_journal.json`,
  `src/db/schema/index.ts`, `src/db/seedContent.ts`,
  `src/design-system/components/ItemCard.tsx`,
  `src/design-system/components/MapboxCanvas.tsx`,
  `src/integrations/maps/MapboxAdapter.ts`, `src/lib/og.tsx`,
  `src/lib/seo-queries.ts`, `src/lib/seo.tsx`, and `src/lib/validation.ts`.
- Worktree and ancestry gates passed for the immutable candidate. Current lane records
  release the operating-model, presence containment, ADR-016 packet, reviews containment,
  and database-status documentation paths with their named independent evidence. This run
  removed stale coordination claims that `src/app/actions.ts` remained exclusively owned,
  that ADR-016 still needed packet preparation, and that the already-corrected ModalSheet,
  desktop close-button, and H40 search defects were still open. No implementation path was
  edited.
- Static hygiene still fails: `git diff --check origin/main..HEAD` reports 17 trailing-
  whitespace defects across ADR-017 (2), the two operating-model documents (9),
  `GetItSheet.tsx` (3), `actions.ts` (1), and `MapboxAdapter.ts` (2).
- Migration gate failed. Candidate hashes are `0009`
  `34dd394d6d4f1aad24a73edee5eb88a93441449a1ff86985b60d3ba04f927b4c`, `0010`
  `9aa8cc511374010f1deb68ec330573a9c4940c2aff1188218d5f3e841fccd7fe`, and `0011`
  `1ad4a33a06dfdc58affcfa92dc7085b5843478e09761ee26a24c7cd6b3c0151b`.
  The volatile `/tmp/wetindey-refute-0010-c6f304b-9bb58f7891d7.evidence.json` still
  hashes to `7b1038bb15516425ad2164c21edfcd73e331bef5775cad1ae9773821110b930c`
  and matches the candidate `0009`, `0010`, and journal bytes, but its source is `c6f304b`
  and it explicitly excludes `0011`. Preview has proven schema/ledger drift around `0011`;
  Production identity, ledger, hashes, schema/RPC/RLS/grant fingerprint, restore evidence,
  authorized order, and compatibility remain unknown. Provenance-aware application and SEO
  reads therefore cannot safely deploy ahead of exact-target `0009` proof.
- Release evidence gate failed. The merged Release verification + Q1 harness remains
  planned and has no result tied to `4da4d5b`; disposable search execution and SEO runtime
  evidence remain pending. Valid unresolved P0s remain for inaccessible Mapbox markers and
  3.30:1 light-mode secondary text. The earlier ModalSheet focus and unnamed close-button
  findings are corrected in the current tree and were not reused as blockers.
- Independent read-only subagent `/root/release_refuter` returned candidate **REFUTED** and
  controller **NO PUSH NOT_REFUTED**. It independently verified clean linear ancestry and
  released containment paths, then confirmed the migration dependency, missing exact-HEAD
  integrated gate, pending executable evidence, valid P0s, and 17 whitespace defects.
- Decision: **NO PUSH**. A push is a Production deployment, so a normal Git revert cannot
  make an application/schema race safe. No push, deployment, migration, seed, shared-
  database access, Blob/Vercel/external configuration change, destructive operation, or
  history rewrite occurred. Re-review only after exact authorized shared-target migration
  compatibility is proven, the integrated gate passes at one exact clean candidate, all
  applicable P0/P1/P2 findings and whitespace defects are closed, and required evidence is
  durable rather than `/tmp`-only.
