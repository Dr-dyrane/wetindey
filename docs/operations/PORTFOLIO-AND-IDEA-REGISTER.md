# WetinDey Portfolio and Idea Register

**Status:** Working portfolio ledger  
**Portfolio owner:** Product & Portfolio  
**Final product authority:** Dr. Dyrane Alexander  
**Operating controller:** Codex Controller  
**Current launch phase:** WetinDey Food Truth & Pilot Operations  
**Operating policy:** [WETINDEY-OPERATING-SYSTEM.md](WETINDEY-OPERATING-SYSTEM.md)

> **This register does not authorize work.** An idea is not a roadmap commitment, lane,
> ADR, implementation, release, or launch promise. Only `LANES.md` grants current path
> ownership.

## 1. Register purpose

This register keeps valuable possibilities visible without turning every possibility into
scope. It records why an idea matters, what must be learned, which decisions it may
require, and when it should next be reviewed.

The sole launch phase remains WetinDey Food Truth & Pilot Operations. Portfolio movement
must strengthen that phase or remain explicitly outside it. Category expansion and
Yelp-like community scope stay parked until the truth, safety, release, and operating
gates in the accepted architecture and operating system are met.

## 2. Artifact boundary

| Artifact | Meaning | Does it authorize implementation? |
|---|---|---|
| Register entry | A problem, hypothesis, or opportunity worth retaining | No |
| Discovery | Permission to learn inside a stated non-implementation boundary | No |
| Candidate | A shaped option ready for a portfolio decision | No |
| Approved | A recorded portfolio decision with conditions | No, not without a lane |
| Roadmap item | Sequenced intent with dependencies and phase | No |
| Lane | Exact temporary path ownership in `LANES.md` | Yes, only inside its scope |
| ADR | Durable decision when accepted | No, it still needs a lane |
| Implementation | A changed candidate produced inside a lane | No release authority |
| Release evidence | Independent proof tied to an exact candidate and target | Input only |
| Release decision | Permission or refusal for an exact promotion | Yes, only as stated |

Approved does not mean Active. Active does not mean Released. Released does not mean the
field outcome succeeded.

## 3. Stage definitions and movement rules

| Stage | Meaning | Entry authority | Exit condition |
|---|---|---|---|
| Inbox | Newly captured and not yet triaged | Anyone may propose; Product & Portfolio records | Duplicate check, phase relevance, problem, and first disposition |
| Discovery | Important uncertainty is being investigated without product commitment | Controller or relevant functional chief inside a reversible boundary | Evidence summary, options, risks, and a recommendation |
| Candidate | Problem and option are shaped enough for a decision | Product & Portfolio after functional review | Explicit approve, park, reject, or return-to-discovery decision |
| Approved | Outcome and conditions are approved, but paths are not yet claimed | Founder for consequential choices; accountable chief for bounded routine work | Dependencies satisfied and an exact lane is claimed |
| Active | An exact current lane exists for this approved outcome | Controller after checking `LANES.md` | Refuted, released to field measurement, parked, rejected, or completed |
| Parked | Worth retaining but intentionally not pursued now | Founder, Controller, or accountable chief within authority | Trigger occurs and a fresh review moves it to Discovery or Candidate |
| Rejected | Deliberately declined with a reason | Same authority required to approve the choice | New material evidence justifies a fresh idea or explicit reconsideration |

### Movement controls

1. Stage changes are explicit, dated, and attributed.
2. Consequential choices receive Founder review before Approved.
3. Proposed ADRs cannot satisfy an accepted-ADR dependency.
4. Approved entries remain unstaffed until `LANES.md` grants exact paths.
5. Active requires a current lane reference, worker, accountable function, refuter, and
   release route.
6. A lane disappearing, expiring, or being released removes Active status.
7. Field evidence may move an entry backward. Activity does not create entitlement to
   continue.
8. Parked and Rejected reasons are retained to prevent repeated argument without new
   evidence.
9. No automation changes a stage, creates scope, or claims a lane.

## 4. Daily portfolio audit

The Codex Controller's daily portfolio auditor compares all documented plans against
`LANES.md` and prepares a Founder / Operating CEO review packet.

### Inputs

- this register;
- current roadmap and architecture plans;
- accepted and proposed ADR status;
- `LANES.md`;
- implementation handoffs and independent verdicts;
- release-controller decisions and evidence;
- the Founder department crosswalk and active functional roster in the operating system;
- current Food field outcomes and operating blockers.

### Required comparisons

- Approved or Active entries with no matching lane;
- lanes with no approved outcome, containment authority, or current dependency basis;
- path overlaps, stale handoffs, or released work still described as active;
- roadmap work that appears in the wrong phase;
- proposals represented as accepted decisions;
- implementation represented as released without exact evidence;
- released behavior represented as a successful field outcome without field evidence;
- Aboki FX, Nearby Presence, Reviews, category, or community work leaking into the Food
  launch phase;
- documented work with no explicit functional home, accountable chief, or department
  classification;
- a Future, Shared-specialist, or hardware-only capability being represented as an active
  team, staffed commitment, or implementation authority;
- duplicate, contradictory, stale, or orphaned plans.

### Packet output

1. Current phase and top outcome.
2. Register movements proposed, not applied.
3. Plan-to-lane discrepancies.
4. Active WIP, blocked days, and handoffs.
5. Consequential decisions needed from the Founder.
6. Refutation, release, safety, privacy, legal, and migration blockers.
7. Food truth, coverage, correction, seller, and field outcome movement.
8. Recommended continue, narrow, repair, resequence, park, reject, or graduate actions.
9. Explicitly deferred scope.
10. Functional-home gaps and specialist or future-capability handoffs requiring Founder
    review.

The auditor does not silently add an entry, change a stage, create a roadmap item, claim a
lane, accept an ADR, assign a worker, or authorize promotion. It may prepare the packet;
the authorized decision-maker records each accepted change afterward.

### Documented-plan intake to `LANES.md`

When a plan, proposal, research note, roadmap line, ADR, discussion, or completed-looking
artifact describes work that is not represented accurately in `LANES.md`, the auditor
creates one review item in the next Founder / Operating CEO packet. It does not create a
task for every document.

The review item records:

1. the source artifact and exact statement;
2. the problem or outcome it appears to pursue;
3. its current register stage, or `Unregistered`;
4. its department-crosswalk classification and WetinDey functional home;
5. the relevant accepted or proposed ADR status;
6. whether a lane is absent, stale, conflicting, wider than authority, or already released;
7. current-phase relevance, dependencies, risks, and explicit non-goals;
8. the smallest recommended disposition: register, continue discovery, make Candidate,
   approve, claim a narrow lane, reconcile, park, reject, or mark superseded;
9. the exact consequential question, if any, requiring Founder decision.

The Founder or authorized accountable chief decides the disposition. Only afterward may
the Controller update the register or request an exact lane through the separately
governed `LANES.md` process. Silence creates no entry, approval, assignment, lane, or
deadline. Related discrepancies are bundled into one outcome-oriented review item so the
intake process does not become dozens of noisy tasks.

## 5. Entry template

Use this structure for every new idea:

```markdown
### WD-I-000: Short title

| Field | Record |
|---|---|
| Stage | Inbox |
| Date captured | YYYY-MM-DD |
| Proposer | Name or function |
| Portfolio owner | Product & Portfolio |
| Accountable function | Function |
| Department classification | Active now / Shared specialist / Future / Not applicable until hardware exists |
| Current phase relevance | Direct / Enabling / Outside current phase |
| Consequential choice | Yes/No and why |
| ADR status | None / Required / Proposed ADR-NNN / Accepted ADR-NNN |
| Lane status | None; ideas never imply a lane |
| Next review | Trigger or date |

**Problem:** Who experiences what uncertainty or harm?

**Hypothesis:** What change may improve which outcome?

**Evidence:** Grade A/B/C/D, sources, contrary evidence, and unknowns.

**Smallest learning step:** A read-only, prototype, field, or operational action that does
not imply launch.

**Success signal:** Observable user or operating outcome.

**Guardrails:** Truth, safety, privacy, accessibility, legal, and operational limits.

**Dependencies:** Decisions, data, operations, migrations, instrumentation, and handoffs.

**Non-goals:** Scope that must not arrive with the idea.

**Functions consulted:** Named functions and unresolved disagreements.

**Decision history:** Date, decision receipt, decider, and rationale.
```

## 6. Decision receipt template

A decision receipt records a portfolio choice. It is different from the user-facing
"decision receipt" idea `WD-I-003`.

```markdown
### WD-D-000: Decision title

| Field | Record |
|---|---|
| Date | YYYY-MM-DD |
| Related idea | WD-I-000 |
| Decider | Founder / Controller / Functional chief |
| Decision | Continue discovery / Make candidate / Approve / Park / Reject |
| Consequential | Yes/No |
| ADR required | None / Required / ADR-NNN |
| Effective boundary | Exact outcome and phase |
| Lane implication | None until separately claimed |
| Review trigger | Date, evidence, dependency, or field threshold |

**Question decided:** One precise question.

**Recommendation:** The proposed choice and why.

**Options considered:** Real alternatives, including do nothing.

**Evidence and confidence:** Evidence grade, limitations, and dissent.

**Consequences:** Benefits, costs, reversibility, and risks.

**Conditions:** Dependencies and gates that must hold before a lane.

**Non-decisions:** Adjacent scope not approved by this receipt.
```

## 7. Inbox

No entries.

New submissions stay here until Product & Portfolio records the problem, checks for a
duplicate, and assigns an initial disposition. Inbox position does not imply priority.

## 8. Discovery

### WD-I-003: User-facing decision receipt

| Field | Record |
|---|---|
| Stage | Discovery |
| Date captured | 2026-07-18 |
| Proposer | Dr. Dyrane through Product & Portfolio |
| Portfolio owner | Product & Portfolio |
| Accountable function | Consumer App |
| Current phase relevance | Enabling for Food truth and corrections |
| Consequential choice | Potentially; retention, sharing, and representation require review |
| ADR status | To be assessed before Candidate |
| Lane status | None |
| Next review | After current Food answer semantics and privacy facts are stable |

**Problem:** A person may act on a time-bound Food answer and later be unable to recall
exactly what WetinDey said, where it applied, how fresh it was, or why it was trusted.
That weakens outcome confirmation, correction, and dispute learning.

**Hypothesis:** A compact, privacy-preserving receipt for the decision state may help the
person act, report what happened, and explain a correction without treating the displayed
price as a quote.

**Evidence:** Grade D. The need follows from the product flow, but no field evidence yet
shows the right format, retention period, or whether a saved artifact is useful.

**Smallest learning step:** Prototype the information hierarchy using non-sensitive sample
content and test comprehension. Compare an ephemeral in-app state, local-only saved state,
and explicit share action.

**Success signal:** People can accurately explain what was known, its age, limitations,
and the next action, then complete an outcome or correction with less confusion.

**Guardrails:** It is not a transaction receipt, seller quote, availability guarantee,
proof of purchase, or legal attestation. Do not include precise user location, hidden
identity, or persistent history by default. Sharing must remain explicit.

**Dependencies:** Authoritative Food answer, truthful freshness and provenance copy,
privacy/retention decision, accessibility review, and outcome instrumentation.

**Non-goals:** Checkout, payment, order history, delivery tracking, or automatic public
sharing.

**Functions consulted next:** Human Interface, Data/Truth Platform,
Security/Privacy/Legal, Localization/Accessibility, Growth/Analytics.

**Decision history:** Captured for Discovery only. No approval or lane.

### WD-I-004: Seller correction link

| Field | Record |
|---|---|
| Stage | Discovery |
| Date captured | 2026-07-18 |
| Proposer | Dr. Dyrane through Product & Portfolio |
| Portfolio owner | Product & Portfolio |
| Accountable function | Seller/Community Operations |
| Current phase relevance | Direct for Food pilot stewardship |
| Consequential choice | Yes; seller identity, consent, moderation, and abuse policy |
| ADR status | Existing ADR-001 boundary applies; additional decision review may be required |
| Lane status | None |
| Next review | After contribution integrity and seller consent prerequisites are explicit |

**Problem:** A seller who sees a wrong price, stock state, contact detail, or hours has no
simple, safe route to request correction. Slow corrections can produce wasted trips and
damage trust.

**Hypothesis:** A scoped correction link tied to a place or claim could reduce correction
time and improve seller stewardship without granting automatic publication or paid trust.

**Evidence:** Grade D. Seller correction is an identified operating need, but no validated
seller workflow, control proof, or abuse model exists.

**Smallest learning step:** Conduct seller workflow interviews and map the minimum
consent, identity/control, reason, evidence, review, status, and appeal states. Test a
non-live paper or clickable prototype.

**Success signal:** Legitimate seller corrections are resolved faster and later field
outcomes improve, without increasing false claims, impersonation, retaliation, or operator
overload.

**Guardrails:** A seller submission is evidence, not automatic truth. A correction cannot
delete immutable history, suppress conflicting reports, purchase verification, raise
confidence by itself, or expose private contact details. Contact is a handoff, never
fulfilment.

**Dependencies:** Seller contact consent, control/identity policy, contribution integrity,
moderator identity and audit, rate limits, dispute and appeal policy, privacy/legal review,
and field operations capacity.

**Non-goals:** Seller dashboard expansion, paid placement, orders, delivery, checkout,
generic reviews, or automatic verified status.

**Functions consulted next:** Seller/Community Operations, Food Operations, Trust & Safety,
Data/Truth Platform, Security/Privacy/Legal, Quality/Release.

**Decision history:** Captured for Discovery only. No approval or lane.

## 9. Candidate

Candidate means ready for an explicit portfolio decision, not approved.

### WD-I-001: One-tap outcome confirmation

| Field | Record |
|---|---|
| Stage | Candidate |
| Date captured | 2026-07-18 |
| Proposer | Dr. Dyrane through Product & Portfolio |
| Portfolio owner | Product & Portfolio |
| Accountable function | Consumer App |
| Current phase relevance | Direct for Food truth |
| Consequential choice | No for bounded validation; yes if identity, incentives, or trust policy changes |
| ADR status | ADR-011 boundaries apply if outcomes affect reputation; ADR remains Proposed |
| Lane status | None |
| Next review | Founder / Controller portfolio review after current-flow baseline |

**Problem:** WetinDey cannot calibrate Food truth or learn about wasted trips without a
low-friction independent outcome after a person acts. The architecture records an existing
visit-confirmation loop, but its field use and measurement are not yet established.

**Hypothesis:** Validate and simplify the existing return prompt so the primary outcome can
be confirmed with one tap, with optional detail disclosed afterward.

**Evidence:** Grade C for product fit because an implementation path exists; Grade D for
field effectiveness because no measured baseline is available.

**Smallest learning step:** Audit the current live flow and event semantics, then run a
bounded usability and field trial without adding incentives or continuous tracking.

**Success signal:** Higher eligible outcome-confirmation rate, lower abandonment, and
enough independent outcomes to estimate false-high and wasted-trip rates.

**Guardrails:** No continuous location tracking, coercive prompt, hidden identity linkage,
self-validating trust, synthetic outcome, or reward feedback loop. "Was there" and "price
matched" remain distinct facts.

**Dependencies:** Truthful current Food result, privacy-reviewed eligibility trigger,
admissible event model, analytics implementation, accessibility, and independent
refutation.

**Non-goals:** Contributor reputation, rewards, gamification, reviews, or category-general
outcomes.

**Functions consulted:** Consumer App, Human Interface, Data/Truth Platform, Trust & Safety,
Security/Privacy/Legal, Growth/Analytics, Localization/Accessibility.

**Decision history:** Shaped as a Candidate. No approval, lane, implementation, or release
commitment.

### WD-I-002: Pilot coverage cockpit

| Field | Record |
|---|---|
| Stage | Candidate |
| Date captured | 2026-07-18 |
| Proposer | Dr. Dyrane through Product & Portfolio |
| Portfolio owner | Product & Portfolio |
| Accountable function | Food Operations |
| Current phase relevance | Direct for controlled Food pilot |
| Consequential choice | No for an internal read-only cockpit; yes for new sensitive data or automated decisions |
| ADR status | Must preserve ADR-012/014/015 boundaries; additional ADR assessed at lane readiness |
| Lane status | None |
| Next review | After Stage 0 truth data and metric definitions are reliable |

**Problem:** Operators and the Founder cannot run a bounded pilot honestly without seeing
which geography, items, variants, units, places, and time windows have fresh admissible
coverage and where gaps, conflicts, and corrections are accumulating.

**Hypothesis:** A small internal cockpit focused on coverage gaps and operating actions
will improve field allocation and prevent unsupported expansion claims.

**Evidence:** Grade B for the operating need because the architecture repeatedly identifies
the absence of an ops surface and coverage loop. The best interface and workload remain
unvalidated.

**Smallest learning step:** Define a read-only daily packet from existing admissible data
before building a dashboard. Run it manually with Food Operations and record decisions it
changes.

**Success signal:** Faster identification of stale or uncovered cells, more efficient field
work, lower dispute age, and explicit evidence for why a geography/catalog is or is not
pilot-ready.

**Guardrails:** No synthetic or quarantined source counts as live coverage. No public
operator data, precise contributor traces, hidden worker ranking, auto-approval, or
false-precision heatmap. Unknown remains unknown.

**Dependencies:** Authoritative observed-only reads, contribution integrity, metric
definitions, operator authorization, privacy review, bounded geography/catalog, and a
field operating process.

**Non-goals:** Generic BI platform, Lagos-wide command center, automated sourcing, partner
ingestion, reputation scoring, or public coverage promises.

**Functions consulted:** Food Operations, Data/Truth Platform, Platform/Database/SRE,
Trust & Safety, Security/Privacy/Legal, Growth/Analytics, Human Interface.

**Decision history:** Shaped as a Candidate. No approval, lane, implementation, or release
commitment.

### WD-I-005: Coverage honesty

| Field | Record |
|---|---|
| Stage | Candidate |
| Date captured | 2026-07-18 |
| Proposer | Dr. Dyrane through Product & Portfolio |
| Portfolio owner | Product & Portfolio |
| Accountable function | Data/Truth Platform |
| Current phase relevance | Direct and foundational for Food truth |
| Consequential choice | Yes if it changes shared result language, ranking, or launch gate |
| ADR status | Must remain consistent with accepted ADR-006, ADR-012, and ADR-015 |
| Lane status | None |
| Next review | Founder / Controller review with Food truth baseline |

**Problem:** A sparse local information product can accidentally imply that an empty,
stale, broad, or weakly sourced result means current nearby reality is known. Hiding a gap
is more harmful than showing no answer.

**Hypothesis:** Make coverage limits a first-class result and operating metric so the
product says where, when, item, unit, and evidence are sufficient, weak, stale, conflicting,
or absent.

**Evidence:** Grade B. Coverage honesty follows directly from WetinDey's mission, accepted
freshness/provenance decisions, and the controlled-pilot requirement. Exact user language
and thresholds still need evidence.

**Smallest learning step:** Define a coverage-state contract and test it against a bounded
Food result set and user comprehension study before changing ranking or launch claims.

**Success signal:** Lower false-high and wasted-trip rates; higher comprehension of gaps;
fewer broad claims unsupported by admissible fresh evidence; deliberate field work aimed
at the most valuable gaps.

**Guardrails:** No engagement optimization may suppress an honest no-answer. Distance,
freshness, provenance, unit comparability, source independence, and conflict remain
distinct. Reference or sample data may be useful context but never live coverage.

**Dependencies:** One authoritative Food assessment, exact coverage dimensions, bounded
pilot geography/catalog, shared map/list/sheet semantics, accessibility and localization
review, and field outcome instrumentation.

**Non-goals:** A universal confidence score, one coverage percentage for Lagos, category
expansion, or automatic launch approval.

**Functions consulted:** Data/Truth Platform, Human Interface, Food Operations, Maps/Location,
Trust & Safety, Growth/Analytics, Localization/Accessibility, Quality/Release.

**Decision history:** Shaped as a Candidate. No approval, lane, implementation, or release
commitment.

### WD-I-006: Farm inputs pillar (Agri)

| Field | Record |
|---|---|
| Stage | Candidate |
| Date captured | 2026-07-22 |
| Proposer | Dr. Dyrane Alexander (Founder, directed in-session) |
| Portfolio owner | Product & Portfolio |
| Accountable function | Product & Portfolio; Data/Truth Platform and Maps/Location consulted |
| Department classification | Active now |
| Current phase relevance | Outside current phase |
| Consequential choice | Yes: a new pillar amends accepted ADR-008's six-pillar taxonomy and requires Founder acceptance of ADR-031 |
| ADR status | Proposed ADR-031 |
| Lane status | None; ideas never imply a lane |
| Next review | On Founder acceptance or rejection of ADR-031 |

**Problem:** A farmer buying fertilizer, seed, agrochemicals, or feed faces harsher
versions of the food shopper's uncertainty: seasonal price swings, long trips to
agro-dealers, and a wasted trip costing a working day inside a planting window.

**Hypothesis:** The Food truth engine reuse is the enabler: the existing truth engine (priced items in real units at named places,
freshness decay, admission rules) serves farm inputs without engine changes, giving
farmers the same pre-trip confidence food shoppers get.

**Evidence:** Grade C: structural analogy to the proven Food model plus common
knowledge of Nigerian input markets; no field data collected. Unknowns: per-pillar
freshness decay (seasonal stability then daily movement), adulteration-driven trust
needs distinct from price freshness.

**Smallest learning step:** Founder decision on ADR-031; then a read-only field survey
of agro-dealers in the pilot geography before any schema work.

**Success signal:** A farmer checks an input price before traveling and the price holds
on arrival, measured the same way Food measures wasted trips.

**Guardrails:** Food Truth phase firewall untouched; no launch promise; no synthetic
Agri truth; no agent-invented local-language copy; adulteration trust signals must not
conflate with price freshness (Trust & Safety flag recorded in ADR-031).

**Dependencies:** ADR-031 acceptance; schema lane (agro_dealer place type, input
catalog); spine lane (pillar flag, category surface); maps lane (dealer symbol, POI
budget review); human-led field coverage.

**Non-goals:** Produce selling, two-sided marketplace, equipment rental, extension
advice, credit, or any fulfilment.

**Functions consulted:** Product & Portfolio (framing), Maps/Location (symbol and POI
budget noted), Data/Truth (freshness tuning flagged); no unresolved disagreement
recorded.

**Decision history:** 2026-07-22: Founder directed the agriculture lane and chose the
farm inputs shape from framed alternatives in-session; ADR-031 drafted Proposed and
submitted for explicit acceptance.

## 10. Approved

No entries.

An entry appears here only after an explicit, attributed decision. Even then, it cannot
move to Active until dependencies are satisfied and `LANES.md` grants exact paths.

## 11. Active

No register entries are Active.

Existing repository work may be active in `LANES.md`; this register does not backfill,
duplicate, or appropriate those lanes. The daily auditor reports any alignment gap for
review.

## 12. Parked

### WD-P-001: Non-Food selectable category launch

| Field | Record |
|---|---|
| Stage | Parked |
| Scope examples | Aboki FX / Exchange, Power, and any other non-Food category |
| Reason | Food truth, safety, release, and operating gates are not complete |
| Governing boundary | Proposed ADR-010 does not authorize implementation |
| Revisit trigger | Controlled Food pilot outcomes, accepted typed-capability decision, reproducible migrations, and a fully grounded second vertical |
| Lane status | None implied |

Bounded prototypes or containment work do not unpark category launch. A future category
must carry its own typed signal, provenance, freshness, conflict, contribution, map,
search, filters, trust explanation, legal caveats, outcome, operations, and refutation.

### WD-P-002: Yelp-like reviews and community launch

| Field | Record |
|---|---|
| Stage | Parked |
| Scope examples | Ratings, reviews, replies, media, helpful votes, feeds, recommendations, and community discussion |
| Reason | Current sole launch phase is Food Truth & Pilot Operations |
| Governing boundary | Reviews are separate from factual live claims; proposed ADR-011 does not authorize launch |
| Revisit trigger | Real Food outcomes, identity, moderation, duplicate/abuse controls, privacy/legal policy, complete read/write paths, and independent evidence |
| Lane status | None implied |

Safety containment around existing review-shaped code may still be authorized in
`LANES.md`. Containment is not portfolio approval and cannot turn reviews into current-state
trust evidence.

## 13. Rejected

No entries.

Rejection records must name the decision-maker, evidence, reason, non-decisions, and what
new evidence would justify reconsideration. Rejected ideas are not deleted.

## 14. Register health metrics

Product & Portfolio reports:

- number of entries by stage;
- age since last evidence or decision;
- Candidate-to-decision time;
- Approved-to-lane lead time;
- Active WIP and blocked days;
- Active entries with exact lane and refuter coverage;
- plan-to-lane discrepancies from the daily audit;
- unregistered documented plans and functional-home gaps awaiting disposition;
- Future, Shared-specialist, or hardware-only capabilities incorrectly represented as active;
- parked ideas repeatedly resurfacing without a trigger;
- percentage of field outcomes that produced an explicit disposition;
- current-phase scope leaks prevented.

These are flow diagnostics, not productivity scores. The goal is fewer hidden commitments
and faster high-quality decisions, not more ideas or more active lanes.

## 15. Maintenance rule

Update this register only through an authorized path-scoped governance lane. Preserve
concurrent work, decision history, parking and rejection reasons, and exact stage
attribution.

Do not turn this file into a backlog of implementation tasks. Once an Approved entry
receives a lane, `LANES.md` governs execution. Once evidence reaches the field, the
portfolio decision returns here as a dated disposition rather than a silent rewrite of
history.
