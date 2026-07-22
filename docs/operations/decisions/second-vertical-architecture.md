# Second vertical architecture: the typed-capability contract every non-Food category must satisfy

**For:** WetinDey Founder (decision owner)
**Prepared by:** Terra, controller-directed (product architecture)
**Date:** 2026-07-22
**Status:** Architecture, released for design, not launch.
**Governs:** the revisit conditions of register entry WD-P-001 (non-Food selectable category launch)
**Reads:** proposed [ADR-010](../../adr/010-typed-live-local-information-platform.md) (typed live local information platform)

> This document authorizes no launch. It opens no lane, adds no category to the selector,
> installs no dependency, writes no application code, declares no schema, generates no
> migration, applies no migration, mutates no shared database, changes no user-facing copy,
> and triggers no deployment. It does not override, amend, or accept proposed ADR-010; it
> reads ADR-010's launch gate and turns it into a per-capability contract and a readiness
> posture. Any feature it describes is built later, in a separate path-scoped lane,
> fail-closed and default-off, with migrations generated-not-applied, and only after the
> Founder decision at the end of this document.

---

## 0. What this document is

WD-P-001 in the [portfolio register](../PORTFOLIO-AND-IDEA-REGISTER.md) is Parked with a
one-line requirement: a future category "must carry its own typed signal, provenance,
freshness, conflict, contribution, map, search, filters, trust explanation, legal caveats,
outcome, operations, and refutation." Proposed ADR-010 states the same gate in prose. Neither
says, concretely, what "carry" means per dimension, nor how the platform stays a Food pilot
today without pre-building a speculative category framework.

This document answers exactly that. It is the typed-capability contract: the thing any
second vertical (Aboki FX / Exchange, Power, Transport, Health, Home, or Community) must
present before it may appear as a launched, selectable capability. It is written so the
Founder can later point at one artifact and ask "does this capability satisfy every clause,"
and so an independent refuter can default the answer to no.

It is architecture, not a launch. It launches nothing. It changes no code. It records the
shape the next real vertical must take, and the exact decision that would authorize the first
one.

## 1. Context

WetinDey has one complete local capability: Food. It is the sole launch phase (Food Truth &
Pilot Operations). The category selector shows more pillars than the product can honestly
answer. ADR-010 named this: labels widened without the domain semantics widening, so a
seeded category value or a changed page title is not a capability.

Money & Exchange is the only other selectable context, and it is deliberately bounded.
[ADR-017](../../adr/017-cbn-reference-rate-converter.md) enabled a provider-aware CBN/Frankfurter
reference converter and a labelled map-listing discovery surface. ADR-017 states, in its own
words, that it "creates no database table, observation, offer, trust score, freshness rule,
seller, verified exchanger, contribution path, rate history, or generic category abstraction"
and "does not satisfy the launch gate for a future local Exchange capability." That converter
is therefore a reference utility, not a launched second vertical, and this contract treats it
as such. A full Aboki FX / local Exchange capability (parallel-market claims, exchanger
observations, contribution, trust) is a distinct, unbuilt thing that would have to pass every
clause below.

The risk this contract exists to prevent is the repository's original failure repeating at a
larger scale: forcing an unrelated domain through Food's item, unit, price, seller, and
purchase model; or, worse, escaping that by collapsing every domain into one EAV or JSON
"value" column that moves correctness out of the schema. ADR-010 forbids both. A price is not
a power state; a reference rate is not an exchanger's executed rate; a route status is not
stock availability. Each must earn its own typed model.

## 2. The contract in one line

> A category may launch only when it carries a complete, independently refuted typed capability
> across all thirteen dimensions below, and Food is not weakened to make room for it.

Partial readiness is not readiness. A capability that has a beautiful map but no moderated
contribution path, or a typed signal but inherited Food freshness, is refuted. The dimensions
are conjunctive.

## 3. Staying Food-pilot-focused now while being architecturally ready

Readiness is a written contract and a shared logical envelope, not a code framework. ADR-010
is explicit: no interface, registry, empty capability folder, dynamic plugin system, or unused
Food implementation may be added during V1, and extraction of any shared abstraction becomes
valid only after at least two capabilities are real, live, and wired to every surface. Building
a category-plugin system now would produce exactly the dead code the platform already paid for
once.

So "architecturally ready" today means five things, all of which are true without touching
runtime code:

1. **The contract exists** (this document). The next vertical has a target to hit and a
   refuter has a checklist.
2. **The shared metadata envelope is understood, not implemented.** ADR-010 lists the metadata
   every signal family may share (source and identity attribution, provenance, observed and
   submitted times, location or area context, evidence references, moderation state,
   idempotency, freshness, conflict, confidence, policy version). The primary claim stays typed
   per family. The physical design (a common observation envelope with typed claim-detail
   tables, or separate typed vertical tables under a shared logical contract) is deferred until
   a second real vertical exists and the migration history is reproducible. This document does
   not choose the DDL and does not authorize one.
3. **Food is treated as the reference implementation, not the universal model.** When a second
   vertical is built, the honest question is which parts of Food's contribution integrity
   (ADR-019), provenance admissibility (ADR-012/ADR-015), and freshness (ADR-006) are genuinely
   signal-independent. Those parts are candidates for later extraction; the price-shaped parts
   are not.
4. **The selector tells the truth in the meantime.** Until a second category passes this
   contract, the honest state is Food as the working context plus the bounded ADR-017 reference
   utility, not a selector implying six live verticals. A disabled or reference-only row is not
   a launched capability and must not be presented as one.
5. **No abstraction is extracted before it is earned.** ADR-010's extraction gate stands
   unchanged: two real live capabilities, both wired to map, search, sheet, filters,
   contribution, sort, copy, and trust; the abstraction removes observed duplication; every
   export has a live caller; and ADR-002 phases and the migration and provenance gates are
   complete. This document adds nothing to that gate and removes nothing from it.

## 4. The typed-capability launch contract

Each clause names what the capability must carry and the governing decision it must stay
consistent with. All thirteen are required.

### 1. Typed signal and subject

The capability declares its own signal type and its own subject, both typed, neither borrowed
from Food. The signal is the typed family of nearby state (for example exchange rate, power
status, route status, service availability, or event status). The subject is the thing whose
state is described (currency pair, power area, route, service listing, event, place), not an
item variant unless the domain genuinely is goods.

The primary claim is a real typed proposition enforced by the schema. It must not live in an
EAV table, a `field/operator/value` query language, a universal `value` column, or generic
JSON as its only enforceable representation. JSON remains permitted only for non-authoritative
adjunct metadata. A capability that needs a currency formatter, sale unit, seller, or purchase
outcome for a signal that is not a goods price is refuted on sight (ADR-010).

### 2. Provenance and admissibility

Every claim carries source and identity attribution and a provenance classification consistent
with [ADR-012](../../adr/012-observation-provenance-boundary.md). Only admissible provenance may
reach a live projection, consistent with
[ADR-015](../../adr/015-observation-provenance-admissibility.md). Synthetic or demonstration
content stays visibly labelled Sample and can never manufacture confidence or corroboration.
Reference or provider-listing data (as in ADR-017) is context, never nearby observed evidence,
and cannot be promoted into the capability's evidence set.

### 3. Freshness

The capability defines evidence-backed freshness windows for its own signal. It does not
inherit Food's 24h/72h windows automatically ([ADR-006](../../adr/006-freshness-windows.md)). A
power outage state ages differently from a shelf price; an exchange reference ages differently
from an exchanger's quoted rate. Freshness, staleness, and the copy that discloses them are
signal-specific and must be justified, not copied.

### 4. Conflict

The capability defines conflict semantics for contradictory admissible evidence. It must not
use last-write-wins. Consistent with [ADR-019](../../adr/019-contribution-integrity-and-moderation.md),
a single report cannot by itself blank or overwrite an existing result; contradiction surfaces
as an explicit conflict or caution state, and changing a public state to the contradicting
claim requires sufficient independent corroboration under a versioned policy or a separate
authorized moderation decision. Replays, corrections from the same subject, and shared anonymous
identity are not independent corroboration.

### 5. Contribution

If the capability accepts public reports, it does so only through the transactional, idempotent,
rate-enforced, fail-closed pending-evidence boundary of ADR-019, with the payload typed for this
signal rather than for Food. A submitted report is pending evidence, not published truth;
publication requires an authorized moderation decision and every domain invariant still holding.
Reports are immutable; corrections and moderation decisions are append-only; admission and
projection are separate transactions. Anonymous contribution reaches the same boundary through a
data-minimized subject and is never presented as a known person. If media may accompany a report,
it follows [ADR-028](../../adr/028-contribution-evidence-media.md): optional, corroborating,
metadata-stripped on ingest, and public only for approved reports. A capability with a write path
that bypasses this boundary is refuted.

### 6. Map

The capability declares its own marker semantics and its own map behavior. Markers mean what the
signal means (a power area is not a price pin; a labelled map listing is not a verified place).
The single persistent Mapbox instance is reused, not recreated, on context switch, as ADR-017
established. Switching into the capability replaces Food markers with the capability's own layer;
switching out restores Food without reinterpreting state across signals.

### 7. Search

The capability declares its own search vocabulary, suggestions, and query semantics. Food's
item/variant/unit/price query is not reused for a non-goods signal. Where AI-routed General
Search later exists ([ADR-027](../../adr/027-ai-routed-general-search.md)), this capability may be
an allowlisted route only after it is itself live and independently proved; General Search does
not accelerate an unbuilt capability, and the model never writes the capability's facts.

### 8. Filters

Filters belong to the capability. It declares only the filters its live query actually enforces;
a filter that does not change the query is not shown. Active-filter counts include non-default
enforced filter dimensions, not raw values, sort, search text, category, or global location
(ADR-010). Common filter concepts (distance, freshness) may be reused conceptually, but each
capability owns which of them it enforces.

### 9. Trust explanation and confidence

The capability has an explainable confidence path: a person can see why a claim is trusted or
uncertain (freshness, corroboration, provenance, conflict), in the capability's own language.
Confidence is earned from admissible evidence, never purchased and never manufactured by media
or by a single source. Reputation and any Trust Graph remain governed by their own decision
([ADR-011](../../adr/011-earned-trust-graph-and-reputation.md), proposed) and are not a
precondition this contract silently imports.

### 10. Legal caveats

The capability carries category-specific legal caveats. Fulfilment stays out of scope for every
category ([ADR-001](../../adr/001-fulfilment-is-out-of-scope.md)): no checkout, payment, dispatch,
tracking, delivery, or orders. Domain-specific caveats are mandatory where the domain invites a
false claim: an Exchange capability must state that WetinDey does not exchange money and must not
label a rate executable, or a street trader "licensed," without licence and outlet evidence
(ADR-017); a Power capability must not imply utility authority; a Health capability must not imply
clinical or dispensing authority. Location disclosure follows
[ADR-023](../../adr/023-browsing-context-and-device-location.md).

### 11. Outcome

The capability defines at least one outcome metric: an observable user or operating result that
tells the platform whether the capability reduced a real uncertainty (for example a confirmed
correct power state, or a wasted-trip avoided). A capability with no way to learn whether it
helped cannot be evaluated after launch and is refuted.

### 12. Operations and coverage

The capability has an operationally grounded data source and a named operating owner: who sources
the initial evidence, who moderates contributions, and what coverage the pilot honestly has.
Coverage limits are first-class: the capability says where, when, and for which subjects its
evidence is sufficient, weak, stale, conflicting, or absent, rather than implying a sparse or
empty result means reality is known. Moderation capacity and abuse controls exist before public
writes, not after.

### 13. Refutation

The capability ships with an adversarial refuter that defaults to REFUTED. A clean build, a
generated migration, a row count, or a self-review is not evidence. Independent source, database,
and browser refutation must try to break typed separation, provenance admission, freshness,
conflict, contribution integrity, trust explanation, legal caveats, and accessibility, and fail
to break them, before the capability is called ready.

### Cross-cutting: state behavior and empty-state language

Across all thirteen, the capability must define its offline, stale, correction, and error
behavior, and its category-specific empty-state language. An unknown state stays unknown and
labelled; it is never dressed as a confident answer. Accessibility (keyboard, screen reader,
compact and regular, light and dark, reduced motion, 44 by 44 point targets) is required, not a
follow-up.

## 5. Worked readiness checks (illustrative, launching nothing)

These examples show how the contract reads a candidate. They authorize nothing and launch
nothing.

**Aboki FX / local Exchange.** The ADR-017 converter is a bounded CBN/Frankfurter reference
utility and, by its own text, does not satisfy this gate. A launched Exchange capability would
need: a typed exchange-observation signal distinct from a reference rate (clause 1); provenance
separating a contributor-observed exchanger rate from a provider reference (clause 2); freshness
tuned to how fast a parallel rate moves, not Food's windows (clause 3); conflict handling for
disagreeing exchanger reports (clause 4); a moderated, idempotent, rate-enforced contribution
path for exchanger observations (clause 5); markers that mean observed exchanger, not reference
POI (clause 6); its own search and filters (clauses 7 and 8); a confidence explanation for a
volatile claim (clause 9); the "WetinDey does not exchange money" and licence caveats (clause 10);
an outcome metric (clause 11); a sourcing and moderation owner plus coverage honesty (clause 12);
and an independent refuter (clause 13). None of that exists. The reference converter remaining
selectable does not change this.

**Power (light) status.** A typed power-status signal (on, off, intermittent, unknown) for a
power area subject (clause 1); provenance for a resident report versus a utility feed if one is
ever admitted (clause 2); freshness reflecting how long an outage claim stays meaningful
(clause 3); conflict handling when one street reports light and another reports darkness in the
same area (clause 4); the ADR-019 contribution boundary typed for status, not price (clause 5);
area markers, not price pins (clause 6); status-shaped search and filters (clauses 7 and 8); a
confidence explanation (clause 9); a caveat that WetinDey is not the utility and does not restore
power (clause 10); an outcome (clause 11); a sourcing and moderation owner and honest coverage
(clause 12); and refutation (clause 13).

## 6. Relationship to existing decisions

- **ADR-010 (proposed) governs and is not overridden.** This document operationalizes its launch
  gate and its typed-claim, no-EAV boundary into a per-capability contract. Where ADR-010 is more
  specific, ADR-010 controls. Because ADR-010 is Proposed, a launch also requires its acceptance;
  a proposed ADR cannot satisfy an accepted-ADR dependency (register movement control 3).
- **ADR-001 remains controlling.** No category introduces fulfilment.
- **ADR-002 remains controlling.** Correctness and provenance precede any boundary or abstraction
  work; no category registry or generic module is authorized now.
- **ADR-006, ADR-012, ADR-015, ADR-019, ADR-028 remain controlling** for freshness, provenance,
  admissibility, contribution integrity, and evidence media respectively, and each clause above
  defers to them.
- **ADR-008 is the portfolio direction** for the six pillars and is amended in spirit by ADR-010:
  a category string and Food-shaped schema do not implement a pillar.
- **ADR-017 remains controlling** for the Money reference utility and is explicitly not a launched
  second vertical.
- **ADR-027 remains separate.** General Search can expose only capabilities that are already live
  under this contract.

## 7. Alternatives considered

**Pre-build a category-plugin framework now so verticals drop in later.** Rejected by ADR-010's
extraction gate and the platform's own dead-code history. An abstraction with one caller is
speculative scaffolding, not readiness.

**Force the second vertical through Food's item/unit/price/seller model.** Rejected. It corrupts
exchange, power, transport, and events into retail concepts.

**Collapse all categories into one EAV or JSON value model.** Rejected. It moves domain
correctness out of the schema and creates an unreviewable query language (ADR-010).

**Let a bounded prototype (such as the ADR-017 converter) count as the second vertical.** Rejected.
ADR-017 itself denies this, and a reference utility carries no contribution, conflict, freshness,
or trust model.

**Write per-dimension requirements only when the first candidate appears.** Rejected. Without a
contract in advance, "ready" becomes whatever the first candidate happened to build, and the
refuter has no independent standard.

## 8. Consequences

**Improves.** The next vertical has one target and one refutation standard. Food stays the sole
launch focus without freezing the platform's future. A launch decision becomes a checklist a
person can audit, not a vibe.

**Costs.** Each vertical must earn a complete domain model, an operating data source, and an
independent refuter. A category toggle is not a cheap content change. Readiness work is
documentation, not shippable product, so it produces no user-visible progress on its own.

**Constrains.** V1 stays Food (plus the bounded ADR-017 utility) until a second capability passes
all thirteen clauses. No registry, adapter, or generic module may be extracted before two real
live verticals exist. This document may not be cited as authority to launch, enable a selector
row, or open a build lane.

## 9. Non-goals

This document does not launch any category, does not enable or un-disable any selector row, does
not override or amend ADR-010, does not choose the second vertical, does not choose or generate
DDL or a migration, does not authorize a category registry or generic module, does not create or
change reputation or Trust Graph policy, does not access or mutate any database, and does not
authorize deployment. It does not move WD-P-001 out of Parked; only the Founder decision below,
recorded through the register's governed process, can do that.

## 10. Validation and review

Before any second vertical is called launch-ready, an independent refuter defaulting to REFUTED
must fail to break all of the following for the exact named capability:

1. the primary claim is a real typed proposition, not EAV, universal `value`, or JSON-only, and
   needs no Food price/unit/seller/purchase concept;
2. only admissible provenance reaches a projection; Sample and reference data cannot;
3. freshness is evidence-backed and signal-specific, not inherited from Food;
4. contradiction produces the specified conflict or caution state, never last-write-wins, and one
   report cannot blank a result;
5. every public write passes the ADR-019 pending, idempotent, rate-enforced, moderated boundary,
   typed for this signal, with append-only corrections and decisions;
6. map, search, filters, sort, and empty states are the capability's own and agree with its
   signal;
7. confidence is explainable and never manufactured by media or a single source;
8. category-specific legal caveats hold and fulfilment stays excluded;
9. an outcome metric exists and can be measured;
10. an operating source and moderation owner exist and coverage is stated honestly;
11. offline, stale, correction, error, and accessibility behavior are exercised in light and dark,
    compact and regular, keyboard and screen reader; and
12. Food is not degraded, reinterpreted, or blocked by the new context.

Review this contract if ADR-010 is accepted, amended, or rejected; if the first real second
vertical exposes a dimension this list missed; or if the shared-envelope DDL is later proposed.

## 11. The exact Founder decision a launch would need

Everything above is architecture. Launching the first non-Food capability requires one explicit,
attributed, dated Founder decision, recorded through the register's governed process as the
WD-P-001 disposition. Its exact form:

---

### WD-D-NNN: Launch the first non-Food typed capability

| Field | Record |
|---|---|
| Date | YYYY-MM-DD |
| Related idea | WD-P-001 |
| Decider | Founder |
| Decision | Approve launch of the named capability / Park / Reject |
| Consequential | Yes |
| ADR required | ADR-010 Accepted (precondition), plus this contract satisfied |
| Effective boundary | The one named capability only; no generic registry; Food pilot unchanged |
| Lane implication | None until a separate path-scoped lane is claimed in LANES.md |
| Review trigger | First field outcomes for the launched capability |

**Question decided:** Does WetinDey launch `<exact capability name, for example local Exchange or Power status>`
as its second selectable typed capability, and move WD-P-001 from Parked to Approved for that
capability only?

**The Founder authorizes launch only if all of the following are true, and states so explicitly:**

1. **ADR-010 is Accepted** (not Proposed), because it is the governing boundary and a proposed ADR
   cannot satisfy the dependency.
2. **The named capability satisfies every clause of section 4** and passes the section 10
   refutation, proved by an independent refuter defaulting to REFUTED, with source, database, and
   browser evidence, not a self-review.
3. **This is the second real, live capability**, so ADR-010's extraction gate is honestly met; any
   shared abstraction is extracted only from proven duplication, with every export having a live
   caller.
4. **Food is not weakened**: the Food pilot experience, data, and freshness are unchanged, and the
   selector stops implying capabilities that do not exist.
5. **The build stays safe**: any implementing lane is path-scoped, fail-closed, default-off, with
   its migration generated-not-applied and applied only later by the shared-database migration
   owner, and its rollout separately authorized per target.

**Founder decision (sign one):**

> "I approve launching `<named capability>` as WetinDey's second typed capability under this
> contract, conditions 1 through 5 met." OR "WD-P-001 remains Parked." OR "WD-P-001 is Rejected for
> `<reason>`."

Until that line is signed with conditions 1 through 5 met, WD-P-001 stays Parked, no non-Food
category launches, and this document has changed nothing but the clarity of what a launch would
require.
