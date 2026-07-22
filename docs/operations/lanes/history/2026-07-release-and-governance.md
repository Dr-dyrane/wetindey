# Historical Lane Archive: release and governance

Historical evidence only. This file grants no current path ownership, release permission, provider access, migration authority, or deployment authority. For active locks and gates, read root [LANES.md](../../../../LANES.md).

- Source snapshot commit: `63d927a`
- Extraction method: exact heading block bytes from `LANES.md` at the source snapshot
- Integrity: each block SHA-256 is listed in [this archive index](README.md)

## Records

<a id="2026-07-release-and-governance-01"></a>

## Quality & Release Controller checkpoint RC-139

Controller owner: this orchestrator, over exactly `LANES.md` and
`docs/architecture/RELEASE-CONTROLLER.md`. RC-139 reconciled from local base `b93014e`,
which was fourteen path-scoped commits ahead of `origin/main` at `2907ba1`; the resulting
checkpoint was independently refuted and published as `5057680`. The modularization and
action candidate through `0287ddc` passed history, live-call-path, focused static, build,
reused-tab runtime, and independent source refutation. The two General Search documentation
commits were independently refuted in their own lanes. Later path-scoped, independently
refuted commits may continue under the release policy below; deployment remains separately
evidence-gated.

**Decision: PATH-SCOPED PUSHES AUTHORIZED; DEPLOYMENT REMAINS EVIDENCE-GATED.** Independently
refuted, path-scoped commits may move promptly to `main`; do not accumulate a private
release train. A push is not proof of a safe deployment. Shared database work remains
fail-closed on exact target identity, ledger/schema/role compatibility, backup, scheduler,
default-off controls, and independent refutation. The Founder has separately authorized
the corrected Presence `0012` rollout when those technical gates pass. History rewrites,
shared seeds, guessed target identity, and migration workarounds remain prohibited.


<a id="2026-07-release-and-governance-02"></a>

### Current-main evidence checkpoint

Historical deployed checkpoint `97b74af` passed the Search/provenance disposable SQL gate, including
strengthened unavailable and contradictory cases plus exact cleanup. That pathless
execution gate is closed and released; the persistent Search & Ranking employee remains
available for later bounded assignments and owns no path. Repository `main` has advanced
beyond that deployed checkpoint; this statement does not claim that repository head is
deployed.

The Founder-provided Dyrane Constitution v1.0 is now durable at
`docs/DYRANE-CONSTITUTION.md`, indexed by `docs/README.md`, and mandatory through
`AGENTS.md`. Its ten-question Dyrane Test guides ideation, implementation, review,
refutation, and release without changing code/ADR/architecture precedence. The temporary
four-path documentation lane is complete and all paths are released.

The 19 July Production auth-email recovery is now durable under
`docs/operations/auth-email/`. It separates request, webhook, SMTP, mailbox, branding,
verification, and account-creation evidence; records the `10`-second Neon timeout,
single `WetinDey <auth@wetindey.live>` sender, redeployment, embedded-logo proof, and
exact support-address signup proof without retaining secrets or OTPs. The temporary
five-path operations-documentation lane is complete and all paths are released.

The semantic iconography foundation has now passed direct existing-tab light, dark, and
grayscale visual refutation plus its focused contract. All five foundation paths are
released. No Item Detail/Get-It adoption lane is currently active; any future adoption
requires a fresh exact claim and independent refutation.


<a id="2026-07-release-and-governance-03"></a>

### Closed: ephemeral Production database-target proof

The isolated `785d327` HMAC proof produced an exact **MATCH** across authority, compute,
database, principal, options, and deployment. Commit `168039f`, pushed to current main,
removed the one-shot temporary proof route, environment, deployment, and Blob claim. No
temporary proof path remains owned. The match satisfies target identity only; corrected
`0012` remains separately fail-closed on ledger/schema compatibility, execution-role
capability, default-off controls, scheduler proof, backup/evidence, and independent
refutation.


<a id="2026-07-release-and-governance-04"></a>

#### General Search vision and AI-routing governance — CLOSED / RELEASED

Owner: current controller. Exact docs-only paths:

- new `docs/adr/027-ai-routed-general-search.md`
- new `docs/product/GENERAL-SEARCH-AND-DECISION-ENGINE.md`
- `docs/DECISIONS.md`
- `docs/WETINDEY_BIBLE.md`
- `docs/product/README.md`
- `LANES.md`

The Founder-directed General Search vision was initially recorded as a strategic post-V1
proposal in commit `6f59047`; the separate acceptance lane below records the later
Founder decision. At this checkpoint ADR-027 is accepted as documented direction only and
authorizes no AI endpoint, model/provider call, prompt, tool registry, schema, dependency,
UI, deployment, or rollout. AI may interpret a question
into a validated typed request; only a live WetinDey capability may answer from admitted
evidence. Precise location, history, and preferences are not implicit model context.
ADR-010's two-complete-vertical abstraction gate remains binding, unsupported intents
fail closed, and category controls remain available until General Search is proved more
comprehensible and reliable. Initial independent review REFUTED a relative link,
premature release wording, nondeterministic rendering language, and underspecified
evidence-reference privacy. The corrected candidate received follow-up independent PASS
with no P1/P2/P3. All six paths are released by the path-scoped documentation commit.


<a id="2026-07-release-and-governance-05"></a>

#### General Search Founder acceptance — CLOSED / RELEASED

Owner: current controller. Exact paths:

- `docs/adr/027-ai-routed-general-search.md`
- `docs/product/GENERAL-SEARCH-AND-DECISION-ENGINE.md`
- `docs/DECISIONS.md`
- `docs/WETINDEY_BIBLE.md`
- `LANES.md`

The Founder explicitly accepted ADR-027 on 2026-07-21. It is recorded as **Accepted —
architecture only; implementation separately claimed**. Acceptance authorizes the
strategic direction and phased implementation planning, not an AI endpoint, provider,
prompt, tool registry, schema, dependency, UI, deployment, or rollout. Independent docs
review returned PASS with no P1/P2/P3. Release all five paths through the path-scoped
acceptance commit.


<a id="2026-07-release-and-governance-06"></a>

##### CSP nonce hydration mismatch — COMPLETE / RELEASED

Owner: released after current-controller implementation and independent Security & Privacy
refutation. Former exclusive paths:

- `src/app/layout.tsx`
- `src/lib/seo.tsx`
- `scripts/csp-policy-contracts.test.ts`
- `LANES.md`

The reused localhost tab reports a React hydration mismatch where request-bound nonce
attributes are present in server markup but appear empty in client properties across raw
layout scripts, Mapbox, JSON-LD, and the development service-worker script. This predates
the modularization candidate and is not a Report Problem defect. Browser nonce hiding is
an unavoidable single-attribute hydration difference: retain every nonce and ADR-020
request-boundary invariant, add suppression only to the five exact nonce-bearing script
elements, and strengthen the focused contract to forbid new broad/root suppression while
pinning the one pre-existing `<html>` exception for pre-paint theme mutation. Do not
change `src/middleware.ts`, remove nonce enforcement, add blanket suppression, or widen
the released action/sheet lanes. Production impact remains unverified until independent
runtime refutation. Focused CSP contracts and exact-path lint passed. The existing localhost
tab reloaded and rendered the complete app; Next Dev Tools exposed no issue item after the
reload. Independent review initially REFUTED the contract's root-suppression ambiguity;
the forward correction pins the sole pre-existing `<html>` theme exception, requires all
five nonce-bearing scripts to use element-scoped suppression, and forbids head/body
suppression. Follow-up independent verdict: PASS, no P1/P2/P3. Release all four paths.


<a id="2026-07-release-and-governance-07"></a>

##### Modularization release-history audit — CLOSED / RELEASED

Owner: current controller. Exact corrective paths:

- `src/app/_actions/food-actions.ts`
- `src/app/_actions/actions.ts`
- `src/app/_actions/report-actions.ts`
- `src/app/_actions/review-actions.ts`
- `docs/operations/RC-139-REPORT-PROBLEM-RUNTIME.md`
- `LANES.md`

The audit preserved commit boundaries and corrected two concrete release-hygiene defects:
explicit Next.js-compatible Server Action exports and restoration of the real
`submitProblemReport` writer. Focused type/build/modularization evidence passed; the live
Report Problem call path and surface were exercised as recorded in the redacted RC-139
runtime transcript; and independent source refutation returned PASS with no P1/P2.
Release all corrective paths.

