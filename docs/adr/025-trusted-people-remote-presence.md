# ADR-025: Trusted People and relationship-scoped remote presence

**Date:** 2026-07-19  
**Status:** Proposed  
**Owners:** Product & Data Governance

> This is a proposal for a separately controlled capability. It authorizes no schema,
> migration, server action, UI, provider integration, feature flag change, deployment,
> pilot traffic, or rollout. [ADR-016](016-nearby-user-presence.md) and the accepted
> browsing/location separation in [ADR-023](023-browsing-context-and-device-location.md)
> remain binding. The ordinary browse path remains anonymous.

## Context

Nearby Presence answers a narrow question: a signed-in account deliberately shared an
approximate area recently, to another reciprocal active sharer. That is not a safe way to
let a person outside Lagos find one particular Festac contact. A remote relationship must
therefore be a separate capability with a smaller audience, a relationship-specific grant,
and no weakening of the Nearby Presence lease, coarsening, or safety rules. The selected
browsing area is a discovery context only: it is never physical-presence evidence, a
`Me` marker, or proof that either party is in Festac.

The intended outcome is bounded: a user physically outside Lagos may browse Festac and see
a specific Festac person only after both people complete an invite/accept lifecycle and the
Festac person grants that relationship permission to view remote presence. Either person
can revoke, block, or report. The remote viewer's browsing point is not evidence that the
viewer is in Festac, and a truthful broad viewer location is an independent disclosure.

## Proposed decision

Create a relationship-scoped **Trusted People / Remote Presence** capability. It is not a
people directory, contact graph, follower system, trust score, or messaging product.

### Discovery and relationship contract

1. Discovery is by an opaque, single-use invite link/QR, or by an exact server-resolved
   handle supplied by the person. Tokens have a server-enforced expiry, one-time consume,
   rotation/revocation, and account/device/network rate budget; handles have no prefix or
   partial-match search. The server resolves the token/handle to a pending invitation;
   clients never enumerate accounts, search contacts, sync an address book, or infer
   relationships from proximity.
2. The target explicitly accepts the invitation. A relationship is not active until both
   sides are authenticated and the server records the mutual invite/accept state. Either
   person may revoke the relationship; revocation is immediate and does not require the
   other person's cooperation.
3. Remote viewing is reciprocal at the consent boundary but independently directional:
   each person separately grants or withholds per-person remote-view consent for the other.
   A person is visible in that direction only when that person's own grant is active. Mutual
   invite/accept never implies either grant, and a one-way grant never creates reverse
   visibility. Each grant is relationship-scoped, explicitly expiring, revocable, and does
   not imply profile, contact, or messaging consent.
4. The viewer need not disclose a location or hold an ADR-016 viewer lease. This is an
   explicitly separate, relationship-scoped audience for this proposal, not a read of the
   Nearby Presence reciprocal snapshot; it does not alter ADR-016's requirement that both
   parties be active sharers for Nearby results, and it cannot make a remote viewer appear
   in Nearby. If the viewer chooses to disclose a broad, truthful location, that is a
   separate, purpose-bound consent with its own expiry. It must never be rendered as a
   Festac peer marker or used to satisfy an ADR-016 lease.
5. A remote marker is eligible only while the subject has an active ADR-016 lease. The
   subject therefore still performs the explicit foreground action, uses the server's
   fixed 500 m grid centroid, and has a lease no longer than 15 minutes. Remote access
   cannot renew, extend, or bypass that lease and cannot read an exact coordinate. The
   remote adapter may return only an eligible boolean/coarse cell and a non-precise client
   freshness indication; the absolute lease expiry remains server-internal and is never a
   precise per-user timestamp.
6. The viewer sees at most one relationship-scoped coarse marker and an accessible card
   exposing the subject's chosen display name/avatar only when both a separate,
   relationship-scoped ADR-025 profile-display consent and this remote-view grant are
   active, plus `Wave`, `Block`, `Report`, and `Close`. ADR-016 presence-profile consent
   remains independent for Nearby's reciprocal audience and is never silently reused or
   broadened. `Wave` is the first and only positive/social interaction in this capability:
   ephemeral, in-app, rate-limited, and never chat, a contact exchange, a follow, or a
   delivery/order action. Block, Report, and Close remain mandatory safety/navigation
   controls; any other social interaction requires a separately accepted ADR.

No public directory, global people search, contact sync, follower count, popularity sort,
trust/reputation effect, automatic enrolment, background tracking, exact-coordinate
disclosure, stable auth identifier, email, phone, WhatsApp, or unrestricted messaging is
permitted. Messaging would require a later ADR with independent anti-spam, age/privacy,
moderation, retention, and Presence separation evidence.

### State, revocation, and safety semantics

Safety and revocation are evaluated before discovery, consent, marker, card, or Wave. A
block wins immediately and bidirectionally over every grant and relationship state. A
private report may place a safety hold that suppresses visibility and interaction while it
is reviewed; reporting never reveals the reporter or creates a discoverable relationship.
The server must fail closed when an invitation is expired, already consumed, revoked,
unaccepted, consent is absent/expired, the subject lease is absent/expired, either account
is blocked, a report safety hold applies, the kill switch is on, or any relationship
authorization cannot be proved. Revoke, block, report, account deletion, lease expiry, and
feature disablement clear the relationship's marker/card capabilities immediately on the
next snapshot and invalidate outstanding interaction capabilities. No stale marker may be
shown from a client cache, service worker, offline snapshot, background poll, or URL.

Remote presence is a projection, not history. Do not retain movement trails, exact fixes,
per-viewer snapshots, or a durable per-user timestamp. Retain only the minimum relationship
state, consent/revocation events, safety reports, rate-limit counters, and redacted audit
receipts for an approved period. Deletion must remove account-linked relationship,
invitation, disclosure, capability, and report details, leaving only the separately
approved minimal safety tombstone required by [ADR-021](021-account-deletion-lifecycle.md).

## Prospective implementation boundaries (not authorized by this proposal)

These names describe a future, separately claimed vertical. They reserve no migration
number and are not current code, schema, API, or UI.

### Schema and database ownership

If a later lane is approved, it may propose a new Trusted People pillar only under
ADR-014, after corrected Presence `0012`, contribution `0013+`, and the active pathless
`0014` shared-target operational gate are separately passed. Trusted People reserves no
migration number and cannot repair or consume `0014`:

- `src/db/schema/trustedPeople.ts`
- `src/db/pillars/52-trusted-people.sql`
- `src/db/pillars/72-trusted-people-services.sql`
- `src/db/pillars/92-trusted-people-security.sql`

Candidate records are `trusted_people_invites`,
`trusted_people_relationships`, directional `trusted_people_remote_view_grants`,
`trusted_people_remote_profile_display_grants`, `trusted_people_location_disclosures`,
short-lived `trusted_people_capabilities`,
`trusted_people_blocks`, and private `trusted_people_reports`. Each row is keyed by an
opaque internal account reference and relationship scope; no public handle, email, phone,
exact coordinate, movement history, follower edge, or popularity aggregate is stored as a
public projection. A capability contains an audience, purpose, relationship, expiry, and
server nonce/counter, not a coordinate or account identifier returned to the client.

Presence remains the owner of its own tables, lease, fixed-grid coarsening, kill switch,
and retention routine. Trusted People may call only a purpose-bound Presence projection
adapter that returns an eligible coarse cell and a boolean/coarse relative freshness
indication; the absolute lease expiry and precise per-user timestamp remain server-
internal. It may not select a cell, renew a lease, query Presence tables directly, or
expose Presence internals. Presence roles may not read Trusted People relationship or
disclosure tables.

### Server/API boundary

Future server-only operations may be named:

- `createTrustedPeopleInvite(input)`
- `resolveTrustedPeopleInvite(token)`
- `acceptTrustedPeopleInvite(token)`
- `setTrustedPeopleRemoteViewConsent(input)`
- `revokeTrustedPeopleRemoteViewConsent(input)`
- `setTrustedPeopleRemoteProfileDisplayConsent(input)`
- `revokeTrustedPeopleRemoteProfileDisplayConsent(input)`
- `setTrustedPeopleLocationDisclosure(input)`
- `revokeTrustedPeopleLocationDisclosure(input)`
- `getTrustedPeopleRelationshipSnapshot()`
- `getTrustedPersonCard(displayCapability)`
- `waveTrustedPerson(waveCapability)`
- `blockTrustedPerson(blockCapability)`
- `reportTrustedPerson(reportCapability)`
- `revokeTrustedPeopleRelationship(input)`

Inputs are resolved from the authenticated session and one-time opaque capability; the
client supplies no account IDs, radius, coordinates, lease extension, or arbitrary target.
Every read is private/no-store, bounded, non-enumerating, rate-limited per account/device/
network, and returns only the minimum projection. Every write is idempotent where retries
could repeat an invite, consent, revoke, Wave, block, or report. Errors are generic and do
not reveal whether an account, relationship, or location exists.

### RLS and authorization boundary

RLS must require the current authenticated account for every relationship mutation and
permit a read only when the relationship is mutual, the directional grant is active, the
subject's ADR-016 lease is active, neither side is blocked/reported-held, and the feature
kill switch is off. The subject may revoke its own grant; either side may revoke the
relationship, block, or report. Safety responders may access only purpose-bound redacted
reports under a separately audited role. No policy may permit `USING (true)`, account-wide
directory reads, client-supplied subject IDs, or a join that bypasses the Presence adapter.

### UI and map boundary

Only a later implementation lane may add relationship-scoped surfaces such as:

- `src/app/_components/TrustedPeopleSheet.tsx`
- `src/app/_components/TrustedPeopleInviteSheet.tsx`
- `src/app/_components/TrustedPeopleRelationshipSheet.tsx`
- `src/app/_components/TrustedPersonCard.tsx`
- `src/app/_components/TrustedPeopleConsentSheet.tsx`
- `src/app/_components/TrustedPeopleLocationDisclosureSheet.tsx`

An existing profile entry may open the sheet, and the map may render a marker only when
the server returns an unexpired display capability. The marker must never feed
`locationStore`, `Me`, a personal avatar, route origin, device evidence, camera/browsing
context, public trust profile, contact resolver, or a follower/popularity surface. There is
no public route, sitemap, people directory, follower surface, contact-sync permission, or
messaging UI. Every card has a non-colour text state, keyboard/focus support,
screen-reader names, 44 px targets, reduced-motion and forced-colors behavior, and explicit
expiry/revocation/error copy.

## Phased rollout (future lanes only)

- **P0 — governance and containment:** accept this ADR separately if desired; keep the
  feature flag and database kill switch off; approve safety responder, retention, rate,
  privacy, legal, provider, deletion, and refutation packets. No user traffic.
- **P1 — relationship lifecycle:** implement invite, resolve, accept, reciprocal
  per-person consent, revoke, block, report, and deletion state without any location marker
  or profile discovery. Prove non-enumeration, consent/grant expiry, block/report priority,
  idempotence, RLS, and generic errors.
- **P2 — remote coarse projection:** after ADR-016 has direct lease evidence, expose one
  relationship-scoped 500 m centroid with its short expiry and the card actions. Prove no
  exact/stale/background data, no self-marker, and no contact/DM/follower side effects.
- **P3 — optional viewer disclosure:** add a separate, truthful broad viewer-location
  disclosure only if its purpose, expiry, audience, retention, and revocation are proved.
  It never changes the Festac marker or nearby eligibility.
- **Later, separately governed:** messaging or any external action requires a new ADR and
  must not be smuggled into this capability.

## Fail-closed acceptance checklist

Acceptance requires direct evidence, not a green build or documentation presence:

1. A viewer browsing Festac while outside Lagos cannot become `Me`, a Festac peer marker,
   an ADR-016 sharer, or a route origin merely from browsing context.
2. No person is visible without opaque invite/handle resolution, mutual invite/accept,
   that person's active per-person remote-view consent, and an active ADR-016 foreground
   lease on the subject. The viewer's lack of an ADR-016 lease is an explicit remote-
   audience boundary, not a change to Nearby's reciprocal active-sharer rule; reverse
   visibility requires the reverse person's separate grant.
3. The chosen display name/avatar is shown only when the separate relationship-scoped
   ADR-025 profile-display consent and remote-view grant are both active; ADR-016's
   reciprocal presence-profile consent remains unchanged.
4. Viewer location is optional; any disclosed broad location is truthful, separate,
   relationship-scoped, expiring, revocable, and never a fabricated Festac marker.
5. Invite/grant expiry, revoke, block, report hold, deletion, kill switch, logout, and
   network/error paths remove markers/cards and invalidate capabilities; block is immediate
   and bidirectional, report holds suppress visibility, and no cache or background renewal
   revives them.
6. Fixed 500 m centroid, maximum 15-minute nonrenewing foreground lease, no exact point,
   no enumeration, no movement history, no precise per-user timestamp or client-visible
   absolute expiry, and bounded reads are proven against ADR-016.
7. RLS, capability audience/purpose, reciprocal per-person grants, per-account/device/
   network budgets, audit redaction, retention purge, account-deletion cleanup, and the
   corrected Presence `0012` → contribution `0013+` → operational `0014` ordering are
   exercised or proved on the exact target by independent security/privacy refutation.
8. Accessibility and copy tests show Wave/Block/Report/Close, identity limits, expiry,
   and failure states without implying chat, contact, popularity, trust, verification,
   or commerce.

Until every item has an exact implementation claim, the corrected Presence `0012`,
contribution `0013+`, and operational `0014` gates have direct evidence, and independent
Founder/counsel/provider authorization exists, ADR-025 remains Proposed and
ADR-016/ADR-023 remain the controlling accepted architecture.
