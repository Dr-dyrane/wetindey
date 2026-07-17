# WetinDey decisions

The accepted and open decisions are maintained in Section 40 of `WETINDEY_BIBLE.md`.

## Accepted ADRs

Read these before proposing work in the area they govern. An ADR overrides any older
document, memo, or research note that disagrees with it.

| ADR | Title | Status | Governs |
|---|---|---|---|
| [001](docs/adr/001-fulfilment-is-out-of-scope.md) | Fulfilment is out of scope; buyer and seller arrange it themselves | Accepted | **No delivery, dispatch, courier, tracking, cart, checkout, or payments.** Contact seller is the handoff. Blocks any delivery-API proposal. |
| [002](docs/adr/002-service-architecture-of-record.md) | The service architecture of record, and the sequence to reach it | Accepted, amended by 003 | **[docs/architecture/SERVICE-ARCHITECTURE.md](docs/architecture/SERVICE-ARCHITECTURE.md) is the architecture of record.** The documented module layer does not exist. Correctness work precedes boundary work. **If you write it, wire it to a live call site in the same change, or do not write it.** |
| [003](docs/adr/003-identity-for-contribution-trust.md) | Optional accounts, because contribution trust needs an author | Accepted | **Reading is anonymous forever; writing may be attributed.** Auth is recognition, never a gate. Supersedes Bible 40.1 *Anonymous browse*; strikes *accounts/auth* from ADR-002's refusal list (RBAC still refused). **Conditional:** the benefit is unbuilt until `sources.user_id` exists and the write paths use the session. |
| [004](docs/adr/004-drizzle-is-the-orm.md) | Drizzle is the ORM | Accepted | Ratifies what shipped. Do not re-decide the ORM or rewrite the data layer. |
| [005](docs/adr/005-mapbox-is-the-map-provider.md) | Mapbox is the map provider; there is no geocoder | Accepted | Ratifies what shipped. CDN-loaded, not a package dep. **There is no geocoding** — the Bible's "geocoding provider" question was moot. |
| [006](docs/adr/006-freshness-windows.md) | The freshness windows are 24h and 72h | Accepted | Ratifies 24h stale / 72h expired, and names `src/lib/trust.ts` the single authoritative expression. **Ratified, not yet true** — competing models still ship. Phase 1 makes it sole. |
| [007](docs/adr/007-contact-belongs-to-a-seller-not-a-place.md) | Contact belongs to a seller, not a place | **Rejected** | **Decides nothing — kept so the argument is not rebuilt.** "`places` conflates venue with vendor" is false: `place_type` is a venue *kind*, and 19 of 38 `open_market` rows are already a single stall. The Bible already settles it — *a stall is a `place`*. **Bible 40.2 stands: consent capture is the blocker, not the schema.** |

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
