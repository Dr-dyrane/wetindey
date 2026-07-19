# Catalog Stewardship Workflow

**Status:** Proposed product and operations contract; documentation only  
**Evidence cut:** 19 July 2026  
**Scope:** Food catalog identity, stewardship requests, canonical publication, and the
boundary to immutable Food observations  
**Authority:** None beyond this document. An accepted governance ADR and separately
claimed implementation lanes are required before any role, state, schema, API, RLS
policy, migration, media workflow, UI, seed operation, or rollout described here exists.

## 1. Read this first

WetinDey has two different jobs that must never be collapsed:

1. **Catalog Stewardship answers what a Food subject is.** It manages names, local
   aliases, variants, allowed units, comparability, lifecycle, and reference imagery.
2. **Observation reporting records what somebody observed.** It records a claim about a
   previously published subject at a place and time. Under ADR-019, that claim is
   immutable pending evidence and cannot change public state until authorized
   moderation.

A report is not a catalog creation form. A catalog publication is not evidence that an
item is available, priced, observed, safe, authentic, seller-approved, or trusted.

The sole product direction already recorded in `LANES.md` is:

> A missing-item submission follows a reviewed catalog-request path. An observation or
> report never creates a catalog row.

Everything else in this document is a **proposal for a future ADR**, not a ratified
decision. Terms such as `MUST`, `MUST NOT`, and `only` below describe candidate
acceptance gates for that ADR. They do not authorize implementation.

### 1.1 Precedence

When this document conflicts with another source:

1. accepted ADRs win;
2. `docs/architecture/SERVICE-ARCHITECTURE.md` wins over other product documents;
3. current code wins over every document; and
4. `LANES.md` controls path ownership, not product truth.

Relevant accepted authorities are ADR-002, ADR-014, ADR-015, ADR-019, and ADR-022.
Proposed ADR-010 does not yet authorize a category-capability registry or another
vertical.

### 1.2 Status vocabulary

| Label | Meaning |
|---|---|
| **CURRENT** | Present in the repository evidence reviewed for this document. It is not automatically deployed or proven against a shared database. |
| **DORMANT / HISTORICAL** | Present as unused data, stale commentary, or target architecture without a live caller. |
| **PROPOSED** | Candidate behavior requiring an accepted ADR, exact lanes, implementation, and independent proof. |
| **PROHIBITED** | Contradicts an accepted ADR, the architecture of record, or the recorded Catalog/Observation separation. |

## 2. Current system truth

### 2.1 Current Catalog records

The current schema has four Catalog tables:

| Table | CURRENT fields and behavior | Material gap |
|---|---|---|
| `items` | `slug`, `canonicalName`, description, four image metadata fields, free-form `category`, boolean `active`, timestamps | `category` is an unconstrained string, not a typed capability. There is no publication revision, retirement reason, merge redirect, or stewardship audit. |
| `item_aliases` | Item FK, raw alias, locale, `normalizedAlias`, and weight | Live search reads the raw alias. Normalization and weight are written by the seed but do not rank or normalize live search. There is no lifecycle or uniqueness policy for reviewed aliases. |
| `item_variants` | Item FK, slug, display name, generic JSONB attributes, boolean `active` | JSONB currently mixes form, grade, package, brand-like wording, and other semantics. It is not a reviewed typed attribute model. |
| `units` | Code, display name, dimension, one global `canonicalQuantity`, notes | A global quantity cannot make local scoops universally comparable across foods. There is no reviewed item/variant-to-unit relation or reportability state. |

The image columns on `items` are independently nullable. Comments intend URL,
attribution, licence, and source URL to travel together, but the database does not
currently enforce that contract.

There is no current brand table, packaged-product table, Catalog request, Catalog case,
revision ledger, decision ledger, redirect, Catalog role, Catalog RLS policy, or Catalog
operations UI.

### 2.2 Current reads cross intended boundaries

- `searchItems` filters `items.active = true` and a caller-supplied category, but then
  joins observations, offers, provenance, and trust. It is not a Catalog-only read.
- Search uses leading-wildcard `ILIKE` over canonical name, slug, and raw alias.
  `normalizedAlias` and alias weight are not used.
- `getItemNarrowingOptions` reads variants, offers, units, and places. It checks variant
  activity but does not independently prove that the selected item is active, Food, or
  published under a stewardship lifecycle.
- `getInitialSubmissionData` returns every place, item, variant, and unit without active
  or category filtering. It sends a full taxonomy rather than a bounded reportable
  selection.
- The architecture document names `getFoodItemCandidates` as an orphan. The current
  `src/app/actions.ts` export inventory contains no such function; that note is
  historical, not a callable boundary.

### 2.3 Current writes and seed blast radius

The repository writer found for the four Catalog tables is the development seed. That is
not proof that it is the only writer in every shared environment.

Running `src/db/seed.ts` is destructive far beyond Catalog. It truncates offers,
observations, sources, places, areas, aliases, variants, items, and units, then rebuilds
Sample data. It must never be treated as routine Catalog CRUD, ingestion, or a safe
shared-database refresh.

The source seed currently contains Food plus price-shaped Home, Health, Money, Transport,
and Community rows. Those strings do not make complete typed category capabilities.
They demonstrate the exact multi-category modeling gap identified by the architecture of
record.

Founder feedback records the household-size seed correction as source-complete and
statically refuted, with 48 items and 85 variants. No destructive refresh or connected
live-catalog result follows from that source commit.

### 2.4 Current reporting

- `ReportPriceSheet` is visibly paused. Every picker, field, availability control, and
  submit button is disabled.
- `submitObservation` delegates to `admitFoodContribution`, whose release controls and
  ADR-019 transaction are the contribution boundary.
- Schema/source presence does not prove that contribution reporting is activated on a
  shared target.
- ADR-019 requires pending, idempotent, rate-enforced, moderated evidence and forbids an
  admission transaction from updating a public projection.

### 2.5 Current and dormant architecture

The Catalog service described by the architecture of record is target decomposition, not
a live module. No live capability implements `WetinDeyModule`. There must be no new
empty `src/modules/catalog` package, generic registry, or uncalled Catalog export.

The architecture correctly identifies dormant data opportunities such as alias
normalization/weight and unit conversion fields. Dormant columns are not a working
stewardship system and are not permission to reorganize the application before
correctness gates.

## 3. Explicit prohibitions

The following are prohibited regardless of rollout phase:

- an observation, price report, visit confirmation, receipt, or report retry creating an
  item, alias, variant, brand, product, or unit row;
- using a Catalog request ID, free-text "Other" value, or client-created temporary ID as
  an observation subject;
- a seller, contributor, support agent, importer, or client directly publishing a
  canonical row;
- auto-approving or auto-merging from a duplicate score, barcode, image match, seller
  assertion, popularity, or payment;
- rewriting, deleting, cascading, or silently re-parenting immutable observations during
  Catalog merge, split, retirement, or correction;
- treating Catalog publication as availability, price, provenance, confidence,
  verification, seller accuracy, business legitimacy, or an endorsement;
- letting payment, sponsorship, subscription, advertising, or volume buy Catalog
  approval, priority, verification, role, lifecycle, ranking, badge, or prominence;
- modeling Power, Exchange, Services, Events, Transport, Health, or another typed signal
  as a Food item with a price-shaped value;
- creating a `CategoryCapability` registry, EAV catalog, generic filter builder, generic
  policy engine, or empty module before two complete live verticals justify it;
- using observation evidence media as a public Catalog reference image, or using a
  Catalog reference image as observation evidence;
- adding fulfilment, delivery, dispatch, courier, inventory guarantee, cart, checkout,
  order, tracking, funds, or payment behavior; and
- creating a server export, table, or UI that has no live caller and owner in the same
  coordinated implementation slice.

## 4. Proposed V1 Food subject model

This section is a candidate model for an ADR. Existing rows do not automatically conform
to it.

### 4.1 V1 hierarchy

The proposed V1 report subject is exactly:

> published active Food item + published active variant + reportable variant-unit
> relation

| Term | Proposed V1 meaning | Example boundary |
|---|---|---|
| **Canonical Food item** | A stable generic buyer intent | Rice, Tomatoes, Palm Oil |
| **Local alias** | A locale- and usage-scoped search name that resolves to one canonical item | A local name for Rice; not a second item |
| **Variant** | A materially meaningful form, grade, origin, preparation, or other distinction under one item | Imported parboiled rice versus local stone-free rice |
| **Unit** | A named quantity expression | 1 kg, one tuber, one loaf, Congo |
| **Variant-unit relation** | The reviewed statement that a variant may be reported in a unit, independently of whether that unit is comparable with another | Loose rice may be reportable by Congo without claiming every Congo has a universal mass |

V1 does not create `brand` or `packaged_product` entities. Contributor request fields,
report gates, action contracts, and V1 candidate schema do not depend on them.

### 4.2 Brands and packaged products: V1.5 proposal

Brands still require stewardship, but adding them before their identity hierarchy is
decided would repeat the current JSONB/alias ambiguity.

A future ADR may ratify this candidate hierarchy:

- a **brand** is a commercial naming identity, distinct from a seller, place, producer
  verification, or product authenticity claim;
- a **packaged product** links a brand, one existing item variant, a product-line name,
  and a declared package quantity;
- a packaged product may be an optional additional reference on a report, but it does
  not replace the required variant-unit semantics; and
- brand aliases, trademarks, barcodes, package redesigns, and producer evidence receive
  their own revision and conflict policy.

That ADR must decide how existing brand-used-generically aliases and branded variant
names migrate. Until then, a familiar brand word may remain current search content but is
not proof that a canonical brand or product entity exists.

### 4.3 Legacy reconciliation

Current records are **legacy current records**, not approved revisions under this
proposal. Before activating stewardship publication, a bounded inventory must classify:

- aliases that are local names, misspellings, transliterations, or brands used
  generically;
- variants that mix grade, form, brand, package, and unit;
- item names that are ambiguous generic concepts;
- JSONB attributes that are descriptive versus identity-defining;
- global unit quantities that are exact, approximate, item-dependent, or unusable; and
- image rows that have complete, incomplete, or unreviewed rights metadata.

No migration may silently stamp all existing rows "reviewed." A bootstrap publication
requires explicit reason codes, actor, source commit, revision snapshot, and an approved
activation plan. Existing non-Food price-shaped rows must not be promoted, remapped to
Food, or treated as category capability evidence.

## 5. Proposed candidate invariants

These invariants require an accepted ADR before implementation.

### 5.1 Reportability gate

A selection is eligible to appear in Report Price only when all are true:

- capability is Food;
- the item identity is `active`;
- the item revision is `published`;
- the variant identity is `active`;
- the variant revision is `published`;
- the exact variant-unit relation has `reportingAllowed = true`;
- the reportability record for that exact item + variant + variant-unit relation key is
  `allowed` and bound to the selected published revision IDs; and
- no merge, retirement, safety hold, rights-independent identity conflict, or
  superseding revision blocks the selection.

The report UI may use a bounded read adapter for choices, but the ADR-019 admission
transaction must re-resolve the IDs and recheck every condition. A successful earlier
read is not authorization and cannot close a time-of-check/time-of-use gap.

If a cached or selected item becomes retired, merged, suspended, or otherwise
non-reportable, admission fails with a stable reason and request ID. It creates no
observation, rate charge, moderation case, audit admission, or projection effect.

### 5.2 Independent dimensions

These states must never be collapsed:

- canonical identity lifecycle;
- revision lifecycle;
- reportability;
- unit comparability;
- Catalog request/case lifecycle;
- reference-asset lifecycle;
- observation moderation;
- seller place-control and role assignment;
- claim-specific confidence; and
- public current offer state.

`Catalog read projection` means the published names and relations used by search and
forms. It is not `offers_current` and does not contain price, availability, freshness, or
confidence.

## 6. Proposed role and authorization model

ADR-022 creates no Catalog role today. The following are candidate roles and permissions
for the required Catalog governance ADR.

### 6.1 Candidate permission matrix

| Actor | Candidate permissions | Explicit denial |
|---|---|---|
| Anonymous requester | Create one rate-limited missing-Food request; read/respond/withdraw through a server-minted opaque capability | No reconsideration, request list, canonical write, case read, moderation, publication, seller scope, or reputation |
| Signed-in contributor | Same request rights; list safe statuses for requests submitted under that account; submit one policy-bounded reconsideration for an owned rejected request | Sign-in is not approval, publication, rate, or moderation bypass |
| Scoped seller proposer | After ADR-022 P2, create and manage proposals for an actively proved place only when assignment includes `food_catalog.propose` | No implicit permission from `seller_owner`, `seller_manager`, or `seller_staff`; no other place; no canonical write or self-approval |
| Catalog Steward | Triage, assign, and explicitly escalate cases; inspect permitted evidence; record duplicate analysis; draft revisions; request information | Cannot publish a revision they requested, proposed, or materially drafted |
| Catalog Publisher | Approve or reject an ordinary reviewed revision and execute publication | Cannot publish their own request or draft; cannot alone publish merge, split, material comparability change, or permanent emergency action |
| Catalog Safety Responder | Apply an immediate, reason-coded, time-bounded deny-only reportability or public-asset hold; revoke a specifically assigned compromised anonymous access grant | Cannot create, publish, allow, resume, retire, merge, withdraw, act on the request, mint a replacement receipt, or make a hold permanent |
| Catalog Rights Reviewer | Inspect permitted Catalog reference-asset evidence and record an immutable approval, rejection, information request, or withdrawal decision | Cannot be asset submitter/draft author, execute withdrawal, publish or republish an asset, change an item, inspect Observation Evidence Media without its separate authority, or decide their own evidence packet |
| Catalog Second Reviewer | Independently approve merge, split, distinct unit creation/retirement/reactivation, material relation/comparability change, and permanent action after first review | Cannot be requester, proposer, draft author, or first decision-maker for the case; cannot approve a same-ID metadata-only unit revision unless it also resolves an active hold |
| Catalog Reconsideration Reviewer | Decide one bounded reconsideration based on new evidence | Cannot be requester, original reviewer, publisher, or support actor for the original decision |
| Catalog Auditor | Read redacted transition and audit records | No raw private evidence, requester secrets, canonical mutation, decision, or publication |
| Support | Explain status and help navigate the flow | Cannot impersonate, edit a request, decide, publish, attach an anonymous request to an account, or reveal private evidence |

### 6.2 Authorization rules

- Authorization truth is application-owned and provider-independent.
- Every protected read and mutation resolves current subject, permission, resource,
  place, lifecycle, and assignment on the server.
- UI visibility, Auth metadata, email, seller label, browser state, and a request ID are
  never authority.
- Unknown role, permission, subject, place, state, or environment fails closed.
- RLS and grants are defense in depth; they do not replace application authorization.
- Suspension or revocation defeats stale session claims.
- A Catalog Safety Responder is a narrowly scoped emergency role, not a Publisher alias.
  Its only direct enforcement mutations are to reduce public exposure from `allowed` to
  `suspended` or from a currently exposed asset state to `suppressed`, and to invalidate
  an explicitly assigned compromised anonymous access grant without changing the
  request. Opening, routing, or escalating safety evidence is a non-mutating
  communication right; it does not approve Catalog truth, edit canonical
  item/variant/unit/category/imagery data, merge records, or widen or mint grants.
- Emergency authority cannot create or edit a canonical revision, activate or resume
  reportability, approve catalog truth, edit canonical item/variant/unit/category/imagery
  data, merge records, widen or mint grants, or withdraw an asset. It cannot read or act
  as the anonymous requester after revocation. Every emergency command names a risk,
  policy version, review deadline where exposure is held, and independent reviewer
  assignment.
- A missed review deadline never restores exposure. It leaves the resource fail closed,
  records an escalation, and requires the explicit reviewed transition in Section 8.

## 7. Proposed workflows

### 7.1 Contributor: "Can't find it? Request item"

1. The user searches the Food catalog.
2. The CTA appears only after a server-complete no-match result or an explicit "None of
   these" choice. A network failure must not masquerade as no match.
3. The CTA reads **"Can't find it? Request item"**.
4. The Request Item sheet prefills the searched name and shows `Food` as a fixed context,
   not an editable multi-category selector.
5. Required field: proposed item name. Progressively disclosed optional fields are one
   local alias plus locale, one variant description, and one proposed unit label or
   quantity. V1 accepts no file, image, external URL, barcode, or brand/product entity.
6. Before submit, the server repeats duplicate search and returns likely matches with
   reasons. The user may select an existing item or continue with a request.
7. Submission creates a request, case, typed child records, and admission audit only. It
   creates no canonical row and no observation.
8. Success copy is **"Received for review"** with a request ID. It never says added,
   saved to Catalog, approved, published, verified, or available.
9. If the request resolves to an existing alias or variant, the requester sees the
   published resolution. If a new revision is approved but not yet published, the item
   remains unavailable to Report Price.

### 7.2 Anonymous request continuity

The online Request Item sheet render includes a stateless signed form challenge with a
random JTI, signing `kid` and key version, algorithm, form purpose, expected origin,
policy version, issued-at, short expiry, and
`csrfCommitment = SHA-256("food-request-csrf-v1" || JTI || expectedOrigin || rawNonce)`.
The render generates a separate 256-bit `rawNonce` and places it only in the same-origin
form's in-memory/hidden submission state, never a URL, log, analytics event, persistent
browser store, or server row. Rendering stores no row, verifier, idempotency result, or
audit event and therefore is not a lifecycle mutation. The server verifies the
signature/expiry and constant-time recomputes the commitment from the presented nonce;
the signed challenge plus matching nonce authorizes only
`beginAnonymousFoodRequestAdmission` and is never accepted by another action.

The form generates and retains a high-entropy idempotency key before calling begin.
`beginAnonymousFoodRequestAdmission` verifies the challenge, exact same-origin
`Origin`/Fetch Metadata, and form-bound anti-CSRF value, then atomically locks a unique
execution identity `(provisional caller namespace = challenge JTI, idempotency key)` and
a separate unique challenge-consumption row keyed by JTI alone. Operation is a stored
envelope/digest field, not a unique-key column. The same transaction records challenge
consumption, reproducible verification evidence, the admission verifier, one durable
disposition, and one audit:

- same challenge JTI + key + normalized origin/form/policy digest returns the stored
  disposition with no second grant or audit event;
- same key with a different digest conflicts with no grant;
- a different key after challenge consumption returns `form_challenge_consumed`;
- concurrent calls serialize to exactly one grant/result/audit; and
- if the response setting the admission-grant cookie is lost, no request exists and no
  secret is reconstructed. The consumed challenge cannot be reused; re-rendering the
  form obtains a distinct signed challenge and starts over.

The consumed evidence stores the exact canonical signed payload and signature, payload
and signature digests, JTI, `kid`, key version, algorithm, retained public-key
fingerprint, verification-configuration generation and key state, verified-at time,
purpose/origin/policy/issued-at/expiry fields, normalized Origin/Fetch Metadata decision,
signed `csrfCommitment`, presented-nonce digest, anti-CSRF comparison result, operation,
idempotency key, normalized request digest, and stable result. It stores no raw nonce or
admission secret. The signed envelope is no longer authorization because the JTI is
consumed; the retained non-secret public key can reproduce the historical signature
check even after private-key retirement. A missing/mismatched nonce, origin mismatch, or
lost form state fails closed and requires a newly rendered challenge. Signed challenge
expiry needs no scheduler transition. The challenge cannot submit a request, replay
admission, read status, or mint more than one admission grant.

Before an anonymous form may submit, it obtains a short-lived admission grant through
`beginAnonymousFoodRequestAdmission`. This is authorization evidence for admission and
exact admission replay only; it is not the later request-access capability.

1. The server generates at least 256 random bits, stores only a keyed verifier plus a
   random admission-grant ID, verifier-key version, origin binding, policy version,
   creation time, and bounded expiry, and sets the raw value only in a `Secure`,
   `HttpOnly`, `SameSite=Strict` admission cookie.
2. The form is bound to that grant with an anti-CSRF value. Submit and replay require an
   exact same-origin `Origin`, same-origin Fetch Metadata, valid anti-CSRF proof, the
   admission cookie, and a live or replay-only verifier. A network address, browser
   fingerprint, public request ID, or idempotency key is never the subject proof.
3. `submitMissingFoodItemRequest` keys anonymous idempotency by operation +
   admission-grant ID + idempotency key and binds it to the normalized payload digest.
   On commit the grant becomes `consumed_replay_only`, remains in the cookie through its
   bounded replay window, and is linked to exactly one durable result.
4. If the response carrying the request-access receipt is lost, the same browser can
   replay the exact submission while the admission grant is valid. The server
   reauthorizes that grant and returns only the stored request ID, safe status, replay
   flag, and `receipt_already_issued`; it neither reconstructs nor replaces the lost
   request-access capability.
5. Same grant + operation + key + digest returns that one result. Same key with a
   different digest conflicts. A different key after consumption returns
   `admission_grant_consumed` and creates nothing. Expiry or loss of the admission cookie
   fails closed; a new form may obtain a new grant and submit a new rate-limited request.
6. The replay window is versioned and no longer than 24 hours. The admission grant
   authorizes no request status, response, withdrawal, rotation, canonical read, or
   recovery-secret issuance. Raw admission and request-access secrets are excluded from
   logs, analytics, audit, URLs, and durable results.

Admission-grant transitions:

| From | Actor and proof | Command | Preconditions | To | Required result |
|---|---|---|---|---|---|
| `absent` | Anonymous form presenting a valid unexpired signed form challenge, high-entropy idempotency key, exact origin/Fetch Metadata, and bound anti-CSRF value | `beginAnonymousFoodRequestAdmission` | Provisional namespace is the challenge JTI; `(JTI, key)` execution identity and unique JTI-consumption claim are both unclaimed; signature/key version and origin/form/policy digest match; abuse policy passes | `ready` | Challenge JTI, complete signed verification envelope, one keyed admission verifier, durable result, and audit commit; raw admission grant is set once in the secure cookie |
| `ready` | Anonymous submitter proving admission cookie, origin, Fetch Metadata, and anti-CSRF value | `submitMissingFoodItemRequest` | Grant live/unconsumed; idempotency key and normalized payload valid | `consumed_replay_only` | Request admission and one durable idempotency result commit atomically |
| `consumed_replay_only` | Same anonymous submitter proving the same admission grant and anti-CSRF/origin checks | Exact `submitMissingFoodItemRequest` replay | Same operation, key, digest, and linked request result; replay window live | `consumed_replay_only` | Stored safe result returns; no request, rate charge, case, audit admission, or capability is created |
| `ready` or `consumed_replay_only` | Policy scheduler | `expireAnonymousFoodRequestAdmission` | Versioned grant/replay deadline elapsed | `expired` | Verifier becomes unusable, cookie is cleared when next seen, and data-minimized expiry audit appends |

`expired` is terminal. A consumed grant can never return to `ready`, authorize another
idempotency key, or become a request-access grant.

For an anonymous request, the proposed server creates a random single-delivery bearer
capability in addition to the public request ID. The raw capability is never part of the
durable idempotency result.

1. Admission generates at least 256 random bits and stores only a keyed verifier bound to
   the request ID, verifier-key version, creation time, and lifecycle. The raw value is
   held only long enough to form the first response.
2. That first successful response sets a request-scoped `Secure`, `HttpOnly`,
   `SameSite=Strict` receipt cookie. The raw value is never put in a URL, response body,
   analytics event, log, audit row, or client-readable storage.
3. The receipt is accepted only with the matching public request ID, exact same-origin
   and CSRF checks, an active verifier, and the bounded request action. It exposes a
   minimized status and permits only response to requested structured fields or
   withdrawal for that request.
4. A same-key admission replay returns the durable request ID, safe status, replay flag,
   and `receipt_already_issued`; it never reproduces or replaces the capability. If the
   first response or cookie was lost, continuity fails closed. Neither support, sign-in,
   the public request ID, nor the stored verifier can recover it. The person may submit a
   new rate-limited request, which may later be consolidated without exposing either
   requester.
5. Clearing cookies loses continuity. Signing in does not automatically attach a prior
   anonymous request to the account.
6. Durable data-minimized subject and network limits still apply.

The active request receipt does not authorize reconsideration. An anonymous rejected
requester may submit a new standalone rate-limited request, but the public request ID and
old receipt cannot attach it to, reopen, or overwrite the rejected request.

Rotation is two-phase so a dropped response cannot revoke the last usable receipt:

1. `beginAnonymousFoodRequestCapabilityRotation` requires the active receipt and a new
   idempotency key. It stores a pending replacement verifier and short expiry while the
   old verifier remains active, then emits the replacement once in a distinct secure
   pending-receipt cookie.
2. `confirmAnonymousFoodRequestCapabilityRotation` requires the pending receipt. In one
   transaction it promotes that verifier, revokes the old verifier, clears pending
   state, and appends audit. After commit, the replacement secret is accepted as the
   sole active receipt whether it arrives under the pending or normalized active cookie
   name, so losing the cookie-normalization response does not lose access.
3. An unconfirmed or lost replacement expires without changing the old verifier. A
   replay of the begin command cannot reproduce the pending secret; after expiry the
   holder of the still-valid old receipt may begin again with a new key.

Anonymous access-grant transitions:

| From | Actor and authorization proof | Command | Preconditions | To | Required result |
|---|---|---|---|---|---|
| `absent` | Admission service acting for the anonymous requester | `submitMissingFoodItemRequest` | Request admission commits; no existing grant for the request | `active` | One keyed verifier is stored and the raw receipt is emitted once as specified above |
| `active` | Anonymous requester proving the active receipt | `beginAnonymousFoodRequestCapabilityRotation` | New idempotency key/digest; no unexpired pending rotation | `rotation_pending` | Old verifier remains authoritative; pending verifier and short expiry are stored; replacement is emitted once |
| `rotation_pending` | Anonymous requester proving the pending receipt | `confirmAnonymousFoodRequestCapabilityRotation` | Pending verifier and expiry match; command idempotency matches | `active` | Pending verifier becomes the sole active verifier and old verifier is revoked atomically |
| `rotation_pending` | Policy scheduler | `expireAnonymousFoodRequestCapabilityRotation` | Pending deadline elapsed without confirmation | `active` | Pending verifier is invalidated; old verifier remains active; expiry audit is appended |
| `active` or `rotation_pending` | Anonymous requester proving the current active receipt | `revokeMyAnonymousFoodRequestCapability` | Matching idempotency key/digest and request ID | `revoked` | Active and pending verifiers are invalidated atomically; request lifecycle is unchanged |
| `active` or `rotation_pending` | Catalog Safety Responder with current `food_catalog.request_access.revoke` permission and assigned incident | `revokeAnonymousFoodRequestCapabilityForRisk` | Enumerated compromise reason, request/grant ID, policy version, and incident reference | `revoked` | Active and pending verifiers are invalidated immediately; no request read or mutation authority is granted |
| `active` or `rotation_pending` | Policy scheduler | `expireAnonymousFoodRequestCapability` | Versioned maximum grant lifetime elapsed | `expired` | Active and pending verifiers are invalidated; request lifecycle is unchanged |

`revoked` and `expired` are terminal. The keyed verifier may be retained only for bounded
security/audit retention; it grants no status or request action. An exact self-revoke
retry must prove the presented receipt against that retained verifier and match the same
operation, key, digest, and request. An exact risk-revoke retry does not require or accept
the receipt: it reauthorizes the same Safety Responder, current revoke permission,
incident assignment, operation, key, digest, request/grant IDs, and reason. Either retry
returns only a generic terminal result. A mismatch fails unauthorized or conflict as
appropriate. Every revoke records actor class, authorization mode, request and grant
IDs, prior state, cleared pending state, reason, policy version, command ID, time, and
correlation without recording a raw receipt. No revocation path mints or recovers a
secret, and revocation never withdraws the Catalog request.

This anonymous-access design is proposed security/privacy behavior and must be ratified
before implementation.

### 7.3 Seller proposal for a controlled place

Seller proposals are V1.5 at the earliest. They require completed and proven ADR-022 P2:
an active place-control claim, active scoped assignment, and the separately enumerated
`food_catalog.propose` permission.

1. The seller opens **My place > Catalog proposals** for one authorized place.
2. They first search the published Food catalog.
3. Selecting an existing item creates no availability or inventory assertion. It only
   prepares a proposal for Catalog review.
4. "Request a missing item" uses the same typed Food identity fields, with the controlled
   place added as private review context.
5. The server rechecks place control and permission on every read and mutation.
6. The proposal creates no place-item inventory, offer, price, availability,
   observation, verified badge, or canonical row.
7. The seller may withdraw through `withdrawSellerFoodCatalogProposal` or respond to
   `needs_info` through `submitSellerFoodCatalogProposalInformation`. Each call and
   replay re-resolves the same signed-in seller, `placeId`, active place-control claim,
   active assignment, explicit `food_catalog.propose`, and current proposal version.
8. Only an independent Catalog publication can make the canonical selection reportable.
9. A later seller-authored price or availability submission still enters ADR-019 as
   attributed evidence. Catalog approval does not make it independent or trusted.

### 7.4 Catalog Steward review

1. Triage the queue by oldest service time, request kind, duplicate risk, and lifecycle
   risk. Paid or high-volume proposers receive no priority.
2. Assign a case to a Steward; record assignment history.
3. Review structured identity fields, safe submitter context, current canonical
   candidates, legacy ambiguity, and explainable duplicate factors.
4. Choose one proposed route:
   `needs_info`, reject, withdraw acknowledgement, resolve to existing published item,
   draft alias, draft variant, draft variant-unit relation, or draft new item.
5. Save a typed draft revision against explicit expected revision IDs.
6. Submit the revision for review. The draft author cannot publish it.
7. The Publisher independently approves for publication or requests changes/rejects with
   a reason code.
8. Publication locks the case, revision, affected canonical rows, aliases, relations,
   and lifecycle records; revalidates duplicates and authorization; appends decision and
   audit; and updates the Catalog read projection atomically.
9. Completed publication is the only ordinary authority that can create reportability
   or make a permanent reportability change. The sole non-publication exception is the
   deny-only emergency hold in Section 8.4; its narrowly reviewed resume command can
   restore only the exact unchanged publication that the hold interrupted.

### 7.5 Report Price handoff

Report Price searches only the published reportable Food read boundary. It has no
"Other" row and never accepts a Catalog request ID.

When a request becomes published:

1. the request status may link to the canonical Food result;
2. the user must open a fresh Report Price flow;
3. the client refreshes item, variant, and unit relation data; and
4. `admitFoodContribution` rechecks the exact selection in its transaction.

The Catalog workflow does not reopen the currently paused report UI and does not weaken
ADR-019 activation gates.

## 8. Proposed lifecycle contracts

The following state machines are candidates for the governance ADR. Every transition
appends a decision or audit event; a status column may be a projection but never the only
history.

### 8.1 Request lifecycle

`local_draft` exists only on the device and is not a server state.

Every mutation and scheduler transition in Sections 7.2 and 8.1-8.6 requires the
Section 14.7 command-idempotency contract, current resource versions, and required row
locks. Each successful transition appends the Section 16 audit in the same transaction.
Any transition not listed is denied and audited as a lifecycle conflict.

| From | Actor and permission/proof | Command | Preconditions | To | Required result |
|---|---|---|---|---|---|
| `local_draft` | Requester with signed-in subject or new anonymous admission context | `submitMissingFoodItemRequest` | Explicit online send; valid Food fields; duplicate-search step completed; admission/rate gates pass | `pending_review` | Request, case, access grant where anonymous, stable result, and admission audit commit together |
| `pending_review` | Assigned Catalog Steward with `food_catalog.case.request_info` | `requestFoodCatalogInformation` | Current case/request versions; enumerated structured fields and reason; no terminal decision | `needs_info` | Information request and audit append; no canonical/public effect |
| `needs_info` | Signed-in owner or anonymous requester proving active receipt | `submitFoodCatalogRequestInformation` | Exact open information request; valid bounded response; request not expired and, when anonymous, access grant not revoked/expired | `pending_review` | Typed response, queue return, and audit commit; no canonical/public effect |
| `needs_info` seller proposal | Scoped seller proposer proving current place control and `food_catalog.propose` | `submitSellerFoodCatalogProposalInformation` | Exact `placeId`, proposal/information-request IDs, active claim/assignment and versions, current proposal version, bounded response | `pending_review` | Typed response and audit commit in seller scope; no canonical/public effect |
| `pending_review` | Catalog Publisher independent of requester, proposer, and draft author | `approveFoodCatalogRevisionForPublication` | Linked revision is `in_review`; linked case is open and `decision_ready`; all ordinary/second approvals required by impact are current; duplicate and lifecycle checks pass | `approved_for_publication` | Immutable approval ID and audit append; no projection/reportability change |
| `approved_for_publication` | Catalog Publisher independent of requester/proposer/draft author | `publishFoodCatalogRevision` | Request and linked case are open in compatible states; approval/revision/parent and affected versions match; all publication locks/gates pass; revision creates a new canonical item | `published` | Canonical publication and terminal-closure transaction commit atomically |
| `approved_for_publication` | Catalog Publisher independent of requester/proposer/draft author | `publishFoodCatalogRevision` | Request and linked case are open in compatible states; same publication checks; approved alias, variant, or relation publishes under an existing canonical item | `resolved_existing` | Canonical child publication and terminal-closure transaction commit atomically; requester sees only the now-published resolution |
| `pending_review` | Catalog Publisher independent of requester and assigned Steward | `resolveFoodCatalogRequestToExisting` | Reviewed evidence identifies an unchanged already-published canonical subject; duplicate check is current; no alias/variant/relation/canonical mutation is needed | `resolved_existing` | Immutable resolution decision links the safe published subject and closes request/case; no canonical, reportability, observation, or offer mutation |
| `pending_review` or `needs_info` | Signed-in owner or anonymous requester proving active receipt | `withdrawFoodCatalogRequest` | Request is non-terminal and access proof is current | `withdrawn` | Request closes; case cannot publish from it; canonical/observation state is unchanged |
| `pending_review` or `needs_info` seller proposal | Scoped seller proposer proving current place control and `food_catalog.propose` | `withdrawSellerFoodCatalogProposal` | Exact `placeId` and proposal ID; active claim/assignment and versions; proposal non-terminal | `withdrawn` | Terminal closure runs in seller scope; no canonical, observation, offer, price, or availability effect |
| `pending_review` or `needs_info` | Catalog Publisher independent of requester and assigned Steward | `recordFoodCatalogRejection` | Exactly one associated `decisionCaseId` has the complete locked rejection packet; it is `decision_ready`, or is `escalated` only when this rejection is the nested final decision under `closeEscalatedFoodCatalogCase` with a matching consumed Second Reviewer approval; complete associated-case-set digest and versions; reason/policy version; no other escalation, competing terminal decision, or approved publication remains | `rejected` | Immutable decision and aggregate terminal closure append; every associated case closes through its applicable ordinary or dedicated escalated row and all other unpublished work invalidates; no canonical/public effect |
| `pending_review` | Catalog Publisher independent of both requesters and assigned Steward | `consolidateFoodCatalogRequests` | Current duplicate-request evidence; distinct surviving non-terminal request; requester privacy preserved | `superseded` | Redirect to surviving case is requester-safe; no canonical merge or cross-request identity disclosure |
| `needs_info` | Policy scheduler using versioned inactivity policy | `expireFoodCatalogRequest` | Response deadline elapsed; no admitted response or legal/operations hold; expected version matches | `expired` | Request/case close with policy version and audit; no publication |
| `approved_for_publication` | Catalog Publisher independent of draft author | `invalidateFoodCatalogRequestPublicationApproval` | Linked revision/parent/lifecycle drifted or approval expired before publication | `pending_review` | Approval remains immutable but unusable; request returns to review with reason/audit |

`published`, `resolved_existing`, `withdrawn`, `rejected`, `superseded`, and `expired`
are terminal for the original request. Reconsideration is a new linked record, not a
status rewrite. A direct existing-subject resolution is not Catalog publication and does
not promise that Report Price gates currently allow the subject.

Every transition into a terminal request state invokes
`closeFoodCatalogRequestTerminally` inside the same transaction. It locks the request,
all associated cases/assignments, every unpublished linked revision, approval,
information request, and submitted decision packet, then:

1. transitions every associated non-`closed` case to `closed`;
2. invalidates every linked `draft`, `in_review`, `changes_requested`, or
   `approved_for_publication` revision except the exact revision being published in that
   transaction;
3. marks every unused approval and decision packet `invalidated`, closes open
   information requests, and revokes assignment leases;
4. preserves every already-published revision and immutable prior decision;
5. appends linked closure/invalidation audit events once; and
6. commits all terminal request, case, revision/packet, and any authorized publication
   effects together or rolls them all back on drift.

For rejection, the command input and digest designate exactly one `decisionCaseId` and
the complete sorted associated-case ID/version set. The designated case must be
`decision_ready` with the rejection packet unless `closeEscalatedFoodCatalogCase`
designates it as `escalated` and consumes the approval bound to that same packet/case
set. Every ancillary non-escalated case may be
`unassigned`, `assigned`, `waiting_requester`, or `decision_ready`; terminal closure
invalidates its unpublished packet/approval, cancels its information request/lease, and
closes it under the designated rejection decision. A missing case, competing terminal
decision, any non-designated escalation, case-set drift, or second designated packet
aborts the whole rejection. The escalated compound path uses the
`closeEscalatedFoodCatalogCase` execution identity, fencing nonce, and stable result for
both nested rejection and aggregate terminal closure; `recordFoodCatalogRejection`
accepts no second key.

Withdrawal, rejection, expiry, consolidation, and direct existing resolution perform no
canonical mutation. Publication terminal closure publishes only its selected approved
revision and invalidates all other unpublished work. A superseded request closes only
its own cases/work; the surviving request remains unchanged.

#### Reconsideration lifecycle

Reconsideration is signed-in-only, accepts one bounded new-evidence submission after an
original `rejected` request, and never rewrites or reopens that request.

| From | Actor and proof | Command | Preconditions | To | Atomic effects |
|---|---|---|---|---|---|
| `absent` | Signed-in owner of the original rejected request | `submitFoodCatalogReconsideration` | Exact original request/decision versions; original state is `rejected`; policy window is open; no prior reconsideration; bounded new evidence and reason; no anonymous receipt, media, price, availability, payment, or verification claim | `pending_review` | Creates one linked immutable reconsideration, one unassigned reconsideration case, one stable result, and one audit event; original request, decision, canonical state, and reportability remain unchanged |
| `pending_review` | Assigned Reconsideration Reviewer independent of requester, original Steward, rejection Publisher, and any affected seller | `decideFoodCatalogReconsideration` with outcome `original_decision_upheld` | Exact reconsideration, original decision, evidence-packet, assignment, and case versions; complete reason/policy; no unresolved conflict | `original_decision_upheld` | Decision appends and reconsideration case closes atomically; original request remains terminal `rejected`; no new request or public mutation |
| `pending_review` | Assigned Reconsideration Reviewer with the same independence | `decideFoodCatalogReconsideration` with outcome `accepted_for_new_review` | Same exact-version and complete-review preconditions; new evidence is sufficient only to warrant ordinary review, not publication | `accepted_for_new_review` | Decision and reconsideration-case closure commit atomically with one distinct signed-in-owned Catalog request in `pending_review` and its new unassigned case; the original request remains terminal and no canonical, reportability, asset, observation, offer, approval, or publication row is created |

`original_decision_upheld` and `accepted_for_new_review` are terminal. There is no
reconsideration `needs_info`, withdrawal, direct approval, publication, or second
reconsideration command. The new request created by an accepted outcome follows the
ordinary request/case/revision tables from its own IDs and cannot inherit the original
approval, packet, assignment, or idempotency namespace. Both commands use their explicit
Section 14.7 registry entries and the mandatory first-flight protocol; stale versions or
actor overlap fail closed.

### 8.2 Case lifecycle

Case reporting and escalation are non-mutating communication. A Safety Responder may
open, route, or escalate safety evidence so that the assigned reviewers can act, but the
append-only routing/escalation record is not approval of Catalog truth and grants no
case-authority, canonical-data, merge, publication, reportability, asset, or anonymous-
grant mutation. The responder's direct enforcement mutations remain limited to
deny-only exposure/asset holds and revocation of compromised anonymous grants.

| From | Actor and permission/proof | Command | Preconditions | To | Required result |
|---|---|---|---|---|---|
| `unassigned` | Catalog Steward with `food_catalog.case.assign` | `assignFoodCatalogCase` | Current case version; no live assignment; assignee currently eligible | `assigned` | Versioned lease/assignment and audit append |
| `assigned` | Policy scheduler | `expireFoodCatalogCaseAssignment` | Versioned assignment lease elapsed; no in-flight locked decision | `unassigned` | Assignment closes and case returns to queue; request/canonical state unchanged |
| `assigned` | Assigned Catalog Steward with `food_catalog.case.request_info` | `requestFoodCatalogInformation` | Current assignment/case/request; exact structured needs | `waiting_requester` | Case wait state and requester information request commit together |
| `waiting_requester` | Admission service after signed-in-owner or active-receipt response proof | `submitFoodCatalogRequestInformation` | Exact open request answered before expiry; versions match | `assigned` | Typed response admits and case returns to its valid assignee, or atomically to `unassigned` if lease expired |
| `waiting_requester` seller-proposal case | Seller admission service after rechecking the same seller, exact `placeId`, active place-control claim/assignment, and `food_catalog.propose` | `submitSellerFoodCatalogProposalInformation` | Exact open information request; proposal/request/case and claim/assignment versions match; bounded response | `assigned`, or `unassigned` if the lease expired | Typed seller response, proposal/request return to `pending_review`, case return, stable result, and audit commit atomically |
| `waiting_requester` | Assigned Catalog Steward with `food_catalog.case.submit_review` | `submitFoodCatalogDecisionPacket` for rejection | Current assignment and case/request/proposal versions; complete rejection evidence and reason make the outstanding fields unnecessary; exact open information request locked; no admitted response or competing transition | `decision_ready` | Information request closes as `cancelled_by_rejection_review`, immutable rejection packet locks, request/proposal may remain `needs_info` until the Publisher decision, and audit appends atomically |
| `assigned` | Assigned Catalog Steward with `food_catalog.case.submit_review` | `submitFoodCatalogRevisionForReview` or `submitFoodCatalogDecisionPacket` | Current assignment; immutable revision/decision packet complete; expected affected revisions listed | `decision_ready` | Packet locks at submitted version and audit appends |
| `decision_ready` | Catalog Publisher independent of requester/proposer/draft author | `requestFoodCatalogRevisionChanges` | Enumerated reason; current packet/revision/case versions | `assigned` | Prior packet remains immutable; a new draft cycle opens for the assignee |
| `decision_ready` with linked request/proposal `approved_for_publication` | Catalog Publisher independent of draft author | `invalidateFoodCatalogRequestPublicationApproval` | Approval expired or linked revision/parent/lifecycle drifted; current request/proposal/case/approval versions; no publication committed | `assigned`, or `unassigned` when no eligible live lease remains | Approval becomes unusable, linked request/proposal returns to `pending_review`, review work reopens, and audit commits atomically |
| No reconsideration case | Signed-in rejected-request owner executing the authorized reconsideration submission | `submitFoodCatalogReconsideration` | Exact rejected request/decision versions; no prior reconsideration; policy window and bounded evidence pass | `unassigned` reconsideration case | Reconsideration record, case, stable result, and audit commit; original rejected request remains terminal |
| `assigned` reconsideration case | Assigned independent Reconsideration Reviewer | `decideFoodCatalogReconsideration` | Exact reconsideration/original-decision/evidence/assignment/case versions and one permitted outcome | `closed` | Upheld decision closes only this case, or accepted decision closes it while creating one distinct request and unassigned ordinary case; original request remains rejected; all effects and audit commit atomically |
| `decision_ready` | Catalog Publisher satisfying the exact request transition | `publishFoodCatalogRevision`, `recordFoodCatalogRejection`, `resolveFoodCatalogRequestToExisting`, or `consolidateFoodCatalogRequests` | Matching request/revision decision preconditions and current case version | `closed` | Case closure commits with the request decision/publication and audit |
| `unassigned`, `assigned`, `waiting_requester`, or `decision_ready` | Terminal-closure executor acting only under the actor/proof authorized for the linked request command | `closeFoodCatalogRequestTerminally`, invoked by publication, direct resolution, rejection, withdrawal, consolidation, or expiry | No associated case is `escalated`, except the exact designated escalated rejection case closing concurrently through the dedicated `closeEscalatedFoodCatalogCase` row; for rejection, the locked aggregate set names exactly one different-or-same `decisionCaseId` with the exact rejection packet, complete case-set digest, and any required consumed Second Reviewer approval, while this row may represent the deciding non-escalated case or an ancillary case; linked request is atomically entering its specified terminal state; complete associated-case/revision/approval/packet set and expected versions are locked | `closed` | All associated cases close through their applicable rows and all unpublished work invalidates atomically; any separate safety incident/hold remains independently governed |
| `unassigned`, `assigned`, `waiting_requester`, or `decision_ready` | Catalog Steward, or Catalog Safety Responder solely for non-mutating safety-evidence routing/escalation with explicit `food_catalog.case.escalate` communication permission and assigned scope | `escalateFoodCatalogCase` | Enumerated safety, identity-confusion, rights, or authorization risk; current case version; reason/policy | `escalated` | Append-only escalation/routing record, prior assignment state, required reviewer, and audit append; no Catalog-truth approval or canonical, reportability, asset, grant, publication, merge, or case-decision mutation |
| `escalated` | Catalog Second Reviewer independent of requester, Steward, and first decision-maker | `returnEscalatedFoodCatalogCaseToReview` | Risk triage resolves escalation without a final decision; continuation scope and assignee eligibility recorded | `assigned` | Linked escalation closes and reviewed work resumes with a new assignment/version |
| `escalated` | Catalog Publisher after independent Catalog Second Reviewer approval | `closeEscalatedFoodCatalogCase` plus the applicable publication/rejection command | Linked approval and exact final-decision preconditions; all versions match | `closed` | Escalation, final request/canonical decision where any, case closure, and audit commit atomically |

`closed` is terminal. Assignment expiry never changes request or canonical lifecycle.
Escalation cannot itself publish, allow, retire, merge, withdraw, or suppress anything.
Any ordinary terminal request command fails closed while an associated case is
`escalated`. An escalated case may close only through
`closeEscalatedFoodCatalogCase` plus its bound publication or rejection command and a
consumed current Second Reviewer approval. Direct resolution, requester/seller
withdrawal, consolidation, and policy expiry require
`returnEscalatedFoodCatalogCaseToReview` first, after which the original authorized actor
and ordinary terminal-closure path apply.

### 8.3 Revision lifecycle

| From | Actor and permission/proof | Command | Preconditions | To | Required result |
|---|---|---|---|---|---|
| `absent` | Assigned Catalog Steward or other explicitly authorized draft author | `saveFoodCatalogRevisionDraft` | Active assigned case; expected parent and complete affected revision set | `draft` | New immutable draft version and author attribution append |
| `draft` | Same authorized draft author | `saveFoodCatalogRevisionDraft` | Expected current draft version; case remains assigned; no review lock | `draft` | A new draft version supersedes the prior editable projection; history remains |
| `draft` | Draft author with current assignment | `submitFoodCatalogRevisionForReview` | Validation passes; expected parent/affected revisions still match; impact packet complete | `in_review` | Submitted revision version locks and case enters `decision_ready` |
| `in_review` | Catalog Publisher independent of requester/proposer/draft author | `requestFoodCatalogRevisionChanges` | Current revision/case; enumerated reason and requested fields | `changes_requested` | Review decision appends; submitted revision remains immutable |
| `changes_requested` | Authorized draft author | `submitFoodCatalogRevisionForReview` | New child revision addresses requested changes; parent/affected versions match | `in_review` | New immutable submitted revision links the prior decision |
| `in_review` | Catalog Publisher independent of requester/proposer/draft author | `approveFoodCatalogRevisionForPublication` | Linked case is open and `decision_ready`; any linked request is open and compatible; duplicate/lifecycle/impact checks pass; any Catalog Second Reviewer approvals required for merge, material comparability, or active-hold resolution are current | `approved_for_publication` | Immutable approval ID, approval set, policy version, and audit append; no public effect |
| `approved_for_publication` | Catalog Publisher satisfying separation of duties | `publishFoodCatalogRevision` or the applicable elevated publish command | Linked case is open; any linked request is open and `approved_for_publication`; approval, parent, affected revisions, preview digest where required, locks, and all gates match | `published` | Revision, decision, projection, lifecycle, terminal closure, and audit commit atomically |
| `published` | Catalog Publisher publishing an approved child revision | Applicable publication command | New revision names this exact published parent; all expected revisions match | `superseded` | Old revision remains immutable/historical and new revision becomes `published` in the same transaction |
| `draft` or `changes_requested` | Draft author | `abandonFoodCatalogRevisionDraft` | Exact draft version; no current approval/publication lock | `abandoned` | Terminal abandonment and audit append; no public effect |
| `draft`, `in_review`, `changes_requested`, or `approved_for_publication` | Catalog Publisher independent of draft author with `food_catalog.revision.invalidate` | `invalidateFoodCatalogRevision` | Enumerated parent/lifecycle/duplicate/approval-expiry conflict; exact revision/case versions | `invalidated` | Terminal invalidation decision and audit append; no public effect |
| `draft`, `in_review`, `changes_requested`, or `approved_for_publication` linked to a terminally closing request | Terminal-closure executor under the already-authorized request command | `closeFoodCatalogRequestTerminally` | Request, all associated cases, revisions, approvals, and packets are locked; this is not the exact revision publishing in the transaction | `invalidated` | Unpublished revision, unused approvals, and packets invalidate atomically with request/case closure |

`superseded`, `abandoned`, and `invalidated` are terminal. A `published` revision is
immutable and can only become the historical `superseded` parent through a later atomic
publication. Correction always creates a new revision.

#### Second-review decision and consumption lifecycle

A required Catalog Second Reviewer approval is an immutable, operation-bound assertion,
not a role label or a Publisher-created flag.

| From | Actor | Command | Preconditions | To | Atomic effects |
|---|---|---|---|---|---|
| No second-review decision for the exact submitted packet version | Catalog Second Reviewer with current `food_catalog.second_review.decide`, independent of requester/proposer, Steward/draft author, Publisher, Rights Reviewer, Safety Responder, and first decision-maker as applicable | `recordFoodCatalogSecondReviewDecision` with outcome `approved` | Submitted immutable decision packet; exact operation kind, subject/hold/asset IDs, packet and policy versions, expected affected revisions, preview/member digest, proposed transition, and expiry; actor has not authored or approved the first decision | Immutable decision `approved`, availability `available` | Decision ID, complete binding, independence evidence, reason, expiry, stable result, and one audit append; no canonical, reportability, asset, request, case, observation, offer, or public-delivery mutation |
| No second-review decision for the exact submitted packet version | Same independently authorized Catalog Second Reviewer | `recordFoodCatalogSecondReviewDecision` with outcome `rejected` | Same complete packet/version/binding checks; enumerated reason | Immutable decision `rejected` | Rejection and one audit append; no authorization or public effect; a new packet version is required before another review |
| Approved decision `available` | Catalog Publisher executing the exact bound mutation | Bound merge, merge correction, split, material-comparability publication, hold extension/release/permanent resolution, suppressed-asset review/resume/withdrawal, or escalated publication/rejection closure command | Approval unexpired and unconsumed; command kind, complete scope/member or preview digest, subject/hold/asset/case IDs, expected revisions, policy, proposed transition, and Publisher separation all exactly match | Approved decision remains immutable; availability `consumed` by a unique consumption link | One approval-consumption link commits inside the consuming command's existing idempotency transaction; it cannot authorize another command or scope and creates no separate stable result/audit |

`rejected` and `consumed` availability are terminal. Drift or expiry leaves the immutable
decision historically `approved` but makes its eligibility derived-false; it cannot be
consumed, refreshed, rebound, or edited. The case must return through the existing
changes/new-packet flow, and a different independent Second Reviewer records a decision
for the new packet version where separation policy requires it.

The consuming commands are exactly:

- `reactivateRetiredFoodCatalogItem`, `publishFoodCatalogMerge`,
  `publishFoodCatalogMergeCorrection`, and `publishFoodCatalogSplit`;
- `reactivateRetiredFoodCatalogVariant`, `publishFoodCatalogVariantMerge`, and
  `publishFoodCatalogVariantMergeCorrection`;
- `publishFoodCatalogUnitRevision` for a distinct unit-ID creation,
  `retireFoodCatalogUnit`, and `reactivateRetiredFoodCatalogUnit`; a same-ID
  metadata-only revision neither requires nor accepts this approval unless it also
  resolves an active hold, while a meaning/dimension change is prohibited and must
  create a distinct unit ID;
- `publishFoodCatalogRevision` for a material-comparability decision and
  `reactivateRetiredFoodCatalogVariantUnitRelation` only when the reviewed reactivation
  changes or newly asserts material comparability; a semantics-preserving,
  non-material reactivation neither requires nor accepts this approval;
- `extendFoodCatalogReportabilitySuspension`,
  `resumeFoodCatalogReportability`, and the applicable publication, retirement, merge,
  or split command that permanently resolves an active reportability hold;
- `submitSuppressedFoodCatalogAssetForRightsReview`,
  `resumeFoodCatalogAssetPublication`, and `withdrawFoodCatalogAsset` from
  `suppressed`; and
- `closeEscalatedFoodCatalogCase` when the bound final outcome is publication or
  rejection.

For escalated closure, `closeEscalatedFoodCatalogCase` is the designated approval
consumer and invokes the applicable final-decision command inside the same execution
identity, transaction, fencing nonce, stable result, and audit set; the nested decision
does not accept another idempotency key or consume the approval twice. No command outside
this exact list accepts a Second Reviewer approval. Adding a future approval-requiring
transition must update this lifecycle table, Server Action boundary, and Section 14.7
registry in the same governance change or fail closed.

### 8.4 Canonical identity and reportability

Canonical identity transitions:

| From | Actor | Command | Preconditions | To | Required result |
|---|---|---|---|---|---|
| `absent` | Catalog Publisher, separate from requester and draft author | `publishFoodCatalogRevision` | Approved immutable revision; duplicate and collision checks; expected revisions; active variant and relation rules resolved | `active` | New canonical ID and published revision are created atomically with decision, projection, and audit |
| `active` | Catalog Publisher, separate from requester and draft author | `publishFoodCatalogRevision` | Approved child revision; current parent and all affected revisions match | `active` | Prior revision becomes `superseded`; identity ID is unchanged |
| `retired` | Catalog Publisher | `publishFoodCatalogRevision` | Approved metadata-only child revision; no claim of renewed reportability | `retired` | Corrected retired representation publishes without activation |
| `active` | Catalog Publisher | `retireFoodCatalogItem` | Approved retirement revision; impact preview; no unresolved publication drift; if an emergency hold is open, linked independent hold-resolution approval | `retired` | Every descendant reportability key becomes `not_reportable` in the same publication |
| `retired` | Catalog Publisher after independent Catalog Second Reviewer approval | `reactivateRetiredFoodCatalogItem` | Identity has never been `merged`; reviewed evidence; no redirect or duplicate conflict; all publication gates pass | `active` | New immutable revision publishes; reportability is set explicitly by that publication |
| `active` or `retired` loser | Catalog Publisher after independent Catalog Second Reviewer approval | `publishFoodCatalogMerge` | Active survivor distinct from loser; approved merge packet; matching preview digest and complete expected revisions; no redirect collision | `merged` | Loser becomes permanently terminal; versioned redirect, decisions, projection, and audit commit atomically |
| `merged` | Catalog Publisher after independent Catalog Second Reviewer approval | `publishFoodCatalogMergeCorrection` | Correction preview proves a distinct target ID, matching expected revisions and redirect digest; target is newly published or is a different eligible retired identity reactivated in the same transaction | `merged` | Merged ID stays merged; only its prospective redirect is superseded; no observation is moved or recounted |

No command and no actor may transition `merged` to `active` or `retired`, mutate its
historical identity, or reuse its ID for the correction target. Such an attempt is
rejected and audited as `lifecycle_conflict`.

The authoritative reportability resource is one stable key composed of `itemId`,
`variantId`, and `variantUnitRelationId`; its state also records the exact published item,
variant, and relation revision IDs it evaluated. There is no free-floating item-level or
variant-level `allowed` boolean. `reportingAllowed` is the relation's reviewed intrinsic
property; the separate keyed reportability state is its publication/safety decision.
Both must pass.

Each transition below applies to one exact key. An item- or variant-scoped hold is only a
command convenience: `previewFoodCatalogReportabilityScope` resolves the complete set of
descendant keys and revision IDs and returns a digest, and the mutation locks and
transitions that entire set atomically. Any drift aborts. The scoped hold also blocks a
new descendant from publishing as `allowed` until the hold is reviewed; no implicit
future-child inheritance or partial suspension is permitted.

Reportability transitions:

| From | Actor | Command | Preconditions | To | Required result |
|---|---|---|---|---|---|
| `not_reportable` | Catalog Publisher | `publishFoodCatalogRevision` or `reactivateRetiredFoodCatalogItem` | Newly published active identity and revision; active published variant; exact relation allows reporting; every Section 5.1 gate passes; no matching active hold, or linked independent hold-resolution approval | `allowed` | Publication, keyed reportability, projection, decision, and audit commit together |
| `not_reportable` | Catalog Publisher | `publishFoodCatalogRevision` | Approved publication intentionally remains unavailable for reporting | `not_reportable` | Reason and evaluated gates are recorded; no Report Price row appears |
| `allowed` | Catalog Publisher | `publishFoodCatalogRevision` | Replacement publication passes every gate | `allowed` | The allowed state is bound to the new published revision IDs in the same transaction |
| `allowed` | Catalog Publisher | `publishFoodCatalogRevision`, `retireFoodCatalogItem`, or `publishFoodCatalogMerge` | Approved publication removes a gate, retires the identity, or merges the loser | `not_reportable` | Denial and canonical publication commit atomically |
| `allowed` | Catalog Safety Responder | `suspendFoodCatalogReportability` | Exact key or complete previewed scope/digest; credible enumerated safety or identity-confusion risk; current revision IDs; reason; policy version; review deadline; independent reviewer assigned | `suspended` | Exposure is denied immediately; hold ID/scope/member digest, prior `allowed` revision IDs, actor, reason, deadline, and audit are immutable |
| `suspended` | Catalog Publisher after independent Catalog Second Reviewer approval | `extendFoodCatalogReportabilitySuspension` | Risk remains unresolved; extension is decided before or during escalated review; bounded new deadline and reason | `suspended` | Prior hold is closed by a linked reviewed hold; unilateral rolling extension is forbidden |
| `suspended` | Catalog Publisher after independent Catalog Second Reviewer approval | `resumeFoodCatalogReportability` | Risk is resolved; identity, revision, variant, relation, and reportability inputs exactly match the recorded pre-hold IDs; every current gate passes | `allowed` | The exact interrupted publication is restored; hold resolution and audit commit atomically |
| `suspended` | Catalog Publisher after independent Catalog Second Reviewer approval | `publishFoodCatalogRevision` | Risk is resolved through a changed approved canonical revision and all current gates pass | `allowed` | A fresh publication, not resume, establishes the changed reportable revision |
| `suspended` | Catalog Publisher after independent Catalog Second Reviewer approval | `publishFoodCatalogRevision`, `retireFoodCatalogItem`, or `publishFoodCatalogMerge` | Linked hold-resolution approval names the hold and exact affected-key digest; approved publication keeps reporting denied, retires the identity, or merges the loser; all expected revisions match | `not_reportable` | Hold, denial, canonical publication, decision, approval, and audit close atomically |

Every authorization-capable `allowed` or `suspended` keyed reportability row binds the
exact published item, variant, unit, variant-unit relation, and
reportability-decision revision IDs. A `not_reportable` row may retain its last
historical bindings and denial reason; it cannot authorize regardless of revision
currency and need not be mass-rebound by metadata-only publication. Inside the
observation-admission transaction, the reporting resolver returns `allowed` only when
the state is exactly `allowed` and all five bindings equal the current published
revisions. Any mismatch is denied even if a stale projection says `allowed`. Every
reactivation or explicit change from `not_reportable` to `allowed` must first bind all
five current revisions atomically.

Child and compound commands also own these exhaustive keyed transitions:

| From | Actor | Command | Preconditions | To | Required result |
|---|---|---|---|---|---|
| Every affected key `allowed` | Catalog Publisher under the reviewed variant command | `retireFoodCatalogVariant` | Complete descendant relation/key member digest; expected variant, relation, key, and publication revisions; no active hold | `not_reportable` | Variant retirement and every keyed denial commit atomically; observations and offers are untouched |
| Every affected key `suspended` | Catalog Publisher after consuming the exact hold-bound Second Reviewer approval | `retireFoodCatalogVariant` | Same complete member digest plus every active hold/version and permanent-resolution decision | `not_reportable` | Variant retirement, hold closure, keyed permanent denial, decision, and audit commit atomically |
| Every referencing key `allowed`, unit revision change proven metadata-only | Catalog Publisher | `publishFoodCatalogUnitRevision` | Complete cross-item referencing relation/key digest locked; expected old/new unit and every relation/key revision; reviewed proof that dimension, quantity, conversion meaning, comparability, and reporting semantics are unchanged; no active hold | `allowed`, rebound to the new published unit revision | Unit revision publication and every exact key rebind commit atomically; any semantic drift fails this row and requires a distinct unit/relation path |
| Every referencing key `suspended`, same-ID change proven metadata-only | Catalog Publisher after consuming current Second Reviewer approval coverage for every active hold | `publishFoodCatalogUnitRevision` | Complete hold/member and referencing-key digests; expected old/new unit, relation, key, and hold revisions; reviewed proof that dimension, quantity, conversion meaning, comparability, and reporting semantics are unchanged; fresh per-key decision | Each hold closes and each key becomes explicitly `allowed` bound to the metadata-only revision or `not_reportable` | This is changed-revision publication, never resume; unit publication, hold closure, key decisions, approval consumption, and audit commit atomically |
| No referencing relation/key | Catalog Publisher after the required unit-creation Second Reviewer approval | `publishFoodCatalogUnitRevision` creating a unit | Approved unit revision; duplicate/dimension/semantics checks; complete empty referencing-set digest | No reportability key is created | Unit publication alone creates no reportable selection; a later approved relation publication must create and bind a key explicitly |
| Every referencing key `allowed` | Catalog Publisher under the reviewed unit command | `retireFoodCatalogUnit` | Complete cross-item referencing relation/key digest and all expected unit/relation/key revisions; no active hold | `not_reportable` | Unit retirement and all referencing keyed denials commit atomically |
| Every referencing key `suspended` | Catalog Publisher after consuming the exact hold-bound Second Reviewer approval | `retireFoodCatalogUnit` | Complete member/hold set and permanent-resolution decision | `not_reportable` | Unit retirement, every hold closure, keyed denial, decision, and audit commit atomically |
| Exact relation key `allowed` | Catalog Publisher | `retireFoodCatalogVariantUnitRelation` | Exact relation/key and expected revisions; no active hold | `not_reportable` | Relation retirement and keyed denial commit together |
| Exact relation key `suspended` | Catalog Publisher after consuming the exact hold-bound Second Reviewer approval | `retireFoodCatalogVariantUnitRelation` | Exact hold, relation/key revisions, and permanent-resolution decision | `not_reportable` | Hold closure, relation retirement, keyed denial, and audit commit together |
| Loser-variant keys `allowed` | Catalog Publisher after consuming the variant-merge Second Reviewer approval | `publishFoodCatalogVariantMerge` | Matching merge preview/member digest; complete loser/survivor relation/key revisions; no re-parenting | `not_reportable` | Loser becomes permanently merged and every loser key is denied; survivor keys change only through separately approved relation publication |
| Loser-variant keys `suspended` | Same Catalog Publisher with approval also bound to every active hold | `publishFoodCatalogVariantMerge` | Merge and hold-resolution digests/versions all match | `not_reportable` | Merge, hold closure, loser-key denial, redirect, decision, and audit commit atomically |
| Legacy split keys `allowed` or `suspended` | Catalog Publisher after consuming the split/hold Second Reviewer approval | `publishFoodCatalogSplit` | Exact split preview/member and hold digests; complete legacy/child relation/key revisions | Legacy keys `not_reportable`; each new child key is explicitly `allowed` or `not_reportable` | Split publication creates no inherited allow: legacy denial, child decisions, hold closure, revisions, redirects, and audit commit atomically |
| Eligible key `not_reportable` after parent variant reactivation | Catalog Publisher after consuming the variant-reactivation Second Reviewer approval | `reactivateRetiredFoodCatalogVariant` | Parent/item active; relation active or approved for reactivation; exact key/revisions and reviewed reportability decision | `allowed` only when explicitly approved, otherwise remains `not_reportable` | No descendant is restored by parent state alone; the complete per-key decision set commits with reactivation |
| Eligible referencing key `not_reportable` after unit reactivation | Catalog Publisher after consuming the unit-reactivation Second Reviewer approval | `reactivateRetiredFoodCatalogUnit` | Unit meaning unchanged or approved revision; item/variant/relation active; complete relation/key digest and exact decision per key | `allowed` only when explicitly approved, otherwise remains `not_reportable` | Cross-item keys are evaluated independently; no blanket restoration |
| Exact key `not_reportable` after relation reactivation | Catalog Publisher, consuming a Second Reviewer approval only for material comparability | `reactivateRetiredFoodCatalogVariantUnitRelation` | All parents active/published; relation meaning and exact revisions match; current evidence; explicit reportability decision | `allowed` only when explicitly approved, otherwise remains `not_reportable` | Relation revision and exact keyed decision commit together; non-material reactivation does not accept a Second Reviewer approval |
| Merged-loser key `not_reportable` | Catalog Publisher under `publishFoodCatalogVariantMergeCorrection` | Prospective redirect correction only | Merged loser remains merged; distinct target and redirect digest match | `not_reportable` | No loser key is restored or rebound; any target relation/reportability change requires its own listed publication transition |

For every multi-key row, mixed `allowed`, `suspended`, and `not_reportable` members are
handled in one locked member set: applicable rows run per prior state, already-denied
members remain denied without a second lifecycle event, and any missing/stale member
rolls back the whole command. No child, merge, split, retirement, or reactivation command
may rely on a parent-state cascade outside this table.

A material unit dimension, quantity meaning, conversion meaning, or semantic change is
never a revision of the existing unit ID. It creates a distinct unit ID through the
unit-creation row, then separately reviewed distinct variant-unit relations and keyed
reportability decisions. The old unit and historical observations retain their original
identity/revision semantics; no reportability key or observation is rebound from the old
unit to the new one.

Emergency authority cannot transition `not_reportable` or `suspended` to `allowed`, and a
suspension attempt against `not_reportable` returns `already_denied` without a lifecycle
mutation. Reaching a hold deadline never auto-resumes; it records escalation and remains
`suspended` until one of the explicit reviewed transitions above commits.

Any publication command that encounters an active matching hold is a hold-resolution
command even if its ordinary no-hold form needs only one Publisher. It must consume a
linked Catalog Second Reviewer approval and close or replace the full hold scope
atomically; changing the command name cannot bypass this rule. Item retirement/merge,
variant retirement/merge, unit retirement, or relation retirement transitions every
affected reportability key to `not_reportable`. Reactivation evaluates each key
explicitly and never restores a descendant merely because its parent became active.

Asset problems normally change asset state, not item identity. Observation moderation
changes neither canonical lifecycle nor Catalog reportability.

### 8.5 Reference-asset lifecycle

| From | Actor | Command | Preconditions | To | Required result/public delivery |
|---|---|---|---|---|---|
| Existing source asset outside this lifecycle | Exact-target bootstrap executor in the assigned schema lane | `classifyLegacyFoodCatalogAsset` | Reviewed inventory maps source row without claiming rights proof | `legacy_unreviewed` | Classification atomically removes it from proposed public delivery; the state is not a licence assertion |
| `absent` | Approved media ingress adapter acting for an authorized Catalog Steward | `registerFoodCatalogReferenceAssetEvidence` | Media/privacy ADR accepted; immutable Catalog-owned handle; malware/safety result; source and rights representation; not an Observation Evidence Media handle | `private_evidence` | Never public; raw media remains behind the media boundary |
| `legacy_unreviewed` or `private_evidence` | Catalog Steward | `submitFoodCatalogAssetForRightsReview` | Complete rights packet, source URL/owner, licence terms or permission evidence, attribution text, checksum, and retention class | `rights_review` | Still never public under the proposed boundary; submitter cannot publish |
| `rights_review` | Catalog Rights Reviewer independent of submitter and Steward/draft author | `approveFoodCatalogAssetRights` | Latest immutable evidence packet is complete; no open information request; checksum; source/owner; licence or permission terms; attribution; depicted-person/privacy result where applicable; safety result; policy version | `approved_for_publication` | Immutable rights decision and evidence references append; still never public |
| `rights_review` | Catalog Rights Reviewer independent of submitter and Steward/draft author | `rejectFoodCatalogAssetRights` | Enumerated rights, privacy, attribution, or safety failure with policy version; any open information request is closed in the same decision | `rejected` | Terminal and never public; immutable decision/audit append |
| `rights_review` | Catalog Rights Reviewer independent of submitter and Steward/draft author | `requestFoodCatalogAssetRightsInformation` | Enumerated missing structured evidence; exact asset and evidence-packet versions; no other open rights-information request | `rights_review` | Versioned information-request ID and audit append; no approval and no public effect |
| `rights_review` | Original authorized asset submitter or assigned Catalog Steward, neither acting as Rights Reviewer/Publisher | `submitFoodCatalogAssetRightsInformation` | Exact open information-request ID; expected asset and prior evidence-packet versions; bounded requested fields; any media handle already passed the approved media boundary | `rights_review` | New immutable evidence-packet revision links the prior packet and request, closes that information request, and appends audit; Rights Reviewer must decide the new packet |
| `approved_for_publication` | Catalog Rights Reviewer independent of submitter | `invalidateFoodCatalogAssetRightsApproval` | Approval expires or bytes, checksum, source, rights, attribution, privacy, or policy input drifts before publication | `rights_review` | Prior approval remains immutable but unusable; no public effect |
| `approved_for_publication` | Catalog Publisher independent of submitter, Steward, and Rights Reviewer | `publishFoodCatalogAsset` | Current immutable rights-approval ID; exact bytes/checksum and metadata match that approval; safety checks pass | `published` | Public reads return image plus complete rights metadata in one object or no image; publication decision/audit append |
| `published` | Catalog Safety Responder | `suppressFoodCatalogAsset` | Credible enumerated safety or rights risk; reason; current asset revision; review deadline; independent reviewer assigned | `suppressed` | Removed from public reads immediately; prior state and immutable hold are recorded; item and observations are unchanged |
| `suppressed` | Catalog Publisher after independent Catalog Second Reviewer approval | `submitSuppressedFoodCatalogAssetForRightsReview` | Linked hold-resolution approval; risk triage packet and current asset revision match | `rights_review` | Hold closes into private review atomically; asset remains absent and ordinary rights approval is required again |
| `suppressed` | Catalog Publisher after independent Catalog Second Reviewer approval | `resumeFoodCatalogAssetPublication` | Suppressed-from state was `published`; risk is resolved; exact bytes, checksum, rights, attribution, and asset revision are unchanged and current | `published` | Restores only the interrupted asset publication; changed evidence must use `rights_review` instead |
| `legacy_unreviewed`, `private_evidence`, `rights_review`, `approved_for_publication`, `published`, or `suppressed` | Catalog Rights Reviewer independent of submitter | `recordFoodCatalogAssetWithdrawalDecision` | Valid uploader/rightsholder request or reviewed obligation; exact asset revision; published urgent risk is suppressed first | same state | Immutable withdrawal decision/audit append only; Rights Reviewer performs no lifecycle or public-delivery mutation |
| `legacy_unreviewed`, `private_evidence`, `rights_review`, or `approved_for_publication` | Catalog Publisher independent of submitter and Rights Reviewer | `withdrawFoodCatalogAsset` | Current withdrawal-decision ID and exact asset revision | `withdrawn` | Terminal lifecycle, decision link, and audit commit; asset remains absent |
| `published` | Catalog Publisher independent of submitter and Rights Reviewer | `withdrawFoodCatalogAsset` | Current withdrawal-decision ID and asset revision; immediate risk is suppressed first where needed | `withdrawn` | Permanently absent; historical attribution, rights decision, and audit remain |
| `suppressed` | Catalog Publisher after independent Catalog Rights Reviewer and Catalog Second Reviewer approvals | `withdrawFoodCatalogAsset` | Both decisions name the active hold and current asset revision | `withdrawn` | Hold and terminal withdrawal close atomically while delivery remains denied |
| `published` old asset | Catalog Publisher independent of replacement submitter, Steward, and Rights Reviewer | `supersedeFoodCatalogAsset` | Distinct replacement is `approved_for_publication`; both expected asset revisions/checksums and replacement approval ID match | `superseded` | Old asset leaves delivery; paired replacement transition below commits under the same command ID |
| `approved_for_publication` replacement | Same Catalog Publisher and `supersedeFoodCatalogAsset` command | `supersedeFoodCatalogAsset` | Exact old asset is `published`; current Rights Reviewer approval; both expected revisions/checksums match; separation of duties holds | `published` | Replacement enters public delivery with complete metadata exactly when old asset becomes `superseded`; both decisions and audits commit atomically |

`withdrawn`, `rejected`, and `superseded` are terminal. Any transition not listed is
denied and audited. A suppression deadline never republishes an asset automatically; it
escalates while public delivery remains denied. `legacy_unreviewed`, `private_evidence`,
`rights_review`, and `approved_for_publication` are never publicly delivered. Asset
transitions never change canonical identity/reportability or observation evidence.

### 8.6 Alias, variant, unit, and relation lifecycles

All child records are immutable revision-owned values. A correction publishes a new
child revision or a distinct child ID; it never overwrites meaning. A child's `active`
state cannot overcome an inactive, retired, or merged parent.

Alias-entry transitions:

| From | Actor | Command | Preconditions | To | Required result |
|---|---|---|---|---|---|
| `absent` | Catalog Publisher independent of requester/draft author | `publishFoodCatalogRevision` | Approved parent item revision; normalized alias, locale, usage scope, and collision checks | `active` | Immutable alias ID/revision enters the search projection with decision/audit |
| `active` | Catalog Publisher | `publishFoodCatalogRevision` | Approved removal or correction packet and expected alias/item revisions | `retired` | Removed from new search resolution; history retained |
| `retired` | Catalog Publisher independent of requester/draft author | `publishFoodCatalogRevision` | Same unmerged parent remains active; renewed evidence and collision checks pass | `active` | New alias revision publishes; prior history remains |
| `active` under an item being merged | Catalog Publisher after Catalog Second Reviewer approval | `publishFoodCatalogMerge` | Merge digest lists alias disposition | `retired` | Loser alias is never re-parented; an approved distinct alias ID may be published under the survivor |

An alias string/locale correction retires the old entry and creates a distinct alias ID.
Deletion, in-place mutation, cross-item re-parenting, and reactivation under a merged
parent are prohibited.

Variant-identity transitions:

| From | Actor | Command | Preconditions | To | Required result |
|---|---|---|---|---|---|
| `absent` | Catalog Publisher independent of requester/draft author | `publishFoodCatalogRevision` | Active parent item; approved typed identity; duplicate and relation impact checks | `active` | Stable variant ID and immutable revision publish |
| `active` | Catalog Publisher | `publishFoodCatalogRevision` | Approved meaning-preserving child revision and exact parent/current revision IDs | `active` | Prior variant revision is superseded |
| `active` | Catalog Publisher | `retireFoodCatalogVariant` | Approved impact preview and exact descendant relation/reportability set | `retired` | Descendant relations retire and reportability keys become `not_reportable` atomically |
| `retired` | Catalog Publisher after Catalog Second Reviewer approval | `reactivateRetiredFoodCatalogVariant` | Variant has never been merged; active parent; duplicate/relation checks; explicit descendant decisions | `active` | New variant revision publishes; each relation/reportability key is evaluated explicitly |
| `active` or `retired` loser | Catalog Publisher after Catalog Second Reviewer approval | `publishFoodCatalogVariantMerge` | Distinct active survivor under the reviewed item scope; matching preview digest and expected revisions | `merged` | Durable variant redirect publishes; loser relations/reportability deny; observations stay on loser |
| `merged` | Catalog Publisher after Catalog Second Reviewer approval | `publishFoodCatalogVariantMergeCorrection` | Distinct new or different never-merged target variant; matching redirect digest/revisions | `merged` | Loser remains merged; only prospective routing changes |

`merged` variant IDs are terminal and cannot be reused or reactivated. Parent-item merge
does not silently re-parent variants: loser variants remain historical, and any survivor
variant is separately created or explicitly merged.

Unit-identity transitions:

| From | Actor | Command | Preconditions | To | Required result |
|---|---|---|---|---|---|
| `absent` | Catalog Publisher after Catalog Second Reviewer approval | `publishFoodCatalogUnitRevision` | Reviewed code/name/dimension semantics; duplicate scan; cross-item impact preview | `active` | Stable unit ID and immutable revision publish |
| `active` | Catalog Publisher; no Second Reviewer unless resolving an active hold | `publishFoodCatalogUnitRevision` | Strictly metadata-only, meaning/dimension/quantity/conversion/comparability-preserving revision; all affected relations/revisions enumerated and rebound; any material effect requires a distinct unit or relation path | `active` | Prior unit revision is superseded without changing old observations; active-hold resolution follows its separate approval rule |
| `active` | Catalog Publisher after Catalog Second Reviewer approval | `retireFoodCatalogUnit` | Complete referencing-relation/reportability preview and replacement guidance | `retired` | Referencing relations retire and their reportability becomes `not_reportable`; observations retain old unit |
| `retired` | Catalog Publisher after Catalog Second Reviewer approval | `reactivateRetiredFoodCatalogUnit` | Same unit meaning/dimension; duplicate and relation checks; no semantic reuse | `active` | New unit revision publishes; relations require explicit separate reactivation |

Unit merge, split, deletion, re-parenting, and in-place dimension/meaning change are
prohibited in this contract. A materially different quantity meaning creates a distinct
unit ID; retiring a duplicate never rewrites an old observation.

Variant-unit-relation transitions:

| From | Actor | Command | Preconditions | To | Required result |
|---|---|---|---|---|---|
| `absent` | Catalog Publisher, with Second Reviewer for material comparability | `publishFoodCatalogRevision` | Active published item, variant, and unit; approved reportability/comparability packet; no duplicate relation | `active` | Stable relation ID/revision publishes with an explicit keyed reportability decision |
| `active` | Catalog Publisher, with Second Reviewer for material comparability | `publishFoodCatalogRevision` | Meaning-preserving child revision; expected item/variant/unit/relation IDs; conversion evidence | `active` | Prior relation revision is superseded; keyed reportability is rebound explicitly |
| `active` | Catalog Publisher | `retireFoodCatalogVariantUnitRelation` | Approved impact and exact reportability key | `retired` | Keyed reportability becomes `not_reportable` atomically |
| `retired` | Catalog Publisher, with Second Reviewer for material comparability | `reactivateRetiredFoodCatalogVariantUnitRelation` | All parents active/published; same relation meaning; current evidence and gates pass | `active` | New relation revision publishes with an explicit reportability decision |
| `active` because item, variant, or unit retires/merges | Catalog Publisher under the reviewed parent command | Parent retirement/merge command | Complete child/relation/reportability digest and expected revisions | `retired` | Relation becomes historical; reportability becomes `not_reportable`; no observation changes |

Relation safety suspension changes only its exact reportability record, not relation
lifecycle. Relation merge, re-parenting, deletion, and in-place semantic change are
prohibited; a changed item/variant/unit combination creates a distinct relation ID. Any
child transition not listed is denied and audited under Section 16.

## 9. Canonical CRUD semantics

### Create

Create means publishing an approved revision in one transaction. Drafts, requests,
imports, seller proposals, seed source edits, and duplicate suggestions are not creates.

### Read

- Public reads return only the approved Catalog read projection permitted by lifecycle.
- Requesters receive safe status for their own request or capability.
- Seller reads are restricted to the exact active place assignment.
- Operations reads are permission-scoped and data-minimized.
- Private evidence, anonymous capabilities, risk data, and moderator notes are never
  public.

### Update

Update means:

1. create a typed draft revision;
2. reference its expected parent and every affected revision;
3. review conflicts and impact;
4. obtain required independent approval; and
5. atomically publish a new immutable revision.

There is no unaudited in-place canonical edit.

### Delete

Ordinary deletion is prohibited. Retirement, merge, asset suppression, and lawful
personal-data redaction have separate semantics. No Catalog operation cascades into
observations.

## 10. Duplicate detection, merge, and split

### 10.1 Explainable duplicate suggestions

Duplicate detection may consider:

- normalized canonical name and aliases;
- locale, transliteration, and common misspelling;
- item identity and food form;
- proposed variant attributes;
- unit dimension and declared quantity;
- future reviewed brand/product identity;
- future evidenced barcode;
- source URL and asset checksum; and
- existing redirects and retired identities.

It returns candidate IDs, matched factors, conflicting factors, and data freshness. A
score alone is never a decision. Fuzzy/trigram infrastructure is added only after a
measured search need and separate privilege/index review.

### 10.2 Request consolidation

Two requests may be consolidated without merging canonical items. One request becomes
`superseded`, retains its submitter-visible status, and points to the surviving case.
Each requester remains private to the other.

### 10.3 Canonical merge

A merge is prospective identity publication:

- the survivor remains `active`;
- the loser becomes `merged`, never ordinary `retired`;
- a durable redirect guides future search and new report selection;
- only independently reviewed replacement alias/relation records publish under the
  survivor; no loser child row is re-parented;
- merged identity cannot be restored;
- old observations keep their original variant, unit, and item semantics;
- loser observations do not automatically enter the survivor's evidence set, price,
  availability, trust, counts, or `offers_current`; and
- any later evidence-set reinterpretation requires a separately accepted decision,
  per-observation or typed resolution evidence, and ADR-019-compliant atomic moderation
  and projection recomputation.

`previewFoodCatalogMerge` must calculate affected revisions, aliases, slugs, variant-unit
relations, active report selections, current offers, redirects, and collisions. It
returns a digest. Publication locks every affected row, recomputes the preview, verifies
the digest and complete expected-revision set, and aborts on drift.

A mistaken merge never reactivates or reuses the merged loser's ID. A reviewed correction
must either create a distinct canonical identity with a new ID or reactivate a suitable
**different** retired identity that has never been merged. `publishFoodCatalogMergeCorrection`
then supersedes the loser's redirect for future search and Report Price intent while the
loser remains permanently `merged`. The original merge, prior redirects, decisions, and
observations remain auditable; observations stay attached to their original identity and
do not count under the correction target. This is prospective routing correction, not
identity restoration or history deletion.

### 10.4 Split

A pre-publication request may be split into two linked cases without canonical impact.

A post-publication canonical split is V2 at the earliest and requires two reviewers:

1. suspend new reporting for the affected identity;
2. preview affected revisions, aliases, relations, reports, offers, and redirects;
3. create new prospective identities and relations;
4. retain the legacy identity and all historical observations;
5. do not copy, bulk re-parent, or count old observations under either child;
6. publish new search/report routing only after collision checks; and
7. leave any observation adjudication to a separately authorized evidence workflow.

The V2 split transition is exact:

| From | Actor | Command | Preconditions | To | Atomic effects |
|---|---|---|---|---|---|
| One `active` legacy item under a deny-only reportability hold; two or more prospective child identities `absent` | Catalog Publisher after independent Catalog Second Reviewer approval | `publishFoodCatalogSplit` | Accepted V2 governance; approved immutable split revision and decision packet; current hold-resolution approval; matching preview/member digest; complete item, child, alias, relation, redirect, reportability, request/case, and observation-impact versions locked; children are distinct and collision-free; no observation reassignment; every new relation/reportability decision explicit | Legacy item `retired` with permanent `split_legacy` reason and every legacy key `not_reportable`; approved child identities/relations become `active` with explicit keyed reportability | Revisions, prospective redirects/routing, hold closure, reportability, projection, linked request/case closure where any, stable result, decision, and audit commit together; legacy observations remain attached only to the legacy ID and `offers_current` is not recomputed |

A `split_legacy` retirement is not eligible for
`reactivateRetiredFoodCatalogItem`; correcting split routing requires a separately
accepted V2 governance decision and new prospective identities/redirect revisions,
never reactivation or observation re-parenting. The split command cannot run without
the active hold and its independent hold-resolution approval.

Catalog split publication does not recompute a public price/availability projection.

## 11. Units, reportability, and comparability

Reportability and comparability are independent.

### 11.1 Proposed variant-unit relation

| Field | Meaning |
|---|---|
| `variantId` and `unitId` | Exact identity pair |
| `reportingAllowed` | Whether a new report may use this pair |
| `declaredQuantity` and `dimension` | Quantity represented, when known |
| `comparabilityGroup` | Group within which aggregation/sort may be considered |
| `conversionStatus` | `exact`, `estimated`, or `absent` |
| `conversionFactor` | Item/variant-specific factor; never inherited blindly from global unit quantity |
| `uncertainty` | Required for estimated conversion |
| `evidenceReference` | Reviewed basis and date |
| `lifecycle` | `active` or `retired`; safety suspension belongs only to the exact separate reportability record |

A relation with no conversion may still be reportable. It is shown and aggregated in its
own unit, but it cannot be compared, averaged, ranged, or cheapest-sorted against another
group.

For local volume scoops such as Congo, Derica, paint bucket, and market bowl, commodity
density and local practice may make a global mass conversion false. Current
`units.canonicalQuantity` must not be treated as universal proof.

Reporters cannot create a unit inline. "My unit is missing" creates a reviewed Catalog
request and leaves the report unsubmitted. ADR-019 continues to prohibit any price when
availability is `unavailable`.

## 12. Proposed UI and interaction contract

All screens are proposed. Apple HIG is a behavior, hierarchy, accessibility, and
interaction reference, not a copying licence.

### 12.1 Screen inventory

| Screen | Primary action | Applicable states |
|---|---|---|
| Food search no-match | `Can't find it? Request item` | Search loading, complete no-match, ambiguous matches, network error, offline cached-only |
| Request Item sheet | Review and submit typed request | Editing, validation error, duplicate suggestions, offline local draft, sending, idempotent replay, received |
| Request receipt/status | Follow status or respond | Pending, needs info, approved-for-publication, published, resolved existing, rejected, withdrawn, superseded, expired |
| Seller place proposals | Search or propose for one controlled place | Place scope loading, no proved control, denied, empty, draft, pending, needs info, closed |
| Steward Queue | Assign next case | Loading, empty, filtered empty, error, denied, offline unavailable |
| Case and duplicate compare | Choose review route | Assigned, waiting, stale data, duplicate candidates, legacy ambiguity, escalated |
| Canonical revision editor | Submit typed revision for review | Draft, validation error, changes requested, parent conflict, submitted |
| Merge/split impact preview | Confirm reviewed impact | Calculating, collision, stale digest, second review required, ready |
| Publish confirmation | Execute atomic publication | Authorization denied, revision drift, transaction error, published |
| Report Price Catalog gate | Select a published reportable pair | Reporting paused, loading, no match/request item, request pending, retired/merged, offline stale, reportable |

### 12.2 Visual and behavioral rules

- Use borderless surface contrast, not hairline boxes.
- Sheet/card surfaces use continuous 24px or 32px radii; controls use 14px or 16px.
- Visible controls may be slender, but every interactive hit region is at least 44 by 44
  CSS pixels.
- Mobile uses a compact floating sheet for the first decision and an edge-docked expanded
  sheet for long forms. Desktop operations use a queue/detail split view.
- Progressive disclosure hides alias, variant, and unit detail until requested.
- Destructive or high-impact actions use a plain-language impact summary, affected
  counts, reason, and second-review status. Color is never the only warning.
- Press/release feedback uses restrained scale and surface changes. Reduced-motion mode
  removes directional motion without removing state feedback.
- Avoid unnecessary nested cards, pills, and decorative badges. Catalog approval never
  earns a "verified" badge.

### 12.3 Accessibility and focus

- Every picker, field, error, status, and impact count has a semantic label.
- Opening a sheet moves focus to its heading; closing returns focus to the invoking CTA.
- Validation failure moves focus to an error summary linked to fields.
- Status changes use a restrained live region; routine queue updates do not repeatedly
  interrupt screen readers.
- Duplicate comparison is fully keyboard operable and does not rely on side-by-side
  position or color.
- Merge/split confirmation names survivor/legacy IDs and consequences in text.
- Text scales to 200 percent without hiding decisions or actions.
- Light, dark, increased-contrast/grayscale, reduced-motion, compact, and regular layouts
  require direct evidence before release.

## 13. Proposed Server Action and API boundaries

These are **candidate use-case names**, not promised exports. The governance ADR and
implementation lane may revise them. They are Food-specific to avoid an unearned generic
Catalog service.

### 13.1 Public/requester Server Actions

| Candidate action | Input | Stable result |
|---|---|---|
| `searchFoodCatalogForReporting` | Bounded query, locale, cursor/limit | Published Food item, active variant, and reportable unit choices; no price/trust invention |
| `beginAnonymousFoodRequestAdmission` | Valid signed form challenge, high-entropy idempotency key, exact origin/Fetch Metadata, and bound anti-CSRF proof | One bounded admission-grant disposition/expiry; consumed challenge JTI and result are stored, while the raw grant is set only in the secure HttpOnly cookie and never reproduced |
| `submitMissingFoodItemRequest` | Signed-in subject or verified anonymous admission grant, idempotency key, anti-CSRF proof, proposed name, optional one alias+locale, variant description, proposed unit text | Request ID, `received_for_review`, replay flag, and receipt disposition; first anonymous response may set the single-delivery request receipt but no stable result contains either secret |
| `getFoodCatalogRequestStatus` | Request ID plus signed-in ownership or anonymous capability | Safe lifecycle, public resolution link, bounded next action |
| `listMyFoodCatalogRequests` | Signed-in subject, cursor | Safe account-owned statuses only |
| `submitFoodCatalogRequestInformation` | Request ID, access proof, idempotency key, typed requested fields | Stable pending-review result |
| `withdrawFoodCatalogRequest` | Request ID, access proof, idempotency key | Stable withdrawn result |
| `beginAnonymousFoodRequestCapabilityRotation` | Request ID, active receipt, idempotency key | Pending receipt disposition and expiry; replacement secret is emitted once only in a secure pending cookie |
| `confirmAnonymousFoodRequestCapabilityRotation` | Request ID, pending receipt, idempotency key | Stable confirmation/replay result; no capability secret |
| `revokeMyAnonymousFoodRequestCapability` | Request ID, active receipt, idempotency key | Stable generic revoked/replay result; request remains unchanged |

V1 request input accepts no media handle, external URL, barcode, brand, or packaged
product. Those require later governance and media boundaries.

#### Credential-key version and compromise contract

Anonymous credential evidence uses two non-interchangeable key classes:

| Key class | Purpose | Record binding |
|---|---|---|
| `form_challenge_signing` | Uses an asymmetric KMS signing key to sign the short-lived, non-admitting Request Item form challenge | Every challenge carries `kid`, `keyVersion`, algorithm, purpose, origin, policy version, JTI, issued-at, expiry, and the form nonce commitment inside the signed payload; the immutable public verification key and fingerprint remain available for audit after private-key retirement |
| `verifier_pepper` | Produces the keyed verifier for an admission grant, active request receipt, or pending replacement receipt | Every verifier row carries its exact `verifierKeyVersion`; neither the raw credential nor a reversible ciphertext is stored |

Raw keys remain in platform key management and are never Catalog rows, logs, audit
payloads, stable results, or analytics. Credential-key configuration is versioned,
audited platform security configuration, not a Catalog Server Action. Catalog roles
cannot change it. Every issuing or verifying process must load one current configuration
generation; an instance that cannot prove that generation or its key state fails closed.

| Key-version state | Issue | Verify | Exact semantics |
|---|---|---|---|
| `active` | Yes | Yes | The sole version used for new material in that key class |
| `verify_only` | No | Yes, only for an otherwise eligible unexpired record | Routine rotation state; successful verifier authentication lazily writes a verifier under the new active pepper in the same locked transaction, without retaining the presented secret |
| `revoked` | No | No | Immediate compromise response; it cannot authenticate an original call, replay, rotation, status read, response, or withdrawal |
| `retired` | No | No | Permitted only after every signed challenge has expired and no authorization- or replay-eligible verifier references the version; private signing or pepper material may then be destroyed, while non-secret public signing-key evidence remains under audit retention |

Routine rotation atomically publishes a new `active` version and moves the prior version
to `verify_only`. A challenge signed by that prior version remains acceptable only until
its embedded expiry. A pepper version remains `verify_only` until all eligible verifier
rows have either lazily re-keyed, expired, been revoked, or become non-verifying terminal
evidence. Routine retirement therefore never silently strands a valid anonymous
credential.

A suspected compromise atomically publishes a higher configuration generation and marks
the affected version `revoked`; verification checks that state both before authorization
and under the command transaction before commit. Fleet members on an older generation
must reject credential operations rather than accept the old version. The security
record names the authorized platform incident actor, incident/change ID, key class and
version, prior and new state, effective time, configuration generation, and affected-row
counts. It contains no credential.

Compromise consequences are fail-closed and exhaustive:

| Referencing state | Consequence of its key version becoming `revoked` |
|---|---|
| Unconsumed signed form challenge | Admission is denied; the person must render a new challenge under the current signing version |
| Admission grant `ready` | Submission is denied; a new form challenge and admission are required |
| Admission grant `consumed_replay_only` | It cannot authenticate or retrieve the prior stable result; any already-created request remains unchanged and no replay mutation occurs |
| Request receipt `active` | Status, information response, withdrawal, and rotation are denied; the request lifecycle itself is unchanged |
| Pending replacement receipt | Confirmation is denied and the pending verifier is unusable; a separately valid active receipt is unaffected only when it references a non-revoked version |
| Verifier whose key version is `revoked`, any expired verifier, or any risk-revoked verifier | It never authorizes and is never tested for a match; retention is audit evidence only |
| Self-revoked request receipt before the earlier of its original credential expiry and idempotency-record expiry, with `active` or `verify_only` key version | It may be compared only for an exact replay of its already-committed `revokeMyAnonymousFoodRequestCapability` command and returns only that generic stable result; it cannot disclose status or authorize any other command |
| Independently authenticated signed-in ownership | Unaffected; it is authorized by account policy rather than an anonymous verifier |

There is no grace acceptance for a compromised version, no reconstruction or
administrative disclosure of a raw credential, and no conversion of retained verifier
evidence back into request access. The narrow self-revocation comparison first requires
the exact retained command, caller namespace, idempotency key, and payload digest; it
uses a constant-time verifier comparison, emits no new event, and ceases at idempotency
expiry, the original receipt's `expiresAt`, or immediately when that verifier key version
is revoked, whichever occurs first. The self-revoked lifecycle label need not change for
retention, but the verifier is never tested at or after that effective expiry. Risk
revocation, ordinary terminal retention, and every non-exact call have no such exception.

### 13.2 Seller Server Action, V1.5

`submitSellerFoodCatalogProposal` takes an idempotency key, controlled `placeId`, expected
place-control claim and assignment versions, either an existing Food candidate or typed
missing-item fields, and no price/availability. Server resolution requires completed
ADR-022 P2 place control plus the explicit `food_catalog.propose` permission.

The initial seller transition is complete and normative:

| From | Actor | Command | Preconditions | To | Atomic effects |
|---|---|---|---|---|---|
| No proposal, request, or case for this command identity | Authenticated Seller Proposer | `submitSellerFoodCatalogProposal` | Exact active `placeId`; same seller holds the current place-control claim and active assignment at the supplied expected versions; `food_catalog.propose`; valid Food-only candidate pointer or typed missing-item payload; no price, availability, media, payment, or verification claim; rate/risk checks pass; Section 14.7 idempotency claim succeeds | Proposal `pending_review`; linked request `pending_review`; linked case `unassigned` | Creates one immutable place-bound proposal, one private-origin request, one linked unassigned case, one stable result, and one audit event in the same transaction; an existing candidate is evidence only; no canonical, reportability, asset, place-catalog publication, or observation row changes |
| Proposal and request `pending_review` | Assigned Catalog Steward | `requestFoodCatalogInformation` | Current proposal/request/case versions; exact structured needs; seller origin and immutable `placeId` match | Proposal and request `needs_info`; case `waiting_requester` | One versioned information request and audit append; no public effect |
| Proposal and request `needs_info` | Same scoped Seller Proposer | `submitSellerFoodCatalogProposalInformation` | Exact open information request, `placeId`, proposal/request versions, active claim/assignment versions, `food_catalog.propose`, and bounded response | Proposal and request `pending_review`; case `assigned` or `unassigned` if its lease expired | Typed response, state pair, queue return, and audit commit atomically |
| Proposal and request `pending_review`; case `decision_ready` | Independent Catalog Publisher | `approveFoodCatalogRevisionForPublication` | Current proposal/request/case/revision and place-binding versions; all ordinary and elevated approvals pass | Proposal and request `approved_for_publication`; case remains `decision_ready` | One immutable approval and audit; no projection or reportability effect |
| Proposal and request `approved_for_publication` | Independent Catalog Publisher | `invalidateFoodCatalogRequestPublicationApproval` | Approval expired or linked revision/parent/lifecycle drifted; all versions match | Proposal and request `pending_review`; case returns to `assigned` or `unassigned` | Approval becomes unusable and paired states return to review atomically |
| Proposal and request `approved_for_publication` | Independent Catalog Publisher | `publishFoodCatalogRevision` | Exact ordinary new-item publication preconditions and all locked versions match | Proposal and request `published`; all linked cases `closed` | Selected canonical revision publishes and terminal closure invalidates all other unpublished work in one transaction |
| Proposal and request `approved_for_publication` | Independent Catalog Publisher | `publishFoodCatalogRevision` | Exact approved child-publication preconditions and all locked versions match | Proposal and request `resolved_existing`; all linked cases `closed` | Selected child revision publishes under an existing subject and terminal closure runs atomically |
| Proposal and request `pending_review` | Independent Catalog Publisher | `resolveFoodCatalogRequestToExisting` | Current reviewed evidence points to an unchanged published subject; no canonical mutation is required | Proposal and request `resolved_existing`; all linked cases `closed` | Existing-subject decision and terminal closure commit; no reportability, observation, offer, or place-catalog mutation |
| Proposal and request `pending_review` or `needs_info` | Same scoped Seller Proposer | `withdrawSellerFoodCatalogProposal` | Exact `placeId`; current proposal/request and claim/assignment versions; `food_catalog.propose` | Proposal and request `withdrawn`; all linked cases `closed` | Seller-scoped terminal closure invalidates all unpublished work; no public effect |
| Proposal and request `pending_review` or `needs_info` | Independent Catalog Publisher | `recordFoodCatalogRejection` | Exactly one `decisionCaseId` has the complete locked rejection packet; complete associated-case-set digest, policy/reason, and exact proposal/request/case versions; no escalation except that designated case under the bound `closeEscalatedFoodCatalogCase` approval; no competing decision | Proposal and request `rejected`; all linked cases `closed` | Rejection and aggregate terminal closure commit through ordinary/dedicated case rows; ancillary case work invalidates; no canonical or public effect |
| Proposal and request `pending_review` | Independent Catalog Publisher | `consolidateFoodCatalogRequests` | Current duplicate evidence; distinct surviving request; seller and requester privacy preserved | Proposal and request `superseded`; all linked cases `closed` | Safe link to surviving case and terminal closure; no canonical merge |
| Proposal and request `needs_info` | Policy scheduler | `expireFoodCatalogRequest` | Response deadline elapsed; no response or hold; exact proposal/request versions | Proposal and request `expired`; all linked cases `closed` | Policy-versioned terminal closure; no publication |

These paired states are one transactionally enforced lifecycle, not eventually consistent
projections. No command may change a seller proposal without making the listed linked
request/case transition, and no generic request command may leave the proposal behind.
`published`, `resolved_existing`, `withdrawn`, `rejected`, `superseded`, and `expired`
are terminal. A mismatch between proposal and request state fails closed and requires an
independently audited repair; it is never normalized silently.

`submitSellerFoodCatalogProposalInformation` and
`withdrawSellerFoodCatalogProposal` take `placeId`, proposal ID, expected proposal and
claim/assignment versions, idempotency key, and the exact response/withdrawal payload.
They recheck place control, assignment, and `food_catalog.propose` on the original call
and every replay; generic request ownership is insufficient.

### 13.3 Operations Server Actions

| Candidate action | Boundary |
|---|---|
| `listFoodCatalogCases` | Permission-scoped cursor queue; no raw evidence in list rows |
| `getFoodCatalogCase` | Assigned case, safe request fields, candidate matches, revisions, redacted audit |
| `assignFoodCatalogCase` | Atomic assignment with expected case version |
| `saveFoodCatalogRevisionDraft` | Typed draft plus expected parent/affected revisions |
| `submitFoodCatalogRevisionForReview` | Locks draft version and enters `in_review` |
| `requestFoodCatalogInformation` | Reviewer request with enumerated field needs and reason |
| `recordFoodCatalogRejection` | Append-only decision with reason, exact `decisionCaseId`, complete sorted associated-case ID/version digest, request/proposal versions, and expected absence of competing decision; ordinary calls require no escalation, while a nested call may name only the designated escalation plus its consumed `closeEscalatedFoodCatalogCase` approval; aggregate terminal closure, no canonical mutation |
| `approveFoodCatalogRevisionForPublication` / `requestFoodCatalogRevisionChanges` | Publisher-only reviewed revision decision with separation of duties; approval is not publication |
| `resolveFoodCatalogRequestToExisting` / `consolidateFoodCatalogRequests` | Independently reviewed request closure with no canonical mutation or requester cross-disclosure |
| `submitFoodCatalogDecisionPacket` / `escalateFoodCatalogCase` / `returnEscalatedFoodCatalogCaseToReview` / `closeEscalatedFoodCatalogCase` | Exact Section 8 case transitions and scoped permissions |
| `recordFoodCatalogSecondReviewDecision` | Second Reviewer-only `approved` or `rejected` decision bound to one submitted packet version, operation kind, exact scope/subject/hold/asset IDs, complete expected revisions and preview/member digest, policy/expiry, actor-independence evidence, expected absence of a decision, idempotency key, and reason; never publishes |
| `invalidateFoodCatalogRequestPublicationApproval` / `abandonFoodCatalogRevisionDraft` / `invalidateFoodCatalogRevision` | Exact-version fail-closed invalidation; never mutates a published revision |
| `publishFoodCatalogRevision` | Atomic revision, decision, Catalog read projection, lifecycle, and audit |
| `previewFoodCatalogMerge` / `publishFoodCatalogMerge` | Complete expected revisions plus preview digest |
| `previewFoodCatalogMergeCorrection` / `publishFoodCatalogMergeCorrection` | Distinct correction target, complete expected revisions, redirect preview digest, and second approval; merged loser stays merged |
| `previewFoodCatalogVariantMerge` / `publishFoodCatalogVariantMerge` / `publishFoodCatalogVariantMergeCorrection` | V1.5 reviewed variant identity/redirect impact; merged loser remains merged; no relation or observation re-parenting |
| `previewFoodCatalogSplit` / `publishFoodCatalogSplit` | V2; complete expected revisions plus preview digest and second approval |
| `previewFoodCatalogReportabilityScope` / `suspendFoodCatalogReportability` | Exact relation key or complete item/variant descendant-key digest; Safety Responder deny-only hold with revision IDs, deadline, and reviewer |
| `extendFoodCatalogReportabilitySuspension` / `resumeFoodCatalogReportability` | Publisher execution after independent review; exact Section 8.4 preconditions; neither creates a canonical revision |
| `retireFoodCatalogItem` / `reactivateRetiredFoodCatalogItem` | Independently reviewed identity revision; merged items cannot reactivate |
| `retireFoodCatalogVariant` / `reactivateRetiredFoodCatalogVariant` | Exact child/relation impact; merged variants cannot reactivate |
| `publishFoodCatalogUnitRevision` / `retireFoodCatalogUnit` / `reactivateRetiredFoodCatalogUnit` | Distinct-ID creation or semantics-preserving metadata revision only, plus independently reviewed lifecycle and complete relation/reportability impact; dimension or meaning change requires a distinct unit ID |
| `retireFoodCatalogVariantUnitRelation` / `reactivateRetiredFoodCatalogVariantUnitRelation` | Exact immutable relation revision and keyed reportability transition |
| `registerFoodCatalogReferenceAssetEvidence` / `submitFoodCatalogAssetForRightsReview` | Post-media-ADR private Catalog asset handoff and rights-review entry; never accepts an Observation Evidence Media handle |
| `approveFoodCatalogAssetRights` / `rejectFoodCatalogAssetRights` / `requestFoodCatalogAssetRightsInformation` | Rights Reviewer-only immutable decision boundary; never publishes |
| `submitFoodCatalogAssetRightsInformation` | Original authorized submitter or assigned Steward responds to one versioned request with a new immutable evidence-packet revision |
| `invalidateFoodCatalogAssetRightsApproval` / `submitSuppressedFoodCatalogAssetForRightsReview` | Exact asset/hold versions; remains non-public and requires a new current rights decision |
| `publishFoodCatalogAsset` / `suppressFoodCatalogAsset` / `resumeFoodCatalogAssetPublication` | Exact Section 8.5 asset-only transitions; no item, reportability, or observation mutation |
| `recordFoodCatalogAssetWithdrawalDecision` / `withdrawFoodCatalogAsset` | Rights Reviewer records only; independent Publisher consumes the current decision for terminal lifecycle; active holds also require Second Reviewer |
| `supersedeFoodCatalogAsset` | Paired atomic old `published` to `superseded` and approved replacement to `published` transition |
| `revokeAnonymousFoodRequestCapabilityForRisk` | Assigned Safety Responder invalidates active and pending verifiers; no request read/action or replacement receipt |
| `submitFoodCatalogReconsideration` / `decideFoodCatalogReconsideration` | One linked new-evidence review with independent actor |

Every `withdrawFoodCatalogAsset` transition invokes
`closeFoodCatalogAssetTerminally` in the same transaction. It locks the asset, current
withdrawal decision, every open rights-information request, every unpublished evidence
packet revision, every unused rights/publication approval, every publication packet, and
any active hold. It then:

1. consumes only the exact current withdrawal decision authorized by the Publisher;
2. closes each open rights-information request as `cancelled_asset_withdrawn`;
3. invalidates every unpublished evidence-packet revision, unused approval, and
   publication packet so none can later review or publish;
4. revokes asset-review assignments and leases;
5. preserves immutable prior decisions, evidence history, attribution history, and any
   former public-delivery history;
6. removes current public delivery when the source state was `published` or `suppressed`;
   and
7. commits the asset `withdrawn` transition and linked closure/invalidation audit events,
   or rolls everything back on stale versions.

The consumed withdrawal decision remains immutable evidence rather than becoming an
actionable approval. A later `submitFoodCatalogAssetRightsInformation`, rights decision,
publication, resume, or supersession command against that withdrawn asset fails closed.
An active hold still requires the independently authorized hold-resolution precondition;
terminal cleanup does not bypass it.

### 13.4 Internal domain functions

Server Actions are adapters. Candidate internal functions own rules:

- `admitFoodCatalogRequest` owns normalization, idempotency, rate limits, typed inserts,
  case creation, and admission audit;
- `closeFoodCatalogRequestTerminally` owns atomic request/case closure and invalidation of
  every unpublished linked revision, approval, information request, and decision packet;
- `closeFoodCatalogAssetTerminally` owns atomic withdrawal, public-delivery removal,
  rights-information closure, and invalidation of every unpublished evidence packet,
  approval, and publication packet;
- `resolveReportableFoodCatalogSelection` owns the one Food publication/reportability
  query and is reused by read adapters and, under transaction locks, contribution
  admission;
- `publishFoodCatalogRevision` owns ordinary publication;
- `publishFoodCatalogMergeDecision` and `publishFoodCatalogSplitDecision` own the
  elevated prospective identity transitions; and
- `projectPublishedFoodCatalog` owns names/relations only, never offers or trust.

#### Mandatory first-flight idempotency protocol

The following protocol is normative for every mutation enumerated in Section 14.7,
including canonical, identity, reportability, asset, alias, variant, unit, relation,
request, seller proposal, case, revision, approval, packet, access, reconsideration, and
scheduler commands. A resource lock alone is not an idempotency claim.

1. After bounded parsing, the adapter canonicalizes every semantic input, including all
   expected versions, and computes one payload digest. It derives the unique execution
   identity `(callerIdempotencyNamespace, idempotencyKey)`. A stable namespace is the
   signed-in actor ID, service principal ID, anonymous admission-record ID, or anonymous
   request-capability lineage ID; rotation never creates a new lineage. `commandName`,
   operation, every resource ID, and the complete requested authorization scope are
   stored envelope fields and digest inputs, never unique-key columns. Reusing one key
   for a different command, resource, seller place, or scope therefore reaches the same
   execution row and conflicts rather than creating a second winner. Authorization is
   checked before result disclosure and again under the domain locks; seller scope
   includes the exact seller and `placeId`.
2. Before any domain mutation or audit append, one database transaction attempts to
   insert the execution identity, payload digest, an unguessable fencing nonce, and
   `executing` state under a unique constraint. The winning transaction keeps that
   unique-key lock while it performs the command.
3. The winner performs every domain transition, projection change, terminal
   invalidation, audit append, and stable-result write, then changes the execution row to
   `succeeded`, all in that same transaction. Only the transaction holding the fencing
   nonce may write the result. A permitted post-commit adapter must consume an outbox row
   carrying the same execution identity and deduplicate it; no direct external side
   effect occurs before commit.
4. A concurrent call with the same execution identity waits on the unique-key outcome
   up to a bounded lock timeout. If the winner commits, the caller reauthorizes, reads
   the committed row, and returns the prior stable result only when its payload digest
   is identical. It performs no domain mutation and appends no audit event. A different
   digest or envelope returns `idempotency_key_conflict` after the winner commits and
   performs no mutation or durable audit/security event.
5. If the bounded wait expires, the caller returns retriable `command_in_progress`,
   with no mutation or audit event, and must retry the same key. If the winning
   transaction aborts or its process dies, its uncommitted execution row, domain writes,
   audit, and result all roll back; exactly one waiting or later caller can then acquire
   the unique identity and execute.
6. No implementation may reserve an idempotency row in one transaction and mutate the
   domain in another, execute before the unique claim, overwrite a digest, steal an
   unexpired fencing nonce, or manufacture a second success audit. Validation or
   authorization failures before the claim disclose no stored result; stale expected
   versions discovered by the winner roll back the whole claim and command.

The signed-form-challenge JTI consumption rules remain the stricter admission-specific
claim for `beginAnonymousFoodRequestAdmission`. Before an admission-record namespace
exists, the challenge JTI is the provisional caller namespace and `(JTI, idempotency
key)` is the execution identity; a second unique constraint consumes the JTI itself.
Operation and digest are stored envelope fields. The transaction must acquire both
claims. The same JTI/key/operation/digest returns exact replay; the same JTI and key with
a changed operation or digest returns `idempotency_key_conflict`; a different key that
loses the JTI-consumption constraint returns `form_challenge_consumed`. Concurrent
different-key calls produce one winner and that same consumed result for every loser.
No path can return both outcomes for one call. The claims use the same atomic winner,
rollback, and bounded-wait behavior and do not create a stored form-render lifecycle.

Across Sections 14.1 and 14.7, conflicting reuse has one controlling rule: return the
generic conflict, disclose no prior result, and write no domain, Catalog audit, or
durable security event. Any earlier wording that permits a protected conflict event is
superseded by this rule; abuse controls may increment only an ephemeral, non-identifying
edge-rate counter. Exact successful replay likewise writes no event. This does not
weaken the original successful command's single audit event.

No internal function is added without its live Server Action/UI caller in the same
change. No `src/modules/catalog` implementation or generic subject abstraction is
proposed.

### 13.5 Optional HTTP adapters

V1 needs no parallel public CRUD API. If a separately approved native or partner client
later requires HTTP, candidate adapters are:

- `GET /api/v1/food-catalog/search`
- `POST /api/v1/food-catalog/requests`

They must call the same domain functions, authorization, validation, idempotency, and
rate boundary as Server Actions. There is no public operations CRUD endpoint.

## 14. Transaction, idempotency, and concurrency contracts

### 14.1 Request admission

One transaction:

1. resolves a signed-in subject or verifies the anonymous admission-grant cookie,
   origin/Fetch Metadata, anti-CSRF proof, keyed verifier, state, and expiry;
2. normalizes and validates the Food request;
3. resolves the sole unique execution identity as `(signed-in-subject namespace or
   admission-grant namespace, idempotency key)`, with operation/resource/scope stored in
   the envelope and digest;
4. compares a normalized payload digest;
5. atomically locks and enforces durable subject/network limits;
6. inserts request, typed child rows, case, and keyed request-access verifier where
   applicable;
7. appends admission/rate audit; and
8. stores the stable result without the raw anonymous capability.

Same key and digest returns the stored result with no second request, rate charge, case,
audit admission, or capability issuance. It reports `receipt_already_issued` and cannot
reproduce a lost receipt. Same key with a different digest returns conflict, creates no
Catalog/domain, Catalog-audit, or durable security event. Any
transaction failure rolls back every admission effect. If commit succeeds but the first
receipt response is lost, the request remains admitted and anonymous access fails closed
for request access as defined in Section 7.2; the still-valid pre-admission grant
authorizes only exact stable-result replay.

Request rate policy is separately versioned. Sign-in does not bypass it.

### 14.2 Ordinary publication

One transaction:

1. authorizes Publisher and separation of duties;
2. verifies an open compatible case and, where request-backed, an open compatible
   request, then locks the complete terminal-closure set, revision, parent revision,
   item, aliases, variant, unit relations, lifecycle, and relevant asset references;
3. verifies every expected revision and duplicate constraint;
4. revalidates typed fields and reportability;
5. appends immutable revision and decision;
6. updates the Catalog read projection and lifecycle;
7. invokes `closeFoodCatalogRequestTerminally` where request-backed, publishing only the
   selected revision and invalidating every other unpublished linked artifact; and
8. appends audit.

Failure publishes nothing. The transaction does not mutate observations or
`offers_current`.

### 14.3 Merge/split publication

The publish command requires:

- preview digest;
- complete expected-revision set;
- first and independent second approval;
- lock/recalculation of all affected rows;
- alias, slug, relation, redirect, and lifecycle collision checks; and
- exact prospective impact audit.

A preview is information, not authorization. Drift requires a fresh preview and review.

### 14.4 Observation admission

`admitFoodContribution` must call the shared reportability resolver inside its existing
database transaction. Catalog rejection happens before an observation or rate
consumption is committed. Catalog publication cannot bypass ADR-019 moderation,
unavailable-price, independence, conflict, or projection rules.

### 14.5 Anonymous capability rotation

Every command follows the access-grant table in Section 7.2. Begin rotation locks the
request-access row, verifies the active receipt and idempotency digest, refuses a second
live pending rotation, stores only the pending keyed verifier and expiry, and appends
audit. Its durable result never contains the replacement secret. Confirm locks the same
row, verifies the pending receipt and expiry, atomically promotes it, revokes the old
verifier, clears pending state, and appends audit. A failed, expired, or replayed
begin/confirm never leaves two active verifiers or revokes the old verifier before
confirmation.

Self-revoke requires the current active receipt; its exact retry proves that receipt
against the retained terminal verifier. Risk revoke requires the Safety Responder
permission and assigned incident; its exact retry instead reauthorizes the same actor,
permission, incident assignment, operation, key, digest, request/grant IDs, and reason.
Either original command locks the grant, resolves idempotency, marks active and pending
verifiers unusable, and appends the data-minimized revocation audit atomically. A retry
may return only the generic terminal result under its distinct Section 7.2 proof rule.
No revoke command changes the request, reveals status, accepts a public request ID as
authority, or creates a replacement.

### 14.6 Emergency holds and reviewed release

Suspension locks the exact reportability key or complete previewed key set, or the
published asset state, plus exact revision IDs. It permits only the deny transition in
Section 8, writes the immutable hold/deadline/member digest, updates the read boundary,
and appends audit in one transaction. Any command that closes, replaces, or permanently
resolves an active hold locks it and verifies a linked Catalog Second Reviewer approval,
even when the same command ordinarily needs one Publisher outside a hold. Resume,
extension, withdrawal, or changed-revision publication also verifies the exact lifecycle
preconditions. A stale revision, changed member set, missing reviewer, or failed gate
commits no release. Deadline processing may append escalation but never changes public
exposure or waives independent review.

Deadline escalation has these complete deny-preserving transitions:

| From | Actor | Command | Preconditions | To | Atomic effects |
|---|---|---|---|---|---|
| Exact reportability hold `suspended` | Policy scheduler service principal | `escalateExpiredFoodCatalogReportabilityHold` | Hold deadline elapsed; hold unresolved; exact hold, member digest, deadline, escalation sequence, and policy versions; no event already recorded for that sequence | Same hold `suspended` | Append one immutable escalation/audit and one deduplicated notification outbox row under the deterministic scheduler execution identity; public reporting remains denied and no canonical, reportability-decision, observation, or offer mutation occurs |
| Exact asset hold with asset `suppressed` | Policy scheduler service principal | `escalateExpiredFoodCatalogAssetHold` | Hold deadline elapsed; hold unresolved; exact hold, asset revision, deadline, escalation sequence, and policy versions; no event already recorded for that sequence | Same asset `suppressed` and hold open | Append one immutable escalation/audit and one deduplicated notification outbox row under the deterministic scheduler execution identity; public delivery remains denied and no rights decision, approval, item, reportability, or observation mutation occurs |

The scheduler cannot advance the escalation sequence or deadline itself. A separately
authorized reviewed hold extension may establish the next deadline/sequence. Stale,
duplicate, early, or already-resolved attempts return their Section 14.7 stable result
without an additional transition or audit.

### 14.7 Complete command-idempotency coverage

**Controlling uniqueness definition.** For every command row below, the sole database unique key is `(callerIdempotencyNamespace, idempotencyKey)`. The listed operation, actor or grant, resource, and scope values are mandatory stored envelope fields and digest inputs used for exact-replay comparison; they are not additional unique-key columns and cannot create another winner. Any tuple or prose below that appears to define identity as operation plus actor or grant plus resource or scope plus key is replaced by this caller-namespace-wide definition. Reuse by the same namespace for any different operation, resource, seller place, or scope reaches the existing row and returns `idempotency_key_conflict`.


This registry is exhaustive for the candidate mutations named by this contract. Every
human/API command uses:

- `(callerIdempotencyNamespace, idempotencyKey)` as its sole unique execution identity;
  operation, currently authorized actor/subject/grant, exact resource/scope, and seller
  place remain stored envelope fields and digest inputs;
- a normalized digest containing all inputs, expected versions, preview/member digests,
  approval/hold/information-request IDs, and policy version that affect the decision;
- authorization re-resolution, resource locks, and one durable result written in the
  same transaction as every state, decision, projection, and audit effect;
- same identity + digest returning that original result with no additional domain row or
  state change, decision, projection effect, rate/limit consumption, or audit event of
  any kind;
- same key with a different operation, resource, scope, or digest returning conflict
  with no domain effect; and
- unknown-result recovery by the original command identity, never by guessing current
  state and issuing a new key.

Policy schedulers use a deterministic key of operation + resource ID + policy version +
due time and the same digest/stable-result/single-audit rule. Multi-resource commands
store one result only after all listed resources commit. Permission or assignment is
reauthorized on every replay; a stored success is not an authorization bypass. A
read-only preview may be repeated under a request/correlation ID and produces no
lifecycle idempotency record; its digest is information, and the later mutation requires
its own key and revalidated digest.

`closeFoodCatalogRequestTerminally` and `closeFoodCatalogAssetTerminally` are locked
internal transaction functions, not independently callable commands. The former executes
only inside the listed terminal request command's execution row. The latter executes
only inside `withdrawFoodCatalogAsset` and shares that command's caller namespace, key,
digest, fencing nonce, stable result, and single audit transaction. Neither helper may
accept a second idempotency key, create a separate winner, or be invoked by a client.

| Coverage group | Exhaustively covered commands | Idempotency principal/special rule |
|---|---|---|
| Anonymous admission and access | `beginAnonymousFoodRequestAdmission`, `submitMissingFoodItemRequest`, `expireAnonymousFoodRequestAdmission`, `beginAnonymousFoodRequestCapabilityRotation`, `confirmAnonymousFoodRequestCapabilityRotation`, `expireAnonymousFoodRequestCapabilityRotation`, `revokeMyAnonymousFoodRequestCapability`, `revokeAnonymousFoodRequestCapabilityForRisk`, `expireAnonymousFoodRequestCapability` | For begin: challenge JTI is the provisional caller namespace, `(JTI, key)` is the execution identity, operation/origin/form/policy are envelope/digest fields, and a separate unique JTI-consumption constraint prevents a different key from winning; complete signed verification evidence, issuance/result, and audit commit atomically. Rendering/expiry of the stateless challenge is not a mutation. Thereafter: admission grant, active/pending/retained self-revoke verifier, assigned Safety Responder, or deterministic scheduler key exactly as Section 7.2 distinguishes |
| Request lifecycle and terminal closure | `requestFoodCatalogInformation`, `submitFoodCatalogRequestInformation`, `approveFoodCatalogRevisionForPublication`, `resolveFoodCatalogRequestToExisting`, `withdrawFoodCatalogRequest`, `recordFoodCatalogRejection`, `consolidateFoodCatalogRequests`, `expireFoodCatalogRequest`, `invalidateFoodCatalogRequestPublicationApproval`, `closeFoodCatalogRequestTerminally` | Request owner/capability, assigned operations actor, Publisher, or scheduler; terminal closure has one key/result spanning all associated cases and unpublished artifacts; rejection digest binds the sole `decisionCaseId`, rejection packet, and complete sorted associated-case ID/version set |
| Seller place proposals | `submitSellerFoodCatalogProposal`, `submitSellerFoodCatalogProposalInformation`, `withdrawSellerFoodCatalogProposal` | Every original call and replay uses the same signed-in seller subject + exact `placeId` + active place-control claim/assignment + explicit `food_catalog.propose`; digest binds claim/assignment/proposal/information-request versions and exact payload. Submission creates only proposal/request/case/audit; response changes only proposal/request evidence; withdrawal invokes terminal closure. None creates canonical or observation state |
| Reconsideration | `submitFoodCatalogReconsideration`, `decideFoodCatalogReconsideration` | Submit requires a signed-in subject owning the rejected request; anonymous receipts are denied. Digest binds original decision/request IDs, policy window, one-use state, new evidence, and expected versions. Decide uses current independent Reconsideration Reviewer permission, linked record/decision versions, reason/policy, and outcome. Each appends one linked immutable record/decision/audit and never overwrites the original |
| Case, revision, and second-review lifecycle | `assignFoodCatalogCase`, `expireFoodCatalogCaseAssignment`, `submitFoodCatalogRevisionForReview`, `submitFoodCatalogDecisionPacket`, `recordFoodCatalogSecondReviewDecision`, `requestFoodCatalogRevisionChanges`, `escalateFoodCatalogCase`, `returnEscalatedFoodCatalogCaseToReview`, `closeEscalatedFoodCatalogCase`, `saveFoodCatalogRevisionDraft`, `abandonFoodCatalogRevisionDraft`, `invalidateFoodCatalogRevision` | Authorized actor plus case/revision/packet IDs and exact versions; second-review digest binds outcome, operation kind, complete scope/subject/hold/asset IDs, expected revisions, preview/member digest, policy/expiry, reason, and independence evidence; later approval consumption is part of the bound mutation's one execution identity, never a second command; scheduler lease expiry uses its deterministic key |
| Canonical item and revision publication | `publishFoodCatalogRevision`, `retireFoodCatalogItem`, `reactivateRetiredFoodCatalogItem`, `publishFoodCatalogMerge`, `publishFoodCatalogMergeCorrection`, `publishFoodCatalogSplit` | Publisher plus required independent approvals, complete expected-version set, preview digest where elevated, and terminal-closure set where request-backed |
| Alias and variant children | Alias create/retire/reactivate through `publishFoodCatalogRevision`; alias disposition through `publishFoodCatalogMerge`; variant create/update through `publishFoodCatalogRevision`; `retireFoodCatalogVariant`, `reactivateRetiredFoodCatalogVariant`, `publishFoodCatalogVariantMerge`, `publishFoodCatalogVariantMergeCorrection` | Parent/child IDs and versions are part of the digest; grouped publication has one result and never re-parents a child |
| Units and variant-unit relations | `publishFoodCatalogUnitRevision`, `retireFoodCatalogUnit`, `reactivateRetiredFoodCatalogUnit`, relation create/update through `publishFoodCatalogRevision`, `retireFoodCatalogVariantUnitRelation`, `reactivateRetiredFoodCatalogVariantUnitRelation` | Complete referencing-relation/reportability set and expected revisions are digest inputs; Second Reviewer decision is required for distinct unit creation, retirement/reactivation, material relation/comparability, or active-hold resolution, and is rejected for an ordinary same-ID metadata-only unit revision |
| Reportability | `suspendFoodCatalogReportability`, `extendFoodCatalogReportabilitySuspension`, `resumeFoodCatalogReportability`, permanent resolution through the applicable publication/retirement/merge command, `escalateExpiredFoodCatalogReportabilityHold` | Exact relation key or complete scope/member digest and hold/approval IDs; deadline escalation uses deterministic scheduler identity |
| Reference assets | `classifyLegacyFoodCatalogAsset`, `registerFoodCatalogReferenceAssetEvidence`, `submitFoodCatalogAssetForRightsReview`, `requestFoodCatalogAssetRightsInformation`, `submitFoodCatalogAssetRightsInformation`, `approveFoodCatalogAssetRights`, `rejectFoodCatalogAssetRights`, `invalidateFoodCatalogAssetRightsApproval`, `publishFoodCatalogAsset`, `suppressFoodCatalogAsset`, `submitSuppressedFoodCatalogAssetForRightsReview`, `resumeFoodCatalogAssetPublication`, `recordFoodCatalogAssetWithdrawalDecision`, `withdrawFoodCatalogAsset` including its internal `closeFoodCatalogAssetTerminally`, `supersedeFoodCatalogAsset`, `escalateExpiredFoodCatalogAssetHold` | Asset/evidence/checksum versions, rights decision, open information request, hold, replacement pair, and approvals are digest inputs; withdrawal has one command identity/result for lifecycle plus all terminal cleanup, and supersession has one key/result for both assets |
| Read-only impact previews | `previewFoodCatalogMerge`, `previewFoodCatalogMergeCorrection`, `previewFoodCatalogVariantMerge`, `previewFoodCatalogSplit`, `previewFoodCatalogReportabilityScope` | No mutation/stable lifecycle result; correlation ID only. Returned digest never authorizes and must be recomputed by the separately idempotent mutation |

Bootstrap and scheduler names in this table are internal policy commands, not public
Server Actions. They use the same authorization/service boundary and transaction rules;
no client may invoke them directly.

## 15. Proposed schema, RLS, and migration implications

This section is candidate decomposition for a future schema ADR/lane. It is not a settled
schema.

### 15.1 Candidate V1 data changes

Prefer extending the current live tables and read projection over creating a parallel
generic subject store.

Candidate typed additions include:

- immutable revision/lifecycle references for items, aliases, variants, units, and
  variant-unit relations;
- reportability records keyed to exact item + variant + variant-unit relation identity;
  authorization-capable states bind exact current published item, variant, unit,
  relation, and reportability-decision revision IDs, while denied rows retain historical
  bindings/reasons; scoped holds carry complete member digests;
- typed `item_variant_unit_relations` with intrinsic reporting permission and independent
  comparability, but no embedded safety-hold state;
- `food_catalog_requests` plus typed alias, variant, unit, consumed signed form-challenge
  JTIs, short-lived anonymous admission-grant verifier/lifecycle, requester-access
  lifecycle, pending verifier, and seller-scope children;
- `food_catalog_cases`, assignments, and case versions;
- immutable `food_catalog_revisions` and typed revision children;
- append-only `food_catalog_decisions`, immutable operation-bound Second Reviewer
  decisions with unique consumption links, and reconsiderations;
- `item_redirects` for prospective merge/search routing;
- `food_catalog_audit_events`; and
- Catalog reference-asset metadata/links, immutable versioned evidence packets and
  information requests/responses, rights decisions, publication approvals, holds, and an
  independent lifecycle.

V1 does not add brands or packaged products. V1.5 may propose them only after the
hierarchy ADR.

The current generic JSONB variant attributes are legacy input to reconcile, not a model
to expand. Request payloads and canonical fields must not become EAV or one unversioned
JSON blob.

### 15.2 Access boundary and RLS

- Public access goes through an authorized read boundary. "Public RLS" does not mean
  direct browser table access.
- Browser roles receive no direct canonical, decision, audit, or evidence DML.
- A requester can read only a safe projection of owned/capability-scoped requests.
- Seller access requires active place assignment and explicit action scope.
- Steward, Publisher, Safety Responder, Rights Reviewer, Second Reviewer,
  Reconsideration Reviewer, and Auditor policies are least-privileged and fail closed.
- Private evidence, consumed form-challenge JTIs, anonymous admission/access keyed
  verifiers, raw risk keys, and full audit remain private.
- Auditor access is redacted transition evidence, not raw requester/media access.
- Security-definer functions, if any, require fixed search path, explicit grants,
  caller/resource checks, and adversarial cross-scope proof.

### 15.3 ADR-014 migration rules

Catalog desired state belongs to pillar `30`; RLS/grants belong to pillar `90`; service
functions belong to pillar `80` where required. Implementation must:

1. reconcile the exact then-current parent lineage and shared-target evidence;
2. claim exact desired-state, generated release, snapshot, journal, manifest, and
   documentation paths under one schema lane;
3. accept a controller-assigned migration number rather than reserve one here;
4. prove blank reconstruction and existing-parent upgrade;
5. analyze locks, backfill, compatibility, failure, and restoration;
6. preserve every shared-applied migration byte and ledger record;
7. obtain independent schema/RPC/RLS/grant refutation; and
8. authorize each target separately.

Repository migration filenames or source integration do not prove a shared database
state. This document authorizes no DB access, baseline, migration generation/application,
ledger change, seed, refresh, or deployment.

### 15.4 Legacy activation/backfill

A future activation plan must:

- inventory current Food rows before assigning proposed lifecycle;
- preserve IDs needed by immutable observations;
- avoid cascading deletes or observation re-parenting;
- classify every unreviewed/incomplete legacy image as `legacy_unreviewed` and atomically
  fail closed to no public image until independent rights approval and asset publication;
- keep non-Food price-shaped rows out of the Food reportable boundary;
- establish explicit bootstrap revisions and reason codes rather than mass approval; and
- preserve compatibility with the currently deployed application until the coordinated
  UI/read/write cutover passes.

The destructive seed is never a shared migration or backfill mechanism.

## 16. Catalog moderation, decisions, and audit

Catalog moderation evaluates identity, naming, alias use, variant meaning, unit
reportability/comparability, duplicate risk, and reference-image rights. It does not
moderate price truth or observation confidence.

### 16.1 Candidate reason codes

- `approved_new_item`
- `approved_alias`
- `approved_variant`
- `approved_unit_relation`
- `resolved_existing_item`
- `duplicate_request`
- `insufficient_identity_evidence`
- `ambiguous_item`
- `ambiguous_variant`
- `ambiguous_unit`
- `non_food_v1`
- `rights_unconfirmed`
- `scope_denied`
- `unsafe_content`
- `requester_withdrawn`
- `lifecycle_conflict`
- `anonymous_access_self_revoked`
- `anonymous_access_compromise`
- `emergency_hold_resolved`
- `asset_rights_approved`
- `asset_rights_rejected`

Reason codes are versioned. Safe requester copy is separate from private operational
notes.

### 16.2 Audit minimum

Each event records:

- random request/command ID;
- actor reference or data-minimized anonymous subject;
- permission used;
- action and resource type/ID;
- place scope where relevant;
- expected and resulting lifecycle/revision IDs;
- reportability key or complete affected-member digest, hold ID, and linked approval ID
  where applicable;
- reason code and policy version;
- prior decision/revision link;
- redacted evidence/asset reference;
- time; and
- transaction correlation.

Audit excludes raw anonymous capabilities, Auth tokens, raw network identifiers, private
free text, raw media, contact values, and provider responses. Audit is evidence of a
transition, not a second mutable domain store.

### 16.3 Reconsideration and emergency action

A signed-in rejected requester may submit one bounded reconsideration with new structured
evidence after the required governance decision defines timing and abuse limits. A
different reviewer decides it; the original decision is never overwritten. Anonymous
request receipts do not authorize reconsideration; a new anonymous submission is a
standalone request and cannot reopen or attach itself to the rejected one.

Credible safety, identity-confusion, or rights risk may temporarily suspend reportability
or suppress an exposed asset through the Catalog Safety Responder's deny-only commands.
The immutable hold records the prior state and revision IDs, reason, actor, policy,
deadline, and assigned independent reviewer. It cannot activate, resume, publish, retire,
merge, or withdraw. Only the exact reviewed transitions in Sections 8.4 and 8.5 can
resolve the hold; a deadline never auto-restores exposure. Permanent retirement, merge,
or asset withdrawal requires its independent publication/decision path. An image-rights
dispute does not retire Rice.

## 17. Reference imagery and media handoff

### 17.1 Catalog reference image contract

A public image object must carry together:

- immutable asset handle or approved source URL;
- source URL;
- creator/rightsholder;
- exact attribution text;
- licence identifier, version, and licence URL;
- checksum and retrieval/review time;
- rights-review decision and policy version;
- alt text;
- crop/focal metadata where used; and
- asset lifecycle.

If required rights metadata is incomplete, the public read returns no image and uses the
existing monogram fallback. Current columns and `itemImages.ts` entries are source
evidence, not proof of complete legal attribution, rights compatibility, or runtime
delivery.

### 17.2 Media ownership boundary

V1 Catalog requests accept no uploaded evidence. Reference imagery may continue from
separately reviewed external sources only after a claimed implementation.

A future media/privacy ADR must distinguish:

| Function | Owns |
|---|---|
| Catalog Stewardship | Subject-image suitability, alt text, source/rights metadata, publish/suppress decision, attribution returned with image |
| Catalog Media delivery | Bytes, malware checks, metadata stripping where appropriate, immutable asset identity, delivery, takedown, retention |
| Observation Evidence Media | Private report evidence, receipt/photo privacy, moderation delivery, retention, deletion, offline threat model |

Observation Evidence Media is a proposed future function and owns no path today. Its
asset handle cannot become a Catalog image without a separate rights representation,
depicted-person/privacy review, licence compatibility review, and Catalog asset
publication. A seller packaging photo is private proposal evidence until that process
completes.

Asset takedown suppresses the asset. It does not by itself retire the canonical item,
change reportability, alter observations, or change trust.

## 18. Offline and recovery behavior

### 18.1 Public Catalog

- Cached identity data shows `Last updated` and a stale/offline label.
- Offline search distinguishes complete cached no-match from "not available in this
  cache." The latter cannot trigger a confident no-match claim.
- Cached lifecycle never authorizes a report; server admission rechecks current state.
- A server rejection after retirement/merge/suspension preserves the user's unsent
  report fields but creates no observation.

### 18.2 Request drafts

Proposed offline copy is:

> **Saved on this device, not sent. Review and send when you're online.**

Before local persistence is implemented, a privacy decision must define expiry and
storage. Candidate minimums are:

- structured Food identity fields only;
- no image bytes, evidence handles, URLs, anonymous capability, private moderation
  notes, or seller verification documents in a draft;
- explicit Delete draft action;
- shared-device warning;
- short bounded expiry;
- deletion on logout/account switch unless the user explicitly retains a non-account
  draft; and
- no background submission. Reconnection requires review and explicit Send.

Idempotency protects explicit retry. "Queued" must not mean received, approved,
published, or guaranteed to sync.

### 18.3 Operations

Steward assignment, evidence review, decisions, merge/split, and publication are
unavailable offline. Sensitive cases and evidence are not persistently cached on the
device. A connection loss during publication returns an unknown-result recovery screen
that queries the stable command ID before allowing retry.

This document does not change ADR-019 offline behavior for observations.

## 19. Metrics and operating service levels

Metrics measure findability and stewardship quality, not approval volume or engagement.

| Metric | Definition |
|---|---|
| Request resolution mix | Published new, resolved existing, rejected, withdrawn, expired, and superseded requests divided by closed requests in a stated window |
| Existing-alias recovery | Requests closed by a published existing-item alias divided by closed missing-item requests |
| Decision time | Median and P90 from admitted request to terminal publication/rejection, excluding requester waiting time |
| Needs-info rate | Cases entering `needs_info` divided by admitted cases |
| Duplicate suggestion precision | Suggestions accepted by a reviewer divided by suggestions reviewed; report by factor family |
| Merge correction rate | Merge publications requiring a prospective identity/redirect correction within 30 and 90 days divided by merge publications |
| Admission taxonomy rejection | Report admissions rejected for inactive/non-reportable Catalog selection divided by attempted report admissions |
| Reportable relation coverage | Active Food variants with at least one reportable unit relation divided by active Food variants |
| Comparability coverage | Reportable relations with reviewed exact/estimated comparison basis divided by reportable relations; never imply uncovered relations are invalid |
| Attribution completeness | Public reference images returned with every required rights field divided by public reference images returned |
| Cross-scope denial | Seller proposal attempts correctly denied outside active place scope; reviewed as a security control, not a growth metric |
| Accessibility completion | Successful task completion for request and Steward critical flows by input/assistive technology |

Instrumentation uses event IDs, lifecycle enums, durations, and coarse counts. It never
copies raw search strings, proposed names, aliases, free text, evidence, anonymous
capabilities, requester identity, or seller documents into analytics. Access is internal,
aggregated with a minimum cohort set by privacy review, retained for a bounded period,
and separated from reputation/trust.

There is no approval-rate target, seller leaderboard, contribution reward, paid priority,
or "requests created" success target.

## 20. Phased rollout

Every phase remains proposed and requires its own exact claims and release evidence.

### Catalog V1: Food request and publication

- Accept the governance ADR and exact V1 hierarchy.
- Reconcile legacy Food items, aliases, variants, units, and imagery.
- Add contributor missing-item request admission with anonymous-first continuity.
- Add Steward queue, revision review, ordinary publication, audit, and reportability.
- Add independent reportability/comparability relations.
- Add Catalog reference-image rights lifecycle without request uploads.
- Replace unbounded Report Price taxonomy with the reportable Food read boundary.
- Keep public reporting paused until ADR-019 activation independently passes.

V1 has no brand, packaged product, seller proposal, canonical merge/split publication,
media upload, second vertical, or generic module.

### Catalog V1.5: seller scope, brands/products, and reviewed merge

- Require completed and proven ADR-022 P2 place-control onboarding and assignments.
- Add explicitly permissioned seller place proposals.
- Accept a separate brand/packaged-product hierarchy decision and reconcile legacy
  branded aliases/variants.
- Add independently reviewed canonical merge and reconsideration.
- Add any Catalog media upload only after a media/privacy ADR and separate media lane.

### Catalog V2: split and earned category evolution

- Add post-publication split tooling, prospective redirects, and two-person operations.
- Add evidence adjudication only through its own accepted observation decision; never
  by Catalog mapping alone.
- Consider another category only after it is a complete typed live vertical across map,
  search, sheet, filters, contribution, sort, markers, copy, trust, and outcomes.
- Extract a shared category capability only after two complete live verticals prove the
  repeated contract. Do not build the registry first.

No phase introduces fulfilment, checkout, payment, purchasable verification, or
seller-paid priority.

## 21. Acceptance and independent refuter criteria

Documentation and any later implementation default to **REFUTED** unless independent
evidence proves all applicable criteria.

### 21.1 Product/domain

1. A no-match request creates no item, alias, variant, unit, offer, or observation.
2. Report Price can reference only a published active Food item, active variant, and
   reportable variant-unit relation.
3. The ADR-019 transaction rechecks Catalog state and a stale client cannot bypass it.
4. Catalog publication creates no availability, price, trust, verification, seller
   accuracy, or public current offer.
5. Brands/products remain absent from V1 and legacy branded terms are not silently
   ratified.
6. Non-Food price-shaped seed rows do not enter the Food reportable boundary.

### 21.2 Authorization and abuse

7. Anonymous request capability, signed-in ownership, seller place scope, and every
   operations permission fail closed; a lost first or pending receipt is never
   reconstructed from idempotency state, a request ID, support access, or a stored
   verifier, and explicit self/risk revocation invalidates active and pending verifiers
   without changing the request or minting recovery access. Exact admission replay
   requires the still-valid pre-admission grant, same-origin/anti-CSRF proof, operation,
   key, and digest; the grant stores no raw bearer secret and authorizes nothing else.
8. A request ID alone reveals no private status and authorizes no action.
9. Same-key replay, conflicting-key reuse, concurrency, and rate edges produce the
   specified single durable result with no partial effects or replayed capability;
   two-phase rotation keeps the old receipt valid until confirmed. Section 14.7 covers
   every canonical, reportability, asset, child, access, request, case, revision, and
   scheduler mutation.
10. Requester, proposer, draft author, Steward, Publisher, Safety Responder, Rights
    Reviewer, Second Reviewer, Reconsideration Reviewer, support, and Auditor separation
    is enforced server-side.
11. Seller proposals cannot activate before proven ADR-022 P2 place control and explicit
    `food_catalog.propose`.
12. Payment, subscription, sponsorship, advertising, and volume cannot change any
    decision or priority.

### 21.3 Lifecycle and transactions

13. Every request, case, revision, item, alias, variant, unit, variant-unit relation,
    keyed reportability record, access grant, and asset transition follows its complete
    actor/command/precondition/from/to table and appends audit.
14. Approval-for-publication is not visible as published/reportable.
    Direct resolution to an existing subject requires an independent audited decision
    and performs no canonical or reportability mutation.
15. Publication, decision, read projection, lifecycle, request closure, and audit commit
    together or roll back together; emergency suspension is deny-only, and reviewed
    release cannot silently change a canonical revision. Every command resolving an
    active hold requires the linked independent approval even if its ordinary no-hold
    form does not. Every terminal request transition closes all associated cases and
    invalidates every unpublished linked revision, approval, information request, and
    decision packet in that same transaction.
16. Preview drift, alias collision, relation collision, stale revision, and duplicate
    publication fail closed.
17. Retired identities can reactivate only by reviewed revision; merged identities
    remain permanently merged. Mistaken-merge correction uses a distinct new ID or a
    different never-merged retired ID and only supersedes prospective routing.

### 21.4 Observation immutability

18. Merge and split never update, cascade, copy, or bulk re-parent an observation.
19. A loser/legacy observation never automatically counts under a survivor or child.
20. Catalog merge/split does not recompute `offers_current`; any evidence
    reinterpretation requires separate ADR-019-compliant adjudication.
21. Pending, rejected, synthetic, reference, inferred, or otherwise inadmissible
    observations remain governed by ADR-015/019 regardless of Catalog state.

### 21.5 Units and imagery

22. A reportable but non-comparable unit remains usable only in its own group.
23. Global `canonicalQuantity` never makes an item-dependent scoop universally
    comparable.
24. Unavailable forbids price.
25. Every public image has a current independent Rights Reviewer approval and returns
    complete attribution/licence/source metadata in the same object or no image at all;
    `legacy_unreviewed` classification removes public delivery. A rights-information
    response requires the exact open request and expected asset/evidence versions and
    appends a new immutable packet revision before review can continue.
26. Every asset transition satisfies its actor, command, precondition, and prior-state
    rule; suppression does not retire the item, change reportability, or alter observation
    evidence, and its deadline never republishes the asset. A Rights Reviewer records
    withdrawal decisions but only an independent Publisher changes lifecycle, while
    supersession publishes the approved replacement atomically with retiring the old
    asset.
27. Request/observation evidence cannot become a public Catalog image without the
    separately approved rights workflow.

### 21.6 UI, offline, privacy, and accessibility

28. Network error cannot appear as no match.
29. Offline draft copy says not sent; no background retry promises publication.
30. Cached Catalog state cannot authorize an observation.
31. Sensitive operations data and media are not persistently cached.
32. Focus entry/return, keyboard comparison, error summary, live status, reduced motion,
    200-percent text, light/dark, grayscale/contrast, compact, and regular layouts have
    direct evidence.
33. No screen shows a verified/trusted badge from Catalog approval.

### 21.7 Delivery and architecture

34. The exact shared target and migration lineage are proven before rollout; source files
    do not stand in for database evidence.
35. No destructive seed is run as migration, backfill, recurring ingestion, or Catalog
    CRUD.
36. Every new export has a live caller in the same change.
37. No generic capability registry, EAV store, graph service, empty module,
    microservice, fulfilment, checkout, or payment path appears.
38. A build, typecheck, generated migration, row count, or self-review is never the sole
    proof.

## 22. Likely future exact path packets

These are planning candidates, not claims. Program Management must reread current
`LANES.md`, make every path exact, resolve hot-file conflicts, and assign one
non-overlapping packet at a time. The current Community, Market, Contribution, Developer
Relations, and coordination work remains untouched.

### Packet A: governance ADR

Likely paths:

- new controller-numbered `docs/adr/<number>-food-catalog-stewardship-and-publication.md`
- `DECISIONS.md`
- `WETINDEY_BIBLE.md`
- `docs/architecture/SERVICE-ARCHITECTURE.md`
- `docs/product/CATALOG-STEWARDSHIP-WORKFLOW.md`

The ADR number and filename are deliberately unreserved here. This packet must ratify or
revise vocabulary, hierarchy, roles, states, privacy, merge/split, and media boundaries
before implementation.

### Packet B: desired state and release delta

Likely paths:

- `src/db/schema/index.ts`
- new `src/db/pillars/30-catalog.sql`
- new Catalog-specific desired-state content under `src/db/pillars/80-*`
- new Catalog-specific security content under `src/db/pillars/90-*`
- one controller-assigned `src/db/migrations/<number>_*.sql`
- its exact Drizzle snapshot, journal, manifest, and database documentation paths

The controller must replace every wildcard/template with an exact path before claim.
One schema lane owns all generated artifacts. No application path belongs in this packet.

### Packet C: contributor request vertical

Likely exact source paths:

- `src/app/page.tsx`
- `src/app/actions.ts`
- `src/lib/validation.ts`
- `src/core/i18n/strings.ts`
- new `src/app/_components/RequestCatalogItemSheet.tsx`
- new live-wired `src/lib/catalog/food-catalog-runtime.ts`, only if the same packet wires
  every export to the actions and UI

This packet does not own Report Price activation, seller roles, media, seed, or operations
publication unless Program Management deliberately combines a proven atomic vertical.

### Packet D: Catalog operations UI

Likely paths:

- new `src/app/ops/catalog/page.tsx`
- new `src/app/ops/catalog/actions.ts`
- new `src/app/ops/catalog/_components/FoodCatalogQueue.tsx`
- new `src/app/ops/catalog/_components/FoodCatalogCase.tsx`
- new `src/app/ops/catalog/_components/FoodCatalogRevisionEditor.tsx`
- new `src/app/ops/catalog/_components/FoodCatalogImpactPreview.tsx`
- shared authorization paths explicitly assigned by the controller

This packet follows the authorization/schema foundation. It may not invent client-only
roles.

### Packet E: Report Price Catalog gate

Likely exact paths:

- `src/app/_components/ReportPriceSheet.tsx`
- `src/app/page.tsx`
- `src/app/actions.ts`
- `src/lib/validation.ts`
- `src/lib/contributions/runtime.ts`
- `src/core/i18n/strings.ts`

This packet must coordinate with the Contribution owner because it changes the live
admission boundary. It cannot reactivate reporting by itself.

### Packet F: seller proposal vertical

Likely paths after proven ADR-022 P2:

- new `src/app/seller/catalog/page.tsx`
- new `src/app/seller/catalog/actions.ts`
- new `src/app/seller/catalog/_components/SellerFoodCatalogProposal.tsx`
- exact place-control/authorization paths assigned at that time
- `src/core/i18n/strings.ts`

No seller path is disjoint or available merely because it is listed here.

### Packet G: media

The media/privacy ADR must first define exact Catalog-reference and Observation-evidence
ownership. Only then may Program Management name storage, upload, scanning, retention,
takedown, and UI paths. Catalog cannot claim Observation Evidence Media paths.

### Packet H: legacy seed/bootstrap

Known source paths:

- `src/db/seed.ts`
- `src/db/seedContent.ts`
- `src/db/itemImages.ts`

Any execution, destructive refresh, connected-data verification, or bootstrap backfill
is a separate exact-target authorization. Source edits do not authorize running the
seed.

## 23. Review record for this proposal

Independent read-only refuter session
`019f79a2-e810-73c1-9991-86b1e0b46c90` defaulted to `REFUTED` on the pre-write plan. Its
blocking corrections are incorporated here:

- every new rule is proposed pending a governance ADR;
- V1 uses item + variant + reportable unit relation, with brands/products deferred;
- merge/split cannot reinterpret old observation evidence;
- current cross-boundary reads, free-form categories/JSONB, nullable image metadata, and
  destructive seed blast radius are explicit;
- complete request/case/revision/identity/reportability/asset lifecycles and separation
  of duties are specified;
- reportability, comparability, identity, and asset state are separate;
- action names are Food-specific and transaction/idempotency contracts are explicit;
- seller proposals require proven ADR-022 P2; and
- schema, RLS, migration, media, seed, and implementation remain separate future
  authorizations.

This review record is documentation evidence only. It is not implementation, runtime,
database, legal, privacy, security, accessibility, or release proof.
