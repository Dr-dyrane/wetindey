# ADR-010: WetinDey is a typed live local information platform

**Date:** 2026-07-17  
**Status:** Proposed  
**Owners:** Dr Dyrane Alexander

## Context

WetinDey has inherited two incompatible product models.

The original implementation and much of the repository describe a Lagos food price and
availability application. The newer product direction and the committed category selector
present WetinDey as a broader local discovery platform. The code has widened the category
labels without widening the domain semantics:

- `items`, `item_variants`, `units`, `observations`, and `offers_current` are goods and
  price-oriented structures.
- `CategorySelectorSheet.tsx` exposes multiple pillars, and `page.tsx` uses category in
  parts of search, popular results, metadata, and the header.
- Item detail, narrowed offers, contributions, map fallbacks, sharing, SEO, and outcomes
  still assume an item, sale unit, price, seller, and purchase.
- Seed content has represented non-price concepts such as grid-power hours through
  price-shaped values.
- The current category selector therefore changes some framing without proving a complete
  category capability.

This is not a harmless naming issue. Power status is not a price. An exchange rate is not
an item offer. A community event is not stock availability. A service review is not
evidence that a nearby factual state is current.

The owner-directed product correction is:

> WetinDey helps people understand the current state of nearby reality before they leave.

Food price and availability remain the current V1 vertical. They are not the universal
data model.

The repository is under an integration freeze while migration lineage, data provenance,
and hot-file ownership are reconciled. This ADR defines an evolutionary direction only.
It does not authorize schema, API, UI, map, or module work.

## Proposed decision

If accepted, WetinDey will be modelled as a **typed live local information platform**.

### Canonical domain language

| Term | Meaning |
|---|---|
| **Pillar** | A product-portfolio grouping such as Food, Home, Health, Money, Transport, or Community. A pillar is not a database value type. |
| **Category capability** | A selectable, complete vertical slice such as Food Markets, Power Status, Medicine Availability, or Exchange Rates. |
| **Signal type** | The typed family of nearby state, such as goods price, stock availability, exchange rate, power status, route status, service availability, or event status. |
| **Subject** | The thing whose state is described: an item variant, medicine, currency pair, route, power area, service listing, event, or place. |
| **Context** | Where, when, and under what local conditions a claim applies. |
| **Claim** | One typed proposition about a subject in context. |
| **Observation** | A source-attributed account of what was seen, measured, asserted, or confirmed at a particular time. |
| **Evidence** | Support for an observation or claim, such as a visit outcome, receipt, audit, or partner record. |
| **Current state projection** | A disposable derived answer representing the strongest admissible current claims for a subject and context. |
| **Decision result** | A user-facing composition of typed state, context, freshness, confidence, provenance, conflicts, and next actions. |

Price remains one signal type. `Offer` remains a Food compatibility term, not a universal
platform noun.

### Shared observation metadata and typed claims

All signal families may share:

- source and identity attribution;
- provenance;
- observed and submitted times;
- location or area context;
- evidence references;
- moderation state;
- idempotency;
- freshness;
- conflict;
- confidence;
- and policy version.

The primary signal remains typed. The architecture must not place authoritative primary
state in an EAV table, a `field/operator/value` query language, a universal `value` column,
or generic JSON.

Examples of distinct typed claims include:

- goods price and stock availability;
- medicine stock availability, with price optional;
- exchange buy, sell, or reference rate;
- power on, off, intermittent, or unknown status;
- transport fare and route status;
- service availability;
- and event lifecycle status.

JSON may remain useful for non-authoritative adjunct metadata. This decision does not
invalidate `item_variants.attributes`, `observations.raw_payload`, or review metadata.
It prohibits JSON from becoming the only enforceable representation of a primary claim.

The eventual physical design may use a common observation envelope with typed claim-detail
tables, or separate typed vertical tables with a shared logical contract. The final DDL is
deferred until a second real vertical exists and the migration history is reproducible.

### Current compatibility boundary

The current `observations` and `offers_current` tables remain the Food V1 compatibility
model. They are not to be renamed or generalized during the freeze.

The target invariant says observations are immutable. Current visit confirmation code
inserts and then annotates an observation, so the invariant is not yet true. Atomic,
idempotent, append-only contribution repair remains ahead of any generic model.

### Category establishes global interaction context

There is one selected category capability at a time. It governs:

- map data and marker semantics;
- search vocabulary and suggestions;
- sheet cards and details;
- contextual filters;
- contribution fields and validation;
- sort options;
- labels and empty states;
- trust explanation;
- and analytics context.

The target sheet-header order is:

> Brand -> Selected category -> Contextual filter -> Add contribution -> Avatar

Changing category must update every governed surface as one context transition. A stale
request from the prior category must not overwrite the new category. Incompatible filters,
search text, selected subjects, or contribution drafts must not be silently reinterpreted.

Filters belong to a category capability. Common filter concepts may be reused, but each
capability declares only filters that its live query enforces. Active-filter counts include
non-default enforced filter dimensions, not raw values, sort, search text, category, or
global location.

The current selector is an incomplete user-facing capability, not evidence that six
verticals exist. Until more than one category passes the launch gate, the honest V1 state
may be a visible non-interactive Food context rather than a selector with false outcomes.

### Capability abstraction gate

The target category capability definition includes:

- category identifier, display name, and icon;
- pillar and signal types;
- typed subject, query, result, and contribution input;
- supported filters and normalization;
- sort options;
- map marker semantics;
- card fields;
- contribution fields;
- and category-specific empty-state language.

No interface, registry, empty capability folder, dynamic plugin system, or unused Food
implementation may be added during V1. Extraction becomes valid only when:

1. at least two category capabilities are real and live;
2. both are wired to map, search, sheet, filters, contribution, sort, copy, and trust;
3. the abstraction removes observed duplication;
4. every export has a live caller;
5. and ADR-002 Phases 0-4 and the migration/provenance gates are complete.

### Launch gate for every new category

A category may appear as selectable only when it has:

- a typed subject and signal model;
- an operationally grounded data source and provenance;
- freshness and conflict semantics;
- a validated contribution path;
- an explainable confidence path;
- map, search, sheet, filter, sort, marker, and empty-state behavior;
- offline, stale, correction, and error behavior;
- category-specific legal caveats;
- an outcome metric;
- and adversarial refutation.

A seeded category value or changed page title does not satisfy this gate.

## Relationship to existing decisions

- **ADR-001 remains unchanged.** No category may introduce checkout, payment, dispatch,
  tracking, delivery fulfilment, or orders. A Cooking Gas delivery filter is excluded
  unless a later accepted ADR explicitly permits seller-provided external information
  while preserving the fulfilment firewall.
- **ADR-002 remains controlling.** Correctness and provenance precede boundary work. No
  category registry or generic module is authorized now.
- **ADR-006 remains controlling for current Food freshness.** New signal families require
  evidence-backed freshness semantics rather than inheriting 24h/72h automatically.
- **ADR-008 would be amended.** Its six pillars remain portfolio direction, but a category
  string and Food-shaped schema do not implement a pillar.
- **ADR-009 remains separate.** Reviews are subjective evaluations, not current-state
  claims.

## Alternatives considered

**Keep price and availability as universal fields.** Rejected. It corrupts exchange,
power, services, and events into retail concepts.

**Use one JSON payload or EAV model for every category.** Rejected. It moves domain
correctness out of the schema, weakens validation, and creates an unreviewable query
language.

**Build every future claim table now.** Rejected. It would add speculative schema on top of
an unreproducible migration history and repeat the repository's dead-code failure.

**Keep Food forever and create separate products later.** Not selected as the product
direction, but still preferable to forcing unrelated domains through a price model.

## Consequences

**Improves.** WetinDey can grow without pretending every nearby fact is a price. UI,
search, ranking, trust, SEO, and contribution semantics become category-correct.

**Costs.** Each vertical must earn a complete domain model and operating data source. A
category toggle is no longer a cheap content change.

**Constrains.** V1 remains Food until another vertical passes the full gate. Current
category UI must be treated as incomplete and reconciled after the integration freeze.

## Validation and review

This ADR remains Proposed until the owner accepts:

- the pillar/category/signal distinction;
- the typed-claim and no-EAV boundary;
- the current selector containment strategy;
- the header and contextual-filter contract;
- and the staged migration path.

Any future vertical is refuted if it requires a currency formatter, sale unit, seller, or
purchase outcome when its signal is not a goods price.
