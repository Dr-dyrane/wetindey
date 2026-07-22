# WD-I-003 User-Facing Decision Receipt: Discovery Deliverable

**Type:** Discovery deliverable. Authorizes nothing.
**Scope:** The user-facing "decision receipt" idea WD-I-003, examined against the accepted
provenance and admissibility boundary and against the live outcome-confirmation posture.
**Authority:** This document grants no lane, no code, no schema, no migration, no copy
change, and no deployment. It is Discovery input to a Founder / Product & Portfolio review
only. It satisfies the Discovery exit condition of "evidence summary, options, risks, and a
recommendation" (`docs/operations/PORTFOLIO-AND-IDEA-REGISTER.md:48`).
**Register source:** `docs/operations/PORTFOLIO-AND-IDEA-REGISTER.md:234` (WD-I-003, Stage
Discovery, captured 2026-07-18).
**Anchors:** ADR-012 (`docs/adr/012-observation-provenance-boundary.md`), ADR-015
(`docs/adr/015-observation-provenance-admissibility.md`), and the one-tap outcome audit
(`docs/operations/audits/one-tap-outcome-audit.md`, WD-I-001).

> This deliverable does not move WD-I-003 to Candidate, claim a lane, accept an ADR, or
> authorize a prototype build against real data. It records what is known, the honest
> options, the risks, and one recommendation, then states the exact next question.

## 0. Disambiguation

The WD-I-003 "decision receipt" is a user-facing artifact shown to a person after they act
on a Food answer. It is not the portfolio "decision receipt" template (WD-D-000) at
`docs/operations/PORTFOLIO-AND-IDEA-REGISTER.md:190`, which records a portfolio choice. The
register itself flags this collision (`:192`). This deliverable concerns only the
user-facing artifact.

Per the register guardrails (`:267`), the user-facing receipt is also not a transaction
receipt, a seller quote, an availability guarantee, a proof of purchase, or a legal
attestation. Those exclusions are load-bearing for everything below.

## 1. What WD-I-003 proposes

The register captures the idea as follows (`:250`).

- **Problem.** A person may act on a time-bound Food answer and later be unable to recall
  what WetinDey said, where it applied, how fresh it was, or why it was trusted. That
  weakens outcome confirmation, correction, and dispute learning.
- **Hypothesis.** A compact, privacy-preserving receipt of the decision state may help the
  person act, report what happened, and explain a correction, without treating the
  displayed price as a quote.
- **Success signal.** People can accurately explain what was known, its age, its
  limitations, and the next action, then complete an outcome or correction with less
  confusion.
- **Smallest learning step.** Prototype the information hierarchy using non-sensitive sample
  content and test comprehension. Compare an ephemeral in-app state, a local-only saved
  state, and an explicit share action.

A receipt is therefore a read-side representation of decision state. It renders facts the
truth core already holds. It is not a new writer and, by itself, produces no observation.

## 2. Evidence summary

### 2.1 Evidence grade

Grade D, per the register (`:257`). The need follows from the product flow, but no field
evidence yet shows the right format, the retention period, or whether a saved artifact is
useful. Nothing below upgrades that grade; it is a Discovery deliverable, not a study.

### 2.2 What the accepted boundary already fixes for a receipt

The receipt cannot invent its own truth. Every field it would show is already governed.

1. **Provenance is typed and fail-closed (ADR-012).** Each observation carries one of
   `synthetic`, `observed`, `partner`, `reference`, `inferred`, `NOT NULL`, defaulting to
   `synthetic`. Only `observed` is "a direct human report or visit confirmation handled by
   a live contribution writer" (`docs/adr/012-observation-provenance-boundary.md:30`). The
   reserved classes "do not authorize a writer, ingestion pipeline, ranking rule, or public
   label" (`:56`). A receipt is a public label surface, so it inherits that constraint: it
   may only reflect provenance, never promote it.
2. **Admissibility and the `Sample` rule (ADR-015).** Confidence, freshness, availability,
   source counts, and explanations derive from admissible `observed` rows only
   (`docs/adr/015-observation-provenance-admissibility.md:46`). Synthetic-only content
   "must be visibly labelled `Sample`" and must not be presented as confirmed or reported
   evidence (`:34`). `Sample` "is a synthetic-origin label, not a member of the `E sure` /
   `Check am` / `E no dey` status set, a confidence band, a verification assertion, or a
   current/observed claim" (`:64`). Critically: "The label is not a disclaimer that permits
   contradictory confident styling. Copy, structured data, color, counts, and ranking must
   agree" (`:81`). A receipt is one more public projection and is bound by that same
   agreement rule.
3. **Freshness is already a first-class fact.** Admissible `observed` evidence passes
   freshness gates (`docs/adr/015-observation-provenance-admissibility.md:33`), so "how
   fresh was it" has a defined, non-fabricated answer the receipt can mirror. The register
   dependency on "truthful freshness and provenance copy" (`:271`) points at exactly this.

Net: a faithful receipt is largely a re-presentation problem, not a new-truth problem. Its
integrity depends on mirroring the ADR-015 state exactly, with no added claim surface.

### 2.3 The blocking upstream gap: there is no outcome to receipt yet

The one-tap outcome audit (WD-I-001) establishes, from the live code, that the
visit-confirmation flow is fully contained and fail-closed at server, UI, and hook layers;
`submitVisitConfirmation` throws and no outcome is written on any branch
(`docs/operations/audits/one-tap-outcome-audit.md:40`). It further finds "Nothing is
measured. There is no baseline" (`:86`), and that the safe sequence is instrumentation
first, re-enable second, one-tap simplification third (`:136`).

Consequences for WD-I-003:

- The receipt's stated purpose is to strengthen outcome confirmation, correction, and
  dispute learning. Those are precisely the flows WD-I-001 shows are currently inert.
- WD-I-003 lists "outcome instrumentation" as a dependency (`:272`). WD-I-001 shows that
  dependency is unbuilt and is itself gated behind a separate Founder question.
- A receipt shown today would represent a decision state that the product cannot yet let
  the user act on and report back against. It would be honest about provenance and
  freshness, but it would sit on top of a confirmation loop that records nothing.

So WD-I-003 is downstream of WD-I-001. This is a sequencing fact, not a defect in the idea.

### 2.4 Open decisions the receipt cannot resolve on its own

The register names them (`:271`): a privacy and retention decision, and an accessibility
review, in addition to the outcome-instrumentation dependency above. Retention is the pivot
that separates the three carriers in section 3, and it is undecided.

## 3. Options

Discovery frames real alternatives, including doing nothing. It does not pick the build.
The three non-trivial carriers below are the register's own comparison set (`:261`), read
through the ADR-012/015 constraints.

### Option A: Do nothing now; keep WD-I-003 in Discovery

Take no receipt action until the two hard upstream dependencies (outcome instrumentation
per WD-I-001, and the privacy/retention decision) are resolved.

- **For.** Zero risk. Avoids building comprehension evidence for a surface whose upstream
  confirmation loop is inert and whose retention model is undecided.
- **Against.** Defers all learning. The comprehension question (can people read provenance,
  age, and limitations correctly) is answerable on sample content without those
  dependencies, so pure deferral leaves cheap, safe learning on the table.
- **Data / lane / ADR.** None.

### Option B: Ephemeral in-app receipt state (no persistence)

The receipt exists only while the relevant surface is open. Nothing is saved; nothing is
shared.

- **For.** Strongest privacy posture; aligns with the register default of "no persistent
  history by default" (`:268`). No retention question to decide, no new stored data, no
  identity linkage. Closest to a pure re-presentation of live ADR-015 state.
- **Against.** Does not serve the "later recall" half of the problem statement. If the
  person closes the surface, the receipt is gone, so it aids in-the-moment action more than
  after-the-fact correction.
- **Data / lane / ADR.** None required to prototype comprehension on sample content. A live
  build would still be a separate lane.

### Option C: Local-only saved receipt (device persistence, no server, no identity)

The receipt is retained on the person's own device, not on the shared database, not
attributed to a server identity.

- **For.** Serves recall and later correction. Keeps the shared truth core untouched and
  avoids per-person server linkage, consistent with the ADR-012 fail-closed posture and the
  register privacy default.
- **Against.** Introduces a retention question (how long, what eviction, what happens on
  account actions) that the register lists as an open dependency (`:271`) and that ADR-021
  account-deletion lifecycle would need to be consulted against for any device-and-account
  interaction. A saved snapshot can also drift from live truth: a receipt that says
  `E sure` captured yesterday must not read as a current claim today, which reopens the
  ADR-015 freshness-agreement rule for stored artifacts.
- **Data / lane / ADR.** No shared-database change; a live build likely needs an explicit
  retention decision and possibly an ADR touchpoint before Candidate.

### Option D: Explicit user-initiated share/export

The person deliberately exports or shares the receipt.

- **For.** Supports dispute and seller-correction conversations. The register requires
  sharing to remain explicit (`:269`), which this honors by construction.
- **Against.** Highest misrepresentation and privacy surface. A shared artifact leaves the
  app's controlled styling, where the ADR-015 "copy, structured data, color, counts, and
  ranking must agree" guarantee cannot be enforced, so a shared receipt could be read as a
  quote, guarantee, or proof precisely against the WD-I-003 guardrails (`:267`). Also the
  most likely to carry location or identity if not carefully stripped.
- **Data / lane / ADR.** Not a Discovery-stage action. Would require the privacy/legal
  review and an explicit representation decision before any Candidate.

### Cross-cutting: what all live options must obey

Independent of carrier, any built receipt must mirror ADR-015 exactly: synthetic-only state
shows `Sample` and never `E sure`/`confirmed`; confidence, freshness, source counts, and
copy agree; provenance is reflected, never promoted; and no receipt field implies a quote,
guarantee, proof of purchase, or legal attestation. A receipt adds no new claim; it
re-presents an admitted one.

## 4. Risks

| Risk | Why it matters | Mitigation direction (not a decision) |
|---|---|---|
| Misrepresentation as a quote/guarantee/proof | Directly breaches the WD-I-003 guardrails (`:267`) and the ADR-015 agreement rule. Highest in shared/exported form (Option D). | Constrain copy and layout so no field reads as price offered, availability promised, or purchase proven; test this in comprehension prototyping. |
| Provenance drift | Showing synthetic `Sample` state as if confirmed would violate ADR-012 (`:56`) and ADR-015 (`:64`). | Receipt reflects the exact provenance class; `Sample` never enters the status set. |
| Freshness staleness | A saved or shared receipt (Options C, D) can outlive the freshness window and read as current. | Any retained artifact must carry and honor the capture time and the ADR-006/ADR-015 freshness meaning; a stale receipt must present as historical, not current. |
| Privacy: location, identity, persistent history | Register forbids precise user location, hidden identity, and persistent history by default (`:268`). | Prefer ephemeral/local-only; strip location; no server identity linkage; any persistence needs the open retention decision. |
| Dependency on an inert loop | The receipt targets confirmation/correction, which WD-I-001 shows records nothing today (`:40`). | Sequence WD-I-003 behind the WD-I-001 instrumentation question; do not build a live receipt over an inert loop. |
| Retention and account lifecycle | An undecided retention model (Option C) intersects ADR-021 deletion. | Resolve retention explicitly before Candidate; consult ADR-021 for device-and-account interactions. |
| Accessibility of a dense artifact | A compact receipt packs provenance, age, and limitations into little space; the register lists accessibility review as a dependency (`:272`). | Include comprehension-with-accessibility in the prototype, not after. |

## 5. Recommendation

**Continue Discovery. Do not move to Candidate yet. Authorize no data, no lane, no ADR.**

1. The one cheap, safe, dependency-free learning available now is the register's own
   smallest learning step (`:260`): prototype the receipt information hierarchy on
   non-sensitive sample content and test comprehension, framed strictly as an ephemeral
   in-app representation (Option B) so no retention or privacy decision is prejudged. The
   testable claim is the success signal (`:264`): people can accurately state what was
   known, its age, its limitations, and the next action. This can proceed without touching
   the shared database, without instrumentation, and without a receipt carrier decision.
2. Specify, up front, that any receipt is a faithful read-only mirror of the ADR-015
   admissibility state with no added claim surface. This keeps the prototype honest and
   makes the later carrier decision cleaner.
3. Hold the carrier choice (ephemeral vs local-only vs share) and any live build behind two
   gates that Discovery cannot close: the WD-I-001 outcome-instrumentation question, and the
   register's privacy/retention decision (`:271`). Persistence and sharing are Candidate-stage
   questions, not Discovery ones.

This recommendation changes no product behavior, mutates no shared database, and claims no
lane. It proposes only bounded, reversible comprehension learning inside the existing
Discovery boundary.

## 6. Exact next question

> Does Product & Portfolio (with Founder review, since retention and sharing may be
> consequential) approve a non-implementation comprehension prototype of the WD-I-003
> receipt on non-sensitive sample content only, presented as an ephemeral in-app
> representation that mirrors the ADR-015 admissibility state with no added claim surface,
> on the explicit condition that the carrier choice (ephemeral, local-only, or explicit
> share), any persistence or retention, and any live build stay deferred until the WD-I-001
> outcome-instrumentation question and the privacy/retention decision are resolved; or
> should WD-I-003 remain in Discovery with no prototype until those upstream dependencies
> are settled first?
