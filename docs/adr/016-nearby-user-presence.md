# ADR-016: Privacy-safe nearby-user presence pilot

**Date:** 2026-07-17
**Status:** Proposed
**Decision owner:** WetinDey owner
**Scope:** Consent, location minimization, reciprocal discovery, safety, authorization,
migration ordering, and rollout gates for a nearby-user presence pilot

## Context

WetinDey may help a person see that other consenting people recently shared an approximate
area nearby. That can support local awareness, but a conventional people map would also
create a stalking, enumeration, profiling, and unwanted-contact surface. An account
preference is not enough to make that surface safe.

The current implementation boundary must be stated without ambiguity:

- `locationSharing` is a consent preference boolean only. It is not an active presence
  lease, a location publication, or proof that another user can see anyone.
- The current UI claim that enabling this preference makes the user visible to "verified
  contributors" or other nearby people is not implemented. There is no complete reciprocal
  presence query, expiring publication, sanitized people projection, block/report
  boundary, or other-user marker path behind that claim.
- The current persisted `locationStore`, including the browser key
  `wetindey.location.v1`, is an owner-location convenience path. It is not presence
  consent, a safe activation source, or a presence-publication boundary.
- This ADR does not make the current UI claim true and does not authorize it to remain
  unqualified while the capability is absent.

ADR-011 is Proposed and is not controlling authority. This ADR independently adopts only
the explicitly enumerated separation and non-purchasability constraints below. Acceptance
of ADR-016 would not accept ADR-011's broader Trust Graph architecture.

ADR-014 preserves applied migration lineage and requires unapplied migration defects to be
folded into the same release before its first shared application. `0010` remains the
unapplied release that must be repaired and finalized before a presence release can be
based on it.

This ADR proposes a deliberately narrow pilot. While its status is Proposed, it authorizes
no schema, migration, Server Action, UI, map, storage, role, RLS, or deployment change.

## Proposed decision

If accepted, WetinDey may implement a limited **nearby-user presence** pilot. Presence means
only that an authenticated person self-asserted one location and explicitly chose to
publish its coarse, short-lived approximation to reciprocal recent sharers. It does not
mean the person is available for contact, is online, is currently at that area, knows
another user, or endorses a place or claim.

The pilot is governed by these non-negotiable limits:

| Control | Required boundary |
|---|---|
| Activation | Explicit foreground consent for each presence lease |
| Spatial precision | One server-computed centroid of a fixed 500 m cell |
| Lifetime | At most 15 minutes, with no automatic renewal |
| Visibility | Both viewer and subject have active, unexpired opt-in leases |
| Viewer center | Derived by the server from the viewer's active coarse lease |
| Search extent | At most 5 km from that server-derived center |
| Result extent | At most 50 per response and 50 distinct subjects per account per rolling day, with stricter aggregate device/network budgets |
| Projection | Opaque, allowlisted marker data only |
| Safety | Bidirectional block effect and private report available at launch |
| Storage | Current lease only; no location history or offline people cache |
| Authorization | RLS plus proved least-privileged runtime access before rollout |

General local-information browsing remains anonymous. The sensitive nearby-person
projection is not a general public projection: it requires an authenticated viewer with a
current reciprocal lease so blocks, reports, expiry, and abuse controls have an accountable
principal.

The marker is self-asserted and may be false. WetinDey does not verify that a device or
person was physically at the submitted coordinate. Even an honestly submitted marker can
be stale because the person may move immediately after activation and no heartbeat follows.
The approved meaning is only **"this account recently shared this approximate area"** within
the unexpired lease. It is never "active nearby", "online now", "verified nearby", or "at
this location".

## Independently adopted trust constraints

Without relying on Proposed ADR-011, ADR-016 adopts only these constraints:

- presence, identity continuity, identity verification, authorization role, lifecycle
  status, reputation, claim confidence, earned recognition, and rewards are separate;
- a self-asserted coordinate and an unexpired presence lease prove neither identity,
  physical location, truthfulness, expertise, safety, nor current availability;
- presence, reports, blocks, avatars, and presence frequency cannot raise or lower
  reputation, claim confidence, verification, ranking, status, or reward eligibility;
- an avatar is presentation and possible identity disclosure, not verification or trust;
  and
- payment, advertising, sponsorship, subscription, reward participation, or commercial
  relationship cannot buy presence priority, visibility, verification, reputation,
  confidence, status, or a badge.

No other concept, data model, phase, or architecture from ADR-011 is adopted by reference.

## Consent and lease lifecycle

`locationSharing` is necessary consent preference state, but it is never sufficient to
publish presence. Setting it to `true`, signing in, opening the app, restoring a session,
returning to the foreground, or granting operating-system location permission must not
start or renew a lease.

Before launch, the current "verified contributors" visibility control and claim must be
disabled or removed, not left as prospective copy. The eventual complete vertical must
describe the audience as **reciprocal recent sharers**, never "the public", "nearby
people", "active users", or "verified contributors". In the same vertical, comments,
schemas, actions, and UI copy that imply `locationSharing` itself publishes a location or
that the audience is verified must be corrected.

Each lease requires a clear foreground action that states:

- that a recently shared approximate-area marker will be visible only to reciprocal recent
  sharers whose leases are also unexpired;
- that the marker represents an approximate 500 m cell centroid, not an exact position;
- that visibility lasts no longer than 15 minutes;
- that the location is self-asserted, may be forged, and may become stale during the
  lease;
- whether a sanitized avatar will be shown; and
- how to stop sharing, block someone, or report a marker.

Consent must be fresh for every lease. A lease cannot auto-renew, silently heartbeat,
restart after process launch, or continue through a background task. Renewal requires
another user gesture and the same disclosure.

Presence activation has a dedicated transient input path segregated from the existing
persisted `locationStore`. It must neither source an activation coordinate from nor write
an activation coordinate, coarse centroid, lease, marker token, avatar reference, or
people projection to `locationStore`, `wetindey.location.v1`, or any replacement
owner-location persistence key.

The raw device coordinate may exist only transiently in the foreground activation call's
browser memory, encrypted transport, and server request memory long enough to derive the
fixed 500 m cell centroid. It must never enter local storage, session storage, IndexedDB,
Cache Storage, service-worker state, persisted React/store state, browser telemetry,
crash reports, server or application logs, infrastructure or edge logs, analytics,
traces, error payloads, caches, queues, reports, or database rows. Request URLs and query
strings must never carry it.

Only one current lease may exist for a user. The durable presence state contains the
minimum internal principal reference, coarse centroid, expiry, revocation state if needed
for an atomic stop, and separately recorded avatar-display consent. It contains no
`last_seen`, heartbeat trail, route, previous cell, or movement history.

A successful stop action, changing `locationSharing` to `false`, account suspension,
account deletion, or kill-switch activation must revoke the affected lease before the
server reports success. Expiry is authoritative at 15 minutes even if cleanup is delayed.
Revoked and expired rows are ineligible for every new read and are purged rather than
archived as presence history.

For a stop, preference withdrawal, suspension, deletion, or kill-switch operation initiated
from the current client, that client clears the **entire people snapshot** before it renders
or reports success. Clearing includes the coarse own marker, every other marker, avatars,
object URLs, display tokens, block/report capabilities, result arrays, disclosure metadata,
and response deadlines. Clearing only the initiating user's marker is insufficient.

Other browser tabs, devices, and sessions are bounded by server revocation plus their next
response or existing snapshot deadline. Their next read must fail closed and clear the
entire snapshot. Because realtime delivery is explicitly out of scope, WetinDey must not
claim that it can remotely erase an already rendered snapshot before that next response or
deadline. This rule applies separately to stop, preference withdrawal, suspension,
deletion, and kill-switch activation; none may rely only on eventual 15-minute expiry.

People responses are short-lived, in-memory, `no-store` snapshots with a server-controlled
response-level display deadline. For every non-empty response, that deadline and every
transient browser, application, edge, or server cache lifetime must be no later than the
earliest included subject lease expiry or the viewer lease expiry, whichever comes first.
There is no stale-while-revalidate or grace period. Responses expose no per-person timestamp
and must disappear when that deadline, lease expiry, sign-out, session replacement, stop,
preference withdrawal, suspension, deletion, kill-switch activation, or offline transition
occurs.

## Coarse presence and reciprocal discovery

The server uses one documented, fixed 500 m spatial grid and publishes only the centroid of
the containing cell. It must not return the input coordinate, choose per-viewer jitter, or
return enough alternate representations to average back toward the input. Repeated reads
of one lease expose the same coarse centroid until a separately consented lease replaces
it.

The coordinate remains self-asserted after coarsening. Coarsening reduces precision; it
does not authenticate the coordinate or prove proximity. A marker can be intentionally
forged or honestly stale anywhere within its lease, so discovery and UI copy must preserve
the "recently shared approximate area" meaning at every surface.

A nearby query succeeds only when the authenticated viewer has an active, unexpired lease.
The server derives the query center from that viewer's stored coarse centroid. A client
must not supply or override the center with a device coordinate, map center, viewport,
place, marker, URL parameter, or another user's identifier.

A subject is eligible only when all of the following are true:

- the subject has a distinct active, unexpired lease;
- the viewer also has an active, unexpired lease;
- both remain opted in at query time;
- neither user has blocked the other;
- the subject's coarse centroid is no more than 5 km from the viewer's server-derived
  coarse centroid; and
- the subject survives the server's abuse controls and fixed result cap.

The server returns no more than 50 subjects in one response. More importantly, it enforces
rolling aggregate disclosure budgets across replacement leases, sessions, and accounts:

- one authenticated account may receive at most 50 distinct subject principals in a
  rolling 24-hour window;
- one short-lived privacy-reviewed device abuse key may receive at most 75 distinct subject
  principals across accounts in a rolling 24-hour window; and
- one privacy-reviewed network abuse bucket may receive at most 100 distinct subject
  principals across accounts and devices in a rolling 24-hour window.

The lowest remaining applicable budget controls each response. Re-reading a previously
disclosed subject does not consume another distinct-subject unit, but it never produces a
stable public token. Replacement leases, sign-out, session replacement, account switching,
browser restart, and map movement do not reset the rolling budgets.

Cell movement has separate aggregate limits. In a rolling 24-hour window, an account may
activate from at most two distinct 500 m cells, a device abuse key from at most three, and
a network abuse bucket from at most six. Renewing in an already counted cell is permitted
within the activation-rate limits. This prevents twelve allowed activations from becoming
twelve forged centers with up to fifty new disclosures each.

The client cannot raise the 5 km or 50-subject response maximum, exceed any aggregate
disclosure or cell budget, request a total count, paginate through the remainder, replace
results to reveal the hidden remainder, sweep arbitrary centers, or use marker lookup to
enumerate users outside the bounded query.

Activation and nearby reads have separate server-enforced rate limits with no unlimited
fallback. Pilot maxima are four activations per account per rolling hour and twelve per
rolling 24 hours, plus twelve nearby reads per viewer per rolling 15 minutes and forty-eight
per rolling hour. Coordinated limits also apply to the authenticated session and a
privacy-reviewed, short-lived device/network abuse key so a new session or Sybil account
does not trivially reset every budget. The server may tighten these maxima. Loosening them
requires recorded owner and privacy review.

The rolling 24-hour anti-enumeration budget requires a narrowly defined exception to the
general no-history rule. It is **minimal privacy-limited abuse state**, not presence or
movement history. The state may contain only:

- scalar activation, read, strike, and distinct-disclosure counts;
- keyed HMAC membership for the already-coarsened 500 m cells needed to enforce the
  two/three/six-cell limits; and
- keyed HMAC membership for disclosed internal subject principals needed to enforce the
  50/75/100 distinct-subject limits.

Each membership value is pseudonymized with a scope- and window-specific secret. The state
contains no raw coordinate, centroid, user-facing marker token, cell order, visit order,
path, per-event timestamp, dwell time, or query result. Storage TTL metadata may enforce
expiry but is not exposed to application/runtime readers and cannot be used to reconstruct
a sequence. Membership cannot be queried for product, analytics, support, trust,
moderation, ranking, or people discovery.

Every abuse-state entry and window secret is hard-purged no later than 24 hours after its
admission. Destroying the secret makes any residual HMAC value unusable. The state is
excluded from logical exports and application backups; any provider restore remains
quarantined until restored abuse state is dropped and fresh secrets are issued. Only the
dedicated budget-enforcement role can test membership or update counters. Application
runtime receives only allow/deny and remaining-capacity classes, while operators receive
aggregate health metrics that cannot identify an account, device, network, cell, or
subject.

Outside this exact 24-hour enforcement exception, the no-presence-history and
no-movement-history rules remain absolute. Failures are generic and reveal neither which
limit fired nor whether another person exists. Authentication, reciprocity, and rate
limits reduce abuse but do not prove physical location or eliminate Sybil accounts; the
pilot must state that residual risk rather than market the map as verified proximity.

An **attempted overage** is safe only when the server denies it before any additional
subject is disclosed. The first attempted account, device, or network activation, cell,
read, or disclosure overage returns a generic denial and records one pseudonymous strike;
it does not trigger the global kill switch. Three denied budget-reset or cell-sweep
attempts by one account in a rolling 24 hours disable presence for that account until the
window expires. Three contained accounts on one device abuse key, or ten on one network
bucket in a rolling hour, disable presence for that device or network scope for 24 hours
and open a safety alert.

An **actual disclosed overflow** is different: at least one response reached a client with
more than 50 subjects or caused an account/device/network rolling distinct-subject budget
to exceed 50/75/100. It is a privacy invariant breach, not an attempted overage or account
strike.

The pilot has zero-tolerance automatic global kill thresholds. Any one confirmed instance
of a raw activation coordinate entering prohibited storage or observability, an
unauthorized or cross-viewer disclosure, a result outside 5 km, a response over 50, an
actual disclosed account/device/network aggregate overflow, an RLS bypass, a display token
accepted by an action endpoint, a wrong-purpose capability accepted, a revoked/expired
lease returned by a new read, a live row missing its purge deadline, a new avatar fetch
succeeding after withdrawal/expiry, or avatar bytes remaining in browser, service-worker,
edge, or other cache after the governing snapshot deadline automatically disables nearby
presence and revokes all leases. In-memory avatar bytes already rendered on a remote client
before that deadline are not by themselves a kill event. A global kill event is an
automatic rollout NO-GO until root cause, containment, purge, counsel/owner review, and
independent adversarial re-acceptance are complete.

Distance and ordering must be described as approximate because they operate on coarse
centroids. The projection must not claim an exact distance or exact current position.

## Sanitized opaque marker projection

Nearby reads use a positive allowlist rather than serializing a user, profile, presence, or
authentication row. The complete subject projection is:

- a short-lived display-only opaque marker token that is not a user ID, profile ID, source
  ID, action credential, or stable cross-lease identifier;
- a marker kind identifying it only as another recent approximate-area sharer;
- the 500 m cell centroid needed to place the approximate marker; and
- an optional short-lived sanitized avatar asset reference when that subject separately
  consented to identity disclosure through an avatar.

When block or report controls are rendered, the projection may also contain two separate
opaque action capabilities: one for block and one for report. They are not identifiers and
contain no client-readable subject, viewer, coordinate, or lease payload.

The projection must not contain or make resolvable:

- email, name, initials, username, profile slug, contact details, or public profile link;
- authentication, profile, source, seller, contributor, device, session, or lease IDs;
- the unrounded coordinate, an alternate coordinate encoding, route, heading, speed, or
  movement;
- exact last-seen, activation, heartbeat, update, or per-person expiry time;
- exact distance, hidden result counts, or presence history;
- user type, authorization role, verification state, reputation, confidence, badge, or
  contribution history; or
- block state, report state, moderation state, fraud state, or the identity of a reporter.

Display marker tokens expire with the snapshot or lease, whichever comes first. They are
presentation handles only and are never accepted by block, report, profile, lookup, or any
other state-changing or identity-resolving endpoint. The block endpoint accepts only a
block capability; the report endpoint accepts only a report capability. Each endpoint
rejects the display token, the other action's capability, and every unknown field before
subject resolution. Adding a projection field requires a privacy review and an accepted
amendment to this ADR.

## Marker-token and action-capability security

Marker tokens and block/report capabilities must be cryptographically unpredictable and
tamper-resistant. They use at least 128 bits of cryptographic entropy or an equivalently
reviewed opaque server-side mapping; sequential IDs, encoded database IDs, unsigned
payloads, and guessable hashes are forbidden.

Every token or capability is bound to the authenticated viewer, viewer session, response
snapshot, subject lease, expiry, and exact purpose. It is non-transferable to another
account, session, snapshot, browser, or action. A display token has only a display purpose.
Block and report use distinct purpose-bound capabilities, so a report capability cannot
block and a block capability cannot report.

State-changing capabilities are single-use or equivalently idempotent. Exact replay,
concurrent replay, payload mutation, action swap, expired use, cross-viewer transfer, and
cross-snapshot transfer produce one generic unavailable/already-processed response without
revealing which binding failed. A report replay or retry creates no duplicate report, and
a block replay creates no additional relationship or notification.

Tokens and capabilities must not appear in URLs, referrers, analytics, traces, logs, error
payloads, notifications, browser persistence, or support tooling. Revocation, stop,
expiry, sign-out, session replacement, block, kill switch, and restore invalidate every
affected capability.

## Avatar consent and fallback

Presence consent does not imply avatar consent. Avatar display is a separate, explicit
identity-disclosure choice for each lease and defaults to off. Consent copy must say that a
recognizable image can identify the person and can be correlated with their WetinDey
account, other appearances of the same image, and external services. Metadata removal does
not make a recognizable face or image anonymous.

When avatar consent is absent, revoked, invalid, or cannot be proved, the marker uses a
generic person glyph. It must not synthesize initials, use a profile name, or infer an
image from another account surface.

When avatar consent is present, the projection may reference only a controlled, sanitized
thumbnail with metadata removed. It must not expose an arbitrary remote image URL, original
upload path, filename, EXIF data, or storage-owner identifier.

Avatar withdrawal immediately revokes every future thumbnail fetch at the server. The
initiating client revokes object URLs, clears decoded/in-memory thumbnail bytes, and
switches every affected marker to the generic glyph before reporting withdrawal success.
Other tabs, devices, and viewers may already have rendered in-memory bytes; without
realtime invalidation, they clear those bytes on their next people response or no later
than the earliest governing snapshot deadline. Every subsequent fetch fails generically.

Every avatar reference is cryptographically unguessable, non-transferable, and bound to
the authenticated viewer, viewer session, response snapshot, subject lease, and earliest
applicable expiry. It cannot be reused as a stable profile image URL or fetched by another
viewer.

The thumbnail response is an authenticated private response with
`Cache-Control: private, no-store, max-age=0` and equivalent anti-caching headers. It
bypasses the service worker, CDN/edge cache, browser Cache Storage, prefetching, image
optimization caches, and any shared or persistent browser cache. The client may hold the
decoded image only in memory for the current snapshot; any object URL is revoked when the
snapshot clears. Expiry or avatar withdrawal invalidates the reference immediately at the
server. No remote in-memory copy may survive its next people response or earliest snapshot
deadline.

The generic glyph is the only approved visual choice for a user seeking an
anonymity-preserving marker presentation, although timing and cell context can still create
residual linkability. A recognizable avatar is explicitly identifying and remains
correlatable despite sanitization. An avatar is presentation, not identity verification,
reputation, status, or evidence that the person is at the marker centroid.

## Block and private report safety boundary

Blocking is directional as a user action but bidirectional in discovery effect. If A blocks
B or B blocks A, neither may receive the other's presence marker. The filter applies before
distance calculation results, ordering, counts, and the 50-result cap so those outputs do
not leak a blocked person's presence.

A block takes effect at the same authoritative boundary as stop, is not announced to the
blocked person, and cannot be inferred from a special empty-state or error. A user manages
only blocks they initiated; the other side cannot read the block row or blocker identity.

Every other-person marker must offer a private report path. The client submits only the
purpose-bound report capability and one server-defined structured reason code. Pilot
reports accept no free-form title, body, notes, attachment, screenshot, media, custom
metadata, or unknown field, so a reporter cannot type or upload a coordinate for retention.
The endpoint rejects values outside the versioned reason-code allowlist before target
resolution. The server resolves the target internally, idempotently prevents duplicate
reports, does not add a raw or coarse location snapshot to the report, and does not expose
the reporter or report to the subject or public.

Reports are readable only by a separately authorized safety role under an approved
retention and response procedure. An unreviewed report must not create a reputation event,
badge change, confidence change, public count, or automatic public accusation. Reporting
and blocking are available independently so immediate personal safety does not wait for
moderation.

## Own-marker and other-marker semantics

The map must distinguish the signed-in person's own location from every other-person
marker in data source, visuals, interaction, and accessible copy.

The pilot renders the own marker only at the same server-derived 500 m cell centroid used
for reciprocal discovery. It does not render a precise own marker, read one from
`locationStore`, or keep a parallel precise fix while the people layer is open. Its label
is **"Your recently shared approximate area"**, and its lifetime is the shorter of the
viewer lease and current snapshot. Stop, preference withdrawal, suspension, deletion,
kill-switch activation, sign-out, session replacement, offline transition, or deadline
clears it with the entire people snapshot.

An other-person marker is anchored only to the coarse centroid. Its visual treatment and
accessible label must communicate **"recently shared approximate area"**, not "active
nearby", "online", "verified nearby", or "here now". It must be materially different from
the own marker and from place, seller, offer, or verification markers. Optional avatars do
not remove the approximate-area or self-asserted treatment.

The map must not reuse an existing precise owner-location marker object and merely change
its icon, because that risks passing a persisted or fresh precise coordinate into the
people layer.

## Data minimization and explicit exclusions

The pilot has no background geolocation, `watchPosition`, service-worker location work,
silent foreground refresh, continuous coordinate update, or operating-system background
permission. Location is requested once per explicit activation or renewal.

People projections are never written to IndexedDB, Cache Storage, local storage, the PWA
offline cache, analytics replay, notification payloads, or persisted client state. When
offline, the app hides people markers and reports that nearby people are unavailable; it
does not render stale cached people.

Except for the strictly bounded 24-hour pseudonymous anti-enumeration state defined above,
the pilot creates no:

- location or movement history;
- realtime stream, websocket, subscription, or live-tracking channel;
- friend, follow, favorite-person, contact-book, or social-graph feature;
- direct message, group message, notification, presence ping, or contact exchange;
- public profile discovery from a marker;
- seller, contributor, shopper, moderator, or partner marker classification;
- reputation, verification, status, trust, reward, or activity badge;
- leaderboard, popularity count, or "people viewed you" metric; or
- fulfilment, dispatch, meetup coordination, route sharing, or safety guarantee.

These exclusions cannot be added as "small extensions" to the pilot. Each changes the
threat model and requires a separate accepted ADR.

## Purge, backup, erasure, operator, notice, and incident gates

Authoritative read exclusion is immediate. Physical live-row deletion has a hard deadline
of 15 minutes after lease expiry, stop, preference withdrawal, account suspension, account
deletion, or kill-switch activation. A monitored purge job and alert prove that deadline;
cleanup delay never extends read eligibility.

Anti-enumeration state has the stricter separate rule defined above: each entry and its
window secret expire within 24 hours, the state is unavailable to ordinary runtime and
operators, it is excluded from logical/application backups, and it is discarded rather
than restored. The 30-day provider-backup allowance below does not authorize retaining a
usable abuse-state secret or restoring abuse counters.

Backups or provider restore points that can contain presence rows have an absolute maximum
retention of 30 days and must be encrypted, access-controlled, inventoried, and deleted at
expiry. A restored environment remains quarantined from application traffic until all
presence leases and all presence-scoped marker/avatar/action capabilities are deleted,
regardless of the timestamps captured in the backup. Block and report data may be restored
only under their approved retention policies. Restore filtering and capability
invalidation must be exercised before the pilot.

Account erasure deletes the current lease, presence-scoped avatar references, capability
state, rate-limit/disclosure state that remains account-linkable, and every non-required
presence linkage. Block and report records follow separately approved safety/legal
retention and erasure rules, but they never retain a coordinate. The owner must approve and
exercise the erasure procedure before pilot traffic.

Routine operators have no people browser, raw-table console, export, support lookup, or
analytics join for presence. Exceptional access is named, least-privileged, time-bounded,
multi-factor protected, reason-coded, approved, alerted, and audited without copying
coordinates or tokens into the audit trail. The exact operator list, access path, review
cadence, and revocation procedure are pre-pilot evidence.

A location-data incident plan must cover suspected coordinate logging, projection leakage,
token compromise, unauthorized operator access, backup exposure, enumeration, and safety
abuse. It must exercise kill switch, lease purge, token/key invalidation, evidence
preservation without expanding location retention, containment, counsel escalation, user
notice decision, regulator notice decision, and safe restart criteria.

Before the pilot, qualified counsel must review the user-facing consent/privacy notice,
avatar linkability disclosure, self-asserted and stale-within-lease semantics, retention
and backup limits, block/report handling, account erasure, operator access, and incident
notification obligations. "Counsel review later" and provider-default retention are
NO-GO.

## RLS and least-privileged runtime proof

Server-side filtering alone is not sufficient for this feature. Presence, block, and
report storage must launch with row-level security, explicit grants and revocations, and a
least-privileged runtime role. RLS is part of the first presence migration, not deferred
hardening.

The database boundary must ensure:

- a user can create, replace, stop, or inspect only their own current lease;
- a user can create and manage only blocks they initiated;
- a user can submit their own report but cannot read report rows through the application
  role;
- no user or ordinary runtime query can select base presence rows or join them to auth,
  profile, source, or contact data;
- the nearby read contract applies reciprocity, expiry, block, 5 km, and 50-result limits
  inside the protected server/database boundary;
- authenticated identity comes from the verified server session, never a client-supplied
  user ID;
- the safety reader is separate from the application runtime role; and
- migration ownership, application runtime, cleanup, and safety review do not share one
  unrestricted role.

Before any pilot traffic, exact-target evidence must prove that the runtime role is not a
superuser, does not own the protected tables, cannot bypass RLS, has no direct base-table
read grant, and can execute only the reviewed narrow contracts. Protected tables must use
forced RLS or an equivalently proved arrangement that remains effective for every runtime
path.

The proof includes the target role identity, role attributes, ownership, grants,
revocations, policies, function/view privileges, normalized RLS/grant fingerprint, and
negative queries executed as the actual runtime role. A schema declaration, generated SQL,
clean build, or test under the migration-owner role is not proof.

## Migration ordering

ADR-014 controls the release lineage.

- Applied `0000` through `0008` remain byte-for-byte immutable.
- Any defect in unapplied `0010` is folded into regenerated `0010` SQL, snapshot, journal,
  manifest, and checksums under one exclusive schema lane.
- No presence SQL, snapshot, journal entry, or placeholder is added to `0010`; presence is
  not a repair to ingestion.
- The first presence release is `0011`, generated only after repaired `0010` has a fixed,
  independently validated result fingerprint.
- `0011` uses that exact repaired `0010` result as its parent. It includes presence, block,
  report, cleanup, RLS, policies, roles/grants, and bounded read contracts as one reviewed
  security boundary.
- A target cannot receive `0011` until that exact target is authorized and proved to have
  applied the repaired `0010` lineage.
- If `0011` is still unapplied when review finds a defect, the defect is folded back into
  regenerated `0011`; it does not create `0012`.
- After first shared application, `0011` is immutable and any defect repairs forward under
  ADR-014.

This ordering supersedes any older lane note that named an earlier migration number for a
profile-only sharing flag.

## Pilot rollout gates

Acceptance of this ADR would permit implementation work, not rollout. Pilot traffic remains
blocked until all of the following have primary evidence and independent refutation:

- the owner has accepted this ADR and approved the exact consent and approximate-location
  copy;
- the current false "verified contributors" control and visibility claim are disabled or
  removed until the complete vertical launches, and the launched audience copy says
  "reciprocal recent sharers";
- misleading implementation comments that equate `locationSharing` with publication,
  public visibility, nearby activity, or verified contributors are corrected in the same
  complete vertical;
- a data-flow and abuse threat model covers stalking, coercion, account compromise,
  forged coordinates, Sybil accounts, cell sweeping, capped-result aggregation,
  enumeration, differencing, blocking, reporting, logs, backups, and operator access;
- repaired `0010` and presence `0011` satisfy ADR-014 generation, disposable upgrade,
  blank reconstruction, archive, exact-target authorization, and restore gates;
- the actual runtime-role RLS and least-privilege proof passes;
- activation, renewal, stop, expiry, reciprocity, coarsening, caps, block, report, avatar
  fallback, rate limits, cross-lease account/device/network budgets, automatic containment,
  kill thresholds, and no-store behavior are exercised through live call sites;
- projection serialization is allowlist-based and leak-tested against auth, profile,
  source, contact, trust, and raw presence records;
- foreground-only location access and absence of location-bearing logs, traces, analytics,
  errors, queues, browser stores, and offline caches are demonstrated, including direct
  inspection of `wetindey.location.v1`;
- the 15-minute live-row purge deadline, 30-day backup expiry, restore filtering, erasure,
  operator-access controls, incident response, and counsel-reviewed notice are proved;
- marker and action capabilities pass entropy, binding, transfer, mutation, replay,
  display-token rejection, action-swap, wrong-purpose endpoint rejection, expiry, and
  duplicate-side-effect review;
- block and report operations have rate limits, abuse controls, a private safety queue,
  structured reason codes only, retention rules, and an accountable responder;
- the pilot is limited by a server-side feature flag, named cohort and geography, with an
  immediate kill switch that revokes reads and clears active leases; and
- an adversarial reviewer defaults to Refuted whenever evidence is missing, indirect, or
  produced only under an owner/admin database role.

No build, typecheck, generated migration, screenshot, or self-review is sufficient rollout
evidence by itself.

## Adversarial acceptance cases

At minimum, an independent reviewer must reproduce these outcomes against the actual pilot
path and actual runtime role:

| Attack or boundary case | Required outcome |
|---|---|
| `locationSharing=true` without fresh activation | No lease, marker, or nearby read |
| App launch, sign-in, restore, or foreground return | No automatic activation or renewal |
| `wetindey.location.v1` and all browser stores inspected | No activation coordinate, centroid, lease, token, avatar reference, or people result |
| Browser/server/app/edge/infra observability inspected | No raw activation coordinate in logs, analytics, traces, errors, URLs, queues, or crash data |
| Viewer inactive while subject is active | Nearby read denied without leaking a count |
| Subject inactive, stopped, revoked, or expired | Subject absent from every new read |
| Lease reaches 15 minutes during a query | Expired subject excluded; race fails closed |
| Response includes leases with different expiries | Snapshot/cache deadline is no later than the earliest included expiry |
| A blocks B or B blocks A | Neither sees the other; cap/count/order leak nothing |
| Client supplies another center or moves the map | Center ignored or request rejected |
| Client requests over 5 km, over 50, or a next page | Bound cannot be widened or paged |
| Forged coordinate is activated | It remains labelled self-asserted and cannot bypass radius, cap, block, token, or rate-limit boundaries |
| A request would exceed an activation/read/cell/disclosure budget | Denied before additional disclosure; one pseudonymous strike records |
| One account makes three denied reset/sweep attempts | Account contained for the rest of its 24-hour window; no global kill absent disclosure |
| Sybil accounts coordinate reads | Device/network aggregate budgets and containment bind across accounts without claiming Sybil prevention |
| Account replaces leases/sessions during a day | At most 50 distinct subjects and two distinct cells in the rolling day |
| Accounts rotate on one device abuse key | At most 75 distinct subjects and three distinct cells in the rolling day |
| Devices rotate on one network bucket | At most 100 distinct subjects and six distinct cells in the rolling day |
| Viewer repeats reads within or across leases | Union remains within every account/device/network disclosure budget |
| Viewer attempts twelve forged centers | Third account cell is denied; containment thresholds activate |
| Server detects projected results would exceed an aggregate budget | Response is denied before disclosure; strike/containment rules apply |
| Client actually receives a result that exceeds any response or aggregate budget | Immediate global kill, lease revocation, incident, and rollout NO-GO |
| Repeated grid queries compare centroids | No raw-coordinate recovery or alternate precision representation |
| Projection is inspected recursively | Only the documented allowlist is present |
| Marker token is reused after snapshot/lease expiry | Token fails without identity leakage |
| Display marker token is submitted to block/report/lookup | Rejected before subject resolution with a generic failure |
| Token/capability bits or payload are mutated | Generic failure; no subject or binding oracle |
| Token/capability is copied to another viewer/session/snapshot | Generic failure; no side effect |
| Block and report capabilities are swapped | Generic failure; neither wrong action executes |
| State-changing capability is replayed concurrently | At most one idempotent side effect |
| Report contains text, media, coordinates, or unknown fields | Rejected before target resolution; nothing retained |
| Report is retried, replayed, or duplicated | Exactly one structured-code private report; generic response |
| Avatar consent is absent | Generic marker; no asset or initials |
| Initiating client withdraws avatar consent | Future fetches revoke and local bytes/object URLs clear before success |
| Remote client already rendered an avatar at withdrawal | Clears on next response or earliest snapshot deadline; no realtime claim |
| Avatar URL is copied to another viewer/session/snapshot | Fetch denied; recognizable-image linkability remains disclosed |
| New avatar fetch follows expiry or withdrawal | Generic denial; any success triggers global kill |
| Browser, service worker, CDN/edge, and image caches inspected after governing deadline | No thumbnail response, decoded byte, or object URL survives; any residue triggers global kill |
| Report is submitted | Subject/public cannot read report or reporter identity |
| Direct base-table read as runtime role | Denied by grants and RLS |
| Runtime role supplies another user ID | Session identity wins; cross-user write denied |
| Offline mode, reload, or service-worker inspection | No people marker survives or reloads |
| Logs, traces, analytics, errors, and queues inspected | No raw coordinate or people payload |
| Own marker and other marker are compared | Precise own coordinate never enters projection |
| Own marker is inspected while people layer is open | It uses only the server-derived coarse centroid and snapshot lifetime |
| Initiating client stops or withdraws preference | Entire people snapshot clears before success is shown |
| Initiating client suspends/deletes account or triggers kill path | Entire people snapshot clears before success is shown |
| Other tab/device reads after stop, withdrawal, suspension, deletion, or kill | Server denies; snapshot clears on response or existing deadline |
| Stop races a new read | Stop commit prevents all later reads from returning the lease |
| Live-row purge deadline is observed | Row is deleted within 15 minutes without extending visibility |
| A backup is restored | Traffic remains blocked until all presence leases/capabilities are purged |
| Operator attempts routine lookup/export | Denied; exceptional access is approved and audited |

## Full-rollout gate

The pilot is not authorization for general availability. Full rollout requires a recorded
owner decision after the pilot and another independent adversarial verdict. Evidence must
show:

- the pilot had no unresolved high-severity privacy, safety, authorization, or enumeration
  finding;
- consent comprehension, stop behavior, approximate-area semantics, avatar fallback,
  blocking, reporting, accessibility, and offline behavior were driven on supported mobile
  and desktop paths;
- abuse and report volume can be handled under a documented response and escalation
  process;
- deletion, expiry, purge, backup retention, account erasure, incident response, and kill
  switch procedures were exercised;
- the counsel-reviewed notice remains accurate for the production audience, avatar
  linkability, self-asserted coordinate, stale-within-lease behavior, and retention;
- production role, RLS, grant, schema, RPC, and ledger fingerprints match the accepted
  artifacts for every target;
- rate limits and the 5 km/50 cap hold under concurrency without fail-open fallbacks;
- rolling account/device/network cell and distinct-subject budgets hold across replacement
  leases, sessions, accounts, restarts, and concurrent requests;
- the 24-hour pseudonymous abuse state contains only approved counters/HMAC membership,
  cannot reconstruct order or movement, is role-isolated, and is purged rather than
  restored from backups;
- no zero-tolerance kill event occurred; any containment threshold and its disposition are
  independently explained before rollout;
- monitoring detects failures without collecting raw coordinates, people projections, or
  identity-location joins;
- no friend, messaging, realtime, history, background tracking, contact, or reputation
  scope entered through pilot iteration; and
- the independent reviewer can reproduce every material claim and returns Not Refuted
  rather than accepting thin or self-authored evidence.

If any full-rollout item is unproved, rollout is NO-GO. The safe fallback is to disable the
feature and purge active leases, not to relax consent, precision, reciprocity, RLS, or
safety controls.

## Relationship to existing decisions

- **ADR-011 is Proposed and does not control ADR-016.** Only the separation and
  non-purchasability constraints enumerated in this ADR are independently adopted. No
  Trust Graph, reputation model, or other ADR-011 proposal is incorporated by reference.
- **ADR-014 remains controlling.** Desired-state pillars, release fingerprints, exact
  targets, immutable shared history, and independent migration proof govern `0011`.
- **ADR-003 remains controlling for the rest of the product.** Local-information reading
  remains anonymous; authenticated reciprocal presence is a separately bounded sensitive
  capability, not an account gate on map, search, sheets, or Food information.
- **ADR-001 remains controlling.** Presence does not authorize delivery, dispatch,
  tracking, transactions, or fulfilment.

## Alternatives considered

**Treat `locationSharing` as complete consent.** Rejected. A durable profile preference is
not fresh consent to publish a current location signal and cannot establish a 15-minute
lease.

**Let anyone browse opted-in people.** Rejected. Non-reciprocal viewing creates an
unaccountable surveillance surface and prevents reliable blocking.

**Use the client map center for discovery.** Rejected. It enables remote sweeping and
enumeration unrelated to the viewer's own presence.

**Publish exact coordinates with random jitter.** Rejected. Repeated samples can be
averaged, and jitter still creates false precision. A fixed 500 m cell centroid is the
maximum approved precision.

**Ship Server Action checks first and add RLS later.** Rejected. A sensitive base table
behind an over-privileged runtime role is not a pilot-ready privacy boundary.

**Add realtime movement, friends, or messaging to make the pilot useful.** Rejected. Each
creates a materially larger social and location threat model.

**Use user type or reputation to decorate markers.** Rejected. Nearby presence is not
trust evidence, and a badge or role label would expose identity context beyond the pilot's
purpose.

## Consequences

**Improves.** The pilot can test whether coarse reciprocal recent sharing is useful without
making a durable people directory or exact tracking system. Consent, expiry, blocks,
reports, RLS, and projection minimization are launch conditions.

**Costs.** Repeated consent adds friction. A 500 m centroid can overlap markers and cannot
support exact meetups. Fifteen-minute leases and no realtime path can make the view less
continuous. RLS proof, safety operations, purge behavior, and adversarial testing require
more work than a profile toggle and map icon.

**Constrains.** No implementation may equate `locationSharing` with active publication,
return profile objects as markers, accept arbitrary query centers, defer RLS, or expand the
pilot into social, tracking, contact, or reputation features.

## Status and review

This ADR remains Proposed until the owner accepts the privacy boundary, migration order,
pilot scope, and rollout gates. Acceptance authorizes a separately claimed implementation
vertical after repaired `0010`; it does not authorize migration application, pilot traffic,
or full rollout without the evidence required above.
