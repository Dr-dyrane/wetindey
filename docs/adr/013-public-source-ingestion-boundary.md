# ADR-013: Public-source food evidence enters an append-only review boundary

**Date:** 2026-07-17
**Status:** Accepted
**Owners:** Dr Dyrane Alexander

## Context

WetinDey needs broader, current Food V1 coverage across Lagos. Public government reports,
institutional datasets, market publications, and named merchant catalogues can contribute
useful evidence, but the live Food model cannot receive that evidence honestly today.

`observations` requires an exact `item_variant_id`, `unit_id`, `place_id`,
`availability_state`, and `observed_at`. Public evidence may instead support a Lagos State
average, a survey period, a local market measure, an explicit price with unknown stock, or
a seller listing with no defensible observation date. Filling those gaps would invent
precision.

The current `sources` table is an identity/category table for live observations. It is not
a source registry: it has no canonical publisher identity, URL, capture, content hash,
publication identity, parser version, fetch history, attribution policy, or ingestion
permission. The current `moderation_status` column also does not provide a review system;
all live writers approve their own rows and no actor-attributed moderation history exists.

[ADR-012](012-observation-provenance-boundary.md) makes observation provenance explicit,
but deliberately reserves `partner`, `reference`, and `inferred` without authorizing a
writer. Applying migration `0009` is therefore necessary for eventual public-source
publication and insufficient to authorize it.

The existing demonstration and seed data are a working product fixture. They must remain
byte-for-byte and behaviorally unchanged. Recurring ingestion must not use `seed.ts`,
rewrite existing observations, require internet access during bootstrap, or put daily
captures into immutable migration history.

## Decision

Public-source evidence enters a dedicated Food V1 staging boundary before it can enter the
immutable observation log. The boundary has six responsibilities:

1. register a publisher or feed without silently approving it;
2. record every scheduled fetch outcome;
3. retain immutable, content-addressed captures where permitted;
4. retain immutable extracted candidates without guessing missing facts;
5. record append-only, actor-attributed review decisions; and
6. produce deterministic review artefacts.

Staging is not publication. A source approval is not a candidate approval. A candidate
approval is not a live observation. No table in this boundary feeds `offers_current`, the
map, search, confidence, freshness, SEO, or any other public projection.

### Public-source registry

`public_source_registry` is the operational registry for one canonical publisher, dataset,
feed, or named merchant source. It is separate from `sources`, because registration and
fetch policy are not evidence that belongs in the live observation identity table.

Each registry row carries:

- a stable ID, source name, canonical domain, and canonical landing URL;
- source category: `primary_institutional`, `government_official`,
  `recognized_market_association`, `approved_partner`, `named_merchant`,
  `reputable_secondary`, `public_social`, or `unknown_unsupported`;
- publisher identity and stated geographic scope;
- content format and reliability tier;
- review requirement and permitted ingestion mode;
- attribution and archive/retention requirements;
- lifecycle state: `proposed`, `active`, `suspended`, or `rejected`;
- the approval reference, reviewer identity, and review timestamp where active; and
- created and updated timestamps.

Newly discovered domains start `proposed`. Only an explicit owner/Sol decision can make a
source active or change its permitted mode. The initial permitted mode for every active
source is `fetch_and_stage`; there is no `auto_publish` mode. Public social sources may
support discovery and candidate review only, never silent publication. Unknown,
unsupported, anonymous, unattributed, or search-snippet-only sources cannot produce a
review-ready candidate.

Registry configuration is operational and may be updated. Changes do not rewrite captures,
candidates, or decisions already attributed to an earlier registry state. A capture
records the effective source classification and policy version used for that fetch.

### Ingestion runs and fetch outcomes

`public_ingestion_runs` records one invocation of a versioned ingestion plan. It carries:

- a stable run ID and deterministic run key;
- scheduled time, started time, and completed time;
- runner/parser bundle version and configuration version;
- repository commit and branch;
- run status and failure summary; and
- aggregate counts used by the review report.

The run key is unique for the scheduled occurrence, ingestion plan, and configuration
version. Retrying the same scheduled run reuses or completes that logical run; it does not
create a second set of evidence.

`public_ingestion_fetches` records one source attempt within a run, including request URL,
final URL, HTTP/fetch result, fetch timestamp, response metadata safe to retain, discovered
publication identity, capture ID when new, and one outcome:
`captured`, `unchanged`, `failed`, `blocked_by_policy`, or `format_changed`.

An unchanged response is a successful fetch outcome, not a new capture. A parser that
previously yielded records and unexpectedly yields none records `format_changed` unless
the adapter has explicit, tested evidence that an empty result is valid.

Run and fetch records are operational audit records. A run may move from running to a
terminal status, but terminal facts are not rewritten to make a failed run appear
successful.

### Immutable source captures

`public_source_captures` is the immutable capture ledger. A capture contains:

- registry ID and effective source policy version;
- canonical URL, request URL, and final resolved URL;
- title, publisher, and upstream publication identity where available;
- fetched timestamp;
- stated publication timestamp, kept distinct from observation or survey time;
- stated observation timestamp and survey-period start/end where explicitly supplied;
- raw byte content hash and hashing algorithm;
- media/content type, byte length, and format;
- geographic scope as stated by the source;
- attribution text;
- archive mode and a raw-content pointer where retention is permitted;
- parser version and capture status; and
- capture-level notes that quote no more source content than permission allows.

The unique capture identity is the registry source, canonical publication URL, upstream
publication identity where present, and raw-byte SHA-256 hash. The content hash is over
the fetched bytes before parsing. A revised source with different bytes creates a new
capture and may reference the earlier capture as a revision; it never overwrites it.

Where copyright, terms, robots policy, or technical controls prohibit raw archiving, the
capture retains the hash, metadata, lawful evidence references, and an external pointer
rather than copying the body into Git or Postgres. Credentials, session tokens, private
pages, paywall circumvention, and personal data not needed for attribution are forbidden.
Search-engine snippets are never capture evidence.

### Immutable Food candidates

`public_food_candidates` is a typed staging table. It does not reuse `observations` and
does not generalize the platform beyond Food. Every row belongs to one capture and retains
the raw source terms alongside any optional normalized mapping.

The candidate contract is:

- `provenance_type = public_source`;
- registry ID, capture ID, and ingestion run ID;
- raw item name and optional canonical item/variant IDs;
- raw variant, quantity, and unit, with optional normalized quantity and unit ID;
- raw price, optional integer `price_kobo`, and optional explicit currency;
- raw availability and normalized availability:
  `available`, `low_stock`, `unavailable`, or `unknown`;
- raw place name, area name, and optional normalized place/area IDs;
- geographic precision:
  `exact_place`, `market`, `neighbourhood`, `lga`, `lagos_state`, or `unknown`;
- the source's geographic-scope text;
- observed timestamp, survey-period start/end, publication timestamp, and fetched
  timestamp as separate nullable facts;
- evidence reference plus optional page, table/section, and row reference;
- extraction method:
  `structured_api`, `structured_table`, `html`, `pdf`, or `manual_review`;
- extraction confidence as a bounded extraction-quality value, not a truth score;
- initial validation status:
  `ready_for_review`, `needs_item_mapping`, `needs_unit_mapping`,
  `needs_place_mapping`, `ambiguous_date`, `possible_duplicate`,
  `price_anomaly`, `unsupported`, or `rejected`;
- parser version, deterministic candidate fingerprint, and optional duplicate/revision
  relationship; and
- non-authoritative raw extraction metadata where needed for reproducibility.

Normalized IDs are nullable by design. `observed_at`, all survey dates, `published_at`,
price, availability, normalized place, and normalized unit are also nullable in staging
when the source does not support them. Null means unknown; the run date never substitutes
for an observation date, a listed price never substitutes for availability, and a seller
address never substitutes for market-wide evidence.

A Food candidate must contain at least one explicit primary claim: a price, or an
availability statement. An unavailable item may have no price. A price-only listing keeps
availability `unknown`. Zero or negative prices, unknown currency for a price, materially
ambiguous units, unsupported place precision, unstable evidence pointers, and invented
dates or availability cannot be `ready_for_review`.

Local units such as derica, mudu, cup, paint bucket, and bag remain distinct unless an
accepted unit policy establishes a conversion. Brands, varieties, grades, package sizes,
fish species, local/imported rice, white/yellow garri, old/new yam, and frozen/live
chicken are not collapsed.

### Deterministic deduplication and related publications

Every candidate fingerprint is SHA-256 over a versioned canonical serialization of:

- canonical registry source identity;
- canonical URL and upstream publication identity;
- capture content hash;
- evidence page/table/row reference;
- raw and normalized item/variant identity;
- raw and normalized quantity/unit identity;
- raw and normalized geographic scope;
- observed time or survey period, when present;
- raw and normalized price/currency;
- raw and normalized availability; and
- fingerprint-policy version.

The database uniquely constrains the candidate fingerprint. Identical reruns therefore
append no candidate.

Deduplication does not erase evidence. Exact duplicates are suppressed by the fingerprint.
Repeated publications, syndicated copies, revised sources, and potentially independent
corroboration remain separately captured and are related to the first candidate with a
classification and reason. A syndication key is based on the named upstream publisher,
publication identity, survey period, and evidence lineage; matching article text or
publisher count alone is not independent corroboration.

An adapter change that alters normalization but not source evidence creates a new
candidate only when the fingerprint policy version changes and the prior candidate is
explicitly linked as superseded extraction. It does not rewrite the prior extraction.

### Review and approval

`public_candidate_reviews` is an append-only decision log. Each decision records candidate
ID, decision (`approve`, `reject`, `request_changes`, or `supersede`), reviewer identity,
review timestamp, reason codes, notes, and the candidate fingerprint reviewed. A later
decision compensates for an earlier decision; it does not update or delete it.

The effective candidate review state is derived from the latest valid decision. The first
implementation may produce deterministic JSON, CSV, Markdown, and SQL-preview artefacts
for human review. It must not create an operations UI, generic RBAC system, or mutable
moderation workflow.

Approval asserts only that the candidate accurately represents the cited public evidence
under this ADR. It does not assert that the source is correct, current, independently
corroborated, or suitable for the live projection.

### Provenance meaning and the publication firewall

If a later ADR authorizes promotion, an accountable government institution, recognized
association, approved partner, or named merchant publishing its own claim maps to
ADR-012 `partner` provenance. In this vocabulary, `partner` means an accountable external
organization or feed; it does not imply a commercial contract or endorsement.

`observed` remains reserved for a direct human report or visit confirmation handled by a
live contribution writer. Static contextual material maps to `reference` and cannot
support a current offer. AI extraction is an extraction method, not `inferred`
provenance: the claim remains attributable to its public publisher, while any model-made
claim not explicit in the source is unsupported and cannot be promoted. Reputable
secondary coverage may stage a candidate, but it cannot become independent evidence when
it merely repeats an identifiable upstream report.

This ADR does **not** authorize a promotion writer. Before the first staged candidate may
enter `observations`, a later accepted decision and implementation must:

1. require an active approved registry source and an effective `approve` review;
2. map every required live field without inventing item, unit, place, availability, or
   observation time;
3. write `provenance = partner` and preserve capture/candidate lineage durably;
4. append exactly once using a database-enforced promotion idempotency key;
5. leave the candidate, capture, review history, and earlier observations unchanged;
6. define correction and revocation behavior;
7. define which public-source evidence is admissible to confidence;
8. prevent synthetic/demo observations from counting as public corroboration or learned
   reputation; and
9. update public projections transactionally and test the live read path.

Until those conditions land, public-source staging tables are quarantined from
`observations` and `offers_current`. Existing synthetic/demo content may continue to power
the demonstration experience, but it remains distinguishable under ADR-012 and cannot
validate, corroborate, approve, or raise the confidence of a public-source candidate.

### Schema authorization and implementation limit

The owner approval of this ADR authorizes Terra to implement the narrow staging schema and
generate migration `0010`, limited to:

- `public_source_registry`;
- `public_ingestion_runs`;
- `public_ingestion_fetches`;
- `public_source_captures`;
- `public_food_candidates`; and
- `public_candidate_reviews`;

plus their foreign keys, checks, unique constraints, indexes, Drizzle exports, deterministic
fetch/extraction tooling, validation tests, and review artefact generation within the
claimed ingestion paths.

The implementation must wire every schema export to the ingestion scripts or validation
path in the same change, per ADR-002. It may not add a generic module, category registry,
graph store, reputation system, operations UI, external API, or dependency without a
separate decision.

Authorization to generate `0010` is **not** authorization to apply any migration to a
shared, preview, or production database. It is not authorization to apply the currently
unapplied `0009`. It is not authorization to insert or update `observations`,
`offers_current`, existing `sources`, demo records, or seed content. It is not
authorization to promote a candidate, push, deploy, or fetch a source whose permission
policy has not been reviewed.

## Alternatives considered

**Write public evidence directly to `observations` as pending.** Rejected. The table still
requires facts many public sources do not support, and its moderation vocabulary has no
review actor or history. A pending lie is still a lie.

**Extend `observations` until every public shape fits.** Rejected. That would weaken the
live Food contract, mix evidence acquisition with public claims, and risk making nullable
unknowns appear in reads that assume exact places and dates.

**Use `raw_payload` as the candidate store.** Rejected. Primary claim semantics would be
unenforced JSON, deduplication would be unstable, and review queries could not distinguish
unknown from omitted.

**Treat every government or merchant publication as observed.** Rejected. `observed`
means a direct human contribution under ADR-012. Public organizational evidence is
accountable external evidence and, if later promoted, uses `partner`.

**Put daily data in `seed.ts` or a migration.** Rejected. Bootstrap must remain static and
offline, migrations define schema rather than current market truth, and demo data must
remain exactly preserved.

**Archive every fetched page in Git.** Rejected. Source permissions and copyright vary,
repositories are poor blob stores, and private/session material must never be captured.
Content-addressed lawful retention plus an immutable pointer is sufficient.

**Auto-publish high-confidence extraction.** Rejected. Extraction confidence measures
parser fidelity, not truth. Initial public-source mode is review-only.

## Consequences

**Improves.** Public evidence can be fetched repeatedly, audited, deduplicated, normalized
gradually, and reviewed without contaminating live observations. Unknown dates, units,
availability, and geography stay visibly unknown. Demo behavior and disposable offline
setup remain unchanged.

**Costs.** Six narrow staging tables and source-specific adapters add operational surface.
Review creates latency. Raw retention must respect source-specific permissions, and
candidate approval cannot be mistaken for launch.

**Constrains.** Coverage reports must show gaps instead of manufacturing statewide
completeness. No source class auto-publishes. No extraction model may invent a missing
claim. No candidate reaches public truth until the publication firewall is separately
accepted and implemented.

**Leaves unresolved.** This ADR does not approve any specific source, classify a proposed
domain, decide source permissions, apply migrations, build promotion, change confidence,
quarantine synthetic rows on existing live reads, or create a moderation interface.

## Validation and review

Terra's implementation is not accepted until an independent Luna refutation attempts to
disprove:

- an unchanged rerun produces zero new captures and candidates;
- an exact duplicate is database-rejected or deterministically suppressed;
- a syndicated copy is not counted as independent corroboration;
- publication time never becomes observation time;
- price never implies availability;
- state/LGA evidence never becomes an exact place;
- local units are not silently converted;
- a source format change cannot report a successful empty parse;
- capture and candidate evidence remains immutable;
- review decisions are append-only and actor-attributed;
- missing canonical source URLs and unstable evidence references fail closed;
- public-source staging cannot write live observations or offers;
- demo and seed files and rows remain unchanged; and
- migration `0010` is generated but not applied.

Review this ADR before authorizing the first promotion writer, the first new source class,
any automatic publication mode, or any change to public confidence/admissibility rules.
