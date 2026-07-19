# Community Trust and Contribution Loop

**Status:** Product and data-governance audit and staged contract; no implementation authority
**Date:** 2026-07-19
**Owner:** Product & Data Governance Architect
**Write scope:** This document only

## 1. Purpose and authority

WetinDey should help a contributor understand what happened after they shared useful
local information, and help a reader understand why a contributor or claim deserves
attention. It must do so without turning popularity, payment, identity, or proximity
into truth.

This document:

- records what the current application implements and what it does not;
- defines a staged product contract for contribution receipts, public trust profiles,
  earned recognition, structured community actions, follows, and later communication;
- proposes exact future implementation paths for later controller claims; and
- supplies acceptance evidence and abuse invariants for those later claims.

It does **not** accept ADR-011, amend ADR-016, ADR-019, or ADR-022, authorize a schema or
migration, reopen reporting or reviews, activate Presence, create a UI claim, select a
migration number, access a database, or authorize deployment.

The governing boundaries are:

- proposed [ADR-011](../adr/011-earned-trust-graph-and-reputation.md): identity,
  reputation, claim confidence, verification, lifecycle, roles, recognition, and rewards
  are separate;
- accepted [ADR-016](../adr/016-nearby-user-presence.md): Presence remains a separately
  consented, reciprocal, coarse, foreground-only capability whose `Wave` is not chat,
  follow state, contact sharing, reputation, or proof of location;
- accepted [ADR-019](../adr/019-contribution-integrity-and-moderation.md): a contribution
  is immutable pending evidence admitted transactionally and can affect public truth only
  after authorized moderation;
- accepted [ADR-022](../adr/022-earned-seller-and-role-onboarding.md): Auth, business
  proof, place control, permissions, contact-publication consent, seller accuracy,
  confidence, and badges remain independent; and
- the Bible's permanent anonymous-reading promise and non-purchasable trust firewall.

When this document and the live code disagree about what exists, the code wins. When this
document and an ADR disagree about policy, the ADR wins.

## 2. Code-truth audit

### 2.1 Implemented now

| Surface or boundary | Code truth | What it proves |
|---|---|---|
| Optional recognition | Neon Auth sessions drive the profile surface. Signed-out browsing remains available. | An account can be recognized; identity continuity does not prove accuracy or grant publication. |
| Owner profile | `src/app/actions.ts` exposes argument-free, session-resolved `getMyProfile`; `src/app/_components/ManageProfileSheet.tsx` lets the owner edit Auth display name, private profile contact, and avatar. | An owner-scoped profile exists. It is not a public trust profile and its contact is not seller-publication consent. |
| Avatar storage | Owner-scoped upload/removal writes the signed-in user's `user_profiles.avatar_url` and exact `avatars/{userId}.` Blob family. | A chosen avatar exists for account UI. It does not authorize public trust-profile or Presence-profile display. |
| Personal report history | `getMyReports` resolves the current session server-side, returns `[]` signed out, and reads attributed observations newest first. `MyReportsSheet` renders informational receipts. | The application can safely read attributed historical assertions back to their owner. It does not know whether those assertions changed a public result. |
| Contribution admission machinery | `submitObservation` delegates to `src/lib/contributions/runtime.ts`, which requires an exact release fingerprint, enabled environment, dedicated database capability, trusted network header, HMAC material, durable idempotency, and an ADR-019 admission result. | A fail-closed server seam and truthful result vocabulary exist in code. Repository presence does not prove environment capability, database application, or public activation. |
| Contribution containment | `ReportPriceSheet` disables every input and submit control with paused copy. Page code deliberately does not drain old offline queues. Visit confirmation throws before database work. | Public contribution and visit-confirmation writes must be described as unavailable. |
| Claim-specific trust | Live Food reads use the existing trust assessment path. | WetinDey can explain confidence in a current Food claim. This is not contributor reputation. |
| Review read | `GetItSheet` loads approved review rows and aggregate ratings and renders them. | Historic review content can be read. It does not establish review authenticity or safe write/moderation. |
| Review write containment | `submitReview` throws `REVIEWS_UNAVAILABLE`; UI says new reviews are unavailable while safeguards are prepared. | No current review or comment creation capability exists. |
| Presence containment | `getSharedUserLocations` always returns `[]`; Manage Profile says Nearby Presence is not available. Presence schema, guarded migration, cleanup, and role artifacts exist separately. | No current application read exposes nearby people. Schema artifacts do not prove activation or authorize reuse. |
| Context saving | “Saved markets” is disabled. | No area, place, item, or person follow capability exists. |

### 2.2 Missing or unsafe now

| Required capability | Current gap or defect |
|---|---|
| Immediate contributor impact receipt | The admission result can say invalid input, maintenance, reporting disabled, received for review, replay, rate limit, or idempotency conflict, but the public report UI is disabled and no receipt surface follows a successful admission. `invalid_input` and `maintenance` carry no server request ID. `MyReports` has no request ID, moderation outcome, projection effect, correction chain, or independently validated impact. |
| Public trust profile | No public profile DTO, route, sheet, consent, lifecycle, or privacy projection exists. The current profile is owner-only account data. |
| Earned contributor reputation | No append-only reputation event ledger, scoped policy, sample/uncertainty projection, appeal, or expiry exists. `sources.reliability_score_internal` is not earned reputation. |
| Earned badges | No public contributor badge projection exists. Existing Food status badges describe claim state; seller badge architecture is unimplemented. |
| Impact counts | No governed count distinguishes received, approved, independently confirmed, corrected, or helped decisions. Raw submission volume is available but must not be called impact. |
| Structured community actions | There is no Thank, Helpful mutation, claim Confirm, claim Correct, or community safety Report action. Visit confirmation is contained; review helpfulness has schema only. |
| Safe reviews | `getReviewsForEntity` returns `userId` and may use Auth email as the public display-name fallback. That leaks a stable account binding and private identity field. The review table defaults to `approved`, helpful votes allow nullable users, and no live moderation or write boundary exists. |
| Follows | No area/place/item subscription or follow record exists. There is no person follow graph or follower count. |
| Direct messaging | No inbox, thread, message, request, delivery, retention, moderation, age policy, anti-spam, or block-enforced communication path exists. |
| Community RLS | Current community reads and writes do not have an approved community RLS contract. Presence's RLS and roles are purpose-bound and cannot be reused as social authorization. |
| Public profile privacy | No consent model decides display name, avatar, broad area, badge explanation, contribution aggregates, or field-level withdrawal. |
| Analytics | There is no event trail for receipt comprehension, contribution outcome, structured interactions, community abuse, or public badge understanding. |

### 2.3 State classification

| State | Meaning in this document | Current examples |
|---|---|---|
| **Implemented** | A wired live call site exists and the code can exercise the stated behavior without treating repository artifacts as environment proof. | Owner profile, avatar management, owner-scoped My Reports read, approved-review read, claim-specific Food trust read |
| **Dormant or contained** | Code/schema artifacts exist, but a flag, capability check, unavailable action, disabled UI, missing target proof, or rollout gate prevents a truthful live-capability claim. | Contribution admission runtime and `0013` artifacts, disabled report form, throwing visit/review writes, Presence schema/migration/RLS/cleanup, always-empty Presence read |
| **Proposed** | This product contract defines a later complete vertical; no path is currently owned or authorized. | Impact receipts, scoped public trust profiles, earned badges, structured actions, subject follows, community RLS |
| **Prohibited** | The model must not be introduced by any phase described here. | Purchasable/transferable points, universal trust score, follower-count trust/ranking, self-validation, Presence-to-message linkage, unrestricted messaging without a new accepted ADR |

A dormant schema or function is not “partly implemented” for product copy. It remains
unavailable until its exact environment, authorization, UI, failure, privacy, and
release evidence passes.

### 2.4 Current statements that must not ship

Until the relevant later vertical is proved, WetinDey must not say:

- “Your report helped” merely because a request was received;
- “Published” for a pending observation;
- “Trusted contributor” from sign-in, submission count, `reliability_score_internal`,
  stars, helpful votes, follows, proximity, or staff selection;
- “Verified” without the exact current verification assertion and scope;
- “Confirmed” because the same person, device, business, or independence group repeated
  a claim;
- “Community member near you” from Presence, browsing context, or an inferred area;
- “Message sent” without a durable, consented messaging capability; or
- a follower, point, badge, or review count as a proxy for current Food confidence.

## 3. Product model: five separate truths

The public experience must preserve these separate domains:

| Domain | Public question | Examples | Never implies |
|---|---|---|---|
| Identity presentation | “How has this person chosen to appear here?” | chosen display name, avatar | legal identity, safety, accuracy, place control |
| Scoped reputation | “How accurate have independently evaluated outcomes been in this defined scope?” | Food price observations in Festac, with window/sample/uncertainty | that the next claim is true; expertise in another category |
| Claim confidence | “How strongly does admissible fresh evidence support this specific claim now?” | Food available at this place, 24h/72h policy | human worth, popularity, seller verification, Presence truth |
| Earned recognition | “Which narrow, versioned public label follows from scoped reputation?” | Accurate Food contributor · Festac · recent window | role, status, payment entitlement, universal trust |
| Community relationship | “Which subject or structured action did this account choose?” | follow a place, thank a contributor, report abuse | reputation, independence, claim confidence, contact consent |

UI copy, data types, analytics, and APIs must name the domain they operate on. A generic
`trustScore`, `verified`, `points`, `engagement`, or `relationship` field is prohibited.

## 4. Role-aware experience without role-shaped identity

One account may hold multiple independently granted, differently scoped assignments.
WetinDey must not require separate accounts for contributing, managing a proved place,
field work, moderation, or community activity. It must also not flatten those assignments
into `isSeller`, `isModerator`, `accountType`, a primary-role enum, Auth metadata, or one
dashboard whose hidden buttons pretend to enforce authorization.

Authentication identifies the account. ADR-022 assignments separately answer which
subject/resource/action the account may access now. The server resolves all current
assignments on every protected read or mutation; the UI is a task launcher, never the
authority.

Explorer and Contributor are **capability experiences**, not authorization roles.
Explorer remains anonymous. Signed-out users may enter the Contributor report flow under
ADR-019 and receive the immediate result for that request; recognition adds owner history
and later optional profile features but is not permission to contribute. Seller
owner/manager/staff, Moderator, Field Operator, Community Guide, and Catalog Steward are
separately granted scoped assignments when their governing phase exists.

### Task-focused flows

| Experience | Primary job | Required separation |
|---|---|---|
| **Explorer** | Browse areas, places, items, evidence, and safe saved subjects anonymously or while recognized | Default experience; no role required; no contributor or seller pressure in the hero flow |
| **Contributor** | Submit typed observations, read receipts, correct prior assertions, see governed impact, and manage an optional trust profile | Cannot moderate its own work, create catalog subjects, publish seller contact, or turn volume into reputation |
| **Seller owner** | Complete proved place-control workflow, manage separately permitted assignments, maintain allowed place facts, and grant/withdraw exact contact publication | Cannot approve own verification, accuracy, moderation, badge, appeal, or catalog change |
| **Seller manager** | Maintain allowed facts and submissions in expressly assigned place/capability scope; manage staff only when granted | Cannot transfer control, widen scope, infer contact consent, or self-grant publication |
| **Seller staff** | Submit attributed seller claims for assigned places/capabilities | Cannot manage roles, control, publication, verification, moderation, badges, or catalog truth |
| **Moderator** | Work an assigned review queue with reason codes, evidence minimization, append-only decisions, and appeals separation | Cannot review own/related work, change role scope, impersonate, rewrite observations, or set reputation/badges |
| **Field Operator** | Collect attributed evidence and complete assigned field tasks | Gains no seller control, moderation authority, catalog authority, or automatic reputation |
| **Community Guide** | Perform separately approved bounded community tasks and explain local context | The title grants no administrative permission, trust weight, Presence access, seller control, or catalog mutation |
| **Catalog Steward** | Triage assigned catalog requests and create/link approved canonical subjects under a separate accepted policy | Cannot approve own/related requests, moderate observations, publish unlicensed media, or gain seller/trust authority |

An account with several assignments sees a role/workspace switcher listing only current
capabilities and scope. Switching workspace changes navigation and task density, not the
Auth subject or permissions. Suspension, revocation, expiry, block, or scope change
removes the affected workspace immediately while preserving unrelated capabilities.

Each workspace requires its own empty, pending, needs-information, suspended, revoked,
expired, appeal, loading, error, and cross-scope denial states. An account without a role
does not see a disabled aspirational dashboard. Deep links resolve authorization
server-side and fail closed rather than relying on the last client-selected workspace.

Jiji may be used only as a qualitative reference for the information density and
progressive onboarding of a seller workspace: clear task grouping, listing/place context,
status visibility, and next-action clarity. It is not a domain model, visual copy source,
API contract, or authority for marketplace, listing, chat, order, checkout, payment,
dispatch, courier, inventory reservation, delivery, promotion, or fulfilment scope.
ADR-001 remains binding.

## 5. Catalog stewardship is not contribution

A Food observation answers:

> What availability and price did this source observe for this existing
> item-variant-unit at this existing place and time?

It does not answer:

> What products should WetinDey recognize, how are they named, grouped, pictured, or
> compared?

Creating or editing canonical products/items, aliases, variants, units, categories,
canonical quantities, taxonomy relationships, or reference imagery is **Catalog
Stewardship**. It requires an authorized catalog/operator workflow with source evidence,
duplicate detection, unit and variant review, licensing/attribution review for imagery,
reason codes, separation of duties, append-only audit, and rollback/correction policy.

Reporting price or availability remains an immutable ADR-019 Observation against existing
catalog IDs. The contribution payload cannot carry a new item name, alias, category,
variant, unit definition, conversion, reference image, or arbitrary catalog metadata for
the admission function to upsert. A seller, contributor, moderator, Community Guide, or
popular request does not receive catalog authority implicitly.

### Item-not-found request and triage

When a contributor cannot find the intended item:

1. Search offers canonical and local aliases without silently creating anything.
2. “Can’t find this item” opens a separate catalog request, not the report form.
3. The request records minimized proposed label, local name/alias, intended category,
   place/area context if necessary, packaging/unit description, source/evidence class,
   duplicate candidates shown to the requester, and a random request ID.
4. Submission returns `received_for_catalog_review`; it creates no item, alias, variant,
   unit, category, observation, offer, trust event, badge event, or public result.
5. An authorized Catalog Steward triages duplicate, needs-information, approve, or reject
   with reason codes. The claimant cannot approve it.
6. Approval creates or links canonical catalog records through one separately reviewed
   transaction, records provenance/licensing, and leaves the request/audit reconstructable.
7. The requester receives a safe outcome and may then start a new Observation against the
   approved subject. The old request never mutates into an observation.

Reference imagery follows the catalog media policy, not review-media or observation-media
shortcuts. An uploaded request image remains private review evidence until licensing,
attribution, privacy, EXIF, retention, and publication approval exist.

## 6. Immediate contributor impact receipts

### 6.1 Receipt contract

The first community loop is not a social feed. It is a truthful receipt returned
immediately after a contribution attempt and updated as governed outcomes occur.

Every local attempt gets a random `attemptId` before validation and a separate
client-generated ADR-019 idempotency key before admission. The `attemptId` anchors UI
state only; it is not evidence of server receipt. A server `requestId` is displayed only
when the server result returns one. `not_sent`, `sending`, and `invalid_input` have no
server request ID; under the current API, all `maintenance`/`reporting_unavailable`
results omit it too.

The receipt has one of these states:

1. `not_sent` — client intent only;
2. `sending`;
3. `invalid_input` — validation failed; no persistence or server request ID is implied;
4. `reporting_unavailable` — maps `maintenance`; capability/environment/network/database
   admission was unavailable and no saving or server request ID is implied;
5. `reporting_disabled` — the database boundary denied admission and returned its server
   request ID; no observation was created;
6. `received_for_review` — ADR-019 admitted one immutable pending observation and
   returned observation/request IDs;
7. `replayed` — the same admitted result was returned with no duplicate effect;
8. `needs_new_request` — same idempotency key, different payload; maps
   `idempotency_conflict` and includes the returned request ID;
9. `rate_limited` — includes truthful retry time and returned request ID;
10. `approved_no_public_change` — approved evidence did not change the projection;
11. `approved_contributed_to_change` — the approved evidence was one input to a recorded
   projection transition;
12. `rejected` — safe reason family and appeal/correction affordance where policy permits;
13. `superseded_by_correction`; or
14. `expired_without_decision` only if an approved moderation service-level policy
    explicitly permits that state.

Process completion includes state 10, but **impact begins only at state 11 or a later
independently validated/helped outcome**. Receipt
copy distinguishes:

- **received**: the system durably accepted pending evidence;
- **reviewed**: an authorized actor made a decision;
- **used**: approved evidence entered a projection calculation;
- **changed**: the projection transition audit attributes it as a contributing input; and
- **confirmed later**: an independent admissible outcome matched it.

No state says that one report alone made a current claim true.

### 6.2 Receipt content

Owner-only content may include:

- client `attemptId`, and server request ID only when returned;
- subject, item/variant/unit/place, availability, and price assertion;
- captured-at and received-at times;
- current moderation/outcome state and safe reason;
- correction chain;
- whether the current state is a replay;
- next permitted action; and
- aggregate impact counters whose definitions are accessible.

It excludes internal fraud/risk signals, raw network identifiers, other contributors,
moderator notes, private evidence, hidden independence groups, internal weights, and
precise location not needed to identify the reported place.

### 6.3 Activity and impact counts, not points

Permitted **activity counts** are plain process facts:

- reports received for review;
- reports approved; and
- corrections submitted or resolved.

They must be labelled activity, never impact.

Permitted **impact counts** require a recorded downstream effect:

- independently confirmed contributions;
- accepted corrections that contributed to a recorded projection change or later
  independently validated outcome;
- distinct places or items helped, subject to privacy thresholds; and
- projection transitions to which approved evidence contributed.

Received, submitted, and approved volume cannot be relabelled as people/items/places
“helped.” Both count families must expose their definition and window. They are not a
balance, currency, level, streak, redeemable unit, marketplace asset, or ranking bid.
They cannot be bought, gifted, transferred, cashed out, multiplied by sponsorship, or
used to raise claim confidence. A deletion, reversal, or policy-version change
recomputes the projection rather than silently editing source events.

## 7. Public trust profiles

### 7.1 Consent and safe projection

A public trust profile is optional and separately consented. Account creation,
contribution, profile editing, Presence consent, seller onboarding, contact storage,
place control, or badge eligibility does not publish it.

The public projection may contain only:

- chosen public display name;
- chosen public avatar;
- an optional broad declared area label, never derived from exact location or Presence;
- scoped earned recognitions with explanation links;
- approved activity and impact aggregates, clearly separated and privacy-thresholded;
- scoped reputation summaries with policy version, window, sample size, uncertainty,
  and last evaluation period; and
- joined month/year only when separately approved and not linkable to a sensitive event.

It must never expose email, phone, WhatsApp, profile contact, stable Auth ID, raw source
ID, precise or historical location, Presence activity, device/network identity, exact
per-contribution timestamps, private moderation history, internal risk/reliability
scores, seller evidence, or a list from which another person's movement can be inferred.

The current owner-avatar Blob key contains the stable Auth ID:
`avatars/{userId}.{ext}`. A public trust profile must never serialize, redirect to, or
request that URL. When avatar-publication consent is granted, a server-owned projection
copies/re-encodes the chosen image into
`community-avatars/{publicProfileId}/{randomVersion}.{ext}`. Both path identifiers are
random public-projection identifiers, not Auth/source IDs. The public DTO exposes only
that projection URL. Replacing or withdrawing the avatar, pausing/deleting the profile,
or deleting the account removes every exact public-profile prefix and invalidates the
projection; it does not need to delete the separate owner avatar unless its own lifecycle
requires it.

The public identifier is a random revocable community-profile ID or slug that is not the
Auth ID. Slug change, profile pause, block, suspension, account deletion, and consent
withdrawal fail closed. Searchability is a separate explicit consent from link visibility.

### 7.2 Reputation presentation

Public reputation is scoped and explanatory:

> Food price observations · Festac · evaluated over the last 90 days
> 24 independently evaluated outcomes · 21 matched · uncertainty: moderate

The exact wording and thresholds require ADR-011 acceptance and calibrated outcome data.
A profile never presents one universal score, leaderboard rank, percentile of human
trustworthiness, or cross-category total.

Sparse samples show “Not enough evaluated outcomes,” not zero reputation. Negative or
conflicting evidence follows an approved explanation and appeal policy; it is not hidden
because the account paid, is popular, or opted out of a badge.

### 7.3 Earned scoped badges

A badge is a disposable projection over a versioned recognition policy. Every badge
records:

- recognition kind;
- subject and exact scope;
- policy version;
- qualifying window and minimum sample;
- uncertainty rule;
- supporting event range;
- issued, recalculated, and expiry times; and
- active, paused, expired, revoked, or appealed lifecycle.

Allowed future copy is narrow, such as `Accurate Food contributor · Festac`. Prohibited
copy includes generic `Trusted`, `Verified`, `Official`, `Safe`, or `Community leader`
unless a separately accepted current assertion defines that exact meaning.

Badges cannot be purchased, manually gifted as a favour, transferred, accelerated by
submission volume, inherited across accounts, or reused across categories. They do not
grant a role, seller control, contact publication, moderation power, higher organic rank,
or automatic Food confidence.

## 8. Structured interaction before social interaction

WetinDey earns communication capability in bounded steps:

| Action | Subject | Product meaning | Trust effect |
|---|---|---|---|
| `Thank` | An opt-in public trust profile identified only by `publicProfileId` | Private acknowledgement of the contributor's body of work; no text payload and no contribution/request/observation target | None by itself |
| `Helpful` | A review or public explanation | Subjective usefulness for that content, recorded only in the authoritative review-helpful ledger | May affect review ordering only after the complete review-integrity vertical; never live-claim confidence |
| `Confirm` | A current typed local claim | Starts a new ADR-019 observation with its own provenance, time, place, independence, moderation, and idempotency | Only after approval and confidence recomputation |
| `Correct` | A specific observation/current claim | Starts a linked correction assertion; never edits the original | Only after independent moderation and projection recomputation |
| `Report` | Profile, badge, review, structured action, or safety event | Opens a bounded safety/moderation case with reason codes and optional constrained details | None; may pause visibility or capability under policy |

Rules:

- Every action is explicit, rate-limited, idempotent, auditable, and reversible where its
  meaning allows. Every person-targeted action is block-aware.
- `Thank` and `Helpful` cannot be spammed into reputation. Self-action, related-party
  action, replay, and brigading are excluded from any aggregate used for ordering.
- `Confirm` is not a vote button. It must collect the minimum typed observation required
  by the domain and pass ADR-019.
- `Correct` creates append-only evidence and a visible resolution state.
- `Report` is always available from a public community surface once that surface exists;
  blocking does not remove the ability to report prior conduct. V1 claim concerns use
  ADR-019's assigned content-moderation boundary, not the later community-safety store.
- Unrestricted comments, @mentions, quote-posting, feeds, and free-form replies are not
  authorized by these actions.

Reviews and comments remain separate from live observations. A star, review, helpful
vote, comment, or owner response cannot change Food availability, price, freshness,
claim confidence, contributor reputation, seller accuracy, or a badge. A factual
statement in review text affects local truth only when the author deliberately enters it
through `Confirm` or `Correct` as a typed observation.

Review/comment media is subjective content, not observation evidence. It cannot become
Food evidence merely because it depicts an item, place, receipt, or timestamp. Evidence
media requires its own private/public classification, consent, EXIF removal, content
integrity, provenance, moderation, retention, deletion, and ADR-019 linkage before an
authorized observation workflow may reference it. Helpful votes on review media remain
review-ordering input only.

## 9. Follows: subjects before people

### 9.1 Area, place, and item follows

The first follow capability is a private preference for a local-information subject:

- area;
- place; or
- item/variant where the domain supports it.

A follow means “make this subject easier for me to revisit” and, only after a separate
notification consent, “notify me under this bounded policy.” It does not mean trust,
endorsement, seller relationship, Presence sharing, or proof that the user lives nearby.

Follow records are owner-readable, owner-writable, non-public by default, exportable,
deletable, block-independent, and provider-neutral. Notification purpose, frequency,
quiet hours, channel, expiry, and unsubscribe must be explicit before any notification
is sent.

### 9.2 Person follows

Person follows come later than area/place/item follows and are not required for the
contribution loop. Before activation they require:

- separate follow/searchability consent on the followed profile;
- private-by-default follower/following lists;
- request/approval rules where risk requires;
- block and suspension propagation;
- anti-enumeration, rate, related-account, and scraping controls;
- age and safeguarding policy;
- deletion, export, retention, and inactive-account behavior; and
- proof that the product need cannot be met by following the person's contributed
  areas/items instead.

V1 has no follower count. If person follow later exists, follower count remains excluded
from trust, claim confidence, badges, seller accuracy, organic ranking, search ranking,
moderation priority, and reward eligibility. Public counts require a separate product
decision and cannot launch merely because edges exist.

## 10. Direct messaging remains deferred

Direct messaging is not a V1, V1.5, or automatically approved V2 feature. `Wave` remains
the complete Presence interaction under ADR-016 and cannot open a thread, share contact,
or reveal whether the recipient read it.

Structured `Thank`, `Helpful`, `Confirm`, `Correct`, and `Report` actions—and, only if its
separate rollout is ever authorized, Presence `Wave`—must precede unrestricted messaging.
Presence does not need to launch in order for the contribution loop to work, and messaging
cannot be used as a reason to activate it. If both ever operate, independent safety
evidence from each is an input to a later messaging decision, never automatic approval.

Any future messaging decision must first establish:

1. reciprocal or recipient-controlled message admission;
2. community block enforcement on send, delivery, history, search, and notification,
   plus separate respect for any current ADR-016 Presence block without reading Presence
   tables through community roles;
3. one-tap report with target evidence and a named moderation/safety response service;
4. account/device/network/content rate limits, cold-message caps, and spam quarantine;
5. age assurance/safeguarding policy and prohibited adult-minor contact cases;
6. privacy notice, lawful basis, encryption boundary, processor/provider review, and
   metadata minimization;
7. message, attachment, report, block, deletion, and legal-hold retention;
8. moderation access, audit, appeal, emergency response, and staff separation of duties;
9. no contact-value inference or automatic enrolment from Auth/profile/seller data;
10. no location attachment, live-location sharing, or Presence-to-message linkage;
11. notification consent, quiet hours, preview privacy, revocation, and account deletion;
12. provider-neutral disablement and a database kill switch; and
13. a new accepted ADR and exact end-to-end implementation claim.

Until all thirteen pass, the UI contains no disabled “Messages coming soon” promise,
thread schema, inbox service, provider adapter, or speculative message table.

## 11. Staged product contract

### V1 — Receipt and integrity loop

**Dependencies**

- corrected Presence `0012` applied and proved on the exact target;
- ADR-019 contribution integrity `0013+` applied and proved;
- public reporting separately authorized and enabled;
- safe public review identity correction;
- named moderation operator, reason codes, service levels, audit, and appeals; and
- ADR-015 observed-only Food truth on every live read.

**Capability**

- a successful contribution receives a truthful immediate receipt;
- My Reports shows owner-only request, moderation, correction, and projection-impact
  states;
- `Confirm`, `Correct`, and content-level `Report claim concern` enter ADR-019's typed
  contribution/moderation boundaries;
- no public trust profile, person follow, public count, point, leaderboard, comment, or
  message exists; and
- area/place/item saves may ship only as private local preferences without notifications.

**Exit evidence**

- driven same-key replay, conflict, rate, offline, crash, moderation, correction, and
  projection-transition cases;
- a receipt never overclaims publication or impact;
- one actor and one independence group cannot self-confirm;
- signed-out contribution remains possible through the ADR-019 anonymous subject;
- owner-only report data cannot cross accounts or caches; and
- accessibility, language, narrow/wide layout, light/dark, reduced-motion, and error-state
  evidence for the receipt and correction flow.

### V1.5 — Scoped public trust and subject follows

**Dependencies**

- ADR-011 separately accepted;
- sufficient independently evaluated outcomes for calibration;
- approved public-profile consent, privacy, erasure, appeal, and explanation policies;
- structured-action abuse controls and moderator capacity proved under V1;
- one complete signed-in review-integrity vertical in the same change: internally
  attributable review creation, duplicate-review/vote prevention, pending admission,
  moderation decisions, safe public read, append-only Helpful events, safe ordering,
  withdrawal, rate/idempotency/self/related-party controls, and tests; the inherited
  nullable/default-approved review and Helpful data remain quarantined until reconciled
  or retired;
- a purpose-bound community block/report/safety-response vertical with current
  assignments, retention, audit, appeals, rate limits, and kill behavior; and
- notification policy/provider review if any follow sends notifications.

**Capability**

- optional public trust profiles with chosen name/avatar and safe aggregates;
- scoped reputation explanations and expiring earned badges;
- impact counts, never points;
- `Thank`, review-only `Helpful`, community `Report`, and community `Block`, with no trust
  effect;
- private area/place/item follows and optional separately consented notifications; and
- no person follows, public follower count, unrestricted comment, or messaging.

**Exit evidence**

- every public profile field has a consent, source, audience, withdrawal, cache purge,
  retention, and account-deletion test;
- sparse samples, expiry, reversal, appeal, related-account, payment, and policy-version
  changes cannot create or preserve a false badge;
- public DTOs contain no Auth/source ID, email, contact value, precise location, or
  Presence data;
- helpful/thank brigades cannot change reputation, confidence, or organic rank; and
- comprehension research distinguishes identity, reputation, badge, and claim confidence.

### V2 — Relationship evaluation, not automatic messaging

**Dependencies**

- V1.5 abuse and privacy evidence over a meaningful operating period;
- accepted reason for person follows that subject follows cannot meet;
- safeguarding, anti-enumeration, consent, block/report, moderation, and deletion policy;
- a new accepted relationship ADR; and
- separate Founder authorization for any messaging experiment.

**Capability**

- at most, private consented person-follow relationships with no trust/ranking effect;
- structured actions remain the default communication;
- direct messaging stays off unless every gate in Section 10 is separately accepted and
  proved; and
- Presence remains a separate reciprocal foreground capability.

**Exit evidence**

- cross-account, blocked, suspended, deleted, underage, enumerating, scraping, brigading,
  notification, and reused-device cases default to denial;
- no follower count affects discovery, reputation, badges, claims, seller accuracy, or
  moderation;
- relationship withdrawal propagates to reads, notifications, and caches; and
- disabling any relationship provider leaves Food discovery and contribution receipts
  useful.

### Long term — separately accepted communication or recognition programs

Long term does not mean pre-authorized. After V2 operating evidence, WetinDey may evaluate:

- a narrowly admitted message-request capability only after every Section 10 gate and a
  new accepted ADR;
- community moderation roles only through ADR-022's scoped authorization, separation of
  duties, lifecycle, audit, and appeal contract;
- evidence-media workflows only under a separate accepted privacy/provenance/retention
  decision; and
- externally funded recognition only through ADR-011's one-way rewards firewall and a
  separate legal, tax, gaming, appeals, and partner-behavior decision.

Even long term, there is no universal reputation, public trust leaderboard, purchasable
verification, transferable point balance, follower-count trust edge, automatic seller
enrolment, contact inference, or Presence-derived messaging graph.

### Role-workspace delivery track

Role workspaces follow the capability they serve, not one social-feature release:

- Explorer remains the anonymous/default map and information experience in every phase.
- Contributor receipts and corrections join V1 only when ADR-019 activation passes.
- Seller owner, manager, and staff workspaces join only in ADR-022 P2 after the P1
  authorization foundation; each renders its distinct permission set and scope.
- Moderator workspace joins only with a named moderation operation, assignment queue,
  separation of duties, evidence policy, audit, and appeal.
- Field Operator workspace joins only with a named field task and attributed evidence
  contract.
- Community Guide workspace joins only after its precise resources, actions, enrollment,
  abuse cases, and prohibited combinations receive separate approval.

Naming a role in documentation does not justify its dashboard. Each workspace ships with
its live server authorization and at least one complete task, or it does not ship.

### Catalog request delivery track

Catalog requests are an independent governed track, not a side effect of V1 community
activation. The item-not-found entry may join the report flow only after:

- ADR-022 P1's application-owned assignment/audit foundation is applied and proved;
- a new accepted Catalog Stewardship decision defines the canonical catalog authority,
  resource/action permission matrix, enrollment and independent approval, prohibited
  role combinations, reviewer separation of duties, suspension/revocation/expiry,
  re-verification, appeal, private data exposure, retention, rate limits, abuse cases,
  and emergency disablement;
- a Catalog Steward assignment and assigned reviewer workflow are active in the exact
  catalog/category scope;
- request evidence, reference-image privacy/licensing, duplicate triage, audit, appeal,
  retention, and deletion policies are approved;
- one atomic authorized catalog mutation and rollback/correction boundary is proved; and
- request receipt and outcome UI demonstrate that submission creates no catalog or
  observation record.

Until then, a missing item produces an honest no-match state and no free-text report
escape that mutates the catalog.

## 12. Abuse and safety invariants

These invariants apply to every phase:

1. **No self-validation.** An actor, related account, business-control group, device,
   network cluster, or common upstream dataset cannot independently confirm itself.
2. **No popularity-to-truth edge.** Thank, Helpful, follow, profile view, star, comment,
   Wave, and message activity never enter Food confidence or scoped accuracy.
3. **No purchasable trust.** Payment, subscription, sponsorship, advertising, promotion,
   staff favour, or reward cannot create verification, reputation, a badge, role,
   confidence, rank, moderation approval, or impact.
4. **No transferable points.** Impact aggregates are non-transferable projections from
   governed events, not balances.
5. **Append-only outcomes.** Contribution, correction, moderation, reputation, badge,
   block, report, and appeal history changes through linked events, not silent rewrites.
6. **Block scope is explicit and fail-closed.** A community block denies community
   profile relationships, person-targeted structured actions, person follows,
   notifications, and any later community message path. ADR-016 Presence blocks remain
   separate, purpose-bound, and authoritative for Presence disclosure and Wave. The UI
   cannot promise “block everywhere” unless a later accepted cross-capability denial
   contract atomically coordinates both boundaries without sharing purpose roles. Safety
   staff access remains separately audited.
7. **Rate every mutation.** Account, anonymous subject, device, network, resource, and
   aggregate budgets are server-owned and concurrency-safe.
8. **Fail closed on ambiguity.** Unknown subject, policy version, lifecycle, scope,
   independence, moderation state, consent, provider, or environment produces no public
   assertion or interaction.
9. **Minimize public identity.** No stable Auth/source IDs, email/contact fallback, exact
   event timestamps, exact location, or Presence state reach public DTOs.
10. **Do not punish privacy.** Withdrawing a public profile, avatar, searchability,
    notification, Presence, or contact consent does not erase earned evidence or lower
    claim confidence; it only withdraws the relevant projection/capability.
11. **No silent resurrection.** Re-enabling a flag, provider, account, or consent does not
    restore expired follows, badges, Presence leases, blocks, or messaging threads.
12. **No dead service.** Schema, runtime, and UI for one capability ship as one wired
    vertical or do not ship.

Global stop conditions include a private identity leak, block bypass, unauthorized
message/contact, exact-location exposure, self-confirmation counted as independent,
pending/rejected evidence affecting a projection, payment changing trust, or a disabled
provider continuing to mutate state.

## 13. Analytics contract

Analytics measure whether the loop is understood and safe, not whether it is addictive.

### Allowed events

- `contribution_receipt_viewed`
- `contribution_receipt_state_changed`
- `contribution_outcome_explanation_opened`
- `structured_action_started`
- `structured_action_completed`
- `structured_action_denied`
- `correction_resolution_viewed`
- `trust_profile_consent_changed`
- `trust_profile_viewed`
- `badge_explanation_opened`
- `subject_follow_changed`
- `community_report_submitted`
- `block_created`

Required properties are enumerated reason/state codes, capability version, broad surface,
anonymous/signed-in class, and coarse performance timing. Events exclude raw names,
emails, contact values, Auth/source/profile IDs, free text, exact coordinates, precise
Presence data, external message/order identifiers, and full request payloads. Analytics
use a purpose-specific rotating identifier where deduplication is required.

### Decision metrics

- receipt-state comprehension;
- median admission-to-decision time;
- percentage received, approved, rejected, corrected, and independently confirmed;
- projection changes attributable to approved evidence;
- rate-limit, conflict, replay, and recovery outcomes;
- correction and appeal resolution time;
- structured-action report/block rate;
- badge explanation comprehension and false-generalization rate;
- public-profile consent withdrawal and cache-purge success;
- follow notification opt-out/complaint rate; and
- safety-response service level.

Follower count, message volume, streaks, daily active chatters, and raw submission volume
are not success metrics for trust and cannot become ranking inputs.

## 14. Exact future path proposals

These paths are proposals for later controller claims, not current ownership. A later
claim must take the complete vertical it activates and preserve concurrent work.

### V1 contribution receipt vertical

| Concern | Proposed path |
|---|---|
| Existing public action seam | `src/app/actions.ts` |
| Existing contribution runtime | `src/lib/contributions/runtime.ts` |
| Receipt/outcome validation types | `src/lib/validation.ts` |
| Existing contribution desired state | `src/db/pillars/40-contribution-integrity.sql` |
| Existing moderation desired state | `src/db/pillars/60-contribution-moderation.sql` |
| Existing contribution services/security | `src/db/pillars/80-contribution-services.sql`, `src/db/pillars/90-contribution-security.sql` |
| Receipt UI | new `src/app/_components/ContributionReceiptSheet.tsx` |
| Owner history integration | `src/app/_components/MyReportsSheet.tsx` |
| Report flow integration | `src/app/_components/ReportPriceSheet.tsx`, `src/app/page.tsx` |
| Visit flow only when ADR-019 expands to it | `src/app/_components/ConfirmVisitSheet.tsx`, `src/app/actions.ts` |
| Copy | `src/core/i18n/strings.ts` |
| Pure receipt presenter | new `src/lib/contributions/receipt.ts` |

No new route handler is justified: the live consumer is the existing app and Server
Actions are its port. The next release migration filename and Drizzle snapshot/journal
paths are assigned only after the controller proves the exact target ledger; this
document reserves no number.

The proposed action-level API names are:

- `getMyContributionReceipts()` and `getMyContributionReceipt(requestId)`;
- `getContributionReceiptOutcome(requestId)` for an owner-safe refresh;
- `submitObservationCorrection(input)` and `reportClaimConcern(input)` through the
  assigned ADR-019 content-moderation boundary; and
- the existing `submitObservation(input)` for initial ADR-019 admission.

Every owner read takes no account ID and resolves its subject server-side. Correction and
report inputs accept public/resource IDs only, never an actor ID, moderation state, impact
value, reputation weight, or badge.

### V1 review privacy containment

| Concern | Proposed path |
|---|---|
| Public review DTO/query | `src/app/actions.ts` |
| Review schema correction, if needed | `src/db/schema/reviews.ts` |
| Review presentation | `src/app/_components/GetItSheet.tsx` |
| Public DTO parser | `src/lib/validation.ts` |

The first correction removes `userId` and email fallback from the public DTO. It does not
reopen review writes or add Helpful.

### V1.5 complete review and Helpful vertical

Helpful remains review-domain data. It does not enter generic community interactions.
The single source of truth is a new append-only `review_helpful_events` ledger declared in
`src/db/schema/reviews.ts`. One database function derives the latest effective
signed-in-account/review state and the bounded ordering count. `markReviewHelpful` appends
an idempotent event; it never directly updates an aggregate.

Helpful cannot launch as a vote-only addition to the inherited ADR-009 tables. ADR-011
keeps that schema quarantined until one live vertical ships author identity,
duplicate-review/vote prevention, pending review write, attributable moderation, safe
read, Helpful write/ordering, and tests together. `submitReview` therefore remains
unavailable until this complete vertical is claimed and proved.

The future review write requires a recognized account and stores a non-null internal
author binding plus a data-minimized independence-group reference. Public review DTOs
still expose neither binding. A submission enters pending moderation; it never inherits
the schema's `approved` default. The server prevents the same actor from manufacturing
duplicate active reviews for the same governed subject under the versioned review policy.
Unrestricted comments, replies, mentions, and review media remain unavailable.

The inherited nullable `review_helpful_votes` table and
`review_aggregates.helpful_count` remain dormant and unread. The controller-assigned
review release migration retires them only after disposable upgrade/refutation proves no
live consumer and preserves any admissible history without treating anonymous nullable
rows as authentic votes.

Helpful eligibility also requires a current append-only moderation decision made after
the review-integrity boundary activates. The inherited
`reviews.moderation_status = 'approved'` text is not decision evidence and cannot make a
legacy row eligible. `review_moderation_decisions` becomes the attributable decision
ledger; the status column is a disposable projection. Legacy reviews remain
Helpful-ineligible unless an authorized reviewer reconciles each one under the new
policy, with actor, reason, evidence class, request ID, time, appeal path, and audit.
Rows with a null or otherwise unprovable internal author/independence group remain
Helpful-ineligible even after content review because self/related-party denial cannot be
proved.

| Concern | Proposed path |
|---|---|
| Helpful event declaration and inherited-table retirement | `src/db/schema/reviews.ts` |
| Review/helpful integrity desired state | new `src/db/pillars/52-review-integrity.sql` |
| Effective-state and ordering functions | new `src/db/pillars/72-review-services.sql` |
| RLS, purpose roles, grants, and default privileges | new `src/db/pillars/95-review-security.sql` |
| Server Action and public ordering read | `src/app/actions.ts` |
| Input/output validation | `src/lib/validation.ts` |
| Attributed review composer | new `src/app/_components/ReviewComposerSheet.tsx` |
| Assigned moderation queue | new `src/app/_components/ReviewModerationSheet.tsx` |
| Review/Helpful controls and ordered public list | `src/app/_components/GetItSheet.tsx` |
| Copy | `src/core/i18n/strings.ts` |

The proposed APIs are `submitReview(input)`, `getReviewsForEntity(type, id)`,
`moderateReview(input)`, and `markReviewHelpful(input)`, all owned by this complete
review-integrity vertical. Review/Helpful mutation requires recognition; anonymous
reading remains unchanged. The server resolves actor, subject, assignment, current review,
and independence evidence; rejects duplicate/self/related/replayed/out-of-scope/blocked/
unreconciled-legacy/no-current-decision actions; enforces rate/idempotency atomically; and
exposes no internal author or voter identity. The ordering function can reorder reviews
with a non-null internally attributable author and current attributable eligible decision
only. It cannot write
rating aggregates, observations, Food confidence, reputation, badges, impact, or seller
accuracy.

### V1.5 trust profile and structured community vertical

| Concern | Proposed path |
|---|---|
| Typed schema declarations | new `src/db/schema/communityTrust.ts`; export from `src/db/schema/index.ts` |
| Desired-state event/projection tables | new `src/db/pillars/50-community-trust.sql` |
| Single authoritative reputation/recognition projection functions | new `src/db/pillars/70-community-trust-services.sql` |
| RLS, grants, default privileges, and purpose roles | new `src/db/pillars/95-community-trust-security.sql` |
| Live Server Action port | `src/app/actions.ts` |
| Public DTO parser and explanation presenter; no policy calculation | new `src/lib/community-trust/presentation.ts` |
| Public profile route and metadata | new `src/app/community/[slug]/page.tsx` |
| Public-avatar projection/copy/purge | new `src/lib/community-trust/public-avatar.ts` |
| Public profile sheet | new `src/app/_components/CommunityTrustProfileSheet.tsx` |
| Owner-only Thank receipt | new `src/app/_components/ContributorWorkspaceSheet.tsx` |
| Profile consent management | `src/app/_components/ManageProfileSheet.tsx` |
| Structured action sheet | new `src/app/_components/CommunityActionSheet.tsx` |
| Existing surface entry links | `src/app/_components/GetItSheet.tsx`, `src/app/_components/MyReportsSheet.tsx`, `src/app/page.tsx` |
| Search indexing only for separately searchable profiles | `src/app/sitemap.ts`, `src/app/robots.ts` |
| Copy | `src/core/i18n/strings.ts` |

The proposed action-level API names are:

- `getCommunityTrustProfileBySlug(slug)`;
- `getCommunityTrustExplanation(publicProfileId, scope)`;
- `setMyCommunityProfileConsent(input)` and `pauseMyCommunityProfile()`;
- `thankCommunityProfile(publicProfileId)`;
- `getMyCommunityAcknowledgements()`;
- `blockCommunityProfile(publicProfileId)`; and
- `reportCommunitySubject(input)`.

No public action accepts an Auth ID, source ID, reputation value, badge state, count, or
moderation result. Reputation-event append and recognition recomputation are
database-owner operations invoked only by approved ADR-019 outcome transitions.
`src/lib/community-trust/presentation.ts` validates and presents their allowlisted DTO; it
contains no threshold, weight, sample, expiry, badge, or reputation calculation.
`src/lib/community-trust/public-avatar.ts` is called only from the profile-consent,
avatar-replacement, withdrawal, and account-lifecycle commands; it never returns the
owner-avatar key to a public caller.

`thankCommunityProfile` is wired only from
`src/app/_components/CommunityTrustProfileSheet.tsx` and the public profile route. Its
target is the random public profile ID resolved from the visible slug; it accepts and
returns no Auth ID, source ID, request ID, observation ID, receipt ID, contact, or location.
Self-Thank, blocked, paused, withdrawn, suspended, expired, replayed, and rate-limited
cases fail closed. The acknowledgement is private to the thanked profile owner and cannot
enumerate who else thanked them. `getMyCommunityAcknowledgements()` takes no account ID
and returns only the owner-safe activity count/state rendered in
`ContributorWorkspaceSheet`; it exposes no sender list and has no reputation, badge,
impact, ranking, or notification effect.

Link visibility and searchability remain separate profile-consent fields. The public route
returns not-found for paused, withdrawn, suspended, expired, unknown, or non-link-visible
profiles. It is dynamic and `no-store` until a later change independently proves
consent-safe cache invalidation; no stale public profile is an acceptable performance
trade. Sitemap inclusion requires current searchability consent and its owning mutation
revalidates the sitemap path. Withdrawal makes the route resolve not-found immediately
and triggers the documented search-engine removal process; WetinDey does not promise
instant deletion of a third-party search cache it cannot control. Neither the slug,
metadata, canonical URL, nor sitemap entry contains an Auth/source ID.

The `50/70/95` pillar names describe canonical desired-state ordering only. The controller
still assigns the next release migration number and exact Drizzle
`src/db/migrations/<number>_*`, `meta/<number>_snapshot.json`, journal, and manifest paths
after reconciling the applied lineage.

### Subject follow vertical

| Concern | Proposed path |
|---|---|
| Follow schema and RLS | extend the claimed community-trust schema/service/security pillar paths above |
| Server Action port | `src/app/actions.ts` |
| Owner list UI | new `src/app/_components/FollowedContextsSheet.tsx` |
| Area/place/item controls | `src/app/page.tsx`, `src/app/place/[slug]/page.tsx`, `src/app/_components/ItemDetailSheet.tsx` |
| Profile navigation entry | `src/app/_components/ProfileSheet.tsx` |
| Notification adapter | no path until one provider and one live consented vertical are accepted |

The proposed action-level API names are `followSubject(input)`, `unfollowSubject(input)`,
and `getMyFollowedSubjects()`. The discriminated `input` admits `area`, `place`, or `item`
only in V1.5; a `person` branch is absent until the V2 relationship decision.

There is no proposed messaging path. If messaging is ever accepted, its ADR must name the
complete schema, moderation, provider, API, RLS, UI, notification, retention, block,
report, and deletion vertical rather than inheriting these paths.

### Role-aware workspace boundaries

| Concern | Proposed path |
|---|---|
| Capability resolution port | `src/app/actions.ts` |
| Deny-by-default role resolution | new `src/lib/authorization/runtime.ts` |
| Capability/role workspace launcher | new `src/app/_components/TaskWorkspaceSheet.tsx` |
| Explorer entry | `src/app/page.tsx` |
| Contributor workspace | new `src/app/_components/ContributorWorkspaceSheet.tsx` |
| Seller owner workspace | new `src/app/_components/SellerOwnerWorkspaceSheet.tsx` |
| Seller manager workspace | new `src/app/_components/SellerManagerWorkspaceSheet.tsx` |
| Seller staff workspace | new `src/app/_components/SellerStaffWorkspaceSheet.tsx` |
| Moderator workspace | new `src/app/_components/ModeratorWorkspaceSheet.tsx` |
| Field Operator workspace | new `src/app/_components/FieldOperatorWorkspaceSheet.tsx` |
| Community Guide workspace | new `src/app/_components/CommunityGuideWorkspaceSheet.tsx` |
| Account navigation entry | `src/app/_components/ProfileSheet.tsx` |
| Copy | `src/core/i18n/strings.ts` |

The proposed API is `getMyTaskWorkspaces()`. Signed out, it may return only the anonymous
Explorer/Contributor capability entries. Signed in, it adds safe resource labels and
opaque scope references for current server-resolved assignments. It takes no account ID.
Each protected workspace calls task-specific Server Actions that independently resolve
the session and current assignment. A generic `performRoleAction`, client-supplied role,
or seller boolean is prohibited.

These paths are claimed only with the corresponding live task. Creating all workspace
files as empty shells would violate the no-dead-service rule.

### Catalog request and stewardship boundaries

| Concern | Proposed path |
|---|---|
| Request schema declarations | new `src/db/schema/catalogRequests.ts`; export from `src/db/schema/index.ts` |
| Request/audit desired state | new `src/db/pillars/55-catalog-stewardship.sql` |
| Request/triage functions | new `src/db/pillars/75-catalog-stewardship-services.sql` |
| Catalog request RLS and purpose roles | new `src/db/pillars/95-catalog-stewardship-security.sql` |
| Contributor request entry | new `src/app/_components/CatalogRequestSheet.tsx` |
| Owner request history | new `src/app/_components/MyCatalogRequestsSheet.tsx` |
| Authorized triage workspace | new `src/app/_components/CatalogTriageSheet.tsx` |
| Existing report-form handoff | `src/app/_components/ReportPriceSheet.tsx` |
| Server Action port | `src/app/actions.ts` |
| Request and triage validation | `src/lib/validation.ts` |
| Copy | `src/core/i18n/strings.ts` |

Proposed APIs are:

- `submitCatalogSubjectRequest(input)`;
- `getMyCatalogSubjectRequests()`;
- `getCatalogTriageQueue(input)` where `input` is pagination/filter only and the server
  resolves all current catalog/category scope from the session and assignments;
- `triageCatalogSubjectRequest(input)`; and
- existing catalog reads only after approval creates or links the canonical subject.

No API accepts a contributor-selected approval state, canonical ID, role, reviewer,
catalog mutation, image-publication decision, or observation payload. Triage and canonical
mutation are one authorized audited transaction; report admission remains a separate
later user action.

## 15. Future data and RLS contract

The proposed V1.5 data model uses typed relational tables, not a generic graph edge:

- `community_control` — default-off operations, generation, approved rate/retention
  values, and kill state;
- `community_profile_consents` — field/audience/searchability consent and lifecycle;
- `community_public_profiles` — disposable public projection keyed by random public ID;
- `reputation_events` — append-only independently evaluated outcome facts;
- `reputation_projections` — disposable scoped/policy-versioned sample and uncertainty;
- `recognition_projections` — disposable scoped badge lifecycle;
- `structured_interactions` — typed Thank acknowledgements only; Helpful remains in the
  authoritative review ledger, and Confirm/Correct remain observations under ADR-019;
- `community_safety_reports` — bounded target/reason/evidence lifecycle;
- `community_blocks` — actor-to-subject denial independent of Presence blocks but enforced
  across community resolvers; and
- `subject_follows` — typed area/place/item owner preference, with person excluded until
  V2 authorization.

Required constraints include discriminated subject/interaction types, no self-action where
meaningless, one active idempotency key per actor/operation, append-only event triggers,
valid lifecycle transitions, expiry ordering, policy-version references, no raw contact
or Auth ID in public projections, and unique owner/subject follow edges.

RLS and grants default to deny:

- public runtime can execute only safe public-profile and explanation resolvers;
- authenticated runtime resolves the actor from server session and can read/write only
  its own consent, blocks, follows, receipts, and permitted interactions;
- contribution owner functions append reputation events only from approved ADR-019
  outcomes, never from client calls;
- moderator functions operate only on assigned resources and append decisions;
- projection role writes disposable profile/reputation/recognition projections;
- safety role reads minimum report evidence and cannot edit reputation or claims;
- lifecycle role handles consent withdrawal, account deletion, and purge;
- table access is absent from application roles; exact `SECURITY DEFINER` functions pin
  `search_path`, validate purpose, and revoke PUBLIC execute; and
- Presence roles, leases, blocks, reports, capabilities, and snapshots remain inaccessible
  to community roles.

RLS is defence in depth. Every Server Action still validates subject, resource, action,
scope, lifecycle, consent, and environment before invoking one narrow database function.

Catalog Stewardship is a separate desired-state family. Its minimum typed records are:

- `catalog_stewardship_control` — default-off request/triage/mutation controls,
  generation, approved rate/retention values, and kill state;
- `catalog_change_requests` — immutable proposed subject/change, normalized digest,
  requester attribution class, assigned scope, idempotency subject/key, lifecycle, and
  private evidence reference;
- `catalog_change_decisions` — append-only triage/approval/rejection/needs-information/
  reversal decisions with actor, reason, independent-review evidence, and appeal link;
- `catalog_change_audit` — request, assignment, decision, canonical create/link,
  licensing, and rollback transitions; and
- existing canonical catalog tables, mutated only by the authorized approval function
  after collision/duplicate checks.

Catalog request runtime may append its own request and read only the current actor's safe
receipts. Catalog Steward runtime sees only currently assigned catalog/category scope.
Catalog owner functions perform canonical create/link; a reviewer cannot call them except
through the decision command, and a requester/related party cannot decide. Evidence-media
access is a separate minimized reviewer function. Public/catalog read roles see neither
requests, evidence, assignments, decisions, nor audit. Suspension, revocation, expiry,
appeal, and the catalog kill control are checked by every request/triage/mutation command.

## 16. Acceptance and refutation evidence

Every implementation phase defaults to **REFUTED** unless independent evidence proves:

### Product truth

- receipt copy distinguishes intent, received, reviewed, used, changed, and independently
  confirmed;
- public profiles distinguish identity presentation, scoped reputation, recognition, and
  claim confidence;
- badges expose scope/window/sample/uncertainty/expiry and never read as universal trust;
- impact counts cannot be mistaken for points, money, rank, or reward balance;
- reviews, Helpful, Thank, follows, and messages cannot affect live observations; and
- V1 contains no follower-count or messaging promise.

### Security and privacy

- every public DTO is allowlisted and excludes Auth/source IDs, email/contact, precise
  location/timestamps, Presence, internal scores, and private moderation;
- serialized profile HTML/JSON, metadata, image URLs, browser asset requests, CDN/Blob
  keys, redirects, errors, and cache records contain no owner `avatars/{userId}.` URL or
  stable Auth/source ID;
- public-avatar copy/re-encode, replacement, consent withdrawal, profile pause, account
  deletion, exact-prefix purge, and failed-copy rollback are driven without orphaned
  public projection objects;
- cross-account, signed-out, blocked, revoked, suspended, expired, stale-session, and
  reused-tab cases fail closed;
- consent withdrawal purges public projections and caches without deleting underlying
  governed evidence;
- account deletion follows ADR-021 and cannot silently orphan a public profile;
- logs, analytics, URLs, errors, and notifications contain no prohibited data; and
- purpose roles cannot set role into, query, or invoke Presence boundaries;
- Explorer/Contributor capability flows remain anonymous-first, while every protected
  seller/moderator/operator/guide/steward workspace resolves current server-owned scope;
- client workspace selection, Auth metadata, a seller boolean, or another account's
  opaque scope reference grants no protected read or mutation;
- Catalog Steward claimants, contributors, sellers, related parties, and original
  reviewers cannot approve their own catalog requests or appeals; and
- private catalog evidence and request imagery never reach public catalog/profile DTOs,
  caches, logs, analytics, or unauthorized workspaces.

### Integrity and abuse

- retries, races, same-key/different-payload, related accounts, self-action, brigades, and
  provider failure cannot duplicate or manufacture impact;
- only approved independently evaluated outcomes append reputation events;
- no client, moderator, seller, payment process, or profile editor can directly set a
  reputation projection or badge;
- reversals and corrections append compensating events and deterministically recompute;
- Thank/Helpful/follows have zero trust edge under static and runtime inspection;
- sequential/concurrent Helpful replay, same-key conflict, duplicate account vote,
  anonymous mutation, self/related-party vote, unapproved/hidden review, block, rate
  limit, withdrawal, reversal, and moderation-transition cases produce one effective
  ordering state and no trust/reputation/observation effect;
- sequential/concurrent review submission, duplicate active review, pending admission,
  moderator self/related review, decision reversal, appeal, hidden/rejected public read,
  null/legacy author, and independence-unknown cases prove the complete attributed review
  vertical; no new review inherits `approved`;
- static and runtime inspection finds no read or write of inherited
  `review_helpful_votes` or `review_aggregates.helpful_count`; only the append-only
  Helpful ledger and its database effective-state function drive review ordering;
- block and report behavior survives cache, other tabs/devices, and provider failure;
- kill/disable controls stop mutations without disabling anonymous Food reading;
- duplicate catalog requests, concurrent equivalent approvals, and pre-existing canonical
  collisions resolve deterministically without duplicate item/alias/variant/unit/category
  records;
- same-key catalog request replay returns one stable receipt, while same-key/different
  payload creates no request, catalog, audit, or observation effect beyond a protected
  conflict event;
- request submitters and triagers cannot self-approve, widen assigned scope, publish
  reference imagery, or bypass independent appeal;
- catalog approval create/link, provenance/licensing decision, and audit transition
  commit together or roll back together; the request never mutates into an observation;
  and
- catalog request admission, triage, and mutation can be disabled independently without
  disabling existing catalog reads or ADR-019 reports against existing subjects.

### Database and release

- blank reconstruction and existing-parent upgrade produce the same desired state;
- exact prior migration bytes and ledger evidence remain immutable;
- injected failure rolls back event, projection, audit, rate, and idempotency effects;
- RLS/grant/default-privilege matrices deny wrong-role and direct-table access;
- catalog request blank/upgrade reconstruction, duplicate races, wrong-role, cross-scope
  queue, stale assignment, suspension, revocation, expiry, appeal, and media-private cases
  pass in a disposable target;
- disposable-environment tests prove append-only history and deterministic projections;
- the release migration number is controller-assigned after target lineage proof; and
- no schema presence is treated as activation, provider readiness, or deployment proof.

### UI and accessibility

- anonymous, signed-in, sparse, expired, blocked, withdrawn, loading, empty, error,
  offline, rate-limited, replayed, pending, approved, rejected, corrected, and appealed
  states are driven;
- screen-reader names, focus order, 44px targets, list equivalents, reduced motion,
  grayscale, forced colors, zoom, and dynamic type are independently verified;
- compact/regular layouts, light/dark mode, reused tabs, session replacement, and
  back/forward presentation are refuted; and
- comprehension research shows users do not infer current-claim truth, identity
  verification, safety, proximity, or payment entitlement from profiles or badges.

Build, lint, generated SQL, screenshots without interaction, self-review, and row counts
are supporting checks only. They are not sufficient acceptance evidence.

## 17. Decisive sequencing

1. Keep reporting, visit confirmation, review writes, public profiles, follows, and
   messaging contained until their exact prerequisites pass.
2. First make the ADR-019 receipt and correction loop truthful end to end.
3. Correct the current public review identity leak independently; do not wait for social
   features.
4. Accept ADR-011 and calibrate real outcomes before public reputation or badges.
5. Add optional public profiles and structured actions before any person relationship.
6. Add private area/place/item follows before considering person follows.
7. Deliver each protected role workspace only with ADR-022 P1 authorization and its one
   complete assigned task; Explorer and Contributor remain anonymous-first capabilities.
8. Keep item-not-found requests contained until a new Catalog Stewardship decision,
   independently granted steward workflow, private evidence policy, atomic catalog
   mutation, and default-refuted proofs pass.
9. Treat direct messaging as a separate high-risk product requiring a new accepted ADR,
   not the inevitable end of Presence or community profiles.

The product wins when a contributor can see truthful, bounded evidence that their
approved contribution helped a local decision—and when a reader can inspect why—without
WetinDey manufacturing a social popularity score or an unsafe contact network.
