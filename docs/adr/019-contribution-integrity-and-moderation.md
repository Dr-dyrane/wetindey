# ADR-019: Contribution integrity is transactional, moderated, and fail-closed

**Status:** Accepted
**Date:** 2026-07-18
**Decision owner:** WetinDey owner
**Scope:** Public Food reports, visit confirmations, idempotency, rate enforcement,
moderation, corrections, audit, and current-state projection

## Context

WetinDey asks people to make real journeys from current local information. A public report
therefore cannot become public truth merely because its payload is well formed.

The live contribution paths were contained after review established that:

- anonymous public mutations were open without an effective abuse boundary;
- every report was immediately approved;
- one unavailable report could blank a seller's result;
- observation and projection writes were separate and race-prone;
- retries had no durable idempotency contract or effective server-side rate policy; and
- unavailable could inherit or manufacture a price.

Containment now fails closed and has passed static and browser refutation. It must not be
removed by restoring the old write behavior. Safe reporting requires a new integrity
boundary first.

[ADR-003](003-identity-for-contribution-trust.md) keeps browsing anonymous permanently and
permits anonymous contribution. Authentication is recognition, not a publication bypass.
[ADR-012](012-observation-provenance-boundary.md) classifies a direct human report as
`observed`, but provenance is not moderation. [ADR-015](015-observation-provenance-admissibility.md)
admits observed evidence to V1 confidence, but admissible origin is not approval.
[ADR-014](014-pillar-baselines-and-release-migrations.md) governs the later database
release.

## Decision

WetinDey accepts public Food reporting only through a transactional, idempotent,
rate-enforced pending-evidence boundary. A submitted report is not published. It becomes
eligible to affect a public current-state projection only after an authorized moderation
decision approves it and every domain invariant still holds.

The implementation release is `0013` or later. It follows the corrected Presence `0012`
technically; this ADR does not apply either migration or authorize deployment.

## Domain invariants

### 1. Reports are immutable pending evidence

An accepted submission creates one immutable observation assertion in `pending`
moderation state. Its subject, place, item, unit, availability, price assertion,
provenance, normalized payload digest, author attribution, and capture time are not
updated in place.

Later clarification never rewrites the assertion. A contributor correction creates a new
observation linked to the earlier one. A moderation outcome creates a separate append-only
decision. Effective status is derived from the decision history; audit history is not
replaced by a mutable final answer.

Deletion, retention, and lawful data-subject handling may redact separately governed
personal data, but must not silently rewrite the historical claim or fabricate a different
one.

### 2. Unavailable forbids price

Availability and price form one discriminated claim:

- `unavailable` permits no price amount, minimum, maximum, range, or copied current price;
- an available price must be finite, positive, use an allowed price kind and unit, and
  satisfy ordered range bounds; and
- an unavailable observation is excluded from every price-band calculation.

The server validates this before persistence and the database enforces the same invariant.
Neither a client default nor an existing offer may supply a price for unavailable.

### 3. Admission is durably idempotent

Every contribution admission carries a client-generated idempotency key. The server
scopes it to the operation and a server-resolved idempotency subject, then stores it
durably with a digest of the normalized request and the stable result. For an anonymous
contributor, that subject is a data-minimized contribution/session key, not proof of a
known person and not reputation.

- Repeating the same key with the same digest returns the stored result and creates no
  second observation, rate charge, moderation item, audit admission, or projection write.
- Reusing the key with a different digest returns an idempotency conflict and creates no
  observation, rate charge, moderation item, or projection effect. A separately protected
  abuse/audit event records the attempt.
- A process crash, timeout, reconnect, double tap, or concurrent retry cannot produce a
  partial or duplicate admission.

Client queue state is intent awaiting server admission. “Queued” does not mean submitted,
saved, approved, published, or guaranteed to sync.

### 4. Rate enforcement is atomic and server-side

Rate limits are enforced durably at the same admission boundary as the observation.
Applicable data-minimized subject keys may include attributed account, anonymous
contribution/device risk key, network risk bucket, operation, place, and item. Clearing a
client queue or retrying from another tab does not reset a durable limit.

Limit inspection and consumption are concurrency-safe. A rejected request consumes no
observation or projection write; an idempotent replay consumes no additional allowance.
A limited response supplies a stable request ID and a truthful recovery interval without
exposing internal abuse signals.

Authentication, attribution, reputation, and rate limits remain separate. A signed-in
actor is still rate-limited; an anonymous actor is not presented as a known person.

### 5. Admission is one transaction

One database transaction:

1. resolves the server-known contribution subject and provenance;
2. validates the normalized domain claim;
3. resolves or reserves the idempotency record;
4. locks and enforces applicable rate state;
5. inserts the immutable pending observation;
6. appends the admission audit event; and
7. stores the stable response.

Any failure rolls back all seven effects. No admission transaction modifies the public
current-state projection.

### 6. Moderation and projection are one transaction

An authorized moderation command appends an approve or reject decision with actor,
timestamp, reason code, request ID, and evidence references. If approval changes the
effective evidence set, that same transaction recomputes the affected projection from
approved, admissible observations and appends the projection-transition audit event.

Pending, rejected, superseded, synthetic, reference, inferred, or otherwise inadmissible
evidence cannot enter a live contribution projection. Synthetic demo fallback remains
governed by ADR-015 and must stay visibly labelled; it is not approved public contribution
evidence.

There is no direct “set current offer from payload” path. Projection is a deterministic
result of the approved evidence set, freshness policy, and conflict policy.

### 7. One report cannot blank a seller

A single unavailable report, including one approved observation, cannot by itself:

- change a public projection to unavailable;
- remove or hide a seller, place, item, or current available result;
- erase a price projection; or
- suppress contradictory approved evidence.

Publishing unavailable requires either sufficient independent approved corroboration
under a versioned policy or a separate authorized moderation resolution. Replays,
corrections from the same subject, shared anonymous identity, and multiple transport
attempts do not count as independent corroboration.

Until that threshold is met, an approved contradictory report may produce an explicit
conflict or caution state, but never last-write-wins blanking. The prior result retains its
own freshness treatment and is not silently refreshed by the contradiction.

### 8. Corrections and decisions are append-only

A correction links the new assertion to the observation it corrects and enters pending
moderation independently. Approval may supersede the earlier assertion for projection
purposes, but does not delete or mutate it.

Moderation decisions are append-only. Reversal requires a new decision that references
the prior decision, includes a reason, and recomputes the projection atomically. Authorized
operations staff can reconstruct who asserted what, who decided what, and why the public
state changed.

## Public and operations behavior

After safe reporting is activated:

- a successful admission says the report was received for review and does not claim it is
  public;
- a replay returns the same truthful status;
- an idempotency conflict asks the client to start a new submission;
- a rate-limited response gives a recovery time and request ID;
- unavailable never displays or accepts a price;
- pending and rejected reports do not change public availability or price; and
- conflicting approved evidence is visible as conflict or caution rather than silently
  selecting the newest report.

Operations access is separately authorized and least-privileged. Public responses never
expose email, raw network identifiers, internal risk signals, private evidence, moderator
notes, or internal source reputation.

Every admission, idempotency conflict, rate decision, moderation decision, correction
link, and projection transition is auditable with a stable request or command ID. Audit
records must be sufficient to reconstruct the transition without becoming a second
mutable source of domain truth.

## Compatibility and activation sequence

1. Integrate and independently prove corrected Presence migration `0012`.
2. Claim the exact desired-state pillars, release migration, snapshot, journal, manifest,
   application, operations, and validation paths for one later implementation lane.
3. Add the `0013+` data boundary and constraints without enabling public mutations.
4. Preserve historical observations as historical/legacy evidence. Do not mass-approve,
   re-author, or reinterpret them as independently moderated.
5. Prove existing-parent upgrade and blank reconstruction under ADR-014, including
   transaction rollback, concurrency, constraints, grants, and immutable audit history.
6. Deploy server admission and moderation capability fail-closed while public projections
   still exclude new pending evidence.
7. Reconcile and prove the approved-only projection from the intended admissible evidence
   set; do not trust the previous auto-approved projection as moderation evidence.
8. Activate reporting only after independent source, database, and browser refutation.
   Rollout authorization remains target-specific.

Old application versions must remain rejected throughout the transition. Schema presence
alone does not reopen reporting, approve rows, or authorize an offline queue.

## Independent refuter criteria

The later implementation defaults to **REFUTED** unless independent evidence proves all of
the following:

1. Same-key/same-payload sequential and concurrent retries create exactly one pending
   observation, one rate consumption, and one linked admission audit event, then return
   one stable result; replay creates none of those effects again.
2. Same-key/different-payload retries return conflict and create no admission, domain,
   quota, moderation, or projection effect; each conflict response has one protected
   linked audit event and stable request ID as its only permitted durable change.
3. Injected failure after each admission step leaves no partial observation, rate charge,
   audit event, or idempotency result.
4. Concurrent limit-edge requests cannot exceed the durable allowance, every allow or
   deny decision has its protected linked audit record and stable request ID, and an
   idempotent replay creates no second rate charge or rate-decision audit.
5. Unavailable plus any price shape is rejected by both server validation and database
   constraint; unavailable never manufactures a price.
6. Pending, rejected, superseded, and inadmissible observations cannot change a public
   projection.
7. One unavailable observation cannot blank an available seller/result, including under
   concurrent moderation and projection recomputation.
8. Contradictory approved evidence produces the specified conflict behavior without
   last-write-wins data loss.
9. A correction and a moderation reversal append linked records; prior assertions and
   decisions remain reconstructable.
10. Projection and moderation audit effects commit together or roll back together.
11. Authorization prevents contributors and ordinary readers from making moderation
    decisions or reading private moderation/audit material.
12. A signed-out anonymous contributor reaches the same pending, idempotent, rate-limited
    moderation boundary through a data-minimized subject that is not represented as a
    known person or reputation; signing in grants no publication, rate, or moderation
    bypass.
13. Browser evidence proves signed-out reporting plus truthful received-for-review, retry,
    rate-limit, unavailable,
    conflict, focus, offline, and recovery behavior without promise copy or duplicate
    network writes.

A clean build, generated migration, row count, or self-review is not sufficient evidence.

## Consequences

**Improves.** Public state is derived from reviewable evidence rather than raw mutation.
Retries are safe, abuse controls are durable, unavailable cannot fabricate price, one
report cannot erase a seller, and every correction or decision remains explainable.

**Costs.** Reporting now requires additional storage, transactions, moderation operations,
conflict presentation, privacy review, and adversarial concurrency testing. Publication is
slower because admission and approval are intentionally separate.

**Constrains.** No report may auto-approve, no client may write a current projection, no
offline queue may promise sync, and no implementation may trade append-only evidence for
an easier mutable status workflow.

## Non-goals

This ADR does not design reputation weights, make verification purchasable, authorize
seller roles, define evidence-media retention, promote public-source ingestion, create a
generic Trust Graph, add another vertical, apply `0012` or `0013+`, access a database,
reopen Production reporting, or authorize deployment.

## Review triggers

Review before the first `0013+` migration is frozen, before public reporting is
reactivated, after any moderation-policy threshold changes, and after any integrity event
in which duplicate, rejected, pending, or single-source evidence affects public state.
