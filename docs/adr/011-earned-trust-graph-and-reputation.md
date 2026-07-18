# ADR-011: Earned Trust Graph, scoped reputation, and non-purchasable verification

**Date:** 2026-07-17  
**Status:** Proposed  
**Owners:** Dr Dyrane Alexander

## Context

WetinDey's durable advantage is not a star average or a generic verification badge. It is
the ability to explain why a time-bound local claim deserves belief.

The current repository has parts of that system, but they do not yet form one trustworthy
model:

- optional email-OTP identity exists;
- recognized writes resolve a source and populate `sources.user_id`;
- recognized contributors currently start with reliability `75`, while the shared seeded
  anonymous Contributor source is `98`;
- observation writes and the interactive read path now call one `assessTrust` model;
- cards, item details, Get-It, and narrowed map markers receive the same server-derived
  status and confidence answer;
- moderation vocabulary exists without a moderator or auditable decision path;
- ADR-012 and migration `0009` classify synthetic, observed, partner, reference, and
  inferred data, but `0009` remains unapplied to shared environments;
- the current trust query still admits every non-rejected provenance class, so T1's
  authoritative result is not yet an admissible public result;
- `places.verification_status` is an unstructured string;
- and review tables exist without live read/write paths, reliable anonymous vote
  uniqueness, or moderation.

Identity attribution and one read/write trust model are present, but earned reputation is
not. ADR-015 now governs which evidence may enter that model. Local implementation may be
statically refuted before rollout; deployment remains blocked behind the target
environment's authorized `0009` application.

This ADR defines an evolutionary architecture. It does not authorize a graph database,
trust service, generic edge table, reputation schema, review launch, RLS rollout, partner
API, reward program, or new confidence formula during the integration freeze.

## Proposed decision

If accepted, the **Trust Graph** will be a logical graph over typed relational records. It
will describe how sources, observations, evidence, outcomes, verification assertions, and
reputation influence confidence in a specific claim.

It is not a separate deployment, graph store, event bus, social graph, or universal score.

### Separate concepts

| Concept | Question answered | Rule |
|---|---|---|
| **Identity** | Who or what is this actor? | Proves continuity or control, not truthfulness. |
| **Source** | Through which person, organization, dataset, device, or system did this contribution arrive? | Every contribution has one accountable source and provenance. |
| **Reputation** | How accurate has this source's independently validated history been in this scope? | Scoped, versioned, sample-aware, and earned from outcomes. |
| **Confidence** | How strongly does admissible evidence support this claim now? | Claim-specific, time-bound, explainable, and freshness-gated. |
| **Verification assertion** | What specific fact was checked, by whom, under which criteria, and until when? | Typed, attributable, expiring, and revocable. |
| **Lifecycle status** | May this subject participate? | Active, suspended, revoked, or closed; not a reputation score. |
| **Authorization role** | What protected operation may this actor perform? | Separate from status and reputation; deferred until a real operation and operator exist. |
| **Earned recognition** | Which understandable label follows from a versioned reputation policy? | Derived and scoped; never purchased. |
| **Reward eligibility** | May an external partner optionally recognize an outcome? | One-way output only; requires a separate future ADR. |

### Earned status and verification tiers

The platform must not collapse distinct meanings into one blue tick.

Examples map to separate systems:

- `Verified Identity` and `Verified Business Control` are verification assertions.
- `Trusted Contributor`, `Local Guide`, `Market Expert`, `Pharmacy Expert`, `Fuel Expert`,
  `Trusted Seller`, and `Community Leader` are possible earned recognitions.
- `Moderator` or `Partner Ingest Operator` are authorization roles.
- `Active`, `Suspended`, and `Revoked` are lifecycle statuses.

Badges are projections of these records, not source-of-truth booleans. Every public badge
must explain what it means and must not imply that every future claim is correct.

### Reputation model

Reputation is built from append-only, idempotent events produced by independently validated
outcomes, audits, or actor-attributed moderation decisions.

Examples include:

- a later visit matches a contributor's price or availability report;
- an accepted correction is confirmed independently;
- a seller's advertised price, stock, or hours repeatedly match observed outcomes;
- a submitted edit is accepted after review;
- a business-control check succeeds;
- or an evidence artifact is verified under a documented policy.

Reputation snapshots are disposable projections. They include:

- subject and scope;
- policy version;
- positive and negative outcome counts;
- sample size and uncertainty;
- decay state where the domain justifies it;
- last supporting event;
- and reason codes.

There is no universal human worth score. Reputation may be scoped by signal type, category,
place, evidence method, or seller operation. A strong food-price history does not
automatically make someone a medicine or power expert.

Corrections use compensating events rather than silent history edits. Appeals, retention,
and account-erasure behavior must be decided before public reputation launches.

### Confidence model

Confidence belongs to one typed claim in context and time. It may consider:

- admissible independent evidence;
- freshness;
- scoped source reputation;
- evidence method;
- historical accuracy;
- conflicts;
- provenance;
- and anomaly signals.

It must not use simple majority voting or raw row counts.

Rules:

1. ADR-006 freshness is a hard gate for current Food claims. Reputation, verification,
   status, role, reward, or sponsorship cannot extend it.
2. Repeated reports from one principal, device, organization, feed, or common upstream
   dataset remain one bounded independence group.
3. Reputation can bound evidence weight. It cannot create evidence.
4. Conflicting fresh evidence remains visible rather than being averaged into false
   certainty.
5. Synthetic, demonstration, inferred, and reference-only records cannot generate live
   confirmation, learned reputation, reward eligibility, or verified-decision metrics.
6. A confidence result cannot reward its author by itself. A later independent outcome,
   audit, or moderation decision is required, avoiding circular self-validation.
7. Every assessment exposes a qualitative band, freshness, reason codes, provenance
   summary, conflict summary, independent-source summary, policy version, and calculation
   time.

No new coefficients or trust-band thresholds are accepted here. ADR-006's current Food
algorithm remains the implementation baseline until real outcome data supports an
amendment. The repository must first make that algorithm authoritative on every live read.

### Contributor and seller trust

Contributor reputation may be earned through accurate confirmations, accepted corrections,
verified evidence, valid edits, and independently corroborated outcomes.

Seller reputation may be earned through observed price accuracy, stock accuracy, verified
hours, response quality under a defined measurement policy, and consistency over time.
Seller payment, advertising, sponsorship, subscription, or reward participation cannot
create reputation or verification.

### Reviews

Reviews are subjective evaluations. They remain separate from factual current-state claims.

- Review reputation may affect review credibility only after identity, moderation, and
  abuse controls are live.
- A review may create a reputation event only after an independent validation or
  actor-attributed moderation outcome.
- Stars and helpful votes do not prove price, availability, power status, or another live
  claim.
- Factual statements inside reviews enter the Trust Graph only through a separate validated
  observation path.
- Owner responses, media, AI summaries, and helpful ranking do not mutate offer confidence.
- AI summaries, if later approved, must cite covered reviews, expose uncertainty, and have
  no authority to create verification or reputation.

ADR-009's schema remains quarantined until a live vertical includes author identity,
duplicate-vote prevention, moderation, read/write paths, and tests in the same change.

### Rewards firewall

The trust architecture reserves a one-way boundary through which a future accepted policy
could expose reward eligibility to a partner.

It does not approve a reward program. Contributor compensation remains open. Any program
requires a separate ADR covering incentives, gaming, tax/legal, privacy, eligibility,
appeals, and partner behavior.

A reward, payment, perk, discount, sponsorship, or promotional relationship can never:

- create identity verification;
- create a verification assertion;
- add reputation;
- approve moderation;
- raise claim confidence;
- alter organic ranking;
- hide stale or negative evidence;
- or grant access to private identity or location data.

WetinDey will not add wallets, balances, payouts, settlement, checkout, orders, dispatch,
tracking, or fulfilment under this architecture.

### Permissions and privacy

Current database migrations define no RLS policy. Server Actions and query policy remain
the live authorization boundary.

Future access principles are:

- anonymous readers receive approved public projections only;
- anonymous contributors write only through validated, rate-limited actions;
- recognized contributors may read safe explanations of their own history;
- partner sources may write only to their own staged provenance scope;
- moderators append scoped decisions and cannot rewrite evidence history;
- derivation workers write disposable projections only;
- reward partners receive explicit eligibility exports only;
- and public users never receive private evidence, exact identity bindings, internal fraud
  scores, or precise contributor location.

Generalized RBAC remains outside V1. A role model becomes justified only with a real
protected operation and actor.

## Current compatibility boundary

`sources.reliability_score_internal` is an interim prior/cache, not earned reputation. It
has no event history, scope, sample size, uncertainty, or policy version. The anonymous
`98` versus recognized `75` inversion must be corrected before reputation affects a public
result.

`offers_current.trust_level` is an interim projection. T1 now routes interactive reads
through one assessment, but it cannot be treated as authoritative until ADR-015 excludes
inadmissible provenance and isolates mixed synthetic/observed projections.

`places.verification_status` cannot back a `Verified only` filter. Review aggregates cannot
back a rating filter until review authenticity and moderation are live.

## Relationship to existing decisions

- **ADR-001 remains controlling.** Trust and rewards do not introduce transactions or
  fulfilment.
- **ADR-002 remains controlling.** Trust stays pure domain logic inside the modular
  monolith until real boundaries are earned. No trust service or graph database.
- **ADR-003 would be amended.** Attribution is now wired; the remaining problem is safe
  reputation semantics, rate limiting, and independent outcomes. Anonymous browse and
  anonymous contribution remain possible.
- **ADR-006 remains controlling.** The 24h stale / 72h expired Food policy is not reopened.
  Read-side authority remains incomplete.
- **ADR-009 would be amended.** Reviews can interoperate with identity and reputation only
  through the boundaries above.

## Alternatives considered

**A paid or manual blue tick.** Rejected. It conflates identity, status, reputation, and
confidence and makes trust purchasable.

**One mutable reliability score.** Rejected as the long-term model. It cannot explain
scope, sample size, policy version, uncertainty, or why a score changed.

**A generic graph database or edge table.** Rejected. The graph is logical; typed
relational records preserve domain meaning and fit the current deployment.

**Use reviews and helpful votes as reputation directly.** Rejected. Popularity is not
validated accuracy and is easy to manipulate.

**Build rewards with reputation now.** Rejected. Incentives before provenance, moderation,
and abuse controls would corrupt the signal being rewarded.

## Consequences

**Improves.** Trust becomes explainable, scoped, earned, and reusable across typed local
claims without becoming a popularity contest.

**Costs.** Reputation requires real outcome data, moderation actors, auditability, policy
versioning, privacy decisions, and calibration. It cannot be manufactured from the current
seed.

**Constrains.** No public reputation, status tier, verification filter, rating filter, or
reward integration may launch from the current scalar fields alone.

## Validation and review

This ADR remains Proposed until the owner accepts the concept boundaries, amendment scope,
and phased gates.

Before V1.5 reputation work:

- migration lineage is reproducible;
- provenance separates synthetic and observed records;
- one read-side confidence path is authoritative;
- contribution writes are atomic and idempotent;
- source independence is defined;
- real outcomes exist for calibration;
- moderation has an actor and audit path;
- erasure, retention, appeal, and public explanation policies are approved;
- and an adversarial reviewer can reproduce every public trust claim.
