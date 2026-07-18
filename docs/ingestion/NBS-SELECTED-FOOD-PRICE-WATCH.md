# NBS Selected Food Price Watch source policy

**Policy version:** `nbs-selected-food-price-watch-v1`  
**Decision:** standing-approved `active + fetch_and_stage`  
**Publication mode:** review only  
**Approval reference:** Founder standing authorization dated 2026-07-18  
**Lane record:** `ad1fb6929e43ce1c951a4ef1fa10b25f4a56acfd`

This document records the approved source policy for recurring, attributable review of
the National Bureau of Statistics Selected Food Price Watch. It does not apply a database
migration, write to a database, promote a candidate, or publish source-backed evidence.

The machine-readable policy is
[`data/ingestion/source-policies/nbs-selected-food-price-watch.v1.json`](../../data/ingestion/source-policies/nbs-selected-food-price-watch.v1.json).

## Source identity and approved mode

| Field | Required value |
|---|---|
| Publisher | National Bureau of Statistics |
| Dataset | Selected Food Price Watch |
| Dataset identifier | `NGA-NBS-FOODPW` |
| Source category | `government_official` |
| Lifecycle | `active` |
| Permitted ingestion mode | `fetch_and_stage` |
| Publication mode | `review_only` |
| Archive mode | `external_pointer` |
| Candidate review | Manual and append-only |

Canonical URLs:

- Collection: <https://microdata.nigerianstat.gov.ng/index.php/catalog/162>
- Related materials and registry landing page:
  <https://microdata.nigerianstat.gov.ng/index.php/catalog/162/related-materials>
- May 2026 external package pointer:
  <https://microdata.nigerianstat.gov.ng/index.php/catalog/162/download/1427>

Standing approval is satisfied. It must not be represented as unresolved, proposed, or
awaiting another Founder decision. `active + fetch_and_stage` authorizes deterministic
retrieval, capture metadata, hashes, attribution, external pointers, extraction, review
artifacts, and append-only candidate staging inside the review boundary. It does not
authorize live publication.

## External-pointer capture contract

Raw package bytes must not be committed to Git or copied into Postgres. A capture records
the request URL, final resolved URL, exact UTC fetch time, response status, media type,
byte length, raw-byte SHA-256, publisher, publication identity, policy version, parser
version, attribution, and external pointer.

The known May 2026 package identity is:

| Fact | Exact value |
|---|---|
| Publication identity | `Selected Food Price Watch, May 2026` |
| Media/content type | `application/octet-stream` / ZIP |
| Byte length | `5,294,517` |
| SHA-256 | `2d46ff90f87c7bfe75cc3df30ae35cc10a9641971543243e9d885aa7a97ca466` |
| Package files | `Selected_Food_Report_May 26.pdf`; `selected food table May 26.xlsx` |
| Recorded fetch time | `2026-07-18T00:42:43.000Z` |

Every later retrieval is a separate fetch outcome. Hash the response bytes before
parsing. Identical bytes are unchanged evidence. Different bytes create a new immutable
capture or a policy-blocked/format-changed outcome; they never overwrite this identity.
An unexpected empty parse is `format_changed`, not success.

## Time semantics

Publication, survey, observation, and fetch time are separate facts:

| Meaning | May 2026 value | Prohibition |
|---|---|---|
| Publication date | Raw `2026-06-25`; normalized `2026-06-25T00:00:00.000Z` | UTC midnight is a deterministic date-boundary convention, not a source timestamp |
| Survey period | Raw `May 2026`; normalized start/end `2026-05-01T00:00:00.000Z` to `2026-05-31T23:59:59.999Z` | Month boundaries are conventions, not observation timestamps |
| Observation time | `null` | Neither publication date nor survey boundary may be copied to `observedAt` |
| Fetch time | `2026-07-18T00:42:43.000Z` for the retained review capture | Fetch time says when WetinDey retrieved bytes, not when NBS observed a price |

Missing time remains unknown. No run date, publication date, or normalized survey
boundary may manufacture an observation timestamp.

## Geography, price, unit, and availability

The May package supports Lagos State precision for the retained candidates. It does not
support a market, LGA, neighbourhood, shop, seller, or exact place. Preserve the raw
source label `Lagos` next to `geographicPrecision: lagos_state`. Never duplicate a state
average across markets or map it to a place.

Prices are source-stated state-level values for exact source-stated items and units. Keep
raw item, brand or variant, quantity, unit, price string, currency, and normalized integer
kobo as separate facts. Do not collapse brands, varieties, package sizes, grades, or
local measures. Do not convert a bag, basket, cup, derica, mudu, paint bucket, or another
local measure without a separately accepted unit policy.

The report supplies price evidence, not stock evidence. When the source has no explicit
availability statement, both raw availability and any live availability assertion remain
absent and normalized staging availability is `unknown`. A price never means `available`,
`low_stock`, or `unavailable`.

## Provenance and attribution

Review candidates use `provenanceType: public_source`. That staging value is not an
`observations.provenance` value and has no live effect. If a later accepted promotion
decision ever authorizes NBS evidence to enter observations, accountable institutional
evidence would use `partner`, never `observed`; that later decision does not exist today.

Attribution must name all four dimensions:

1. publisher: National Bureau of Statistics;
2. publication: Selected Food Price Watch;
3. supported geography; and
4. supported survey period.

For the retained May 2026 Lagos State evidence, the required origin label is:

> Official data · NBS · Lagos State · May 2026

Source-backed evidence must never use `Sample`. `Sample` is reserved for synthetic/demo
content. The NBS origin label is not a confidence badge, verification claim, endorsement,
availability assertion, or permission to style evidence as confirmed.

## Publication firewall

`active + fetch_and_stage` stops at the append-only review boundary. It has no effect on:

- `observations` or `offers_current`;
- confidence, freshness, independence, reputation, verification, or rewards;
- map markers, search, item/place pages, SEO, structured data, or social cards;
- live UI or the existing synthetic/demo fixture; or
- market/place coverage claims.

Shared or Production application of migration `0010` remains separately blocked. This
policy does not authorize a shared database write, Production write, live promotion,
push, or deployment. The current Preview quarantine and unknown Production migration
state are not changed by repository review artifacts.

## Historical artifact preservation

The earlier controlled pilot remains historical evidence and must not be rewritten:

- [`data/ingestion/nbs-selected-food-may-2026.review.json`](../../data/ingestion/nbs-selected-food-may-2026.review.json)
- [`docs/ingestion/NBS-MAY-2026-PILOT.md`](NBS-MAY-2026-PILOT.md)

Their earlier unresolved-policy record explains why that pilot was ineligible at the
time. This approved policy compensates forward; it does not alter the earlier artifact,
its hash, its candidates, or its publication firewall.
