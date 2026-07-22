# WetinDey Active Lanes and Gates

**Purpose.** This root file is the repository's required authoritative human coordination claim/index for current edits. Agents must consult and claim it before editing. It is advisory to Git, the filesystem, runtime, and platform enforcement: it is not a technically enforced lock. It records current exclusive human path claims and live pathless blockers and queues. A historical archive, department worklog, handoff packet, commit, or employee seat never grants a current claim.

**Reading order.** Read current root `LANES.md` before editing. For completed evidence and branch reconstruction, use [the current-cycle lane history index](docs/operations/lanes/history/README.md) and the [legacy historical archive](docs/operations/lanes/LANES-HISTORICAL-ARCHIVE.md).

**Last updated:** 2026-07-21

## Current controller and release policy

Controller owner: current orchestrator, over exactly `LANES.md` and `docs/architecture/RELEASE-CONTROLLER.md`. Path-scoped pushes require independently refuted, exact-scope commits. A push is not deployment proof. Shared-database work remains fail-closed on exact target identity, ledger/schema/role compatibility, backup, scheduler/default-off controls, and independent operational refutation. No history rewrite, shared seed, guessed target identity, or migration workaround is authorized.

The currently recorded controller evidence is indexed in [2026-07 release and governance history](docs/operations/lanes/history/2026-07-release-and-governance.md).

**Push authorization of record (controller, 2026-07-22, from the Founder's own words).** The Founder's standing instruction ("handle git, check for good checkpoints and push"), the active controller brief ("Commit those exact paths... Push main immediately"; operating rule "Commit and push proven checkpoints promptly"), and the corrected governance rule ("an explicit owner instruction to push authorises pushing; push the checkpoints is not push the irreversible") together authorize pushing PROVEN, PATH-SCOPED, REVERSIBLE checkpoints to main, including routed documentation and conformance fixes that change no runtime behavior. This authorization does NOT cover the irreversible: shared-database migrations or writes, activation or control-flag flips, account or data deletion, Preview or Production mutation, or anything a revert cannot undo; those remain separately and explicitly gated. Seats holding refuted local checkpoints under this class (for example the Maps worklog plural conformance at `c0e729d`) may push per this record.

## Persistent employee roster

### Pinned persistent employee roster

Pinned employee tasks are durable department seats, not active path claims and not cleanup
candidates. They remain pinned and idle between bounded controller assignments. A seat may
edit only after this file records an exact non-overlapping lane; completion returns the seat
to idle rather than creating a replacement task.

| Pinned employee | Current state | Next bounded deliverable |
|---|---|---|
| Nearby Presence Platform Engineer | Production `0012` operational PASS; exact source paths released | Ledger/fingerprint/idempotence, least-privilege scheduler, cleanup/retention, default-off containment, and independent operational refutation passed; remain persistent for a later bounded assignment |
| Program Management & Functional Organization Lead | Idle | Reconcile portfolio proposals into CEO-reviewable lane candidates without editing product paths |
| Contribution Integrity & Moderation Engineer `019f75a3-f50d-7180-8e92-0a7aabd8a98c` | `0013` operational activation COMPLETE / PASS, default-off; all paths released | Preview `dpl_2UC8gEPJ4V5sZvRd4M74fMoqFvBm` and Production `dpl_8fZpUNgRi3zebGqy75DGt9qAQ4Kq` passed identity, ledger/schema/RPC/grants, smoke, rollback, and independent refutation; admission/reporting/moderation remain false |
| Human Interface Design Engineer `019f75a5-0fc6-7f40-9a0f-8097ead3b45d` | Market source paths released; runtime residual pathless | `14ece5b`/`4b56d95` released `src/app/page.tsx` and `src/design-system/components/PlaceOfferRow.tsx`; regular runtime and compact AX passed, while compact visible pixels remain unverified; no source reopen without fresh product evidence |
| HI Quality & Regression Lead | Two-document acceptance governance COMPLETE / PASS; paths released | `d263fba` reconciles source-complete facts, runtime-unverified residuals, and bounded future ownership without reopening Maps, Presence, or ADR-locked paths |
| Food Evidence Provenance & Source Governance Lead | Standing review authorization | Classify recurring NBS/current Food evidence; no live promotion or shared migration |
| Development Food Evidence Fixture Engineer | Idle | Append-only development evidence fixture after exact artifact-path claim; never mutate recurring seed data |
| Food Source Authenticity & Attribution Refuter | Idle refuter | Independently verify each staged source artifact against original evidence and terms |
| Search & Ranking Engineer | Available, no active claim | The deployed-current-main `97b74af` disposable SQL evidence gate passed and is released; remain persistent for the next bounded Search/Ranking assignment |
| Iconography & Visual Systems Lead | Iconography source lanes complete / released | `9b74a31`, `ed5a6cb`, `a2a7104`, `b93761b`, and `ae47513` are current-main ancestors; foundation, intent adoption, Report Price, and Confirm Visit source paths are released |
| Maps & Location Experience | No active path claim; source corrections released; runtime evidence required before reopening | `b1901fb`/`350cb7f` and `dae6786`/`d1f87d0` are released; any new Map claim requires fresh concrete runtime evidence and an exact manifest |
| Client Reliability & Offline Engineer `019f75d3-65d0-7033-bef7-11a83aca9723` | Bootstrap visibility complete / released with Production PASS | `d42454b` passed prompt initial shell on `dpl_Dat5W4KZz6wNYb37jcCq1DKjyKrY`; `ThemeContext.tsx` released |
| Security & Privacy Engineering Lead | Production DB-target proof closed | Exact HMAC match is recorded; `168039f` removed every temporary proof claim. CSP collector source remains released and production CSP remains fail-open/report-only |
| Motion & Interaction Engineer `019f71ca-8646-7452-9171-439f5d78e71a` | Idle persistent seat; no path claim | H10 is complete/released at pushed `091fe8e`; the obsolete Frameworks replacement task is not a current owner |
| Quality & Release Controller | Idle persistent release employee | Q1 gate passed independently at pushed `569b1bb`; its script is released. Thread `019f7865-c497-71a3-89a2-4effd79b557b` remains available and must not be archived |
| Product & Data Governance Architect `019f7599-0eaa-7423-9ebf-a1bfea8efe37` | Community Trust governance complete / released | `170de61` is on current main; remain persistent for later bounded governance or independent review assignments |
| Developer Relations & Engineering Enablement `019f7995-5b7b-7ee1-81ef-2c3a3c57b836` | Department worklog protocol complete / released | `62880ac` and fail-closed repair `2523da1` are on current main; remain persistent for later bounded enablement assignments |
| Catalog Stewardship `019f7999-37d0-7231-8b89-0e71c2569ce2` | Catalog workflow complete / released; employee idle | `8a072e2`/`7b42664` and `fe09dc3` resolved the safety-scope and no-match/transport corrections; no active path claim remains |
| Private Contractor, Full-Stack Delivery `ef98946c-a55e-4700-aa6e-c1a840e42eef` | Seated by Founder instruction 2026-07-21; first lane (account deletion) RELEASED, blocked by ADR-021, request to controller recorded in Active locks; now discovering the next ADR-clear lane | Method: multi-agent orchestration ending in default-to-REFUTED independent refutation, and ADR-clearance proven before any claim (the deletion lane taught this). Not building on stale memory: a discovery workflow reads the ADRs, this registry, and the gate states to find genuinely open, ADR-clear, unclaimed, high-value work, then executes only on affirmative clearance |
| Private Contractor, Maps Delivery `c9c17443-ef5e-4a7b-9b6e-c8f5381da30c` | Nine lanes complete / released; Lane B of the richness pass pending an owner semantics call | `f307cef` light ground warmth shipped; queued: routeTint spine slice and commercial-district wash (Lane B), Safari or iOS capture drive (owner tooling), Presence Maps-side serialization when routed |



## Company activation map (controller, 2026-07-22, Founder-directed)

The Founder directed full-company activation: every department takes a lane of the Founder's plan, orchestrated by the controller through bounded Terra implementation and Luna default-to-refuted review. No Founder Approved decision is claimed for any wave-1 item: each is a bounded, reversible, controller/chief Discovery-authority step under the register's movement controls (accepted-ADR-directed groundwork, an internal read-only learning step, or a Proposed-ADR draft that authorizes nothing). Consequential product choices still return to the Founder. Wave 1 lanes are ACTIVE below; wave 2 is QUEUED and activates as wave 1 releases; external-gated items stay recorded, not waited on.

| Department / seat | Plan item | Lane state |
|---|---|---|
| Presence-Safety + Security-Privacy | ADR-021 P1 deletion saga (persistence + provider boundary, migration `0018` assigned) | ACTIVE wave 1 (App Store critical path) |
| Operations-Field-Data (Food Operations) | WD-I-002 coverage cockpit, smallest step: read-only daily coverage packet | ACTIVE wave 1 |
| Trust-Data-Governance | Evidence-media policy draft, proposed `ADR-028` (answers the open image-on-reports request) | ACTIVE wave 1 |
| Human-Interface + Executive-Product (Consumer App) | WD-I-001 one-tap outcome confirmation, smallest step: audit the live visit-confirmation flow and event semantics, no product change | QUEUED wave 2 |
| Trust-Data-Governance (Data/Truth Platform) | WD-I-005 coverage honesty, smallest step: define the coverage-state contract, no result-language change | QUEUED wave 2 |
| Catalog-Stewardship + Food Evidence Provenance | Standing review authorization: classify recurring NBS/current Food evidence, no live promotion | QUEUED wave 2 |
| Executive-Product | App Store distribution decision packet (PWA vs native wrapper) for Founder decision | QUEUED wave 2 |
| Contribution-Integrity | 0017 Preview apply + moderation lifecycle | EXTERNAL GATE: owner migration credential |
| Maps-Location | Safari/iOS capture drive; Presence integration serialization | EXTERNAL GATE: owner host tooling; 0014 gates |
| Community-Growth | WD-P-002 reviews/community | PARKED by register; no unparking without trigger |
| Legal-Policy, Client-Reliability, Quality-Release, DevRel, Program-Release | Standing refutation, release, worklog, and reconciliation duties on demand | STANDING |

### Founder decisions ON RECORD (decided, controller executing)

The Founder confirmed 2026-07-22 that a requested feature is itself the decision; nothing already asked for returns as pending. Recorded as decided, now under execution:

1. Contribution evidence-media (image CRUD, #25): ADR-028 ACCEPTED at the ADR (Founder words "it is already decided, I asked for it"). The image feature is a claimable, buildable lane, fail-closed behind moderation per ADR-019; the shared-database apply remains the only external gate (owner credential).
2. App Store distribution: DECIDED, stay PWA and build the app native-incorporation-ready (Capacitor-ready structure) without leaving the PWA. Under execution as the native-readiness lane; Apple 5.1.1(v) deletion is covered by the ADR-021 saga continuing to P2/P3.
3. One-tap outcome and contribution reactivation: PREPARE toward it. The only thing standing between prepared and live is the ADR-019 fail-closed activation, which is the shared-database owner credential, not a Founder decision.

The single real external key that unblocks activation of the prepared contribution, image, and deletion features is the shared-database migration-owner credential (0017 Preview, 0018, and any 0019). That is a missing key, not a decision; the controller prepares everything up to it.

#### ADR-021 P1 deletion saga: persistence and provider boundary (DELIVERED 4d7038c, wave 1)

DELIVERED and Luna-refuted-then-fixed: schema/migration/adapter/primitives landed on the 9-path set, tsc clean, deletion P1 contract 17/17, worklog contract still 5/5, `0018` candidate_unapplied with all authorization flags false, immutables 0000-0017 byte-frozen, no DB contacted. EXTERNAL EXIT GATE before any shared application: the disposable PGlite fresh-and-upgrade reconstruction proof (the contract ran static-only because `@electric-sql/pglite` is absent from this host; installing the disposable dep is an owner/host tooling step) plus P2 cleanup adapters. P1 owns no UI, Blob, Presence UI, or public action; no account is deletable from this code.



Owner: controller-directed Terra under Presence-Safety `019f759f-3521-7ee1-90a3-5af3539d757e` and Security-Privacy seats. Exact writable paths (widened 2026-07-22 after the scout proved the original six were ADR-014-noncompliant; the controller approved exactly this additive set, no silent widening): new `src/db/schema/deletion.ts` (Drizzle desired-state tables and enums, because ADR-014 forbids a pillar owning tables and hand-editing a snapshot), new `src/db/pillars/90-deletion-saga.sql` (roles/grants/RLS only, no tables), new `src/db/migrations/0018_deletion_saga_persistence.sql` (generated), new `src/db/migrations/meta/0018_snapshot.json` (generated), new `src/db/migrations/meta/0018_release_manifest.json` (records candidate_unapplied and all authorization flags false), `src/db/migrations/meta/_journal.json` (append 0018 only), one appended `export * from "./deletion"` line in `src/db/schema/index.ts`, new `src/lib/deletion/` (types, guards, inert adapter, compare-and-set phase and idempotency primitives), and new `scripts/deletion/deletion-saga-p1-contract.test.ts`. NO department worklog edit (protect the 5/5 contract). Contract: exactly ADR-021 P1 (deletion-request/phase/audit schema, server-only Neon branch administrative auth adapter with exact-target fail-closed guards, phase transition and idempotency worker primitives). P1 owns NO UI, Blob deletion, Presence UI, or public action; exit requires disposable PGlite fresh and upgrade migration proof and a pure-unit provider-capability fail-closed refutation WITHOUT any real destructive provider call or real account. NO shared-database apply: `0018` stays candidate_unapplied with all authorization flags false; immutables 0000-0017 stay byte-unchanged.

#### WD-I-002 coverage daily packet (DELIVERED 7833a11, wave 1)

Owner: controller-directed Terra under Operations-Field-Data. Exact writable paths: new `scripts/operations/coverage-daily-packet.mjs`, new `docs/operations/COVERAGE-PACKET.md`, and a `docs/operations/departments/operations-field-data.md` append entry. Contract: the register's smallest learning step only, a READ-ONLY daily packet from existing admissible observed data (ADR-012/014/015 boundaries: no synthetic or quarantined source counts as live coverage, no public operator data, no contributor traces, unknown stays unknown). SELECT-only against the live database; zero writes; no dashboard, no automation, no public output.

#### Evidence-media policy draft, proposed ADR-028 (DELIVERED 9c808f5, wave 1)

Owner: controller-directed Terra under Trust-Data-Governance `019f7599-0eaa-7423-9ebf-a1bfea8efe37`. Exact writable path: new `docs/adr/028-contribution-evidence-media.md` (Status: Proposed, decision owner Founder) plus a `docs/operations/departments/trust-data-governance.md` append entry. Contract: draft the retention, admission/moderation flow, privacy, Blob storage layout, and display gating for user photos on price reports, consistent with ADR-013/015/019 and the moderation pipeline; authorizes nothing by itself; closes the open REQUEST TO CONTROLLER on image-on-price-reports when the Founder accepts or rejects.

#### WD-I-001 one-tap outcome audit (DELIVERED cf9deb5, wave 2)

Owner: controller-directed Terra under Human-Interface and Executive-Product. Exact writable path: new `docs/operations/audits/one-tap-outcome-audit.md` only. Contract: the register's smallest step, a READ-ONLY audit of the existing visit-confirmation flow and its event/analytics semantics (no product, code, schema, or copy change). Map the current live path, the event model, the eligibility trigger, accessibility, and whether "was there" and "price matched" stay distinct facts, then record gaps against WD-I-001 guardrails (no continuous tracking, no incentive, no hidden identity linkage) for a Founder portfolio review. Authorizes no implementation.

#### App Store distribution decision packet (DELIVERED f808468, wave 2)

Owner: controller-directed Terra under Executive-Product. Exact writable path: new `docs/operations/decisions/app-store-distribution-packet.md` only. Contract: a Founder decision packet for issue #24 (WetinDey is a PWA; Apple cannot ingest a PWA). Lay out the real options (stay PWA, TWA/Play, a native wrapper such as Capacitor, or a thin native shell), each option's cost, review-guideline exposure (including Apple 5.1.1(v) in-app account deletion, which the ADR-021 saga is the groundwork for), maintenance, and pilot-phase fit, ending in a clear recommendation and the exact decision the Founder must make. Authorizes nothing; opens no lane.

## Wave 3 execution (prepare all features, remove all blockers)

Controller-directed Terra + Luna arms, each scout-confirms its exact paths and STOPS to the controller before crossing into another arm's area (no silent widening). Non-overlapping by construction.

- Blocker #22, dev LAN boot crash: `crypto.randomUUID` throws in a non-secure LAN context so the PWA cannot open on a phone. Arm area: the exact source that calls `crypto.randomUUID` at boot plus a safe fallback; no unrelated file.
- Blocker H40, search shows no price: the search read path in `src/app/actions.ts` returns results without a price. Arm area: that search action only.
- App Store native-readiness (decided: stay PWA, build native-incorporation-ready): a readiness assessment plus inert non-breaking scaffolding so a later Capacitor wrap is a small step. Arm area: new `docs/operations/decisions/native-readiness.md` and a new inert `capacitor.config.ts` only; no dependency install, no `next.config` change, the live PWA build must stay green.
- Feature #25 contribution evidence-media (ADR-028 Accepted): a full buildable lane, migration generated-not-applied, fail-closed behind moderation, default-off. Launches after H40 lands to avoid an actions collision; scout confirms the exact schema/adapter/server-action/UI/contract path set.

External key (not a decision): activating the prepared contribution, image, and deletion features needs the shared-database migration-owner credential (0017 Preview, 0018, 0019). The controller prepares everything up to it.

## Full Founder release program (all documented proposals and blockers unlocked)

Founder instruction 2026-07-22: release every documented proposal and unlock every blocked pathway into workflows; the proposals are the Founder's and are hereby lanes. The controller releases the whole register and blocker set to bounded Terra + Luna arms, each following the accepted ADRs (build safely, not skip safety), each path-scoped and independently refuted, migrations generated-not-applied and features default-off/fail-closed. The single remaining external key is the shared-database migration-owner credential; every buildable pathway is unlocked up to it.

| Register proposal / blocker | Release lane | State |
|---|---|---|
| WD-I-001 one-tap outcome (#audit cf9deb5) | prepare reactivation + one-tap ahead of ADR-019 activation | prepared; activation on the DB key |
| WD-I-002 coverage cockpit | packet delivered 7833a11; run is an operator step | delivered |
| WD-I-003 user-facing decision receipt | Discovery deliverable doc | batch 3 |
| WD-I-004 seller correction link | Discovery deliverable doc | batch 3 |
| WD-I-005 coverage honesty | user-facing coverage-state contract | batch 3 |
| WD-P-001 non-Food category launch | typed-capability second-vertical architecture doc | batch 3 |
| WD-P-002 contextual community (#26) | proposed ADR-030 contained community model (not a social feed) | batch 3 |
| #20 seller contact ownership | proposed ADR-029 (contact belongs to the seller, not the place) | batch 3 |
| #22 crypto.randomUUID LAN crash | code fix | batch 1 running |
| H40 search shows no price | code fix | batch 1 running |
| #24 App Store | native-readiness + deletion saga | batch 1 running + saga |
| #25 image evidence-media | full feature to ADR-028, generated-not-applied, default-off | batch 2 |
| #16 account deletion | saga P1 delivered 4d7038c; P2/P3 continue | batch 2 |

### Batch 3 release arms (design and ADR, disjoint new-file paths, ACTIVE)

Each is a controller-directed Terra draft + Luna default-to-refuted, editing ONLY its one or two new files, authorizing no shared-database mutation, consistent with the accepted ADRs. Exact new-file paths: `docs/adr/029-seller-contact-ownership.md`; `docs/adr/030-contextual-community.md`; `docs/operations/COVERAGE-HONESTY-CONTRACT.md` and `src/lib/coverage/coverage-state.ts`; `docs/operations/discovery/decision-receipt-discovery.md`; `docs/operations/discovery/seller-correction-link-discovery.md`; `docs/operations/decisions/second-vertical-architecture.md`.

## Active exact path locks

#### Maps light cartography warmth - RELEASED / PATHLESS

Complete at `f307cef`, pushed under the `0bbdb11` proven-reversible class after a NOT REFUTED verdict on all five claims: light land warmed to the sand family, water settled, park opacity ramp lifted, dark proven pixel-identical (0.00% diff), stock citations verified against the live style. The commercial-district area wash and the routeTint spine slice remain the Lane B candidates, pending an owner call on tint semantics. Path released.

#### Maps worklog action-noun conformance - RELEASED / PATHLESS

Complete at `2508af0`, pushed under the authorization of record `0bbdb11`: the routed Action-noun fix cascaded into four sibling asserts in entries 3 and 4 (Targets, resolution-action order, Action verb), all repaired in the same conformance class. The department worklog contract passes 5 of 5 for the first time. Path released.

#### Maps worklog plural conformance - RELEASED / PATHLESS

Complete at the pluralization commit: both Owned paths lines now match the contract template; the focused test's only remaining failure is contribution-integrity's, separately routed. The routed push was declined; push authority stays with the owner. Path released.

#### REQUEST TO CONTROLLER: status-chip media-scrim fill (PlaceOfferRow) - seat recommends NO-FILL

Forwarded for the controller's decision; the seat holds `PlaceOfferRow.tsx` scrim edits and does not pre-empt. The token lane `1704eda` deferred whether the two regular-layout status chips in `src/design-system/components/PlaceOfferRow.tsx` (~126, ~136) should take `bg-media-scrim/<alpha>` after the dead `bg-black/78` was swept.

Seat recommendation: no fill, on accessibility grounds. The `StatusBadge` chip already paints its own semantic tint (`bg-status-*-bg`, 14% opacity) under semantic ink (`-fg`) tuned to 4.5:1 on that tint per P0-6. `bg-media-scrim/80` is one background-color, so it replaces the 14% tint rather than layering over it, landing semantic ink on roughly 80% black. Light-mode inks fall below AA there: `caution-fg #a94c00` about 3.7:1, `confirmed-fg #1e7634` about 3.7:1, `unavailable-fg #be261b` about 3.5:1. The only dark-scrim pairing that passes is white text, exactly the `text-white` the Founder removed in `d2f557f` to preserve semantic ink. So the refuter's target (orange "Available", a `StatusBadge kind=confirmed|caution`) is the one chip where a scrim both fails AA and reverses a Founder decision. The underlying legibility concern is real and is pursued AA-safe under the HI claim below.

CONTROLLER RULING 2026-07-22: NO-FILL affirmed. The seat's AA computation stands and a media-scrim on the StatusBadge both fails the P0-6 4.5:1 floor for every light-mode semantic ink and reverses the Founder's `d2f557f` removal of `text-white`; the controller will not trade semantic ink or a Founder decision for a scrim. The legibility concern is routed correctly to the HI text-shadow claim below, which is cleared to proceed under its default-to-REFUTED light/dark and P0-6 contrast gate. Any heavier semantic-tint option needs a separate Iconography/token claim, not a scrim.

#### HI claim: AA-safe status-chip legibility over media (PlaceOfferRow) - SOURCE COMPLETE / REFUTER NOT REFUTED / PUSH HELD

- **Owner:** Human Interface Design Engineer `019f75a5-0fc6-7f40-9a0f-8097ead3b45d`. Opened per Founder instruction 2026-07-22; the fresh product evidence that lifts the prior "no reopen" hold is the refuter's over-photo legibility finding plus the AA computation above.
- **Exclusive path:** `src/design-system/components/PlaceOfferRow.tsx` only.
- **Contract:** improve the orange "Available" chip's legibility over busy photos in-file, preserving semantic ink and the P0-6 4.5:1 floor. Primary lever is a stronger or layered `text-shadow` (it aids ink over varied photos without changing background-color or ink, so the measured contrast is unaffected). Optionally close the fallback `<span>` no-fill gap in the same file under the same gate.
- **Exclusions:** no `bg-media-scrim` and no black scrim on the `StatusBadge`; no `text-white`; no `StatusBadge.tsx` or `globals.css` token edits (a heavier semantic tint would need those, so route it as a separate Iconography/token claim); no other `PlaceOfferRow` behavior.
- **Gate:** independent light/dark and P0-6 contrast refutation, default-to-REFUTED, before release. No push.
- **Evidence:** source complete at `25054a9` (path-scoped, `PlaceOfferRow.tsx` only). Two-layer theme-aware `text-shadow`: white halo in light mode and a black halo via `dark:` for the semantic-ink `StatusBadge` (dark ink in light, bright ink in dark), and a stronger black shadow for the white-ink fallback `<span>`. Independent default-to-REFUTED refuter returned NOT REFUTED, no P1/P2, two P3 non-defects. It compiled the exact classes on the project Tailwind 3.4.19 and confirmed both rules emit with the `dark:` variant winning by `:is(.dark *)` specificity, verified ink direction per theme, confirmed background-color and ink are unchanged so the P0-6 measured contrast is bit-identical, and confirmed forced-colors and the light/dark sync path untouched. `typecheck` and `audit:tokens` are clean.
- **Push:** authorized by the controller under the authorization of record once the contrast refuter passes; held pending an owner light/dark visual glance, because a runtime screenshot was not captured in-session (a competing dev server would disrupt the active `:3000`, which already reflects the change via HMR). Path stays claimed until pushed or released.

#### Maps renderer-failure evidence entry — RELEASED / PATHLESS

Complete at `23b1aef` (tuple base `b0f78cd`, digest `02f1ca61…`, re-verified byte-exact after a HEAD-race restamp). Renderer-failure bridging is closed with reproduced evidence; the remaining Unknown is exactly `Safari and iOS capture behavior`, blocked on host tooling only the owner can enable (no iOS Simulator runtime installed; Safari remote automation disabled). Path released.

#### Contractor playbook amendment: handed incidents — RELEASED / PATHLESS

Complete at `aa29b91`: the eight incidents Full-Stack Delivery handed at `4a8db00` are incorporated into `docs/operations/CONTRACTOR-PLAYBOOK.md` with credit, every commit-referenced incident verified against its citation, independently refuted to NOT REFUTED after one blocking and four precision repairs. The contributor input itself had already been swept out of this registry by the playbook lane's own release burst `fbd3995`, unseen, when its heading-to-heading replacement swallowed the section 4a8db00 had appended; it was recovered from git history this cycle, which is why release bursts must diff their replacement span before committing. Path released.

#### Contractor workflow playbook — RELEASED / PATHLESS

Complete at `9c1db98`: `docs/operations/CONTRACTOR-PLAYBOOK.md` preserves the recorded multi-session loop as method-only memory, granting no authority. Independent refutation passed after two bounded repair rounds (six findings repaired, then two, then NOT REFUTED). Path released.

#### Food report pending-review experience — SOURCE PASS / RELEASED

Commit `e554efd` wires only the existing ADR-019 `report_price` admission path. The first
independent review found an in-flight dismissal duplicate-admission race, mismatched price
normalization, wrong status semantics, localization/spacing defects, and a regex-only
contract. The forward correction introduced an executable coordinator contract and the
delta refuter returned **PASS** with no scoped P1/P2/P3. All six source/test/worklog paths
are released. Runtime target activation remains blocked on the separately claimed review
operations vertical below; this source commit must not deploy alone as a false affordance.

#### Contribution control Neon endpoint guard — COMPLETE / RELEASED

- **Owner:** Executive controller; independent Security/Quality refuter required before apply.
- **Exclusive paths:** `scripts/contributions/contribution-moderator-control.ts` and
  `scripts/contributions/contribution-moderator-control-contract.test.ts` only.
- **Contract:** replace the unusable Neon proxy-IP equality with exact endpoint-id, project, branch,
  database, configured-host, and allowlist agreement. Keep every control command dry-run by default;
  do not assign a moderator or change reporting/moderation controls until the correction is refuted.

Complete at `4b93726`: exact target and immutable Neon identity settings, target-bound hashed actor
approvals, recursive no-`SET ROLE` membership closure, and one serializable pre-probe/mutation/post-probe
transaction passed focused contracts, exact-path lint, live Preview read-only proof, and independent
refutation. Paths released.

#### Contribution pending-queue row-shape repair `0017` — ACTIVE

- **Owner:** database service worker; independent Database/Quality refuter required before any apply.
- **Exclusive paths:** `src/db/pillars/80-contribution-services.sql`, new
  `src/db/migrations/0017_contribution_pending_queue_shape_repair.sql`, new
  `src/db/migrations/meta/0017_snapshot.json`, new
  `src/db/migrations/meta/0017_release_manifest.json`,
  `src/db/migrations/meta/_journal.json`, new
  `scripts/contributions/contribution-pending-queue-shape-repair-contract.test.ts`, and
  `docs/operations/departments/contribution-integrity.md` only.
- **Contract:** preserve immutable applied `0000`-`0016`. Repair only
  `public.contribution_pending_queue(uuid, integer)` so its two declared `text` columns explicitly
  return `availability_state::text` and `collection_method::text`; preserve signature, assignment
  enforcement, ordering, limits, admission/effective-decision predicates, ownership, ACLs, and all
  other service behavior. Prove blank/upgrade/idempotence/injected-failure rollback on PostgreSQL 17,
  then independently refute before exact-target Preview application. Production and report activation
  remain separately gated.

The exact seven-path candidate passes its five focused contracts, scoped diff hygiene, and independent
source refutation with no P1/P2/P3. The strengthened PostgreSQL 17 evidence bundle at
`/var/folders/n9/d2z6ybln5vb34xvzpqrwj4wr0000gn/T/wetindey-0017-runtime-1784717772800-508629ffd3`
passes blank `0000`-`0017`, staged `0000`-`0016` predecessor reproduction, real `0017` upgrade,
injected rollback, second Drizzle migration, manual idempotence, exact owner/ACL/baseline restoration,
and zero disposable-database residue; Luna's follow-up verdict is **PASS**. The lane stays claimed only
through commit and guarded exact-target Preview application. Production migration and report activation
remain separate later gates.

**Controller checkpoint 2026-07-22 (source landed; Preview execution is an EXTERNAL GATE).** The
source checkpoint is on `origin/main` at `f5e8318` and byte-verified: `0017` SQL sha256
`a864a63b…` matches the committed manifest, the focused contract is 5/5 PASS at HEAD, scoped diff is
clean, and immutable `0000`-`0016` are untouched. Read-only Preview identity was confirmed on the exact
target: `current_setting('neon.branch_id')` = `br-steep-dust-auhcmjk8`, PostgreSQL `170010`,
`rolsuper=false`. Preview APPLICATION cannot proceed from this controller seat: the only Preview
credentials handed to it are the runtime principals `wetindey_moderator_preview_login` and
`wetindey_control_preview_login`, both denied on `drizzle.__drizzle_migrations` and
`public.contribution_control` (SQLSTATE `42501`); `.env.local` resolves to the base branch, not Preview,
so it must not be used. Applying the guarded `0017` bytes requires the migration-owner DSN for
`br-steep-dust-auhcmjk8`, which was not provided. Per the fail-closed operating rules no target was
fabricated, derived, or substituted. External handoff: the owner-credentialed executor performs the
guarded apply and then the ledger-hash / owner-and-execute-ACL / ADMIN-only-baseline / no-residue /
moderator-queue-RPC verification and Luna exact-target refutation; contribution reporting and moderation
controls remain disabled throughout (their state is also unreadable from these principals). Not waiting
indefinitely; recorded and released to the external gate.

#### Contribution moderation service `0015` / ACL repair `0016` — PREVIEW APPLIED / SOURCE + RUNTIME PASS / RELEASED

Preview applied immutable `0015`, then direct ACL evidence proved its post-`RESET ROLE`
`REVOKE`/`GRANT` statements were no-ops: `PUBLIC` retained `EXECUTE` and the intended
moderator grant was absent. `0015` and its metadata are now read-only. The forward repair
owns exactly `src/db/pillars/90-contribution-security.sql`, new
`src/db/migrations/0016_contribution_review_acl_repair.sql`, new
`src/db/migrations/meta/0016_snapshot.json`, new
`src/db/migrations/meta/0016_release_manifest.json`,
`src/db/migrations/meta/_journal.json`, new
`scripts/contributions/contribution-moderation-acl-repair-contract.test.ts`, and
`docs/operations/departments/contribution-integrity.md`. It must repair the ACL while
`wetindey_contribution_owner` is the active role, leave only owner plus
`wetindey_contribution_moderator` execution, revoke all temporary membership/schema
capabilities, prove rollback/idempotence on PostgreSQL 17, and be independently refuted
before Preview revalidation. No Production migration or runtime enablement is authorized
by this claim.

Owner: database service worker. Add only the protected review-detail service needed for a
second moderator to inspect a decided claim and reverse it without broad table access.
Preserve immutable `0000`-`0014`; this is a forward release delta and matching desired-state
pillar repair. No app UI, environment, role login, shared-target migration, flag, deployment,
or report activation is authorized by this source lane.

Exact writable paths:

- `src/db/pillars/80-contribution-services.sql`
- `src/db/pillars/90-contribution-security.sql`
- new `src/db/migrations/0015_contribution_moderation_operations.sql`
- new `src/db/migrations/meta/0015_snapshot.json`
- new `src/db/migrations/meta/0015_release_manifest.json`
- `src/db/migrations/meta/_journal.json`
- new `scripts/contributions/contribution-moderation-migration-contract.test.ts`

The RPC must assert the authenticated assigned moderator and return only the claim/catalog
labels plus effective-decision fields required to review or reverse. It must exclude email,
contact, precise coordinates, source IDs, digests, network/risk signals, private notes, and
raw payload. Blank and `0000`-`0014` upgrades, rollback, idempotence, exact grants/RLS, and
independent default-to-REFUTED evidence are required before release.

#### Contribution moderation application — SOURCE PASS / RELEASED

Owner: application operations worker. Build the least-privileged, unlinked operator route
against the frozen `0015` RPC contract. It remains disabled before auth/pool/SQL unless the
exact release flag is present, derives actor identity only from Neon Auth, accepts only
finite reason codes and client UUID command identities, performs no automatic mutation
retry, and never returns private contributor or internal-risk material. This lane may not
use generic app-database access as a substitute for the moderation RPCs.

Exact writable paths:

- new `src/lib/contributions/moderation-runtime.ts`
- new `src/app/operations/contributions/actions.ts`
- new `src/app/operations/contributions/page.tsx`
- new `src/app/operations/contributions/_components/ModerationConsole.tsx`
- new `src/app/operations/contributions/_components/hooks/useModerationConsole.ts`
- new `src/app/operations/contributions/_components/views/ModerationConsoleView.tsx`
- new `src/app/operations/contributions/_components/copy/copy.ts`
- new `scripts/contributions/contribution-moderation-runtime-contract.test.ts`
- new `scripts/contributions/contribution-moderator-control.ts`
- new `scripts/contributions/contribution-moderator-control-contract.test.ts`
- `docs/operations/departments/contribution-integrity.md`

Acceptance includes disabled-before-effects ordering, exact RPC capability probes,
signed-out/ordinary/suspended/expired/self-review denials, queue/detail/approve/reject/
different-moderator reverse and audit states, stable same-intent command replay, conflict
containment, accessible empty/loading/forbidden/error states, noindex/no-store route behavior,
and an independently refuted exact-path candidate. Provider credentials, named assignments,
flags, Preview/Production activation, browser proof, migration, push, and deployment remain
separate operational gates.

#### Contribution moderation client/server boundary repair — SOURCE PASS / RELEASED

Owner: controller. The Production build exposed one bounded import-boundary defect: the
client moderation hook imported a value from the PostgreSQL-backed server runtime and
therefore pulled Node `pg` dependencies into the browser bundle. Move only shared DTOs and
finite reason-code constants into a client-safe contract, preserve all behavior, and add a
focused regression assertion that client code cannot import the server runtime.

Exact writable paths:

- `LANES.md`
- new `src/lib/contributions/moderation-contract.ts`
- `src/lib/contributions/moderation-runtime.ts`
- `src/app/operations/contributions/_components/ModerationConsole.tsx`
- `src/app/operations/contributions/_components/hooks/useModerationConsole.ts`
- `src/app/operations/contributions/_components/views/ModerationConsoleView.tsx`
- `scripts/contributions/contribution-moderation-runtime-contract.test.ts`
- `package.json`
- `package-lock.json`

No UI, copy, RPC, database, migration, environment, flag, provider, role, or moderation
semantics may change. The only dependency change allowed is the standard `server-only`
poison-package guard. Release requires the focused runtime contract, exact-path lint, a
Production build, independent default-to-REFUTED review, and a path-scoped forward commit.

Final evidence: the focused runtime contract and exact-path lint pass; the full Next
Production build compiles and generates all 117 routes without the prior `pg` browser
bundle; independent forward refutation returned PASS with no P1/P2/P3. Paths are released
upon the path-scoped commit.

#### Governance modularization — RELEASED / PATHLESS

The active serialized governance claim completed as one atomic path-scoped candidate. Independent final refutation returned **PASS**; its exact documentation and archive-split paths are released upon the atomic path-scoped commit. Root `LANES.md` remains the required human coordination index for future current claims, while the current-cycle archive preserves completed evidence without granting authority.

#### Account deletion vertical — RELEASED, BLOCKED BY ADR-021 / REQUEST TO CONTROLLER

Owner released: Private Contractor, Full-Stack Delivery `ef98946c-a55e-4700-aa6e-c1a840e42eef`. Both paths (`src/app/_actions/account-actions.ts`, `src/app/_components/manage-profile-sheet/**`) are released; no source is claimed. Nothing was committed. The synchronous action and enabled control I built are reverted from the tree, preserved only in this session's scratchpad.

Why released: I claimed this lane on stale memory and did not first check the ADRs. [ADR-021 Account deletion lifecycle](docs/adr/021-account-deletion-lifecycle.md) (Accepted, decision owner Founder) redesigned deletion after my original evidence and, at its "Truthful UI and completion" section, forbids exposing an enabled self-delete control until a full async saga exists. My build was a synchronous action with an enabled control; it also ran a raw `DELETE FROM neon_auth."user"` through the app database role, which ADR-021 specifically prohibits (auth deletion must go through Neon's server-only branch administrative capability, no database credential substituting). ADR outranks a task or lane, so I stopped rather than ship over it. The build agent flagged the same divergence.

REQUEST TO CONTROLLER / FOUNDER (a decision only they can make): account deletion is an App Store 5.1.1(v) submission requirement, but ADR-021 makes it a multi-phase saga (P1 persistence and a Neon branch-admin auth adapter, P2 cleanup adapters, P3 user flow), gated on Presence `0012` proof. This is a platform effort for the appropriate seat, not a contractor vertical. Options: (a) sequence ADR-021 P1/P2/P3 under a platform seat; (b) the Founder amends ADR-021 to permit a simpler pilot deletion, after which the reverted build is most of the way there but its raw-DELETE-via-app-role still needs the provider-boundary concern resolved. Governance note recorded during my schema mapping: our public identity tables carry no FK to `neon_auth`, and `presence_*`/`contribution_*` (measured empty, default-off) hold `account_id` columns, so whichever design ships must extend to those subsystems as they activate or it becomes an incomplete erasure.

#### Maps theme-transition continuity — RELEASED / PATHLESS

Complete at candidate `370cf07`: theme swaps hold the outgoing frame and cross-fade; the skeleton is suppressed only while bridged. Independent refutation passed (initial and delta). All three paths are released; the record is preserved at [2026-07-maps-experience-01](docs/operations/lanes/history/2026-07-maps-experience.md#2026-07-maps-experience-01). The release-critical Maps Adapter lane is closed, so the queued Presence integration serialization is no longer blocked by a Maps lock.

#### Root UI Component Decluttering — RELEASED / PATHLESS

Commit `699d1a5` moved the six remaining root UI components into the smallest live
controller, hook, view, and import slices, rewired all four caller seams, and updated five
focused UI contracts. Independent refutation first rejected an incomplete manifest, dead
copy/style/hook scaffolds, an unused PresentationHost prop, and an unrelated place-detail
layout change. The forward candidate removed the ceremonial layers, restored
`home-detail-bounded`, and then passed TypeScript plus iconography, liquid-glass,
live-sheet-inset, location-default, and motion contracts. The exact 39-path receipt is in
the Human Interface worklog. Browser rendering remains explicitly unverified because the
browser-control safety layer blocked the post-recovery action; no runtime success is
claimed. All Root UI paths and contract requests are released.

#### Public review privacy containment — RELEASED / PATHLESS

Commit `8f91169` is on `origin/main`; `src/app/_actions/review-actions.ts` is released and
owns no repository path. Independent refutation passed: the public DTO and SQL expose
neither stable reviewer identity nor Auth email, existing name/avatar display and
approved-only ordering remain intact, and review writes remain fail-closed with
`REVIEWS_UNAVAILABLE`. No schema, UI, moderation, aggregate, provider, database, or
deployment behavior was authorized or changed.

#### Profile sheet signed-out view extraction — RELEASED / PATHLESS

Commit `5155567` extracted the live signed-out OTP presentation into
`ProfileSignInView.tsx`; both application paths are released and own no repository path.
Independent refutation passed all idle, email, code, verified, stalled, retry, resend,
different-email, focus/ref, accessibility, style, spinner, handler, and auto-submit
equivalence checks. `ProfileSheetView.tsx` is 209 lines and `ProfileSignInView.tsx` is 166;
no Auth provider, state, effect, signed-in flow, UI design, database, or deployment behavior
changed.

#### Get-It reviews view extraction — RELEASED / PATHLESS

Commit `f777e6b` extracted the live review aggregate and reviews body into
`GetItReviewsView.tsx`; both application paths are released and own no repository path.
Independent refutation caught and then cleared an ordering regression: aggregate, Share,
directions, manual-copy, contact, and reviews now retain their exact prior order and
branches. `GetItSheetView.tsx` is 219 lines and `GetItReviewsView.tsx` is 136; no review
data, moderation, copy, visual, accessibility, contact, share, directions, write,
database, or deployment behavior changed.

#### Currency upstream provider extraction — RELEASED / PATHLESS

Commit `a214a7f` extracted Frankfurter/CBN transport, response validation, parsing, and
upstream fetch helpers into the directly imported server-only provider boundary at
`src/app/_actions/currency-provider.ts`. `src/app/_actions/currency-actions.ts` remains the
sole public action boundary and is below 300 lines. Independent default-to-REFUTED review
first caught a private exported-function return type and a missing type import; both were
corrected before the final PASS. Public exports and signatures, URLs and queries, 8/35-day
windows, one-hour revalidation, eight-second timeout, parsing, errors, fallback behavior,
and provider attribution remain unchanged. No UI, browser-cache, provider-network, database,
or deployment behavior changed. Both action paths are released.

#### Food trust query extraction — RELEASED / PATHLESS

Commit `93bba80` moved the private read-side trust key/types, normalization, fallback
mapping, key serialization, and unchanged batch SQL/query processing into the directly
imported server helper `src/app/_actions/food-trust.ts`. `food-actions.ts` retains the sole
`use server` boundary plus the public `getOfferTrustBatch` and `getOfferTrust` actions and
re-exported `OfferKey`/`ReadTrust` types. Independent default-to-REFUTED review returned PASS
with no P1/P2/P3: SQL eligibility, provenance, trust assessment, newest-observation ordering,
batching, empty/missing fallbacks, exports, signatures, and live callers remain equivalent.
No UI, schema, migration, provider, database, browser, or deployment behavior changed. Both
action paths are released.

#### Maps platform consolidation — RELEASED / PATHLESS

Commit `03adfad` extracted cartography and theme-snapshot helpers from the Mapbox adapter,
kept the thin `applyCartography()` compatibility wrapper, and removed only the dormant
ADR-016-prohibited contact-popup construction. Independent static refutation passed the
exact four-path candidate with no P1/P2/P3; TypeScript, exact-path lint,
`location-default-contract`, and diff checks passed. The worklog preserves the prior direct
Chromium theme-transition evidence without overstating it. Hardware-GPU Safari/iOS,
hidden-document, and forced-provider-failure behavior remain explicit runtime residuals;
the browser-control safety layer blocked the post-recovery action, so no new browser PASS is
claimed. All four paths are released.

#### Maps three-scope evidence entry — RELEASED / PATHLESS

Complete at `8fb9b02` (tuple base `8b1d7ca`, digest `21b35ad5…`, independently re-verified after a mid-refutation restamp). The first theme-transition entry's Unknown scope is closed to exactly: Safari and iOS capture behavior; renderer-failure bridging behavior. Path released.

#### REQUEST TO CONTROLLER: image-on-price-reports (#25) is evidence-media, gated by ADR-019 (OPEN)

From: Private Contractor, Full-Stack Delivery `ef98946c-a55e-4700-aa6e-c1a840e42eef`. The Founder asked for image upload on the price-report flow (task #25). On clearance review it is not a clean contractor lane: a photo attached to a price report is evidence-media, and [ADR-019](docs/adr/019-contribution-integrity-and-moderation.md) names "define evidence-media retention" in its Non-goals (it is explicitly undefined), while its Constrains require all report evidence to flow append-only through the moderation pipeline, which is default-off and owned by the Contribution Integrity & Moderation seat. So building the upload now would either bypass moderation (an ADR-019 violation) or reach into that gated subsystem. This is the same shape as #16 (deletion, ADR-021) and #24 (App Store native wrapper): the heavy features the Founder wants are gated on a policy decision, not on engineering.

Proposal (a contractor prepares the decision, does not pre-empt it): I can draft an evidence-media ADR covering retention, the moderation/admission flow for user photos, privacy (faces, plates, PII in a market photo), Blob storage layout, and display gating, for the Founder to accept or reject and for the Contribution Integrity seat to own the pipeline half. That converts #25 from blocked to buildable in one decision, with no code written ahead of policy. Awaiting the controller's direction: authorize the draft (and say whether it lands as a new ADR number the controller assigns), route #25 to the Contribution Integrity seat, or defer. I hold #25 until answered. My seat is otherwise free (decluttering released at `d3de9dc`); point me at a non-gated slice lane and I take it immediately.

#### Nearby Presence live-readiness audit and post-`0012` vertical — REFUTED / PATHLESS

Status: **REFUTED** live-readiness audit; queued and pathless post-`0012` vertical under
the persistent Nearby Presence Platform Engineer. Current truthful containment remains:
`page.tsx` hard-passes `sharedUsers=[]`; `getSharedUserLocations` returns `[]` with no
caller; Manage Profile says “Not available yet”; and the self avatar is wired but is not
reciprocal Presence. The dormant shared popup violates ADR-016 and must not be wired.

With `0012` and Contribution `0013` operationally passed/applied as recorded, and after Maps releases its locks, the atomic vertical
may request exact claims for new `src/app/presence-actions.ts`, new
`scripts/presence/presence-private-pilot-contract.test.ts`, new
`src/app/_components/NearbyPresenceControl.tsx`, and new
`src/app/_components/PresenceTapCard.tsx`; then later integration through
`src/app/page.tsx`, `src/design-system/components/MapboxCanvas.tsx`, and
`src/integrations/maps/MapboxAdapter.ts`; and copy through `src/core/i18n/strings.ts` and
`src/app/_components/ManageProfileSheet.tsx`. These are queued path sets, not current
claims. Scheduler paths are released. Never source Presence from browsing
`mapCenter`, `locationStore`, or a saved area—only fresh server-authorized foreground GPS
may supply it.


##### Presence `0014` shared-target migration — OPERATIONAL PASS / PATHLESS

Owner: Nearby Presence Platform Engineer `019f759f-3521-7ee1-90a3-5af3539d757e`. This gate owns no repository path and authorizes no UI, peer visibility, flag enablement, or public rollout.

Atomic reconciliation commit `55fb0d8` is on `origin/main`; its exact 16-path scope is
released and owns no repository path. Independent static and operational refutation remain
**PASS**. This release removes the former overlap with the controller's exact two-path
claim and does not weaken the separate runtime, private-pilot, privacy, safety, lifecycle,
or product NO-GO.

Current proven Preview facts: persistent Neon branch `preview/wetindey-presence` (`br-steep-dust-auhcmjk8`) exists; its pooled and unpooled endpoints directly connected; Vercel Preview database aliases plus the contribution and Presence safety URLs were overridden; Production variables were untouched; and Preview deployment `dpl_HVgUnhDSmdhDw7fSCnTuPk8iGCyY` built `READY`. No Vercel CLI command is represented as disclosing sensitive runtime values.

Independent operational evidence proves exact `0000`-`0014` ledger/hash/result equivalence
on Production `main` (`br-flat-band-aui9waf5`) and Preview
`preview/wetindey-presence` (`br-steep-dust-auhcmjk8`) in Neon project
`wild-rain-23091788`, database `neondb`, role `neondb_owner`. Both targets match fingerprint
`a0126839bc0671fff9b9ad3bc4954e3dfb2286fccdbb352651a199f74b23ab03`; controls remain
default off, the allowlist and active Presence state are empty, and transient owner
privileges are absent. Preview physical inheritance is independently supported by parent
LSN `0/7368FF50`, `xmin` `228412`, and relfilenode `368692`.

The migration is complete and duplicate execution is forbidden. This PASS grants no
runtime flag, allowlist population, peer visibility, private pilot, privacy/safety/legal
approval, deployment, or public rollout. Those remain separate fail-closed gates below.

##### Private-pilot manifest convergence — QUEUED, NOT ACTIVE

Readiness remains **EVIDENCE-REFUTED**. Frozen `0012` exposes stable
`subject_account_id`, `subject_lease_id`, and `wave_id`, but no opaque capability table;
activation/report lack idempotency; the block-versus-Wave safety race is unproved; a stable
profile avatar URL is unsuitable; and app/account-deletion wiring is absent. The `0014`
source correction exists on current main and both `0012` and Contribution `0013` are operationally passed/applied as recorded, but
no Presence UI or code claim may activate merely because the shared-target `0014` migration
passed. Runtime, private-pilot, privacy, safety, lifecycle, and product evidence remain
separately gated.

The four new files are not independently activatable: without a live caller they would
violate the repository's no-dead-service/component rule. The Platform manifest must choose
either (A) a truthful live opt-in vertical wired through an existing Profile entry in the
same commit, with no peer-visibility claim, or (preferably) (B) the complete live path
through page/Canvas/Adapter plus Profile/copy after the map incident releases. Every new
action and component must have its live caller in the same change.

Human Interface, Motion, and Quality & Release independently converge on the same atomic
first vertical. Do not activate it until the Nearby Presence Platform, Security & Privacy,
and Client Reliability manifests agree and the release-critical Maps Adapter lane closes.
The candidate first claim is exactly:

- new `src/app/presence-actions.ts`
- new `src/app/_components/NearbyPresenceControl.tsx`
- new `src/app/_components/PresenceTapCard.tsx`
- new `scripts/presence/presence-private-pilot-contract.test.ts`

The later integration remains separately serialized over `src/app/page.tsx`,
`src/design-system/components/MapboxCanvas.tsx`, and
`src/integrations/maps/MapboxAdapter.ts`; copy/profile changes remain later over
`src/core/i18n/strings.ts` and `src/app/_components/ManageProfileSheet.tsx`. The card must
use `ModalSheet`, never the dormant Mapbox Popup, and expose exactly Wave, Block, Report, and
Close. It must not expose contact, stable identifiers, or coordinates. QE's P-01..P-27
fail-closed evidence manifest is a required gate, not runtime proof. These are prepared
paths only; no Presence source claim is active until the three remaining manifests and the
Maps Adapter release are recorded.



## Queued, non-authorizing candidate lanes

### Developer Relations worklog-contract reconciliation (COMPLETE, 5/5 GREEN at `446da3d`)

CHAIN CLOSED 2026-07-22: DevRel `c5c2ef0`, Maps plural `c0e729d`, Contribution Integrity conformance `d3ab340`, Maps action-field conformance `2508af0`; controller independently verified tests 5 pass 5 fail 0 at origin `446da3d`, the first green since the governance split. No further work in this record; residual wording reconciliations (the validator's pending-word rule vs two LANES headings) stay queued as a later bounded call.

The DevRel-seat reconciliation landed at `c5c2ef0`, independently refuted on its bytes: the contract now verifies the truthful released state (active heading absent, released record present, exact owner retained), no other assertion weakened, digest rotated to `WD-DEVREL-WORKLOG-20260722-DIGEST4` (base `d6357a5f`, digest `435a9b4a…`) with DIGEST3 pinned as superseded. The focused test remains 4/5 on main because advancing past the stale assertion unmasked two pre-existing committed conformance defects it had been hiding, both outside the DevRel lane and now ROUTED to their seats: (1) Maps & Location seat: `docs/operations/departments/maps-location.md` lines 208 and 278 read "Exactly the 1 path" where contract line 217 requires the literal plural "Exactly the 1 paths"; two-word fix, no digest coupling. (2) Contribution Integrity seat: DELIVERED at `d3ab340`, Luna NOT REFUTED, history byte-preserved, all reconstructed digests recomputed with the contract's own algorithm. Third unmasked residual, routed to the Maps seat: `maps-location.md` entry 3 Action fails the contract noun rule; the minimal reword (add the word evidence) reaches 5/5. Validator residual recorded: the word pending in two exact LANES headings is forbidden by concreteValue(), so worklog Lane heading fields carry substitutes with heading-of-record notes; reconciling that wording is a later bounded call, not a blocker.

### Incremental live-app modularization — QUEUED / PATHLESS

No future source path is pre-reserved. The released Slice 1 through Slice 10 evidence is archived in [application modularization history](docs/operations/lanes/history/2026-07-application-modularization.md). Any later extraction must first map the current live topology, identify one connected call path, claim exact non-overlapping paths, preserve behavior, and obtain independent refutation. Do not revive orphan module patterns or use a historical candidate list as a current claim.

### General Search — ACCEPTED ARCHITECTURE ONLY / PATHLESS

ADR-027 is accepted as architecture direction only. It authorizes no AI endpoint, provider call, prompt, tool registry, schema, dependency, UI, rollout, or deployment. AI may interpret a request only; admitted WetinDey evidence answers it. The released decision record is in [release and governance history](docs/operations/lanes/history/2026-07-release-and-governance.md).

## Recently released pointer

Released records are historical evidence, not current locks. Locate them through [the current-cycle lane history index](docs/operations/lanes/history/README.md), including Presence/platform, modularization, Human Interface/Aboki FX, documentation/enablement, and release/governance records.

## Historical lane archive

Archives grant no current human claim. They preserve source-snapshot evidence for audit and branch handoff only.

- [Current-cycle history index](docs/operations/lanes/history/README.md)
- [Legacy historical archive](docs/operations/lanes/LANES-HISTORICAL-ARCHIVE.md)


#### Developer Relations department worklog protocol — RELEASED / PATHLESS

Commit `350882e` rebased the fixed-digest repair onto the final Root UI parent, reconciled
the active department manifest to 21 exclusive paths, and preserved the historical
23-path bootstrap evidence append-only. The canonical digest
`759e9cd3263030be967fcce995935253b54dd4eb09c9f8402eca3c0d63b00597` is a fixed literal;
normalization removes only its self-reference and permits no dynamic acceptance.
Independent final refutation passed all five focused department-worklog contracts. All
DevRel paths are released; the persistent employee remains available for later bounded
assignments.
