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

### Browser refutation tab discipline

HI Quality and every future browser refuter must reuse one dedicated localhost QA tab.
Navigate or reset that tab in place for each flow, preserve all unrelated user tabs, and
close any unavoidable temporary duplicate before reporting. Never create a fresh tab or
window per test. A report must confirm this discipline; repeated tab/window creation or an
unclosed duplicate leaves the browser gate incomplete and therefore fail-closed.

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

ADR-014 governs database evolution. The controller preserves the exact applied `0000`-`0014`
lineage and immutable ledger evidence, repairing defects forward only. Independent evidence
proves the same `0014` result on Preview and Production; duplicate execution is forbidden.
Runtime, pilot, privacy, safety, deployment, and rollout gates remain separate.

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

Historical bootstrap note only: migration `0010` was independently `NOT_REFUTED` at clean
`c6f304b`; its volatile disposable manifest and pre-`0011` scope are not current shared-target
evidence. Current posture is recorded in root `LANES.md`: `0000` through `0014` are applied
and immutable on Preview and Production with one accepted result fingerprint.

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
- HI Quality completed visible selector/Aboki and `d82b87e` hit-target evidence across
  desktop/compact and light/dark. Selector/Aboki behavior passed; 44x44 Add/Profile edge
  clicks passed while visible circle/avatar scale remained 32px. The scoped implementation
  paths `src/app/_components/CategorySelectorSheet.tsx`,
  `src/app/_components/ExchangePanel.tsx`, and `src/app/page.tsx` were released. The
  combined release verdict remains **REFUTED** only because Safari keyboard focus and
  artificial loading/error/cache/empty states were not proven. Those remain residual
  evidence gaps, not retained ownership. Exact screenshot paths remain in the HI report.
  That completed flattening lane released `ExchangePanel.tsx`; the path is now separately
  claimed by the later ADR-017 provider-aware implementation lane recorded below.
- Human Interface Design Engineer task `019f75a5-0fc6-7f40-9a0f-8097ead3b45d` completed
  the Founder-directed slim-category-trigger implementation at exact one-file commit
  `9f7b2c74d3395c687c91338fe475b8d3872cbcb1`. It preserves a 44px outer target
  around a 32px visible surface with 8px horizontal padding and a 2px label-chevron gap.
  No tests, browser, push, or deploy occurred during implementation. HI Quality reused-tab
  visual refutation passed across desktop/compact, light/dark, Food↔Aboki switching, and
  the 44px outer/32px visible geometry. `src/app/page.tsx` is released.
- Search & Ranking Engineer task `019f75b7-6c59-7952-bf14-b01cfbfd2793` completed the
  forward sequence at `2ebaf54` and `75a1fd1` without amending runtime-refuted `48fac46`.
  HI Quality returned final PASS in the reused Safari QA tab at Amuwo Odofin 5 km: Rice
  home/search matched Sample `₦81,158–₦101,401 / 50kg bag / 7 places`; Pepper matched
  `₦3,982–₦7,949 / Paint bucket / 12 places`. Category switching remained operable, no
  visible exception appeared, and the tab was restored. The Rice Search lane is closed;
  `src/app/actions.ts` is released from Search and transferred immediately to the
  Contribution containment lane below. A later independent static review returned PASS:
  the mismatch was Sample-projection divergence, not `ItemCard`; `searchItems` now mirrors
  the home fresh-current-offer and detail-window projections while synthetic results remain
  Sample/zero-confidence and the observed-only gate is preserved. That worker's browser
  recheck was blocked by connector `Cannot redefine property: process`. The tooling
  residual neither overturns the prior runtime PASS nor reopens the Search code lane. No
  edits, tests, or DB access occurred.
- Product & Data Governance Architect task
  `019f7599-0eaa-7423-9ebf-a1bfea8efe37` completed the two-path ADR-017 governance
  correction at `0bf641d7784edfa512ab54bf13a15c3ac0c72ce1`. Independent refutation
  passed with no P1/P2/P3, so `docs/adr/017-cbn-reference-rate-converter.md` and
  `WETINDEY_BIBLE.md` are released. Governance now requires truthful provider/date
  attribution, permits CBN labelling only for explicit CBN backing, otherwise uses
  `Frankfurter reference`, preserves the Aboki FX name and non-transaction boundary, and
  authorizes a searchable picker with bundled non-emoji SVG flags.
- Human Interface Design Engineer task `019f75a5-0fc6-7f40-9a0f-8097ead3b45d` completed
  the exclusive ADR-017 implementation lane at
  `ed9483c55789c0ad88bcac94befb43a1c2849463` over exactly
  `src/app/currency-actions.ts`,
  `src/app/_data/reference-currencies.ts`, `src/app/_components/ExchangePanel.tsx`,
  `src/app/_components/CurrencyPickerSheet.tsx`, `src/app/_components/CurrencyFlag.tsx`,
  `public/icons/currency-flags.svg`, and `public/icons/currency-flags.LICENSE.md`.
  Independent static/diff refutation passed. The exact tree has 28px circular local SVG
  orbs, pair-keyed rate state, a typed catalog/rate call chain, and truthful
  provider/effective-date data. HI Quality runtime refutation **REFUTED** the candidate:
  amount `100` JPY clears when the same Safari window crosses desktop→compact. All other
  tested core flows, circular orbs, and provider labels passed. Forward fix
  `a4eaed3b41f19162bc89e4f07100dc23a0285001` changed only `ExchangePanel.tsx` and
  received independent static PASS with no P1/P2/P3. It uses bounded validated current-tab
  `sessionStorage` to preserve amount across responsive remount, clears invalid or blank
  state, and changes no egress/provider behavior. HI Quality then returned narrow runtime
  PASS in the existing localhost Safari WetinDey tab: `100` JPY persisted
  desktop→compact→desktop; clearing removed the amount; pair reset intentionally cleared
  it; invalid compact input did not resurrect the prior amount; light/dark were exercised;
  and the tab was restored to Food/light desktop. The seven implementation paths are
  released. This scoped PASS does not close separate Safari keyboard/artificial-state,
  iconography-runtime, Contribution, shared-migration, push, or deployment gates. The
  Founder-reaffirmed
  visual-system rule binds this lane: primary surfaces stay monochrome/neutral so
  controlled color lives in iconography and photography; currency flags are circular local
  SVG orbs, never emoji or rectangular flag badges. No tests, DB, push, or deploy occurred.
- Product & Data Governance Architect task
  `019f7599-0eaa-7423-9ebf-a1bfea8efe37` completed H23 at exact one-file commit
  `18b9b09a0815037e90f438e43fdefba2b1f8dd27`; independent static refutation passed
  with no P1/P2/P3. `docs/adr/006-freshness-windows.md` is released. The repair changed
  citations and call-site descriptions only while preserving every freshness/trust
  decision; no code or policy change occurred.
- The same Product & Data Governance Architect completed ADR-018 Controlled Semantic
  Iconography at `4116532def401c8419cc645b55d18b2dca36139e` over exactly
  `docs/adr/018-controlled-semantic-iconography.md`, `docs/design-system/ICONOGRAPHY.md`,
  `docs/architecture/SERVICE-ARCHITECTURE.md`, and `WETINDEY_BIBLE.md`. Follow-up
  independent refutation passed with no P1/P2/P3, so all four governance paths are
  released.
- Iconography & Visual Systems Lead task `019f75cf-4d8f-7263-822b-06e846fce7ac`
  completed the exact twelve-path ADR-018 implementation at
  `69737de3a3e84d88bfe7bb906d4abdc4b7315dee`: `src/app/globals.css`,
  `tailwind.config.ts`, `src/design-system/components/IconOrb.tsx`,
  `src/design-system/components/ListRow.tsx`, `src/design-system/components/ItemCard.tsx`,
  `src/app/_components/CategorySelectorSheet.tsx`,
  `src/app/_components/ProfileSheet.tsx`, `src/app/_components/GetItSheet.tsx`,
  `src/app/_components/AboutSheet.tsx`, `src/app/_components/LocationSheet.tsx`,
  `src/app/_components/ReportProblemSheet.tsx`, and
  `scripts/iconography-contracts.test.ts`. Scope is the exact ADR/audit contract: neutral
  ordinary actions; separate Food/Money domain tones; status only actual state; rating
  token; neutral disabled future categories; circular borderless `IconOrb` 28/32/48;
  neutral item fallback; scoped raw/status misuse and routine decorative-border removal;
  >=44px parent targets; accessibility; and reduced motion. Independent refutation returned
  **NOT REFUTED** with no P1/P2; exact twelve-path scope was clean and the focused
  iconography contract passed. All twelve implementation paths are released. Runtime
  visual verification and independent contrast calculation remain release-evidence
  residuals. Broader future call-site coverage stays queued and unclaimed until exact
  disjoint paths are proposed. The completed scope excludes all seven Aboki paths,
  `page.tsx`, `MapboxAdapter`, and DB; no build, browser, DB, push, or deploy occurred.
- Founder authorization activates three bounded ADR-018 expansion units for Iconography &
  Visual Systems Lead `019f75cf-4d8f-7263-822b-06e846fce7ac`. Foundation owns exactly
  `src/app/globals.css`, `tailwind.config.ts`,
  `src/design-system/components/IconOrb.tsx`, new
  `src/design-system/icons/SolidIcon.tsx`, and
  `scripts/iconography-contracts.test.ts`. `package.json` and `package-lock.json` remain
  outside this claim because the ownership table retains them for auth; they require an
  explicit release/handoff only if a reviewed web-licensed solid-icon dependency is
  selected. Foundation must commit and receive independent review before Sheet Adoption.
- The Founder-directed Market Details Sheet Visual Systems lane is a separate bounded
  implementation/refutation unit after Foundation. Iconography & Visual Systems Lead owns
  exactly `src/app/_components/ItemDetailSheet.tsx`,
  `src/design-system/components/ListRow.tsx`,
  `src/design-system/components/SheetPicker.tsx`, and
  `src/app/_components/GetItSheet.tsx`. Its objective is a context-aware,
  Apple-HIG-inspired market detail sheet with useful already-licensed/available item
  imagery, solid semantic icon orbs, comfortable use of available vertical space, clear
  light/dark surfaces, and a stable bottom action. It must preserve existing truth
  semantics, item/offer counts, trust/provenance labels, accessibility, and
  fulfilment-out-of-scope.
- Remaining Sheet Adoption owns exactly
  `src/design-system/components/MapLoader.tsx`,
  `src/app/_components/SettingsSheet.tsx`,
  `src/app/_components/CurrencyPickerSheet.tsx`, and
  `src/app/_components/ExchangePanel.tsx`. The separate Map Symbols unit owns exactly
  `src/design-system/components/MapboxCanvas.tsx` and
  `src/integrations/maps/MapboxAdapter.ts`, preserving H37 place-type forwarding and all
  existing marker contracts.
- All three units preserve ADR-018: ordinary controls remain neutral; Food, Money, rating,
  and actual status states retain distinct semantic ownership; no blanket colour, direct
  Apple SF Symbols licensing assumption, generic/translucent-outline regression, or
  authentic flag/photo/avatar treatment is permitted. Exact exclusions are
  `src/app/page.tsx`, `src/app/actions.ts`, every Contribution-owned path, currency
  actions/data, `CurrencyFlag`, flag sprite/licence assets, and all DB/schema/migration
  paths. Independent light/dark reused-state visual/accessibility refutation must cover
  accessible names/text, >=44px parent targets, reduced motion, and semantic-tone use
  before release. No push or deployment is authorized.
- Market Details additionally excludes `src/app/page.tsx`, `src/app/actions.ts`,
  schema/migrations, map adapter/canvas, BottomSheet motion behavior, Contribution paths,
  currency data/actions, and new remote media/licensing. Its independent refutation must
  cover light/dark, accessibility, reduced motion, stable action placement, and absence of
  truth/count/trust/provenance regressions before the four paths can be released.
- Reserve ADR-019 as `019-contribution-integrity-and-moderation.md` for later
  post-containment migration `0013` policy. ADR-018 released `WETINDEY_BIBLE.md`, but
  ADR-019 remains pathless until Contribution runtime evidence passes and a new exclusive
  governance claim is recorded.
  These documentation updates change no release authority: unresolved shared migration state
  keeps the decision strictly **NO PUSH / NO DEPLOY**.
- Nearby Presence governance completed in path-scoped commit
  `c96086007e6f379c1b686b8203deef2c7c5559c2` with independent PASS. Its exact paths were
  `WETINDEY_BIBLE.md` and `docs/adr/016-nearby-user-presence.md`, now released. ADR-016 is
  Accepted for implementation architecture only and authorizes no shared migration,
  deployment, pilot traffic, or public rollout.
- Presence Platform Engineer task `019f759f-3521-7ee1-90a3-5af3539d757e` completed the
  reduced local-only Nearby Presence schema lane at `3e50656` over exactly:
  `src/db/schema/presence.ts`, `src/db/schema/index.ts`,
  `src/db/pillars/80-presence-services.sql`,
  `src/db/pillars/90-presence-security.sql`,
  `src/db/migrations/0012_guarded_presence.sql`,
  `src/db/migrations/meta/0012_snapshot.json`,
  `src/db/migrations/meta/_journal.json`, and
  `scripts/presence/presence-migration-contract.test.ts`. Independent static/diff
  refutation passed with no P1/P2. The source implements a disabled seven-table core
  (`presence_control`, preferences, leases, blocks, waves, reports, rate buckets), nine
  RPCs, empty allowlist/no traffic, forced RLS with no `PUBLIC` and least privilege,
  removal of unsafe `user_profiles` location fields without backfill, kill purge,
  reciprocity, nonrenewing leases, Wave/report/block/rate controls, and forward `0012`
  while frozen `0011` remains byte-identical. The eight source paths are released into an
  unapplied execution-gate state. No tests, typecheck, lint, build, migration, seed, DB,
  push, or deploy occurred; Drizzle generated only local named artifacts. Disposable
  SQL/role/PostGIS/RLS/lineage/restore proof remains separately unauthorized. Shared
  migration, pilot traffic, and public rollout remain blocked. Contribution integrity
  follows as `0013` or later.
- Founder browsing policy now requires real GPS outside Lagos to keep browsing/search
  context inside Lagos using the default Festac area, unless the user explicitly selects a
  Lagos area such as Yaba. Fallback or selected area must show truthful area context and
  never “You are here.” This remains separate from presence: only a fresh in-Lagos
  foreground GPS fix may activate nearby presence; manual/selected area, the default
  centroid, stale persisted fixes, and simulated/demo coordinates never may. The current
  self marker represents position, not an avatar. If a user explicitly approves sharing
  while their real device location is outside Lagos, peers may receive only coarse
  country/region text such as `United States`; never coordinates, address, exact movement,
  a false Lagos presence, or nearby-presence status. Browsing context may still be Festac
  or a selected Lagos area, but presence remains absent outside the real Lagos area. Peer
  presence currently fails closed because `src/app/page.tsx` passes `sharedUsers={[]}`.
  Any coarse-label implementation requires exact ownership and counsel/privacy review. The
  Founder wants a private two-account Festac pilot, but this intent authorizes no shared
  migration, `0012` application, deployment, pilot traffic, or public rollout. The Presence
  Platform Engineer returned an exact seven-path first-slice proposal, but it is not
  active: `src/app/page.tsx` remains exclusively owned by Contribution. The proposed new
  `src/app/presence-actions.ts`,
  `src/app/_components/NearbyPresenceControl.tsx`,
  `src/app/_components/PresenceTapCard.tsx`, and
  `scripts/presence/presence-private-pilot-contract.test.ts` are unclaimed;
  `src/design-system/components/MapboxCanvas.tsx` and
  `src/integrations/maps/MapboxAdapter.ts` are released/unowned; and `src/app/page.tsx`
  conflicts. Presence must wait and later request a fresh atomic claim over those same
  seven paths. It may not widen into `src/app/actions.ts`, `locationStore`, profile/auth
  internals, or committed `0012` paths.
- Disposable proof is separately unauthorized. A future exact authorization must name a
  guarded disposable target; reproduce exact lineage through `0012`; prove roles/PostGIS,
  forced RLS, no `PUBLIC`, least privilege, default-off and empty allowlist; exercise the
  exact two-account Festac allowlist, reciprocal opt-in, lease expiry/nonrenewal, rates,
  block/report, kill purge, and restore/cleanup; and prove fallback/selected/stale/simulated
  coordinates never activate presence. A named safety responder and approved legal/privacy
  notice are mandatory before pilot traffic.
- Fail-closed privacy correction: manual, AI-selected, or default centers—including a
  selected Badagry center—may drive browsing only and never unlock real peers. Badagry may
  show local information or explicitly labelled Sample users. Real presence requires each
  viewer’s fresh foreground GPS in the same area, reciprocal opt-in, and coarse
  lease-scoped markers. Contact or interaction must never automatically reveal true
  location. Optional coarse country/region sharing remains explicit and counsel-gated.
- Consent to share with someone outside the physical area must be a separate future Remote
  Sharing mode, never an override of Nearby Presence. Nearby Presence remains fresh-GPS,
  reciprocal, and area-bound. The safe Remote Sharing default is explicit trusted-audience
  selection, coarse area/country label only, short expiry, immediate revoke, no background
  tracking, and no automatic exact-location disclosure on interaction. Global visibility
  to “any signed-in user” is a separate high-risk privacy/legal gate and is not authorized.
  The future Trusted Circle audience is invite/QR-based with mutual acceptance, coarse
  scope, expiry, and immediate revoke; it has no contact sync or global directory. It
  remains a pathless concept, separate from Nearby Presence, pending counsel/privacy
  approval, exact future ownership, and independent privacy refutation. No Remote Sharing
  path is claimed.
- Seller Identity, RBAC & Onboarding is a future pathless governance lane. Seller
  registration is separate from ordinary contribution; place ownership claims need a
  verified lifecycle; identity and business verification remain distinct from reputation.
  Future owner/manager/staff roles require scoped permissions for prices, availability,
  hours, contact consent, corrections, and responses plus audit, revocation, suspension,
  and appeals. “Verified WetinDey Seller” may be earned only from approved verification
  evidence and objective accuracy, never purchased. Seller data must not automatically
  become live observations. Legal/privacy, auth/provider, moderation, Trust Graph, exact
  ownership, and independent identity/moderation refutation remain gates.
- Core vision, mission, and product-model changes require governance-document correction
  first. A later bounded product/legal UI handoff may claim
  `src/core/i18n/strings.ts`, `src/app/_components/AboutSheet.tsx`, and
  `src/app/_components/LocationSheet.tsx`; it may add
  `src/app/_components/ProfileSheet.tsx` or `src/app/page.tsx` only when entry wiring
  changes. This record claims none of those paths, preserves current owners, and retains
  counsel approval for final legal wording.
- `src/app/page.tsx` modularisation and reusable core engines are a future pathless
  architecture lane. Contribution retains `page.tsx`; this record transfers no path and
  authorizes no implementation. Required planning deliverables are the current code tree,
  live caller/dependency graph, ownership-boundary matrix for discovery/search, location,
  map/presence, sheet/presentation, contribution, exchange, seller, trust/confidence, and
  legal/analytics, documentation changes, and an incremental strangler sequence. ADR-002
  correctness-before-boundaries controls the work: extract only live vertical slices with
  callers wired in the same change, keep domain logic out of UI, prefer shared typed
  contracts/configuration and reusable core engines, and prove no behavior regression.
  Every extraction requires exact paths, a named owner, and independent refutation.
  `src/modules` remains aspirational until wired to a live caller in the same change.
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
- The next unblocked non-overlapping Stage 0 lane is the H27 seed-trust correction.
  Catalog Stewardship Engineer `019f75a3-f38d-7893-9b82-2d6871a2563c` owns exactly
  `src/db/seed.ts`; independent default-to-refuted review is assigned to
  `/root/h27_seed_trust_refuter`. Remove the hardcoded freshness-to-high/medium/low trust
  ladder so synthetic/Sample offers cannot earn observed-evidence confidence from age.
  Use the canonical derived trust contract or a justified conservative schema-compatible
  synthetic value. Preserve deterministic per-place PRNG, one run timestamp,
  catalog/slugs/variants, consumer-primary ordering, the Spaghetti contract,
  freshness/availability timestamps, synthetic provenance, and Sample wording. Exclude
  `src/app/actions.ts`, `src/lib/trust.ts`, `src/db/seedContent.ts`, schemas, migrations,
  UI, and test paths. One path-scoped local commit is required before independent
  static/data-trust refutation. No seed/reseed, connected DB, destructive refresh, push,
  or deployment is authorized; stale-comment cleanup remains separately unclaimed and
  blocked where Contribution retains `actions.ts`.
- H27 evidence reconciliation does not invent a second result for `32b15ae`. That commit
  and its independent PASS close the deterministic catalog/seed-generation scope over
  `src/db/seed.ts` and `src/db/seedContent.ts`; current `src/db/seed.ts` still contains the
  hardcoded freshness-to-trust assignment. The attempted new H27 employee handoff found no
  live worker and produced no edit or commit, so `src/db/seed.ts` is released/unclaimed and
  H27 remains open. No seed execution, connected DB, push, or deployment occurred.
- Foundation commit `1d0515583418acf91469c00b57c25b2a2fcc1118` is independently
  **REFUTED** with no P1 and one P2. Exact five-path scope and a clean worktree were
  confirmed. In `src/app/globals.css`, forced-colours globally sets `.solid-icon` to
  `CanvasText`, overriding an interactive parent's inherited system colour and risking
  selected/button contrast. The bounded forward lane owns only `src/app/globals.css` and
  `scripts/iconography-contracts.test.ts`: inherit parent colour and make the contract
  prohibit glyph-level forced-colour ownership; licensing provenance cannot be proven by
  a self-attesting comment regex. Iconography & Visual Systems Lead remains owner and the
  same independent visual/accessibility refuter must re-refute the forward commit. Sheet
  Adoption, Market Details, and Map Symbols remain closed. No push/deploy.
- Contribution Integrity & Moderation Engineer task
  `019f75a3-f50d-7180-8e92-0a7aabd8a98c` completed exact five-path containment at
  `495750aaa0730dcd35b4e7a6dbeba24caef1caf3` over `src/app/actions.ts`,
  `src/app/page.tsx`,
  `src/app/_components/ReportPriceSheet.tsx`,
  `src/app/_components/ConfirmVisitSheet.tsx`, and `src/core/i18n/strings.ts`.
  Independent static/source refutation returned STATIC_PASS with no P1/P2/P3. Both actions
  reject as the first statement; no client enqueue/drain/retry/delete paths remain; both
  sheets remain reachable but disabled; maintenance copy is untranslated; and no success,
  saved, queued, or will-sync promise remains. HI Quality runtime refutation **REFUTED**
  the candidate solely because focus escapes to the background Map when all sheet controls
  are disabled. UI safety/readability, disabled controls, and no-promise copy passed;
  storage/network/visit residuals remain unproven. Retain all five paths pending shared-
  modal diagnosis and a new reused-tab verdict. Schema, migration, `0013`, and full
  moderation work remain excluded. The completed `0013+` planning packet enumerates
  ADR-019, schema/migration/manifest, app/ops paths, and dependencies, but grants no claim
  or implementation authority. Do not activate it until containment runtime evidence and
  Presence/shared-migration gates pass, followed by a fresh exact exclusive handoff. No
  tests, DB, push, or deploy is authorized.
- Shared `ModalSheet` focus hardening completed at `3e28c63` and independent refutation
  returned **NOT REFUTED**. Shared `isEnabledVisible` is used by initial focus and Tab
  trapping, covering native/ARIA disabled, hidden, disabled fieldsets, inert/ARIA-hidden,
  absent layout, and computed display/visibility. Panel fallback, Escape, trapping,
  nesting, restoration, animations, and reduced motion are preserved.
  `src/design-system/components/ModalSheet.tsx` is released. Browser/runtime focus,
  `visibility:collapse`, and restoration when the prior target becomes hidden remain
  unproven. Contribution retains its separate five paths; no push or deploy is authorized.
- H38 offline search assessment is complete, but correction remains pathless and blocked
  while Contribution exclusively owns `src/app/page.tsx`. Catastrophic error-boundary
  escape is refuted in the current tree: search rejection is caught and `AsyncList`
  receives an error prop. The confirmed residual is only that the search catch clears
  prior trustworthy rows and no `onRetry` is supplied. The smallest future one-file patch
  adds retry-token state, removes the clear, adds the dependency token and `onRetry`
  callback, and preserves cancellation/finally. Browser-refuter criteria are ready; no
  edits or tests occurred, and a separate exact claim is required after `page.tsx`
  releases.
- Security & Privacy Engineering Lead task
  `019f75e5-8c04-74c0-9392-d9f741a7a131` completed the H6 CSP architecture assessment
  read-only/pathless. P0 findings: leaving static `vercel.json` CSP beside future
  middleware creates two intersecting enforcing policies; all three raw layout scripts and
  the parser-inserted Mapbox script require nonce; and Next 15.5.20 requires the same
  policy on cloned request headers and response, so `x-nonce` alone is insufficient.
  Future governance paths are
  `docs/adr/020-per-request-nonce-content-security-policy.md`, `DECISIONS.md`,
  `WETINDEY_BIBLE.md`, and `docs/architecture/SERVICE-ARCHITECTURE.md`. Only after ADR
  acceptance may a fresh exact implementation handoff claim `src/middleware.ts`,
  `src/app/layout.tsx`, `vercel.json`, and the conditional SEO/error/route/service-worker/
  report-endpoint call sites. Dynamic/no-store HTML, environment-specific policies, Blob
  CSP, and report-only rollout remain P1/P2 dependencies. The assessment claims no path,
  authorizes no implementation, and involved no edits, tests, browser, or DB access.
- The H6 ADR-020 governance handoff to Product & Data Governance Architect
  `019f7599-0eaa-7423-9ebf-a1bfea8efe37` became stale: repeated finish prompts produced no
  file-change or commit evidence. That employee is retired from this claim, which is
  recovered without widening and reassigned to H6 ADR-020 Governance Worker
  `/root/h6_adr020_governance`. The replacement exclusively owns
  `docs/adr/020-per-request-nonce-content-security-policy.md`, `DECISIONS.md`,
  `WETINDEY_BIBLE.md`, and `docs/architecture/SERVICE-ARCHITECTURE.md`. Security & Privacy
  Engineering Lead `019f75e5-8c04-74c0-9392-d9f741a7a131` is the independent refuter.
  Acceptance requires one enforcing nonce policy; later same-change removal of the static
  Vercel CSP; nonce coverage for all three raw layout scripts and the parser-inserted
  Mapbox script; the identical Next 15.5.20 policy on cloned request headers and response;
  explicit dynamic/no-store, environment-specific, Blob CSP, and report-only consequences;
  and exact boundaries for the later code handoff. Require one path-scoped docs commit and
  independent source refutation with no P1/P2. This lane authorizes no code, test, build,
  browser, DB, push, or deploy.
- Exact H6 governance commit `14aff35fa98728c4d2c22e61e773254d42186db7`
  changes only the four claimed documents. Independent refutation remains pending: the
  named Security & Privacy refuter `019f75e5-8c04-74c0-9392-d9f741a7a131` returned no
  verdict after repeated bounded prompts and is stale for this checkpoint. The same
  first replacement `/root/h6_adr020_refuter` inherited the wrong controller prompt,
  produced no task output, and is retired as an assignment-wiring failure. A fresh refuter
  `/root/h6_adr020_security_refuter` was created with no inherited turns and only the exact
  commit/four-file checklist; it must default to REFUTED when evidence is thin. Retain all
  four governance paths. Do not close H6 or open `src/middleware.ts`,
  `src/app/layout.tsx`, `vercel.json`, or any dependent implementation lane before a
  no-P1/P2 verdict covering the full acceptance contract.
- H6 governance is now complete for exact commits
  `14aff35fa98728c4d2c22e61e773254d42186db7` and
  `6c74c147678eefbda8e5b5030c0ab51c13a6a952`. Independent refuter
  `019f7692-d254-7e43-a687-154876274927` returned **NOT REFUTED** with no P1/P2/P3.
  The forward one-file correction explicitly rejects `x-nonce` alone and requires cloned
  request headers containing raw `x-nonce` plus the exact nonce-bearing CSP, explicit
  `NextResponse.next({request:{headers}})`, and a byte-identical response CSP. The four
  governance paths are released. This closes architecture evidence only and authorizes no
  implementation, Preview/Production enforcement, push, or deployment.
- H6 nonce-CSP implementation is **BLOCKED before edit**, not active readiness. Owner
  `/root/h6_nonce_implementation` retains exactly new `src/middleware.ts`, existing
  `src/app/layout.tsx`, and `vercel.json`, and has stopped with zero code changes.
  Repository-visible Blob evidence is limited to wildcard
  `*.public.blob.vercel-storage.com` plus the runtime `blob.url`; no non-secret file
  records the exact per-store avatar hostname, and ADR-020 forbids guessing or admitting
  the wildcard. The repository also contains no CSP reporting endpoint/header, collector
  implementation, or approved Preview redaction/access/retention contract. Therefore
  Preview report-only, Preview/Production enforcement, and static-CSP removal remain
  prohibited. If those gates are later satisfied, acceptance still requires one canonical
  per-request policy, raw nonce plus exact CSP on cloned request headers, identical
  response CSP, nonce coverage for all three raw layout scripts and the Mapbox script,
  preservation of every non-CSP Vercel header, private/no-store and environment
  contracts, and no product/layout redesign or second enforcement boundary. Independent
  refuter after any future commit remains `019f7692-d254-7e43-a687-154876274927`.
- Account deletion completion is not supported by repository evidence. All visible refs,
  `git log --all`, reflog, and inspected unreachable commit subjects reveal no deletion
  implementation; current and reachable source/history contain no `deleteUser` or
  `deleteAccount`. `src/app/_components/ProfileSheet.tsx` exposes Sign out only, while
  `src/core/i18n/strings.ts` says deletion and retention remain under review and directs
  account requests to support. Commit `708bc73` documents unresolved Neon provider
  capability; it is not implementation. No deletion test, destructive authenticated proof,
  counsel-approved retention/anonymisation matrix, or approval receipt is present. The old
  blocker remains; no completion is invented.
- Founder approval activates Seller Identity, reusable RBAC & Onboarding as architecture
  planning only, with seller onboarding as the first vertical. The reusable model must be
  deny-by-default and server-authorized for seller owner/manager/staff, moderator, field
  operator, support, and community roles with scoped permissions and audit. Identity
  verification, business verification, reputation, confidence, and rewards remain
  separate; suspension/revocation, appeals, and non-purchasable badges are mandatory.
  Seller updates do not automatically become trusted public observations. Auth/provider,
  RLS/schema, legal/privacy, moderation, Trust Graph, exact paths, and independent
  refutation remain gates; no implementation or deployment authority follows.
- H37 place iconography is complete at `6611068`, and current HEAD corrects a stale final
  audit description: `MapboxCanvas` forwards `candidate.placeType`, `MapMarkerOptions`
  declares `placeType`, and the adapter selects semantic place symbols. Those two
  implementation paths remain released. The confirmed user-visible gap is peer presence,
  because `src/app/page.tsx` passes `sharedUsers={[]}`. The self marker is a precise or
  approximate position marker only; unsigned fallback is a generic position marker, and
  neither has a self-avatar contract. Self-avatar/profile work remains a separate pathless
  location/profile lane. Peer presence requires a future exact adapter/canvas/page plus
  presence-data/schema/action handoff and remains gated by ADR-016 runtime and pilot evidence,
  privacy, consent, leases, rate controls, block/report, and kill-switch evidence. No path
  is claimed; no edit, browser, DB, push, or deployment is authorized.
- Preview and Production identity, exact `0000`-`0014` ledger, and shared
  schema/RPC/RLS/grant fingerprint are independently proved. This closes migration state
  only; deployment ordering and product activation remain separately unauthorized.
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
- Sol Lane A committed
  `33104017380fd57b1e03132fd334482dcf26cf07` over its exact policy/runbook paths. Luna
  independently matched the original 5,294,517-byte package and SHA-256
  `2d46ff90f87c7bfe75cc3df30ae35cc10a9641971543243e9d885aa7a97ca466`; exact scope,
  historical hashes, time/geography/unit/availability/attribution, no-Sample, and no-live
  rules passed with no P1/P2. P3 only: intentional Markdown hard-break whitespace. Lane A
  paths are released. Luna **REFUTED** Terra Lane B commit `e49782b` with no P1 and three
  blocking P2s: the recurring-fetch timestamp is falsely historical, the development
  fixture validator does not read candidate artifacts, and the historical validator
  default/contract regressed. P3: the fingerprint/ID relationship is unenforced. Luna
  verified the source facts, package hash/size, grounded Lagos rows, and absence of Sample
  or live effect. Terra committed forward correction `6ae4df9` over the same ten paths
  with implementing static PASS. Its four contracts are: current recurring-fetch
  timestamp; development fixture validator reads candidate artifacts; historical validator
  default/contract restored; and fingerprint/ID relationship enforced. Luna's repeat verdict
  closed the prior three P2s and P3 but **REFUTED** one remaining P2: `Date.parse +
  endsWith('Z')` accepted calendar-invalid and noncanonical timestamps. Terra committed the
  narrow one-file correction `449cb82` in
  `scripts/ingestion/fetch-nbs-selected-food-price-watch.ts`; independent implementing
  static refutation passed. Luna now rechecks exact candidate
  `e49782b + 6ae4df9 + 449cb82`. Luna returned final **PASS** with no P1/P2/P3.
  Strict canonical injected retrieval timestamp, full candidate validation, restored
  historical/default CLI behavior, and fingerprint/ID enforcement all passed. All ten
  Lane B implementation paths are released. Standing recurring retrieval/review
  authorization remains, but artifacts are review/development-only: no shared `0010`,
  seed, publication/promotion, push, or deployment occurred or is authorized.
- Decision: **NO PUSH / NO DEPLOY**. This documentation checkpoint authorizes no test,
  push, deployment, migration, seed, shared-database access, or external change.

## Bootstrap reconciliation: 2026-07-18

## Checkpoint artifact `RC-2026-07-18-138`

**Controller:** orchestrator, exact ownership `LANES.md` and
`docs/architecture/RELEASE-CONTROLLER.md`
**Candidate:** local `main` at `89482fb`; `origin/main` at `b89ebba`; clean, 138 commits
ahead.
**Prior-controller recovery:** the previously reported draft was not present as a
recoverable commit object in the current repository. This entry is the authoritative
checkpoint and does not claim that draft hash.

### Release decision

**NO PUSH / NO DEPLOY.** The 138-commit range is not a release unit. It mixes protected
`0009`/`0010`/`0011` migration lineage, nearby presence work, CSP governance, application
changes, and documentation. Preview schema/ledger drift is known and Production remains
unknown. A clean worktree and disposable validation do not prove shared-target compatibility
or deployment ordering. No shared migration, seed, deployment, history rewrite, or push is
authorized.

### Evidence and next lane

- Iconography correction `89482fb` is independently **NOT REFUTED** only for its narrow
  forced-colors inheritance scope. It does not close the broader foundation findings:
  translucent semantic fills, unrestricted caller glyph styling, and incomplete exact
  size/token contract coverage.
- The next bounded lane is **Search execution proof**, owned by Search & Ranking as a
  read-only evidence task over the already-corrected `c6f304b` behavior. It may inspect
  and execute only against a uniquely disposable database at the exact candidate; it may
  not edit `src/app/actions.ts`, change schema/migrations, or access a shared database.
- Acceptance requires the corrected fallback-unit SQL to execute against the declared
  schema, preserve the server-derived trust/provenance contract, and receive an
  independent refutation. No implementation lane is reopened until that evidence is
  returned.

### Search proof result and forward routing

Search & Ranking returned **BLOCKED** without database access. Current source is statically
aligned, but the only available credential is an ambient non-disposable Neon URL. No record
authorizes a uniquely named disposable database/project/branch, expected database and role,
fixture, parent fingerprint, or destruction authority. The ambient URL is inadmissible.
Search execution proof remains an explicit external-target gate and claims no code path.

This blocker does not prevent disjoint local UI work. The next active lane is the exact
five-path **Semantic iconography foundation forward correction** recorded in `LANES.md`.
Market Details and every adoption lane remain closed until that foundation receives an
independent no-P1/P2 verdict. No query, action, database, map, shared-target, push, or
deployment change is authorized.

### Controller scheduling correction

The repeating `wetindey-orchestrator-recovery` automation was deleted after generating
multiple task runs and an extra controller task. Its generated runs and controller clone
were archived. Controller work now remains in the primary orchestrator thread only. The
Portfolio auditor and Lagos Food ingestion schedules keep their separate bounded purposes
and may not receive release-controller assignments or create controller clones.


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


## Active-lane registry and archive reconciliation

Before promoting a candidate, the controller reads root `LANES.md` as the required authoritative human coordination claim/index for current edits and gates. It remains advisory to Git, filesystem, runtime, and platform enforcement rather than a technically enforced lock. When a candidate or handoff refers to completed work, the controller also verifies the cited current-cycle archive record locator, source snapshot commit, and extracted SHA-256. An archive record is historical evidence only; it cannot retain, release, or create a current human claim. A mismatch between root, archive, candidate tuple, or external-state evidence is `REFUTED`.
