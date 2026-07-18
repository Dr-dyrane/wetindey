# ADR-017: Provider-aware Money & Exchange reference and Sample discovery prototype

**Date:** 2026-07-18  
**Status:** Accepted  
**Owner:** Dr Dyrane Alexander

## Context

The accepted six-pillar direction includes Money & Exchange, but the current application
has only one complete local capability: Food. The existing category selector therefore
keeps every non-Food row disabled. The owner has asked for a deliberately bounded Money
prototype now: choose an available curated currency, enter an amount, see its estimated
value in Nigerian naira, and explore how nearby bank and Bureau de Change discovery could
work.

This is not a parallel-market feed or a local exchanger capability. The Central Bank of
Nigeria publishes official reference data, not a retail buy/sell quote. Frankfurter
exposes provider-aware current and historical reference rates through a public JSON API.
Some corridors can be explicitly attributed to CBN; other corridors are Frankfurter's
blended reference. Provider identity is therefore part of the claim, not decorative
metadata. A blended reference must never inherit a CBN label.

```text
GET https://api.frankfurter.dev/v2/rate/USD/NGN?providers=CBN
```

The service requires no account or application token. The requested base/quote pair and
provider selection are fixed and validated by the server; the amount a person enters
never leaves their browser. Availability is not assumed from a hardcoded currency list:
the server publishes a validated catalog formed by intersecting the curated WetinDey list
with currency pairs currently available from Frankfurter.

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
provider-aware foreign-currency-to-NGN calculator and a Sample-only nearby-discovery
prototype. The curated currency set is:

`USD`, `GBP`, `EUR`, `CAD`, `AUD`, `GHS`, `KES`, `ZAR`, `AED`, `CNY`, `INR`, `BRL`,
`CHF`, `JPY`, and `SAR`.

The client shows only members of that set whose NGN pair is present in the current
server-validated catalog. A curated code is permission to consider a corridor, not a
promise that Frankfurter currently supplies it. Unknown, withdrawn, malformed, or
unavailable pairs fail closed and do not appear as selectable.

The screen:

- labels a result **CBN reference** only when the validated upstream result explicitly
  attributes that pair and date to CBN;
- labels every non-CBN or blended result **Frankfurter reference**, never CBN;
- keeps provider and effective/publication date attribution accessible beside the result;
- calculates locally as `foreign amount × reference rate`;
- labels the result as an estimate;
- states that banks and currency exchangers may offer different rates;
- never uses `live`, `parallel`, `black market`, `buy`, or `sell` for this data;
- hides Food search, Food contribution, Food details, Food routes, and Food map markers;
- offers `All`, `Banks`, and `BDC outlets` prototype filters;
- keeps the location list and map marker set derived from the same filter;
- labels every simulated record `Sample` in both the list and detail presentation;
- and never claims that a Sample location is real, open, licensed, contactable, or
  offering the displayed reference value.

The calculator remains amount-first: amount entry and converted estimate are the primary
hierarchy, while pair, provider, effective date, saved/error state, and disclosure remain
legible supporting information. It must say that **WetinDey does not exchange money**. It
offers no wallet, balance, recipient, send, transfer, quote acceptance, rate lock, fee,
delivery estimate, checkout, payment, or transaction implication.

Currency selection uses a dedicated searchable picker rather than expanding the primary
sheet into a long list. Search matches at least currency code and accessible currency
name. The picker may show:

- **Recent**, derived only from device-local selections and clearable with local app data;
- **Popular**, a deliberately curated product shortcut, not a claim about measured user
  demand unless a later analytics decision supplies evidence; and
- **All available**, containing the remaining catalog-intersected curated pairs.

A currency appears at most once in the rendered result groups, and search results remain
bounded to the same server catalog. Every row has at least a 44 × 44 point target, a
visible keyboard focus state, semantic selected/disabled state, screen-reader code and
currency name, and reduced-motion behavior that removes nonessential movement.

Currency markers use a bundled, licensed, local SVG flag sprite with non-emoji rendering.
The sprite is an assistive visual only: currency code and name carry meaning. No flag,
country, or currency artwork may be fetched remotely at runtime, and a missing sprite
symbol falls back to a neutral local marker rather than an emoji or network request.

The existing Mapbox instance remains mounted so switching contexts does not destroy and
recreate WebGL state. Exchange replaces Food markers with neutral Sample markers. A
Sample marker may open only a clearly labelled prototype detail state; it offers no
directions, contact, opening-hours, licence, or transaction action. The global location
and recenter controls remain valid because distance is part of the prototype, but they
do not turn Sample coordinates into verified places.

The application accesses Frankfurter only through a dedicated Server Action. The server
validates the curated allowlist, current upstream catalog, requested pair, provider
attribution, effective date, rate, and complete response before returning a typed result.
It may request an explicit CBN result only for a catalog-supported CBN corridor. Otherwise
it requests and labels the Frankfurter reference without a CBN provider constraint. A CBN
request that fails or loses attribution cannot silently fall back while retaining CBN
copy.

The server request is cached for one hour as reference data, not an intraday executable
quote. Cache identity includes pair and provider mode so CBN and blended results cannot
cross-contaminate attribution. The browser may retain the latest successfully validated
rate per currency for offline/error fallback, visibly labelled as saved data with its
provider and effective date.

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

**A generic real-time executable FX feed.** Rejected. A minutely market, broker, buy/sell,
or tradable quote is a different claim from a dated reference rate and would invite
transaction implications this prototype explicitly excludes.

**Keep only USD, GBP, and EUR and label every result CBN.** Rejected. It withholds useful
catalog-supported corridors and conflates an explicitly CBN-attributed reference with
Frankfurter's blended reference. Provider-aware attribution is more truthful than a
single prestigious label.

**Hardcode all 15 curated currencies as available.** Rejected. Product curation cannot
create an upstream pair. The server catalog is the availability authority, and missing
or invalid corridors fail closed.

**Use Unicode flag emoji or remote flag images.** Rejected. Emoji rendering varies by
platform and can turn a currency marker into a country-identity assumption; remote images
add tracking, availability, performance, and licensing risk. A licensed local SVG sprite
is deterministic and works without network flag requests.

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
- The converter remains useful without credentials, schema work, or a new runtime
  dependency.
- Product interaction can be tested before real outlet ingestion exists, without
  manufacturing public businesses.
- It depends on Frankfurter availability, catalog accuracy, provider attribution, and rate
  semantics. A catalog or provider change may remove a pair until validation succeeds.
- The curated 15-currency set is a maximum product set, not an availability promise.
- CBN-labelled and Frankfurter-labelled references can coexist without suggesting that a
  blended corridor is official CBN data.
- A saved offline rate can be older than the current publication; the UI must disclose
  that state, provider, and effective date rather than silently presenting it as current.
- Recent choices remain device-local; Popular remains editorial unless a later accepted
  analytics decision supports a measured claim.
- Bundled licensed SVG flags add an asset provenance and maintenance obligation, but no
  remote flag request or emoji rendering dependency.
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
3. the server catalog exposes only the intersection of the 15 curated codes and currently
   supported NGN pairs, and unavailable pairs cannot be selected or requested;
4. amount values are not sent to Frankfurter or stored remotely by WetinDey;
5. every simulated row, marker-driven detail, empty state, and filtered view remains
   unmistakably Sample and exposes no navigation/contact/licence/rate action;
6. filters update map and list from the same in-memory result;
7. loading, catalog-empty, pair-unavailable, upstream error, retry, saved/offline,
   invalid-input, light, dark, keyboard, focus, reduced-motion, and screen-reader
   result-announcement states are exercised;
8. CBN appears only on explicitly CBN-attributed results; blended or other results say
   Frankfurter reference, and provider plus effective/publication date remain accessible
   beside every result;
9. all available curated pairs produce correct local multiplication without sending the
   entered amount upstream;
10. the dedicated searchable picker deduplicates Recent, Popular, All available, and
    search results; uses 44 × 44 point targets; and never exposes a non-catalog pair;
11. flag markers resolve only from a licensed bundled SVG sprite, remain redundant to
    accessible text, honor reduced motion, and make no emoji or remote image request;
12. no state or copy implies wallet, recipient, send, transfer, fee, rate lock, payment,
    or exchange execution, and the WetinDey-does-not-exchange boundary stays explicit;
    and
13. an independent reviewer tries to refute context separation, Sample containment,
    provider truth, catalog admission, accessibility, and non-transaction semantics.

Reconsider the provider if its terms, catalog, availability, provider coverage, or data
semantics change. Reconsider the product boundary only through a separate accepted
decision for a complete typed local Exchange capability.
