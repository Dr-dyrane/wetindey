# ADR-029: Seller contact ownership; a contact belongs to a consenting seller identity, not to a place

**Status:** Proposed
**Date:** 2026-07-22
**Decision owner:** Founder
**Scope:** Who owns a displayed contact channel (phone, WhatsApp, hours, or another
reachable channel), the identity, consent, and provenance conditions under which any
contact may appear at all, and how that ownership interacts with anonymous reading,
seller identity, correction, verification, and personal-data handling.

> This is proposed policy pending Founder acceptance. It authorizes no lane, no schema, no
> migration, no contact publication, no read-path change, no deployment, and no database or
> storage access. It resolves portfolio item #20 (register discovery WD-I-004) at the level
> of ownership semantics only. It moves, drops, and adds no column: the physical storage of
> a contact value is out of scope here and remains exactly as [ADR-007](007-contact-belongs-to-a-seller-not-a-place.md)
> left it. Fail-closed default: absent a consenting seller identity, there is no contact to
> own, show, or serialize.

## Context

Portfolio item #20 states a claim that has surfaced repeatedly: contact details belong to
the seller, a user and accountable identity, not to the place. The place is a location. The
contact is a way to reach a person who has agreed to be reached. Those are different things,
and the platform has never written the difference down as durable policy.

Two prior decisions bound this one and must be read together, because they appear to conflict
and do not.

[ADR-007](007-contact-belongs-to-a-seller-not-a-place.md) is **Rejected**. Its rejected
argument was a storage and granularity claim: that the `places` contact columns are wrong,
that `place_type = open_market` proves one place conflates a whole market with a vendor, and
that a seller entity is therefore required before the columns can be filled. That argument
did not survive the data and is not revived here. But ADR-007's own rejection reasoning
already says the thing portfolio #20 asks for: contact is *"PII belonging to a real trader,"*
*"one place = one stall = one trader = one contact,"* and the real blocker is *"trader consent
capture,"* a data-operations problem, not a schema defect. ADR-007 kept the columns and located
the missing piece in consent and accountability. This ADR does not reopen the columns; it
formalizes the ownership and consent semantics ADR-007's rejection already implied.

[ADR-022](022-earned-seller-and-role-onboarding.md) is **Accepted** and is the seller-identity
decision. It establishes application-owned, deny-by-default role assignments, earned seller
stewardship over a proved place-control claim, and an explicit contact-publication consent
lifecycle: consent is bound to one place, channel kind, exact value, and audience, recorded
with the consenting subject and authority, revocable without losing the seller claim, and a
contact value *"must never be inferred from Auth identity, business evidence, a profile, or
another place."* ADR-022 already treats contact as a seller consent decision. What ADR-022
did not do is name, as a standing invariant, *who owns the datum* and *what a place with no
consenting seller must show*. This ADR fills exactly that gap and nothing wider.

Adjacent accepted decisions constrain the answer. [ADR-003](003-identity-for-contribution-trust.md)
makes reading anonymous and permanent, and gates writing on optional identity; it is explicit
that vendor and trader accounts are out of its own scope and that "Contact seller" is the
terminal handoff. [ADR-001](001-fulfilment-is-out-of-scope.md) makes "Contact seller" a
channel handoff, never a broker, quote, order, or transaction. [ADR-015](015-observation-provenance-admissibility.md)
keeps current-state confidence earned only from admissible `observed` evidence.
[ADR-019](019-contribution-integrity-and-moderation.md) makes contribution writes transactional,
moderated, and fail-closed. [ADR-013](013-public-source-ingestion-boundary.md) firewalls
third-party and public-source data behind separate staging. [ADR-021](021-account-deletion-lifecycle.md)
deletes a user's application data and Blob objects through an ordered saga.

## Decision

A contact channel is owned by a specific, accountable seller identity that has consented to
publish it, never by the place at which it is shown. A place is a location and confers no
contact. Any displayed contact must trace to a consenting seller identity and carry its
provenance, and it may never be invented, inferred, or enriched from the place. Absent such a
seller, a place shows no contact, and the read path has no contact value to return.

The following invariants are proposed as consistent with ADR-007's rejection reasoning, with
ADR-022's accepted consent lifecycle, and with ADR-001, ADR-003, ADR-013, ADR-015, ADR-019,
and ADR-021.

## Invariants

### 1. No contact without a consenting seller identity

Every displayed contact channel must trace to one specific seller identity, as defined by
ADR-022, that performed an affirmative, per-place, per-channel-kind, per-value, per-audience
publication consent under ADR-022's consent lifecycle. Storage of a value, existence of a
place, a business claim, a seller role, and consent to publish are separate decisions, and
only the last of them puts a contact in front of a reader. No consent means no display. A
contact is never derived from the place name, the place address, seed or fixture data, Auth
identity, a profile, a prior controller, or another place.

### 2. A place with no claimed, consenting seller shows no contact

A location existing in `places` grants zero contact. When no accountable seller holds a
proved place-control claim and a live publication consent for a channel, the place shows no
contact: not a blank-but-present field, not a placeholder, not a "contact unknown" that
implies one exists, and not a seed or fixture value rendered as if real. The public read
returns no contact field to serialize on that branch, matching ADR-022's rule that
non-consented branches have no value field. The absence of contact is the correct and
expected state for most places until a seller claims and consents.

### 3. Ownership and accountability sit with the seller, not the place

The seller identity is the data subject and controller for the contact PII. The place is
only where the value renders. Correction, withdrawal, verification, dispute, and deletion of
a contact are the seller's rights and decisions, exercised against the seller identity, even
though the value may display at the place. Transferring control of a place does not inherit
the previous seller's contact: control transfer re-collects consent under ADR-022, and any
prior published value is withdrawn from public reads at transfer. A place changing hands, or
a seller relinquishing a place, never silently reassigns a contact to a new party.

### 4. Provenance is shown, and contact is never invented

A displayed contact carries provenance: that it is a seller-published channel, attributed
within the approved audience scope of ADR-022, and that it is not an `observed` price-style
claim and not a platform verification of the seller unless a separate assertion supports that
exact word. Contact is never fabricated, guessed, pattern-generated from a name or address,
or enriched from third-party or public-source data, which remains behind the ADR-013 firewall
and is never a contributor's or seller's consented channel. The reader can always tell that a
contact is a seller's stated way to be reached, not a fact the platform discovered.

### 5. Anonymous reading is preserved; anonymous publishing is impossible

Consistent with ADR-003, reading a published contact requires no account: a reader opens the
place and taps "Contact seller" with no sign-in, and this ADR refuses any proposal to gate
that read behind identity. Publishing a contact, by contrast, is impossible without a
consenting, accountable seller identity under ADR-022. ADR-003's anonymous contribution path
covers observations, never contact publication: an anonymous author can report a price, but a
contact channel can never be attached to an unknown, unaccountable author. The read path stays
open; the publish path is gated on identity and consent.

### 6. Correction and verification route through the seller and fail closed

A change to a contact, including the seller-correction route captured as WD-I-004, is a
seller-authored, consented action. It is moderated under ADR-019, never auto-published, never
able to expose a private or unconsented value, and never able to raise confidence by itself.
Verifying control of a contact channel, for example proving control of a phone number, is a
distinct assertion from business verification and place control under ADR-022, and one does
not imply another. Conflicting or competing contact claims for the same place fail closed into
moderation rather than publishing either value.

### 7. Seller PII is minimized, private by default, revocable, and deletable

Contact PII is minimized and private until an affirmative consent publishes it. Withdrawal
makes the value unavailable to public reads immediately and records an audit event, and the
raw value is not retained in ordinary logs, analytics, caches, or appeal copy, per ADR-022.
Deleting the seller account removes the seller's contact data through the ordered ADR-021
account-deletion saga, enumerating and deleting the value the same way ADR-021 handles other
personal data, and treating "already absent" as idempotent success only after enumeration
proves nothing remains. Removing a contact never rewrites or deletes the immutable observed
price history, which is separate evidence governed by ADR-019 and ADR-021 and is not contact.

### 8. Contact is a handoff, never fulfilment, ranking, or purchased trust

Consistent with ADR-001, "Contact seller" hands off a channel and is never an order, quote,
availability guarantee, escrow, or transaction. Consistent with ADR-015, the presence of a
published contact, its verification, or a seller's responsiveness never raises Food
current-state confidence, corroboration, admissibility, or ranking, and no contact, badge, or
placement may be purchased, accelerated by payment, or exchanged for volume. A contact tells a
reader how to reach a seller; it never tells the platform what is true.

## Consequences

**Improves.** The platform gains one durable answer to "whose contact is this?": always a
consenting seller's. The seed-fixture ambiguity that made contact untrustworthy is resolved by
policy, because no seed value may render as real contact. The eventual "Contact seller" surface
becomes safe to build, because it can only ever show a value that a specific accountable seller
consented to publish, with provenance, and the resolver has one clear rule: no consenting
seller, no field. It aligns cleanly with ADR-022's consent lifecycle rather than competing
with it.

**Costs.** Most places show no contact until a seller claims control and consents, so contact
coverage begins near zero and grows only through the ADR-022 onboarding and consent path. That
is slower than displaying inherited seed contact, and it is the correct cost: a contact shown
without a consenting owner is a privacy and impersonation hazard, not coverage.

**Constrains.** No contact may appear from a place alone, from seed data, from inference, or
from third-party enrichment; no contact may be published anonymously; no contact may be
presented as platform-verified truth, confidence, ranking, or fulfilment; and no place change
may silently reassign a contact.

## Non-goals

This ADR does not:

- revive ADR-007's rejected columns or granularity argument, and it moves, drops, and adds no
  column, schema, table, index, or migration; the physical storage of a contact value is a
  separate schema decision and lane;
- revive a `vendors` table, a marketplace, or any fulfilment, cart, checkout, payment, order,
  or dispatch semantics, all of which remain out of scope under ADR-001 and ADR-022;
- define the seller onboarding, place-control verification, consent capture, or withdrawal
  user interface, which belong to ADR-022's later phases;
- build, enable, or specify the "Contact seller" resolver, endpoint, read path, or serializer;
- set retention durations, rate limits, audience taxonomies, or moderation thresholds beyond
  deferring to ADR-019, ADR-021, and ADR-022;
- change ADR-015 admissibility, confidence, corroboration, or the `Sample` treatment;
- change ADR-003 anonymous reading or anonymous contribution; or
- authorize a lane, schema, migration, contact publication, deployment, rollout, or any
  access to a database or storage.

## Review triggers

Review this ADR:

- before any contact-publication consent, contact storage, or "Contact seller" resolver is
  claimed, built, or enabled;
- before any place read path serializes a contact field to a public response;
- if ADR-007's stored contact columns are ever proposed to move, drop, gain a seller foreign
  key, or otherwise change shape, which is a separate schema decision and lane that must cite
  this ADR;
- after any change to ADR-022's seller identity or consent lifecycle, ADR-003's anonymous
  reading, ADR-021's deletion saga, or ADR-019's moderation boundary; and
- after any incident in which a contact appeared without a consenting seller, was inferred or
  enriched, leaked before consent or after withdrawal, survived a place-control transfer, or
  was presented as verified, ranked, or fulfilment.
