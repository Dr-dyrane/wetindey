# ADR-017: Money & Exchange reference and Sample discovery prototype

**Date:** 2026-07-18  
**Status:** Accepted  
**Owner:** Dr Dyrane Alexander

## Context

The accepted six-pillar direction includes Money & Exchange, but the current application
has only one complete local capability: Food. The existing category selector therefore
keeps every non-Food row disabled. The owner has asked for a deliberately bounded Money
prototype now: choose USD, GBP, or EUR, enter an amount, see its estimated value in
Nigerian naira, and explore how nearby bank and Bureau de Change discovery could work.

This is not a parallel-market feed or a local exchanger capability. The Central Bank of
Nigeria publishes one official daily reference rate, not a retail buy/sell quote.
Frankfurter exposes current and historical CBN-sourced rates through a public JSON API,
including:

```text
GET https://api.frankfurter.dev/v2/rate/USD/NGN?providers=CBN
```

The endpoint requires no account or application token. The requested base/quote pair is
fixed by the application; the amount a person enters never leaves their browser.

The repository has no current bank-branch or BDC-outlet dataset. The CBN announced that
82 BDC companies held final licences under the revised framework effective November 27,
2025, but the current public material found during this decision did not provide a
machine-readable, coordinate-level outlet directory. Older CBN address lists predate the
revised licensing regime and cannot establish current authorization. A company licence
also does not prove that an arbitrary street trader, branch, or franchise location is
authorized.

Without an explicit boundary, enabling the existing Money row would silently reuse Food
search, item/unit/price queries, contribution controls, places, and map markers. It could
also present invented prototype outlets as licensed real businesses. Either failure would
present a national reference rate or simulated place as nearby observed reality and
violate the typed claim separation proposed in ADR-010.

## Decision

Food and Money & Exchange are the only selectable category contexts.

Selecting Money & Exchange replaces the Food search/results sheet with a focused
USD/GBP/EUR-to-NGN calculator and a Sample-only nearby-discovery prototype. The screen:

- identifies the value as an **official CBN reference rate**;
- shows the provider's publication date;
- calculates locally as `foreign amount × reference rate`;
- labels the result as an estimate;
- states that banks and currency exchangers may offer different rates;
- never uses `live`, `parallel`, `black market`, `buy`, or `sell` for this data;
- hides Food search, Food contribution, Food details, Food routes, and Food map markers;
- offers `All`, `Banks`, and `BDC outlets` prototype filters;
- keeps the location list and map marker set derived from the same filter;
- labels every simulated record `Sample` in both the list and detail presentation;
- and never claims that a Sample location is real, open, licensed, contactable, or
  offering the displayed CBN reference value.

The existing Mapbox instance remains mounted so switching contexts does not destroy and
recreate WebGL state. Exchange replaces Food markers with neutral Sample markers. A
Sample marker may open only a clearly labelled prototype detail state; it offers no
directions, contact, opening-hours, licence, or transaction action. The global location
and recenter controls remain valid because distance is part of the prototype, but they
do not turn Sample coordinates into verified places.

The application fetches Frankfurter only from a dedicated Server Action. It validates
the currency allowlist and the complete upstream payload before returning a typed rate.
The server request is cached for one hour because CBN publishes a daily reference value,
not an intraday stream. The browser may retain the latest successfully validated rate
per currency for offline/error fallback, visibly labelled as saved data.

The Sample dataset lives in a separate typed application file, not the Food seed, place
table, or database. Names are generic and explicitly prefixed or described as Sample;
coordinates are demonstration points within the pilot geography. Sample entries cannot
be indexed as public businesses, shared as real places, routed to, contacted, reviewed,
confirmed, or promoted into observations.

This prototype creates no database table, observation, offer, trust score, freshness
rule, seller, verified exchanger, contribution path, rate history, or generic category
abstraction. It does not enter the Food data model and does not satisfy the launch gate
for a future local Exchange capability.

## Alternatives considered

**AbokiFX.** Rejected for this utility. Its API requires a paid bearer token and its
published terms require consent for redistribution. It also represents a different
claim family: parallel-market rates rather than the CBN official reference.

**Morningstar.** Rejected. Its exchange-rate services are licensed enterprise investment
data products and add authentication and commercial complexity without improving this
small CBN calculator.

**A generic real-time FX API.** Rejected. A minutely global market rate is not the CBN
official daily rate and would make the label less truthful, not more useful.

**Store rates or simulated outlets in WetinDey observations/places.** Rejected. Reference
data is neither a Food observation nor nearby user evidence, and an invented coordinate
is not a real place. Persisting either in the current schema would corrupt domain meaning.

**Use the old CBN BDC address lists as current outlets.** Rejected. The licensing regime
was revised and the CBN says only the current list establishes authorization. Historical
addresses cannot prove a company or outlet remains licensed, present, or open.

**Label street traders “licensed Aboki outlets.”** Rejected. CBN guidance distinguishes
street traders from licensed BDC entities. Colloquial identity cannot substitute for
licence and outlet evidence.

**Keep Money disabled and put the converter in Profile.** Rejected by the owner. The
category selector is the requested context switch; the implementation must make that
transition coherent instead of hiding the utility in account navigation.

## Consequences

- The category label, main sheet, available actions, marker layer, and metadata agree
  when the context changes.
- The converter remains useful without credentials, schema work, or a new dependency.
- Product interaction can be tested before real outlet ingestion exists, without
  manufacturing public businesses.
- It depends on Frankfurter availability and its correct representation of CBN data.
- A saved offline rate can be older than the current publication; the UI must disclose
  that state rather than silently presenting it as current.
- Sample location usefulness does not prove data supply, licensing, or operational
  feasibility. No launch claim may be based on the prototype.
- Money & Exchange is selectable for this bounded national reference utility only.
  Local exchangers, parallel rates, map discovery, contribution, verification, and trust
  remain unimplemented beyond the visibly simulated interaction and must not be inferred
  from the selectable row.

## Validation and review

The decision is satisfied only when:

1. switching to Money removes Food search, report controls, details, routes, and markers;
2. switching back restores the existing Food experience without reinterpreting Exchange
   state as Food state;
3. USD, GBP, and EUR payloads are runtime-validated and produce correct multiplication;
4. amount values are not sent to Frankfurter or stored remotely by WetinDey;
5. every simulated row, marker-driven detail, empty state, and filtered view remains
   unmistakably Sample and exposes no navigation/contact/licence/rate action;
6. filters update map and list from the same in-memory result;
7. loading, upstream error, retry, saved/offline, invalid-input, light, dark, keyboard,
   focus, and screen-reader result-announcement states are exercised;
8. source and publication date remain visible beside every calculated result; and
9. an independent reviewer tries to refute context separation, Sample containment, and
   rate semantics.

Reconsider the provider if its terms, availability, CBN coverage, or data semantics
change. Reconsider the product boundary only through a separate accepted decision for a
complete typed local Exchange capability.
