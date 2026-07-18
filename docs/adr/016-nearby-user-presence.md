# ADR-016: Privacy-safe nearby-user presence pilot

**Date:** 2026-07-18
**Status:** Proposed
**Decision owner:** WetinDey Founder
**Scope:** Consent, location minimization, reciprocal discovery, authorization, safety,
migration ordering, and separate private-pilot and public-rollout gates

> **No approval is recorded by this revision.** Commit `4e25b8c7` contains the current
> unsafe implementation in the repository; it does not approve presence or prove runtime,
> database, deployment, or legal readiness. Rollout remains disabled. This ADR stays
> Proposed until the Founder makes an explicit selection and a later governance change
> records the resulting status.

## Founder decision record - all choices unchecked

The Founder can answer with a short selection such as `A1 B1 C1 D1`. The recommended
conservative selection is **`A1 B1 C1 D1`**. Checking a choice does not silently change
this document from Proposed or authorize a deployment, database change, or public launch.

### A. Product boundary

- [ ] **A1 - Adopt the conservative target (Recommended):** allow engineering planning
  only for the complete boundary in this ADR. Tradeoff: lower discovery utility and more
  foreground friction in exchange for less precision, enumeration, and contact risk.
- [ ] **A2 - Keep containment and reject nearby-user presence:** strongest privacy
  outcome; no nearby-person utility is built.
- [ ] **A3 - Return for revision:** preserve containment while the Founder identifies the
  boundary that needs changing.

### B. Private Festac pilot rate budgets

- [ ] **B1 - Require account, device, and network budgets before any pilot
  (Recommended):** slower pilot start; keeps the private pilot on the public safety path.
- [ ] **B2 - Explicitly defer those budgets for exactly two allowlisted accounts:** faster
  private learning, but the Founder accepts the temporary abuse-control gap. The
  server-enforced allowlist is hard-capped at exactly two account principals, a third
  account must fail closed, and this exception cannot carry into a larger cohort or public
  rollout.
- [ ] **B3 - Do not run the private pilot:** retain only the contained, disabled state.

### C. Migration path

- [ ] **C1 - Use the evidence-controlled `0011`/`0012` rule (Recommended):** repair
  `0011` in place only if authoritative evidence proves its current bytes were never
  applied to any shared target; otherwise preserve it and repair forward with `0012`.
- [ ] **C2 - Defer all presence schema work:** retain containment until the migration
  state and target authorization are available.

### D. Public rollout

- [ ] **D1 - Keep public rollout unauthorized pending a separate Founder review
  (Recommended):** a passing two-account pilot is evidence, not launch approval.
- [ ] **D2 - Rule out public nearby-user presence:** the private pilot, if separately
  chosen, cannot graduate into a public capability.

## Context and containment state

A map of people creates stalking, enumeration, profiling, unwanted-contact, and false
live-presence risks. A durable preference or a signed-in session is not enough to make
publication safe.

The unsafe current path is contained by commit
`4e25b8c7ac8a3ad598567e186575defd51113247` (`4e25b8c7`). That containment removes or
fails closed the unauthenticated global presence read, profile coordinate inputs,
automatic publication and polling, stale-marker retention, and misleading visibility
copy. It is containment only. At-rest profile coordinates and dormant presence DTO or
renderer remnants remain migration and later implementation concerns. No runtime,
deployment, shared-database, or legal-readiness claim follows from the commit.

While this ADR is Proposed:

- nearby-user presence must remain disabled;
- no schema, migration, database, action, UI, map, background task, or deployment change
  is authorized by this document;
- the default-off feature flag and database kill switch described below are target
  controls, not claims about the current implementation; and
- general local-information browsing remains anonymous. Only this sensitive presence
  projection would require a signed-in viewer.

## Proposed decision

If later accepted, WetinDey may build only a coarse, reciprocal, short-lived presence
capability. Its entire approved meaning is:

**"This signed-in account explicitly shared this approximate area recently."**

It must never be presented as proof that a person is physically there, live, online,
available, safe, verified, known to the viewer, or open to contact. A coordinate is
self-asserted and may be forged. An honestly submitted marker may become stale as soon as
its account moves.

### Conservative target contract

| Control | Required boundary |
|---|---|
| Activation | One explicit foreground action after clear disclosure; no activation from a preference, permission grant, sign-in, app open, foreground return, or saved location |
| Exact input | Transient request input only, used to select one fixed-grid cell; never durable, cached, logged, analyzed, queued, or placed in a URL |
| Coarsening | Server computes the centroid of one documented fixed 500 m grid cell; the client cannot select the centroid or grid |
| Lease | Maximum 15 minutes; nonrenewing; no heartbeat, background task, silent restart, or grace period |
| Audience | Reciprocal recent sharers only: both viewer and subject have separate active, unexpired leases at query time |
| Viewer | Signed in, currently opted in, and holding an active lease |
| Self-exclusion | The viewer is never returned as a subject in the people snapshot |
| Block | Either account's block excludes both accounts from each other's current and future snapshots |
| Report | Private, purpose-bound report action available from every returned marker |
| Radius | Server-owned maximum 5 km from the viewer's stored coarse centroid; no client center, viewport, or radius override |
| Result cap | Maximum 50 subjects per snapshot; no count, pagination, replacement sweep, or hidden remainder |
| Projection | Coarse centroid plus opaque per-snapshot display/action capabilities only |
| Excluded fields | No identity, profile, handle, name, contact, avatar, reputation, verification, status, role, contribution history, or stable subject identifier |
| Response | Authenticated and private with `Cache-Control: private, no-store`; memory only; never stored by the service worker or offline cache |
| Controls | Default-off application feature flag and an independent server-owned database kill switch; both must allow the operation |
| Expiry | Server rejects stale leases and capabilities; every client immediately clears the complete people snapshot when it becomes stale or invalid |

The 500 m centroid reduces precision; it does not anonymize a person in a sparse cell or
prove that the input was inside the cell. The same lease returns the same centroid. The
system must not issue multiple jittered representations that can be averaged toward the
exact input.

## Separation of concepts

These concepts are independent and must not be collapsed into one consent flag, trust
score, profile, or reward state.

| Concept | Meaning in this ADR | What it does not mean |
|---|---|---|
| Exact input coordinate | Transient foreground activation input long enough for server coarsening | Durable preference, lease, history, proof of location, or response field |
| Durable preference | Default-off statement that the account may ask to share presence | Activation, publication, renewal, audience consent, or a coordinate |
| Short-lived lease | Server-held internal account key, one 500 m centroid, issuance and expiry, and revocation state for no more than 15 minutes | Identity disclosure, live-person claim, background tracking, or movement history |
| Specific-record confidence | Confidence in one local-information record from admissible evidence | Confidence in a person, presence, identity, reputation, or safety |
| Identity | Internal authenticated account continuity needed for authorization, block, and report | A field in the presence projection, physical-location proof, or verification |
| Reputation | Separately earned history from relevant outcomes | Presence frequency, proximity, visibility priority, or a reason to reveal more data |
| Contact-publication consent | A separate, purpose-specific decision to publish a contact channel | Implied by presence, profile, seller status, identity, or a report |
| Rewards | Separate recognition or compensation policy | A way to buy presence, rank, precision, identity, verification, or access |

Presence, blocks, reports, lease frequency, and attempted use must not change
specific-record confidence, reputation, verification, ranking, badges, rewards, or public
status. Payment, sponsorship, advertising, subscription, or reward participation cannot
buy presence priority, additional precision, a wider radius, a larger result set, or an
exemption from safety controls.

## Consent, lease, and exact-coordinate lifecycle

The durable preference is default off. Turning it on does not create a lease. Every lease
requires a new foreground action that explains the audience, 500 m grid centroid,
15-minute maximum, self-asserted and potentially stale meaning, block/report controls,
and the absence of identity and contact fields.

A lease cannot renew. A later foreground action may create a new lease only after the same
disclosure and a fresh exact input. No saved owner location, profile coordinate, prior
centroid, operating-system permission, session restoration, application launch,
foreground event, polling loop, or background process may create or extend it.

The exact input may exist only in foreground browser memory, encrypted transport, and
server request memory for the coarsening operation. It must not enter local storage,
session storage, IndexedDB, Cache Storage, service-worker state, persisted client state,
database rows, analytics, logs, traces, crash reports, error payloads, queues, caches,
backups, URLs, or query strings. The coarse centroid must not be copied into a profile or
owner-location store.

Only one current lease may exist per account. The lease stores no exact coordinate,
previous cell, path, heartbeat, `last_seen`, movement history, profile fields, avatar, or
contact consent. Expiry is authoritative even if physical cleanup is delayed. Stop,
preference withdrawal, sign-out, suspension, account deletion, block effects, and the
database kill switch revoke affected access immediately; expired and revoked leases are
ineligible for every new read and are purged, not archived as history.

## Reciprocal query and projection boundary

A nearby query succeeds only when the signed-in viewer has an active unexpired lease and
both control planes permit presence. The server derives the center only from that lease's
coarse centroid and applies the fixed 5 km maximum. A client cannot supply a device
coordinate, map center, viewport, place, marker token, subject token, URL value, or custom
radius as the query center.

A subject is eligible only when the subject is a different account with an active
unexpired lease, both accounts remain opted in, neither account has blocked the other,
both are inside the authorized cohort and geography, and the subject passes server-owned
rate and disclosure controls when those controls are required by the selected pilot mode.

A response contains no more than 50 subjects and no total count. The server must not offer
pagination, arbitrary-center search, marker lookup, replacement results, export, or any
endpoint that turns the cap into an enumeration cursor.

Each response is a new snapshot. Every display token and block/report capability is
cryptographically opaque, newly minted for that snapshot, bound server-side to the signed-
in viewer, one internal subject, one action purpose, the snapshot, and a deadline no later
than either account's lease expiry. Tokens are not account IDs, are not stable across
snapshots, cannot be exchanged between viewers or actions, and cannot be accepted by a
general lookup endpoint. The server resolves them without returning the internal identity.

The allowlisted projection is limited to:

- one coarse 500 m cell centroid;
- one opaque per-snapshot display token;
- separate opaque block and private-report capabilities; and
- one response-level expiry deadline needed for immediate clearing.

It includes no identity, profile, contact, avatar, reputation, verification, contribution,
role, presence-frequency, exact-distance, exact-time, or stable-link field. Randomized or
coarse ordering must not imply exact distance, popularity, trust, or recency.

## Block, report, and safety operations

A block takes effect bidirectionally before success is returned: neither account may see
the other in a new snapshot. Current-client state for the blocked relationship is cleared
immediately, and its snapshot capabilities become unusable. A block must not notify the
blocked account or reveal who blocked them.

A report is private. It is visible only to authorized safety personnel and must not be
returned to the reported account, nearby users, profiles, reputation, verification,
ranking, or rewards. The report action uses its purpose-bound capability, records only the
minimum evidence required by the approved report policy, and returns no subject identity
to the reporter. Report retention, reporter access, responder access, escalation, and
deletion require the policy decision listed below; engineering must not invent them.

The pilot must name one safety responder and one backup, define how reports are received
and acknowledged, and give both responders authority to activate the database kill switch.
A report volume or severity that the named responders cannot safely handle is a stop
condition, not a reason to expose reports publicly or automate a reputation penalty.

## Response and stale-snapshot lifecycle

Presence responses are authenticated, private, `no-store`, in-memory snapshots. Their
server deadline is no later than the viewer lease or earliest included subject lease
expiry. There is no stale-while-revalidate, offline fallback, people cache, snapshot
restoration, or grace period.

The client clears the complete people snapshot immediately on its deadline, stop,
preference withdrawal, sign-out, session replacement, suspension, account deletion,
block, report-triggered safety stop, feature-flag denial, database kill switch, offline
transition, authorization failure, or read error. Clearing means markers, centroids,
arrays, tokens, capabilities, deadlines, and disclosure copy. Keeping old markers while a
refresh fails is prohibited.

Other tabs and devices are bounded by server revocation and their existing snapshot
deadline. Because realtime remote erasure is out of scope, the product must not claim that
it can erase pixels already rendered on another device before that device's next request
or local deadline.

## Dual control planes and kill behavior

Presence is available only when both controls allow it:

1. A default-off application feature flag limits which server deployment may call the
   presence boundary.
2. A server-owned database kill switch independently denies activation, reads, and
   capability actions even if application configuration is stale or wrong.

The database switch is checked on every sensitive operation. Activating it fails closed,
revokes and purges current leases and snapshot-capability mappings, prevents new leases,
and causes subsequent client requests to clear state. Turning it back off never restores
a lease or snapshot. Re-entry requires a new explicit foreground activation.

Confirmed exact-coordinate persistence, unauthorized or cross-viewer disclosure, a result
outside 5 km, a response over 50, self-inclusion, block failure, stale lease disclosure,
reusable or wrong-purpose capability, RLS or role bypass, public/cacheable response, or
failure to clear stale state is a global stop condition. The feature remains off until
containment, purge, root-cause review, and independent refutation are complete.

## Migration decision and evidence rule

Migration state is a release fact, not an inference from a local file. No presence
migration may run against a shared target without exact-target authorization and evidence
for the applied order and bytes of `0009`, `0010`, and `0011`.

The current `0011` may be repaired in place **only if authoritative evidence proves its
current bytes were never applied to any shared target**. Evidence must identify every
shared development, preview, staging, and production target in scope and reconcile the
migration ledger, exact checksums, deployed revisions, and schema state. Missing access,
an unknown target, an ambiguous ledger, or conflicting evidence means non-application has
not been proved.

If non-application is proved, regenerate and review `0011` in place under one exclusive
schema lane before its first shared application. Do not create `0012` merely to repair an
unapplied `0011`.

If the current bytes were applied anywhere shared, or authoritative non-application cannot
be proved, preserve `0011` and its ledger evidence byte-for-byte and create forward
migration `0012`. `0012` must first disable the unsafe presence path, revoke and purge its
data, and drop unsafe profile-coordinate storage, policies, functions, indexes, and
grants. Only after that destructive boundary is complete may the same reviewed release
install the coarse lease, block, private-report, capability, kill-switch, RLS, and least-
privilege role boundary. No old exact or profile coordinate may be copied or backfilled
into a lease.

A disposable migration and security harness must prove both the relevant fresh-baseline
path and the exact existing-lineage path selected above. It must exercise expiry,
revocation, purge, self-exclusion, reciprocal eligibility, bidirectional block, private
report authorization, 5 km and 50 caps, capability purpose/viewer/snapshot binding,
`private, no-store` behavior at the server boundary, RLS denial, dedicated-role denial,
kill-switch denial, and absence of unsafe profile-coordinate storage. Disposable proof is
necessary but does not authorize a shared migration.

The pilot runtime uses a dedicated least-privilege database role that cannot read profile
coordinates, bypass RLS, enumerate accounts, or access unrelated profile, contact,
reputation, verification, observation, reward, or administrative data. Owner or migration
credentials are never the presence runtime.

## Private two-account Festac pilot gates

A private pilot and public rollout are separate decisions. The private pilot is not a
small public launch and does not authorize discovery by any account outside its allowlist.
Every gate below must have recorded evidence before the first private activation:

- the Founder selection is recorded and ADR status is changed explicitly in a follow-up;
- repository containment at `4e25b8c7` remains intact until the complete replacement
  boundary is ready;
- an exact server allowlist contains exactly two named internal account principals and
  denies a third account before any location input or result processing;
- the server enforces an approved Festac geography boundary for both activation and read;
  a client viewport, label, address, or claimed neighborhood is not the geography gate;
- both the default-off feature flag and database kill switch are implemented, exercised,
  and owned by named operators;
- block and private report work before presence is enabled;
- one named safety responder, one backup, a report channel, response steps, and authority
  to stop the pilot are recorded;
- the dedicated least-privilege database role and RLS boundary are proved with denial
  cases;
- exact migration-state proof selects the `0011` or `0012` path, and the disposable
  migration/security harness passes independently;
- clear copy states approximate 500 m area, 15-minute maximum, self-asserted and possibly
  stale meaning, reciprocal two-account audience, no identity/contact, and stop/block/report
  behavior;
- the complete foreground activation, stop, expiry, error, offline, sign-out, block,
  report, and kill-switch snapshot lifecycle is driven, not inferred from a build;
- an independent adversarial reviewer defaults to refuted where evidence is thin and
  records no unresolved safety finding; and
- the rate-budget mode is exactly B1 or B2. Silence is not a B2 exception.

If B2 is selected, the exception defers only account/device/network activation, read, and
aggregate disclosure budgets for this exact two-account allowlist. It does not defer
authentication, reciprocity, explicit activation, the 500 m grid, 15-minute nonrenewing
lease, self-exclusion, bidirectional block, private report, Festac gate, 5 km radius,
50-response cap, opaque snapshot capabilities, private/no-store responses, least-
privilege role, feature flag, kill switch, or immediate stale clearing. Changing either
allowlisted account, adding a third account, widening geography, or exposing the feature
outside the private flag ends the exception. Full budgets are required before any cohort
expansion or public review.

## Public rollout gates

A successful private pilot does not satisfy public rollout. Public rollout remains
disabled and requires a separate Founder decision, an explicitly accepted or superseding
ADR, and fresh evidence for all private gates at public scale. At minimum, that later
review must require:

- server-enforced account, session, device, and network activation/read/disclosure budgets
  with no two-account exception and no unlimited fallback;
- anti-enumeration analysis across replacement leases, sessions, accounts, devices,
  networks, cells, snapshots, block/report capabilities, and the 50-result cap;
- staged cohort and geography controls that default off and cannot be widened by clients;
- staffed safety response, report retention/access policy, incident thresholds, purge and
  kill-switch drills, and an accountable launch owner;
- authorized shared-target migration application with exact post-migration schema, RLS,
  role, purge, and ledger evidence;
- privacy/security threat-model refutation and driven lifecycle evidence on supported
  devices, including offline and stale-snapshot behavior;
- recorded Founder and counsel-owned answers to the unresolved policy questions below,
  without treating this ADR as legal advice or counsel approval; and
- a new independent adversarial rollout review that defaults to no-go when evidence is
  incomplete.

No public flag may be enabled merely because two allowlisted accounts completed a pilot.

## Consequences and tradeoffs

- Explicit activation and a maximum 15-minute nonrenewing lease create friction and may
  make the feature too weak to justify its safety cost.
- A fixed 500 m centroid and no identity, avatar, contact, reputation, or verification
  fields reduce utility but also reduce targeting and false-trust cues.
- Reciprocity, authentication, allowlists, blocks, reports, caps, and rate budgets reduce
  abuse; they do not prove physical proximity or eliminate collusion, coercion, account
  compromise, sparse-cell identification, or Sybil risk.
- Private/no-store snapshots and immediate clearing intentionally provide no offline people
  experience.
- A database kill switch and destructive migration cleanup add operational cost but are
  required because an application flag alone cannot contain stale or misconfigured code.
- If the complete boundary is too expensive to implement and operate, A2 or B3 is the
  correct outcome. The architecture must not be weakened to preserve the feature.

## Policy questions engineering cannot decide

No legal conclusion or counsel approval is recorded here. Before any pilot, the Founder
must assign qualified policy/counsel owners to decide:

- who is eligible to participate, including any age or guardian rule;
- the legal basis and exact notice for transient exact inputs, coarse leases, block/report
  records, abuse-control identifiers, processors, and cross-border handling;
- minimum and maximum retention, access, deletion, appeal, and escalation rules for private
  reports and durable blocks; and
- whether B2's explicit two-account rate-budget deferral is an acceptable temporary product
  risk. Engineering can enforce the selected answer but cannot accept that risk silently.

## Out of scope

This ADR does not authorize:

- fulfilment, delivery, dispatch, courier integration, tracking, cart, checkout, or payment;
- public avatars or any avatar in a presence response;
- claims that a live person, verified person, active user, or trusted contributor is nearby;
- direct contact, messaging, follow/friend mechanics, or contact-publication consent;
- paid verification, purchasable reputation, priority visibility, or reward-based access;
- broad social discovery, people search, profiles, stable links, counts, pagination, or
  exports;
- background tracking, heartbeat, route history, silent renewal, saved-coordinate
  activation, or offline people snapshots; or
- using presence as evidence for local-information confidence, identity, reputation,
  verification, authorization, ranking, status, or rewards.

## References

- [ADR-001: Fulfilment is out of scope](001-fulfilment-is-out-of-scope.md)
- [ADR-002: Service architecture of record](002-service-architecture-of-record.md)
- [ADR-003: Identity for contribution trust](003-identity-for-contribution-trust.md)
- [ADR-011: Earned Trust Graph and reputation (Proposed)](011-earned-trust-graph-and-reputation.md)
- [ADR-014: Pillar baselines and release migrations](014-pillar-baselines-and-release-migrations.md)
- [Database evolution guide](../database/README.md)
- [Service architecture of record](../architecture/SERVICE-ARCHITECTURE.md)
