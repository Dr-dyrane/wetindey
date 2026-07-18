# Live Information and Earned Trust - Proposed Architecture Evolution

**Date:** 2026-07-17  
**Status:** PROPOSED ADDENDUM - not the architecture of record  
**Decision proposals:** [ADR-010](../adr/010-typed-live-local-information-platform.md)
and [ADR-011](../adr/011-earned-trust-graph-and-reputation.md)

## Read this first

[SERVICE-ARCHITECTURE.md](SERVICE-ARCHITECTURE.md), ratified by ADR-002, remains the
architecture of record. This file records the requested product-model and trust evolution
in enough detail to review. If the two documents disagree, the architecture of record
wins until an accepted ADR amends it.

This document does not authorize implementation.

### Current-main audit reconciliation

The deep repository audit observed `8ebefb7`. The reconciled planning baseline is
`b89ebba`:

- D1 restored reproducible lineage through `0008`.
- D2 added provenance in repository history and passed independent disposable migration,
  seed, backfill, and idempotence refutation through `0009`; no shared target was migrated.
- T1 made server-derived trust authoritative across card, detail, Get-It, and marker
  presentation.
- T2A now admits only `observed` evidence to confidence and labels synthetic-only fallback
  `Demo data`; the audit's synthetic-confidence finding is therefore closed.
- Food remains the only selectable live category. The other category rows are honest
  unavailable context, not partial implementations.
- The current search path still contains a runtime-invalid `item_variants.unit_id`
  reference. That confirmed defect is the first unresolved implementation lane.

The repository is an **advanced interactive alpha approaching a controlled Food pilot**,
not an open Lagos product. The active phase is **WetinDey Food Truth & Pilot Operations**.

The release truth gate remains in force because:

- `searchItems()` does not match the declared item-variant schema;
- shared environments have not received authorized `0009`, so provenance-aware code may
  not deploy ahead of the exact target migration;
- T2C observed-only price/range isolation and T2D SEO isolation remain;
- public contribution lacks a transactional, idempotent, rate-limited, moderated conflict
  policy;
- account deletion, actionable consented seller contact, and pilot operating tools are not
  complete;
- and automated database, Server Action, browser, accessibility, PWA, and release checks
  are not yet one enforced pipeline.

No Trust Graph DDL, category registry, generic filter form, review work, reward work, RLS
rollout, or broad UI refactor starts in this state.

## 1. Mission and product model

> **WetinDey helps people understand the current state of nearby reality before they
> leave.**

The promise remains:

> **Know before you go.**

Food price and availability are the V1 proof. They are not the universal ontology.

| Category capability | Primary signal | Supporting signals |
|---|---|---|
| Food Markets | Goods price | Stock availability, freshness, confidence |
| Fuel | Goods price | Fuel grade, availability, queue band, freshness |
| Cooking Gas | Refill or purchase price | Cylinder size, stock availability, freshness |
| Medicine Availability | Stock availability | Formulation, strength, optional price, confidence |
| Exchange Rates | Buy, sell, or reference rate | Market channel, trend, freshness |
| Power Status | On, off, intermittent, or unknown | Last confirmation, duration, nearby corroboration, confidence |
| Local Services | Service availability | Response time, validated reputation, moderated rating |
| Community Events | Event lifecycle status | Time, venue, organizer confirmation, freshness |

This table is a target vocabulary, not a list of live features.

## 2. Current-state correction map

| Area | Current repository truth | Required correction |
|---|---|---|
| Product identity | The architecture and About copy call WetinDey a food price map. | Lead with live local information; name Food as the current pilot vertical. |
| Category selector | Six pillars are selectable and partially affect search, popular rows, metadata, and header state. | Treat the selector as incomplete until every exposed category owns a complete typed vertical. |
| Catalog | `items`, variants, and sale units are goods-oriented. | Keep them for goods and medicines; do not represent currency pairs, power areas, routes, services, or events as items. |
| Observation | Current observations require item variant, unit, place, availability, currency, and optional price. | Preserve as Food compatibility; design typed claims only with the first real non-Food vertical. |
| Current read model | `offers_current` is a price/availability projection. | Preserve for Food; use `Current state projection` as the generic logical concept. |
| UI | Item cards, item detail, report price, Get It, and visit confirmation assume price and purchase. | Keep them explicitly Goods-specific. New signal families receive typed surfaces. |
| Search and ranking | Search/popular actions and cheapest sorting assume goods. | Each category capability owns query, filter, and sort semantics. |
| Map | Category affects some results, while fallback places and marker meaning remain broad/shared. | One category context must drive map and sheet from the same normalized result set. |
| SEO | Item JSON-LD hardcodes Food while non-Food seed rows can reach item/place surfaces. | Emit structured data only for a real subject type and implemented vertical. |
| Seed | Plausible random values at named places look like human observations. Power hours are price-shaped. | Quarantine synthetic data; never reinterpret stored prices as power duration. |
| Identity | Recognized contributions now resolve to `sources.user_id`. | Correct stale docs; do not mistake attribution for earned reputation. |
| Reputation | Recognized sources start at `75`; seeded anonymous Contributor is `98`. | Remove the inversion before reputation influences public confidence. |
| Trust | Writes call `assessTrust`; UI and map still use competing heuristics. | Make one read-side assessment authoritative before graph expansion. |
| Moderation | Status fields exist, writers approve automatically, and no moderator/audit surface exists. | Do not create reputation events or verification from fictional moderation. |
| Reviews | Schema exists without live actions, UI, moderation, or robust anonymous vote uniqueness. | Keep reviews quarantined until one complete vertical slice ships. |
| Legal/About | `about.how_intro` says price map; `about.how_report` says every price came from a person. Terms and privacy are owner-review drafts. | Hand off accurate platform, synthetic-data, privacy, and signal-specific language to the UI owner and counsel. |
| API | Product data uses Server Actions; `/api/v1` remains future-only. | Keep Server Actions. Design a public/partner API only for a real second consumer. |
| RLS | Current migrations define no RLS policies. | Treat query/action authorization as current; decide RLS with real actors and database-role behavior. |

## 3. Domain and data model

### 3.1 Shared logical envelope

An observation records:

- author source;
- provenance;
- observed and submitted times;
- collection method;
- location or area context where relevant;
- idempotency;
- moderation state;
- evidence references;
- and one or more compatible typed claims.

It does not carry one universal authoritative `value`.

### 3.2 Typed claim families

| Claim family | Required typed meaning |
|---|---|
| Goods price | Item variant, sale unit, amount/range, currency, place, price kind |
| Stock availability | Catalog subject, place, availability state, optional capacity qualification |
| Exchange rate | Currency pair, side, rate, market channel, quote time |
| Power status | Area/zone, on/off/intermittent/unknown, status start |
| Fare | Route/service, origin, destination, mode, amount, currency |
| Route status | Route/service, operating/disrupted/unavailable, segment, time |
| Service availability | Provider/listing, accepting-work state, next availability |
| Event status | Event, scheduled/postponed/cancelled/ongoing/ended, venue, time |
| Review | Subjective target evaluation; intentionally outside factual current-state claims |

The architecture rejects EAV, a universal `value + unit`, untyped filter arrays, and JSON
as the only authoritative claim representation.

### 3.3 Evolutionary logical ERD

```mermaid
erDiagram
    PRINCIPAL ||--o{ IDENTITY_BINDING : "recognized through"
    PRINCIPAL ||--o{ SOURCE : "controls"
    ORGANIZATION ||--o{ SOURCE : "operates"

    SOURCE ||--o{ OBSERVATION : "authors"
    OBSERVATION ||--|{ CLAIM : "contains"

    CLAIM ||--o| GOODS_PRICE_CLAIM : "typed as"
    CLAIM ||--o| STOCK_AVAILABILITY_CLAIM : "typed as"
    CLAIM ||--o| EXCHANGE_RATE_CLAIM : "typed as"
    CLAIM ||--o| POWER_STATUS_CLAIM : "typed as"
    CLAIM ||--o| FARE_CLAIM : "typed as"
    CLAIM ||--o| ROUTE_STATUS_CLAIM : "typed as"
    CLAIM ||--o| SERVICE_AVAILABILITY_CLAIM : "typed as"
    CLAIM ||--o| EVENT_STATUS_CLAIM : "typed as"

    CLAIM ||--o{ EVIDENCE_ITEM : "supported by"
    CLAIM ||--o{ CONFIDENCE_ASSESSMENT : "assessed as"
    CLAIM ||--o{ CURRENT_STATE_PROJECTION : "may derive"

    SOURCE ||--o{ REPUTATION_EVENT : "subject of"
    REPUTATION_EVENT }o--|| REPUTATION_SNAPSHOT : "projects into"
    REPUTATION_SNAPSHOT ||--o{ CONFIDENCE_ASSESSMENT : "bounded input"
    MODERATION_DECISION ||--o{ REPUTATION_EVENT : "may produce"

    SOURCE ||--o{ REVIEW : "authors"
    REVIEW_TARGET ||--o{ REVIEW : "evaluated by"
    REVIEW ||--o{ REPUTATION_EVENT : "may produce after validation"

    SOURCE ||--o{ VERIFICATION_ASSERTION : "may receive"
    PRINCIPAL ||--o{ ROLE_GRANT : "may hold"
    PRINCIPAL ||--o{ STATUS_EVENT : "has lifecycle"

    PARTNER_PROGRAM ||--o{ REWARD_ELIGIBILITY : "may define later"
```

This is a logical ERD, not V1 DDL. The final physical relationship between a common claim
row and typed detail tables is deliberately deferred. Existing Food records must not be
silently promoted into a generic observed-history model.

## 4. Category context, header, and filters

### 4.1 Target persistent-sheet header

The visual and focus order is:

> **Brand -> Selected category -> Contextual filter -> Add contribution -> Avatar**

Responsibilities:

| Control | Responsibility |
|---|---|
| Brand | Product identity and return to root discovery |
| Selected category | Displays and changes the active complete category capability |
| Contextual filter | Opens filters declared and enforced by that capability |
| Add contribution | Opens the capability's typed contribution flow |
| Avatar | Account, settings, About, privacy, terms, and support |

All rendered controls keep at least 44x44px targets, focus visibility, accessible labels,
and the same order on compact and regular layouts. The brand may compress visually on
narrow screens; controls do not reorder.

If Food is the only complete capability, the category slot may be a non-interactive
`Food` context label. A control with one real outcome must not pretend to be a selector.

### 4.2 One global category context

Changing category must:

1. invalidate prior in-flight results;
2. ignore late responses from the old category;
3. close or reset incompatible selected details;
4. clear incompatible search text;
5. restore the new category's normalized session filter state;
6. recompute the active-filter count;
7. update map and sheet from the same query context;
8. update contribution labels, fields, and validation;
9. preserve genuinely global location, radius, theme, and identity;
10. and never recast an unsaved draft as another claim type.

The current implementation does not meet this contract. Category scopes some top-level
reads, but narrowed offers, contribution items, detail state, fallback markers, and stale
response handling remain incomplete.

### 4.3 Filter state rules

- Filter state is keyed by category capability for the current session.
- Switching back restores that category's valid normalized state.
- Reset affects only the selected category.
- Apply updates map and sheet together.
- Empty results caused by filters offer `Clear filters`.
- The badge counts active non-default filter dimensions, not raw selected values.
- Sort, search text, selected category, and global location do not count.
- A filter not enforced by the server/query does not count and must not render.
- Future cross-session persistence requires a versioned parser and reset/migration policy.

### 4.4 Candidate filters and dependencies

These are candidate product requirements, not approved fields or immediate work.

| Category | Candidate contextual filters | Dependency or constraint |
|---|---|---|
| Food | Product type, brand, unit/pack, price range, stock, distance, freshness, confidence, verified seller, place type | Verification requires typed ADR-011 assertions |
| Fuel | Grade, price range, stock, queue band, distance, last confirmed, verified station | Queue semantics and station verification require field research |
| Cooking Gas | Refill/purchase, cylinder size, price range, stock, distance, last confirmed, verified seller | Delivery is excluded under ADR-001 unless separately amended |
| Power | On, off, intermittent, restored/interrupted recently, recency, confidence, nearby corroboration, radius, distribution area/feeder | Never show price filters; utility caveat required |
| Medicine | Name, strength, formulation, in stock, optional price, prescription requirement, distance, verified pharmacy, last confirmed | High-stakes health policy, pharmacy verification, and legal review required |
| Skincare | Product type, brand, skin concern, size, price, stock, seller authenticity assertion, distance, last confirmed | Authenticity requires a typed evidence policy, not a paid badge |
| Exchange | Currency pair, buy/sell/reference side, channel, rate range, distance, last updated, verified exchanger, transaction method | Financial-information caveat; no trade quote or payment flow |
| Services | Service type, available now, response time, optional price, distance, verified provider, earned trusted-provider status | Rating requires live moderated ADR-009 reviews |

### 4.5 Future typed capability definition

The conceptual capability definition contains:

- stable category id, display name, icon, and pillar;
- supported signal types;
- typed subject, query, filter state, result, contribution input, sort key, and marker;
- filter normalization and active-dimension calculation;
- search behavior;
- map conversion and legend;
- card presentation;
- contribution form and validation;
- sort semantics;
- trust adapter;
- and empty/loading/stale/offline/conflict/error language.

It must be an exhaustive typed union over real capabilities, not a generic object with
`field`, `operator`, `unknown`, or `Record<string, unknown>`.

No code contract is created until two capabilities are live and every consumer is wired.

## 5. Trust Graph and Reputation

### 5.1 Non-negotiable separation

| System | Output |
|---|---|
| Identity | Principal/source continuity |
| Reputation | Scoped validated history with uncertainty |
| Confidence | Claim-specific evidence assessment now |
| Verification | Typed assertion with issuer, policy, expiry, and revocation |
| Status | Participation lifecycle |
| Role | Authorization for a real protected operation |
| Recognition | Explainable earned label derived from reputation policy |
| Rewards | Separate future one-way eligibility decision |

No payment, sponsorship, subscription, perk, or promotion creates any trust output.

### 5.2 Bounded propagation

Confidence assessment order:

1. define the typed claim and context;
2. classify provenance;
3. apply validation and moderation admissibility;
4. apply the signal's freshness policy;
5. collapse correlated records into bounded independence groups;
6. read scoped reputation with sample size and uncertainty;
7. evaluate evidence method;
8. preserve conflict;
9. return qualitative band, reasons, provenance, independence summary, policy version,
   and calculation time.

Reputation cannot create evidence. Verification cannot validate every contribution.
Expired evidence remains expired. Confidence cannot reward its own author without a later
independent outcome.

### 5.3 Reviews

Reviews are subjective and have a separate credibility path. They do not feed offer or
current-state confidence directly. Helpful votes are not accuracy outcomes. Rating filters
remain blocked until review identity, duplicate-vote prevention, moderation, read/write
paths, and trustworthy aggregates are live.

### 5.4 Rewards

This proposal records only a firewall. Any reward program needs another ADR. Partners may
eventually consume explicit eligibility outcomes, but cannot write back to reputation,
verification, moderation, confidence, or organic rank.

## 6. Subsystem impact

| Subsystem | Evolution |
|---|---|
| Schema and migrations | Repair lineage first. Later use typed relational claims; no speculative all-category DDL. |
| Server Actions | Remain the V1 boundary. Resolve source and identity server-side; clients never set trust, reputation, verification, role, or moderation. |
| Search | Return a discriminated typed result per live capability. No search service until scale and consumers justify it. |
| Ranking | Apply admissibility, confidence, and freshness before capability-specific comparison. Never rely only on rating or cheapest price. |
| Map and sheet | Consume one selected category and one normalized query result. Marker and card status meanings must match. |
| Contributions | Typed per signal, atomic, idempotent, relationally valid, and abuse-resistant. No universal report form. |
| Catalog stewardship | Canonical item identity, aliases, variants, units, categories, duplicate merging, and reference imagery remain an operator-owned catalog concern, not a report side effect. |
| Media | Catalog reference media and observation evidence may share storage plumbing later, but never ownership, permissions, moderation, retention, or lifecycle semantics. |
| Moderation | Add only with a real actor. Decisions are append-only, attributed, reasoned, and auditable. |
| Profiles | Show safe self-explanation, not fraud scores or universal social scores. |
| Seller dashboards | Future factual accuracy and source history; no paid trust. |
| Contributor dashboards | Future contribution history, outcomes, uncertainty, and appeals. |
| Reviews | Deferred complete vertical under ADR-009 and ADR-011. |
| Verification | Typed assertions replace generic strings before any verified-only filter. |
| Analytics | Measure false-high rate, calibration, conflict resolution, freshness, provenance leakage, moderation reversal, and partner disagreement without exposing identity/location. |
| RLS | Future defense in depth. Current policy is Server Actions/query checks; no RLS policies are present. |
| Public/partner API | Deferred until a real second client or partner exists. Typed resources only. |
| Notifications | Future outcome or freshness reminders only after privacy and value are proven. |
| Achievements | Derived earned recognitions, never purchasable and never authorization by implication. |
| SEO | Emit only truthful live verticals and correct schema.org types. No unimplemented category pages. |
| Legal/About | Human-reviewed platform description, provenance disclosure, signal caveats, privacy facts, and no-guarantee language. |

## 7. Technical debt register

| ID | Debt | Gate |
|---|---|---|
| GOV-01 | **Closed:** schema, SQL, snapshots, and journal are reproducible through `0008` | D1 completed and independently refuted |
| DATA-01 | **Repository/disposable gate closed:** provenance exists through `0009`; exact shared-target rollout remains unapplied | Separate authorized migration-before-code release gate |
| SEARCH-01 | `searchItems()` references `item_variants.unit_id`, which does not exist in the declared schema | First Stage 0 implementation lane plus disposable DB query proof |
| CATALOG-01 | Catalog records and reference images are seed-managed; there is no authorized item CRUD, attribution, or duplicate-merging workflow | Catalog Stewardship lane |
| MEDIA-01 | Report evidence has no privacy, EXIF, hashing, moderation, retention, or offline-upload pipeline | Observation Evidence Media lane |
| LIVE-01 | Six-category selector is partially wired over a Food-shaped data model | V1 containment before further expansion |
| LIVE-02 | Non-Food seed concepts are encoded as price-shaped item offers | Quarantine; never reinterpret |
| LIVE-03 | Item cards, detail, reports, sharing, and visit outcomes assume price/purchase | Keep Goods-specific; typed verticals later |
| LIVE-04 | SEO hardcodes Food while category data can be broader | Truth-core SEO correction |
| LIVE-05 | No category-scoped enforced filter contract or stale-response generation guard | Contextual capability lane |
| TRUST-01 | Anonymous seeded Contributor reliability `98` exceeds recognized contributor `75` | V1 trust correction |
| TRUST-02 | **Closed by T1:** one server assessment now drives card, detail, Get-It, and marker presentation | Preserve one assessment while T2C/T2D close |
| TRUST-03 | `sources` conflates source kind, account binding, lifecycle, and a reputation-like scalar | V1.5 reputation design |
| TRUST-04 | Provenance exists; independence group, policy version, and calibration record do not | Stage 3 reputation design after real outcomes |
| TRUST-05 | Moderation status exists without an actor, queue, audit, or honest writer | Real moderation gate |
| TRUST-06 | Generic verification string cannot support a truthful badge/filter | Typed assertions in V1.5 or later |
| REVIEW-01 | Reviews are schema-only; anonymous helpful-vote uniqueness and moderation are incomplete | Keep deferred |
| WRITE-01 | Contribution is non-transactional, non-idempotent, auto-approved, and lacks enforceable device/account rate and conflict policy | Stage 0 contribution-integrity lane |
| QA-01 | CI lacks integrated migration, database, Server Action, browser, accessibility, PWA, and production-build gates | Stage 0 release-verification lane |
| OPS-01 | No operating loop yet maintains field coverage, catalog/place corrections, disputes, freshness, and moderator audit | Stage 1 Food pilot operations |
| SELLER-01 | Contact is consent-aware but not actionable; seller claim, hours, correction, and safe resolution are absent | Stage 1 seller contact/stewardship |
| RELEASE-01 | Direct `main` pushes can deploy while database rollout is separately controlled | Migration-before-code gate now; protected-main/preview transition before open pilot |
| LEGAL-01 | Product identity and demo caveats are corrected; final privacy, deletion, retention, processor, and contact terms remain draft | Product/legal lane plus human counsel |

## 8. Evolution roadmap

**Controller phase name:** WetinDey Food Truth & Pilot Operations.

| Release stage | Scope | Exit condition and explicit exclusions |
|---|---|---|
| Current checkpoint | D1 and disposable D2 complete; T1 authoritative reads complete; T2A observed-only confidence and `Demo data` presentation complete; Food-only category containment preserved | No shared `0009`, no claim of open-pilot readiness |
| Stage 0 - Release truth gate | Fix and disposable-DB-test `searchItems()`; complete T2C observed-only projections and T2D SEO firewall; migrate an explicitly authorized staging target before provenance-aware deployment; make writes transactional/idempotent/rate-limited with contradictory-report handling; settle account deletion; create integrated release checks; run Luna refutation | The same offer is truthful and semantically aligned on card, detail, marker, Get-It, share, item/place routes, and SEO. No new category, reviews, reputation, rewards, or evidence media |
| Stage 1 - Operational Food pilot | Source-review and field-entry tools; merchant/contact consent; catalog/unit mapping; place correction/merge; disputes/corrections; coverage/freshness dashboard; moderator identity/audit; bounded seller contact and stewardship | A bounded geography and catalog have enough current verified density for successful real errands. No Lagos-wide scale claim |
| Stage 2 - Controlled Lagos expansion | Expand markets and merchant participation; approved scheduled ingestion; contributor training; freshness SLAs; alerts; viewport querying/clustering; funnel and wasted-trip measurement | Expand only where false-high confidence and stale coverage are measured and controlled |
| Stage 3 - Earned reputation | Contributor and seller outcome histories, scoped expert status, corrections, appeals, earned recognitions, optional partner eligibility | Real outcomes first; no paid verification, universal score, public fraud score, or reward-driven trust |
| Stage 4 - Yelp-like local discovery | Moderated reviews, ratings, owner replies, photos, questions, helpful votes, recommendations, and community discussion | Reviews remain distinct from current-state price/availability evidence; identity, moderation, and abuse controls required |
| Stage 5 - First non-price vertical | Build Power as area, status, start time, last confirmation, nearby corroboration, confidence, and restoration history; extract shared capability only after Food and Power are both live | No naira, sale unit, seller-contact, or Food-form reuse for Power; no speculative generic registry |
| Long term | Additional typed verticals, calibrated per-signal policies, privacy-preserving APIs, scoped partner ingest, separately approved evidence media and external reward eligibility | No fulfilment, wallets, payments, purchased status, or opaque AI truth |

### Dependency graph

```mermaid
flowchart LR
    DONE["D1 + disposable D2 + T1 + T2A complete"] --> SEARCH["P0 repair search schema contract"]
    SEARCH --> T2CD["T2C projections + T2D SEO"]
    T2CD --> MIG["Authorized staging migration before code"]
    MIG --> WRITE["Atomic + idempotent + rate-limited writes"]
    WRITE --> QA["Integrated release verification"]
    QA --> Q1["Luna adversarial release refutation"]
    Q1 --> OPS["Stage 1 Food pilot operations"]
    OPS --> PILOT["Controlled real Food outcomes"]
    PILOT --> EXPAND["Stage 2 Lagos expansion"]
    PILOT --> R1["Stage 3 earned reputation"]
    R1 --> REV["Stage 4 reviews + community"]
    EXPAND --> POWER["Stage 5 Power vertical"]
    OPS --> CAT["Catalog Stewardship"]
    D2["D2 provenance boundary"] --> OEM["Observation Evidence Media, separately gated"]
```

## 9. Lane plan and handoffs

| Lane | Status | Mission | Dependencies |
|---|---|---|---|
| Governance / Roadmaps | Active, docs only | Reconcile the `8ebefb7` deep audit against current `main`, gates, priorities, and handoffs | Existing governance claim |
| D1 database lineage | Complete | Restored one reproducible migration history through `0008`; no Trust Graph DDL | G0 |
| D2 provenance boundary | Repository and disposable execution complete; shared rollout gated | Keep five-value immutable provenance and migrate only an exact authorized target before dependent code | D1 and ADR-012/015 |
| P0 search schema repair | Active | Remove the nonexistent `item_variants.unit_id` relationship and prove the real query on a disposable database | Exclusive `src/app/actions.ts` claim |
| V1 truth core | T1/T2A complete; T2C/T2D queued | Finish observed-only projection ranges and the SEO firewall | Search repair, D2, ADR-015 |
| Contribution integrity | Planned Stage 0 | Transaction, idempotency, atomic conflict handling, rate policy, and contradictory-report safety | Truth-core reads plus threat model |
| Release verification | Planned Stage 0 | One executable migration/database/action/browser/accessibility/PWA/build gate plus Luna refutation | Search, T2C/T2D, write safety |
| Account deletion | Provider/counsel gated | Delete provider identity and approved app PII while retaining/anonymising public evidence exactly as approved | Neon capability proof and retention matrix |
| Food pilot operations | Planned Stage 1 | Field/source review, catalog/place maintenance, correction/dispute, freshness coverage, and moderator audit | Stage 0 exit |
| Seller contact and stewardship | Planned Stage 1 | Consented actionable contact, claim/onboarding, hours, correction, and response state | Stage 0 exit; ADR-001 fulfilment exclusion |
| Context header containment | Planned after truth gate | Target header order, visible honest category context, enforced Food filters only | Stable Food query contract and exact UI/map/action claims |
| Contextual category capability | Deferred Phase 5A | One non-price vertical plus typed capability extracted from two live implementations | ADR-002 Phases 0-4, V1 exit, clean migrations |
| Catalog Stewardship | Planned Stage 1 | Item CRUD, aliases, variants, units, categorisation, reference imagery, attribution, and duplicate merging | Operator authorization, catalog ADR, reference-media policy, and a real stewardship workflow |
| Observation Evidence Media | Deferred Stage 2+ | Report attachments, receipts, EXIF removal, privacy, hashing, size limits, moderation, retention, and offline uploads | D2, media/privacy ADR, storage decision, moderation actor, and offline threat model |
| R1 reputation calibration | Deferred Stage 3 | Append-only events and scoped projections from real outcomes | Pilot outcomes and ADR-011 acceptance |
| Reviews and community | Deferred Stage 4 | Moderated reviews, ratings, media, questions, replies, helpful votes, recommendations, and discussion | Pilot outcomes, identity, moderation, duplicate-vote safety, read/write/UI/tests |
| Power typed vertical | Deferred Stage 5 | Prove Power status without price semantics, then extract only genuinely shared capability | Food operating loop and two-live-vertical rule |
| Q1 release refutation | Read-only at Stage 0 exit | Attempt to disprove every truth, migration, write, category, accessibility, and release claim | Candidate controlled-pilot release |

No future lane owns a path until it is activated and exact files are transferred. The
former auth/UI claim is retired; its paths require new narrow claims. Current map, trust
hot-file, brand, and migration claims remain protected.

### Catalog media and observation evidence are different domains

An item is a canonical subject. Its reference image is curated catalog material with
licensing, attribution, replacement, and duplicate-merging rules.

An observation is a time-bound claim. Its receipt or photo is evidence for that one claim
and carries privacy, EXIF, moderation, retention, and access-control risk.

An evidence attachment must never become an item image automatically. A catalog image must
never be counted as observation evidence. Shared blob storage or upload primitives do not
merge these ownership and lifecycle boundaries.

### About, legal, and WetinDey-flow handoff

**Owner:** a new narrow product/legal UI lane must be assigned for `ProfileSheet.tsx`,
`page.tsx`, and `strings.ts`, with human owner/counsel approval. The former auth/UI session
is no longer an owner.

Required corrections:

- replace `price map` as the platform identity;
- state Food price/availability is the current pilot;
- remove the false claim that every displayed price came from a person;
- disclose demonstration data until provenance makes it distinguishable;
- describe the flow as `Context -> Intent -> Typed local state -> Trust explanation ->
  Decision -> Outcome`;
- add signal-specific limitations for food/fuel price, medicine, exchange, power, services,
  and events before those capabilities launch;
- reconcile location, avatar, profile contact, retention, deletion, and processor claims
  with actual implementation;
- preserve anonymous browse and the fulfilment exclusion;
- and obtain native-language review rather than machine-translating legal or trust copy.

Acceptance requires factual product behavior, owner/counsel approval, an effective date,
controller/contact details, processor and retention facts, and no unsupported guarantee.

## 10. Refutation tests

The architecture is refuted if:

- a Power result renders naira, sale unit, cheapest sort, seller contact, or purchase;
- a Medicine in-stock report requires a price;
- an old Food response appears after switching category;
- map and sheet apply different filter state;
- a filter badge counts a constraint the query ignores;
- category switching reinterprets an unsaved draft;
- `Verified only` reads the current generic place string;
- rating filters use schema-only reviews;
- synthetic records earn trust, reputation, rewards, SEO confirmation, or pilot metrics;
- one source becomes multiple independent corroborators;
- reputation extends freshness;
- a reward or payment changes trust or organic rank;
- Cooking Gas exposes delivery without an accepted ADR-001 amendment;
- or a capability registry exists with one implementation or an unwired consumer.

The verifier defaults to refuted when evidence is missing.
