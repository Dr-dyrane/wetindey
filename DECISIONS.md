# WetinDey decisions

The accepted and open decisions are maintained in Section 40 of `WETINDEY_BIBLE.md`.

## Accepted ADRs

Read these before proposing work in the area they govern. An ADR overrides any older
document, memo, or research note that disagrees with it.

| ADR | Title | Status | Governs |
|---|---|---|---|
| [001](docs/adr/001-fulfilment-is-out-of-scope.md) | Fulfilment is out of scope; buyer and seller arrange it themselves | Accepted | **No delivery, dispatch, courier, tracking, cart, checkout, or payments.** Contact seller is the handoff. Blocks any delivery-API proposal. |
| [002](docs/adr/002-service-architecture-of-record.md) | The service architecture of record, and the sequence to reach it | Accepted, amended by 003 | **[docs/architecture/SERVICE-ARCHITECTURE.md](docs/architecture/SERVICE-ARCHITECTURE.md) is the architecture of record.** The documented module layer does not exist. Correctness work precedes boundary work. **If you write it, wire it to a live call site in the same change, or do not write it.** |
| [003](docs/adr/003-identity-for-contribution-trust.md) | Optional accounts, because contribution trust needs an author | Accepted; proposed amendment in ADR-011 | **Reading is anonymous forever; writing may be attributed.** Auth is recognition, never a gate. Attribution is now present in the current tree; safe earned-reputation semantics are not. |
| [004](docs/adr/004-drizzle-is-the-orm.md) | Drizzle is the ORM | Accepted | Ratifies what shipped. Do not re-decide the ORM or rewrite the data layer. |
| [005](docs/adr/005-mapbox-is-the-map-provider.md) | Mapbox is the map provider; there is no geocoder | Accepted | Ratifies what shipped. CDN-loaded, not a package dep. **There is no geocoding** — the Bible's "geocoding provider" question was moot. |
| [006](docs/adr/006-freshness-windows.md) | The freshness windows are 24h and 72h | Accepted | Ratifies 24h stale / 72h expired and names `src/lib/trust.ts` the single authoritative expression. T1 now wires that model across cards, detail, Get-It, and narrowed map markers; provenance admission remains gated by ADR-015 and unapplied migration `0009`. |
| [007](docs/adr/007-contact-belongs-to-a-seller-not-a-place.md) | Contact belongs to a seller, not a place | **Rejected** | **Decides nothing — kept so the argument is not rebuilt.** "`places` conflates venue with vendor" is false: `place_type` is a venue *kind*, and 19 of 38 `open_market` rows are already a single stall. The Bible already settles it — *a stall is a `place`*. **Bible 40.2 stands: consent capture is the blocker, not the schema.** |
| [008](docs/adr/008-category-filtering-and-pillars.md) | Multi-Category Expansion and Core Pillars | Accepted; proposed amendment in ADR-010 | **Expands scope from Food to 6 pillars.** The current selector is partially wired, but a category value does not yet provide a complete typed vertical. |
| [009](docs/adr/009-polymorphic-ratings-and-reviews.md) | Polymorphic Ratings & Reviews System | Accepted; proposed amendment in ADR-011 | **Lays schema foundation for generic reviews.** It has no live read/write capability yet and must not be treated as trust evidence or a usable rating filter. |
| [012](docs/adr/012-observation-provenance-boundary.md) | Observation provenance is explicit and fail-closed | Accepted | **Every immutable observation is classified as synthetic, observed, partner, reference, or inferred.** Unknown and historical rows fail closed to synthetic; live writers set observed explicitly. Source type, collection method, moderation, and provenance remain separate. |
| [013](docs/adr/013-public-source-ingestion-boundary.md) | Public-source food evidence enters an append-only review boundary | Accepted | **Public Food evidence is registered, captured, extracted, deduplicated, and reviewed in six quarantined staging tables.** It does not enter observations or public projections; migration generation is authorized, but migration application and promotion are not. |
| [014](docs/adr/014-pillar-baselines-and-release-migrations.md) | Pillar desired state with short-lived release migrations | Accepted | **Desired-state pillars define the target; immutable deltas record shared execution.** Fresh databases use the latest proven baseline plus later deltas, existing databases use pending deltas only, and ledger reconciliation is exceptional recovery rather than deployment. |
| [015](docs/adr/015-observation-provenance-admissibility.md) | Live confidence admits observed evidence; synthetic data stays labelled demo | Accepted | **Only observed evidence may produce V1 current-state confidence.** Synthetic data is zero-confidence, visibly labelled demo fallback; partner, reference, and inferred remain quarantined. Provenance-aware code must not deploy before `0009` is authorized and applied to the target database. |
| [017](docs/adr/017-cbn-reference-rate-converter.md) | Money & Exchange reference and Sample discovery prototype | Accepted | **Frankfurter’s CBN provider supplies the official reference rate; conversion stays local.** Demonstration bank/BDC points are always labelled Sample and never claim a real business, licence, directions, contact, hours, or outlet rate. |

## Proposed ADRs

These record owner-directed product evolution but do not authorize implementation while
their detailed boundaries remain under review.

| ADR | Title | Status | Governs if accepted |
|---|---|---|---|
| [010](docs/adr/010-typed-live-local-information-platform.md) | WetinDey is a typed live local information platform | Proposed | Separates pillars, selectable category capabilities, signal types, claims, and observations. Food is V1, not the universal ontology. Defines the target category-aware header and contextual-filter contract without authorizing a registry or schema work. |
| [011](docs/adr/011-earned-trust-graph-and-reputation.md) | Earned Trust Graph, scoped reputation, and non-purchasable verification | Proposed | Separates identity, reputation, confidence, verification, status, roles, reviews, and rewards. Trust is earned from verifiable outcomes and cannot be purchased. |

**Retroactive ADRs 004-006** record decisions that shipped in code and were never written
down, while the Bible still listed them *open* — an invitation for an agent to re-decide a
load-bearing choice and rewrite working code. They ratify; they do not re-open.

**Where documents disagree:** an ADR beats every other document. The architecture of record
beats the Bible and `docs/`. **The code beats all of them** — when the code and a document
disagree, the document is the bug.

## Writing an ADR

Create one ADR in `docs/adr/` for every decision that changes:

- product scope;
- domain meaning;
- shared interaction behavior;
- data trust rules;
- external infrastructure;
- privacy posture;
- or a difficult-to-reverse technical choice.
