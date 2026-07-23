# ADR-022: Earned seller stewardship and extensible role onboarding

**Date:** 2026-07-18
**Status:** Accepted - P1 app-layer half implemented at `bcf6028` (`src/lib/roles/` vocabulary, resolver, and lifecycle; no live caller); the schema half stays a separate lane gated on the two recorded controller rulings
**Decision owner:** WetinDey Founder

## Context

WetinDey needs a truthful way for a person who controls a stall, shop, or other existing
`place` to maintain information about it. It also needs bounded operator roles for later
moderation, field work, support, and community programs. Authentication alone answers
which account is present; it does not prove a person's identity, a business, control of a
place, permission to act, accuracy, or consent to publish a contact channel.

Collapsing those meanings into a `seller` boolean, an Auth-provider metadata field, or a
public “verified” badge would create durable security and trust errors. It would also let
payment, onboarding completion, or staff activity appear to improve the confidence of a
Food observation. ADR-011 separates these concepts, and ADR-015 permits only admissible
observed evidence to produce V1 current-state confidence.

The existing `places` model includes individual stalls as places. This decision does not
revive a generic `vendors` table or turn WetinDey into a marketplace. ADR-001 remains
binding: WetinDey does not provide fulfilment, delivery, dispatch, cart, checkout,
payments, or transaction guarantees.

## Decision

WetinDey will use application-owned, provider-independent, deny-by-default role
assignments. The first use is earned seller stewardship over a bounded business and
place. The same authorization vocabulary may later support separately approved
moderator, field-operator, support, and community roles without making any role an
identity, trust, or status shortcut.

This ADR accepts architecture and policy only. It does not authorize source, schema,
migration, provider, dashboard, contact-publication, badge, deployment, pilot, or public
rollout work.

### Concepts remain separate

The following are independent assertions with independent evidence, lifecycle, and
authority:

- Auth identity and provider continuity;
- identity proofing, if a later risk assessment requires it;
- business existence or registration;
- control of a specific place;
- a scoped role assignment and its permissions;
- consent to publish a specific contact value;
- seller-update accuracy;
- claim-specific current-state confidence;
- reputation, reviews, rewards, and public badges; and
- lifecycle states such as active, suspended, revoked, or expired.

No one assertion implies another. In particular:

- sign-in does not create a seller;
- business verification does not prove control of every place;
- place control does not publish contact information;
- a role does not increase observation confidence;
- payment, subscription, advertising, or sponsorship cannot buy identity or business
  verification, place-control approval, a role, lifecycle/status, accuracy, ranking, or
  a badge; and
- an accurate seller history does not turn seller-authored claims into independently
  observed evidence.

### Provider-independent authorization

Neon Auth may authenticate a subject, but role truth belongs to WetinDey. Provider
metadata, browser state, email address, token claims, or UI visibility must not be the
sole authorization source.

An assignment binds:

- one internal subject reference;
- a named role template;
- an explicit business, place, capability, or operational scope;
- an enumerated permission set;
- lifecycle state and effective/expiry times;
- issuer and independent reviewer where required; and
- creation, change, suspension, revocation, and appeal evidence.

Server-side authorization resolves the current assignment and resource scope on every
protected mutation and sensitive read. It fails closed for unknown roles, permissions,
resources, subjects, states, or environments. Short-lived session claims may be a cache,
never the authority after suspension or revocation. Row-level controls are defence in
depth, not a substitute for application authorization or resource ownership checks.

This is bounded RBAC, not a generic policy engine, EAV permissions store, organization
suite, or multi-tenant product. A new role or permission ships only with a named resource
and action, least-privilege matrix, separation-of-duties analysis, lifecycle owner,
audit contract, abuse cases, and exact implementation paths.

### Seller roles and permissions

The initial role family is:

| Role | Permitted direction | Explicit limits |
|---|---|---|
| `seller_owner` | Manage a proved place-control claim; request scoped manager/staff assignments; maintain permitted place facts; explicitly publish or withdraw approved contact channels | Cannot approve the owner's own verification, moderation, appeal, or accuracy; cannot transfer control without re-verification; no fulfilment authority |
| `seller_manager` | Maintain permitted place facts and seller submissions; manage staff only when separately granted | Cannot transfer ownership, widen its own scope, infer contact consent, approve verification, or publish contact without the specific permission |
| `seller_staff` | Submit attributed price, availability, hours, and correction claims for assigned places and capabilities | Cannot manage membership, ownership, contact publication, verification, moderation, or badge decisions |

Later role templates may include `moderator`, `field_operator`, `support`, and
`community`, but none exists merely because it is named here:

- a moderator may review assigned content and claims but cannot approve their own work;
- a field operator may contribute attributed evidence but gains no seller control;
- support may explain or assist a workflow but cannot impersonate a subject, approve a
  claim, publish contact, or silently mutate protected data; and
- a community role must be defined around specific resources and actions and receives no
  administrative permission by default.

Every public or private seller dashboard view is filtered to the same effective scope as
its mutations. An assignment to one place or business reveals nothing about another.

### Business and place-control verification

Seller onboarding is an evidence-backed claim workflow, not a form that awards a role.
Business verification and place-control verification are recorded separately. Evidence
must be proportionate to the risk, minimized, private to authorized reviewers, protected
from public delivery, and deleted or tombstoned under an approved retention schedule.

Canonical claim states are:

`draft` → `pending` → `needs_info` → `approved`, `rejected`, `suspended`, `revoked`, or
`expired`.

Approval requires a reviewer who is not the claimant. Higher-risk control transfer,
conflicting claims, contact publication, or reinstatement may require a second reviewer.
Approval records the specific business/place, evidence classes considered, reviewer,
reason code, decision time, and expiry or re-check date. It never records a vague
account-wide “verified seller” truth.

Conflicting control claims fail closed and enter moderation. Suspension immediately
removes protected access and public assertions while preserving the minimum evidence
needed for review. Revocation invalidates derived assignments in that scope. Expiry
requires re-verification rather than silent renewal.

### Moderation and appeals

Verification, role, seller submission, contact, and accuracy decisions use named reason
codes and deterministic lifecycle states. A claimant can see a safe explanation and
submit one bounded appeal with new evidence. An appeal is reviewed by someone other than
the original decision-maker and claimant. Support cannot decide the appeal.

Emergency suspension is allowed for credible safety, fraud, account-takeover, or
place-control risk, but it is audited, time-bounded pending review, and cannot become an
unreviewed permanent punishment. Restoring access requires explicit review; deleting a
UI flag is not reinstatement.

The audit record contains a random request identifier, actor reference, action, resource
and scope, before/after lifecycle or permission state, reason code, reviewer reference,
timestamp, and redacted evidence reference. It excludes raw identity documents, contact
values, secrets, Auth tokens, free-form evidence, and provider responses. Audit access
and retention are themselves scoped and approved.

### Explicit contact-publication consent

Storage, verification, place control, a seller role, and contact publication are five
different decisions. Contact remains private unless an authorized person performs a
separate affirmative publication action.

Consent is:

- bound to one place, channel kind, exact value, and audience;
- preceded by a preview of the exact public value and where it will appear;
- recorded with the consenting subject, authority, purpose, time, and policy version;
- revocable without losing the underlying seller or place-control claim; and
- re-collected when the value, audience, place, controller, or material policy changes.

Only the owner, or a manager with the separately enumerated publication permission, may
publish or withdraw a channel. Phone, WhatsApp, email, or another contact value must
never be inferred from Auth identity, business evidence, a profile, or another place.
Withdrawal makes the value unavailable to public reads immediately and records an audit
event. Historical raw values do not remain in ordinary logs, analytics, caches, or
appeal copy.

The eventual public resolver must return a contact value only on an authorized,
currently consented branch. Other branches must have no value field to serialize.
“Contact seller” remains unavailable until that server boundary and consent lifecycle
are implemented and proved.

### Earned seller accuracy and badge

Seller accuracy is a place-and-capability-scoped projection over seller-authored updates
that later receive independently admissible outcomes, corrections, or resolved disputes.
It requires a published minimum sample size, evaluation window, uncertainty rule,
anti-gaming controls, and expiry/recalibration policy. Submission volume alone is not
accuracy.

No accuracy score or badge may exist before the contribution-integrity write path and
outcome ledger can distinguish authors, claims, independent observations, corrections,
moderation, and conflicts. Seller self-confirmation and accounts under the same business
or control graph do not count as independent corroboration.

A future badge may communicate a narrow assertion such as “Accurate seller updates” only
when its scope, evidence window, sample size, and recency are accessible. It must not say
or imply “trusted,” “official,” “licensed,” “safe,” or “verified seller” unless a
separate current assertion supports that exact wording. It expires or disappears when
evidence becomes insufficient, control lapses, or qualifying activity is suspended.

Accuracy and badges cannot be purchased, accelerated by payment, exchanged for volume,
or used as rewards for engagement. They do not automatically raise an offer's
current-state confidence, its rank, or the admissibility of seller-authored evidence.
ADR-015 remains the authority for public Food confidence.

### Future role extensibility

New role families reuse the assignment, permission, lifecycle, moderation, appeal, and
audit contracts. They do not reuse seller verification or seller accuracy unless the
new role's resource and evidence semantics genuinely match.

Before any new role activates, its owner must document:

1. the resource/action permission matrix and deny-by-default behavior;
2. enrollment and independent approval evidence;
3. conflicts of interest and prohibited combinations;
4. suspension, revocation, expiry, re-verification, and appeal;
5. private and public data exposure;
6. audit and retention;
7. rate limits and abuse cases; and
8. exact source, schema, migration, UI, and release claims.

A new role that changes product meaning, public trust language, privacy, or security
requires an ADR amendment or a new ADR.

## Implementation ordering

Seller onboarding follows Food truth and contribution integrity; it does not compete
with them for a migration number or hot path.

Before P1:

- ADR-015's observed-only Food truth must be wired and independently proved across live
  contribution and read surfaces;
- the exact applied migration lineage through provenance and ingestion must be proved for
  the target;
- corrected Presence `0012` must be applied and proved on that target; and
- the separately controlled contribution-integrity migration at `0013` or later must be
  applied and proved with attributed, idempotent, moderated writes and outcome evidence.

The controller assigns the next available seller migration only after reconciling that
ledger. This ADR reserves no migration number.

### P1 — authorization foundation

Future exact claim:

- subject, role-template, permission, scoped-assignment, lifecycle, and audit desired
  state;
- the next controller-assigned migration plus snapshot/journal evidence;
- server-side deny-by-default authorization and resource-scope checks;
- suspension/revocation propagation and separation-of-duties constraints; and
- disposable blank/upgrade migration, cross-scope denial, stale-session, and audit
  refutation.

P1 owns no seller onboarding UI, verification decision, contact publication, seller
badge, fulfilment, or shared rollout.

### P2 — seller onboarding, consent, and operations

After P1:

- business and place-control claim/evidence workflows;
- owner, manager, and staff invitation/acceptance within proved scope;
- moderation, conflict, suspension, revocation, expiry, and independent appeal;
- explicit per-place/per-channel/per-value/per-audience contact-publication and
  withdrawal consent;
- bounded seller dashboard reads and writes; and
- privacy, retention, rate-limit, account-takeover, and cross-place end-to-end
  refutation.

P2 does not authorize an accuracy badge. Public contact remains off until its exact
consent and server-return boundary passes independently.

### P3 — earned accuracy and later roles

After P2 and sufficient independently evaluated seller outcomes:

- a calibrated seller-accuracy projection with published scope, window, sample, and
  uncertainty;
- narrow, expiring, non-purchasable public badge copy;
- manipulation, related-account, moderation, appeal, grayscale/accessibility, and public
  comprehension refutation; and
- one separately claimed future role at a time using the extensibility checklist.

No P3 assertion may alter Food confidence or ranking without its own accepted trust
decision and evidence.

## Validation gates

Independent security, privacy, trust, and product review must default to refuted unless
it can show:

- role truth is application-owned and provider-independent;
- every protected read and mutation is denied outside current subject/resource/action
  scope;
- suspension and revocation defeat cached or stale claims;
- claimants, support staff, and original reviewers cannot self-approve or decide appeals;
- business proof, place control, role, contact consent, accuracy, and confidence remain
  separate;
- contact values cannot leak before consent, across places, after withdrawal, or through
  logs and caches;
- seller-authored or related-party activity cannot manufacture independent outcomes;
- payment, sponsorship, subscription, or volume cannot buy identity/business
  verification, place-control approval, a role, lifecycle/status, accuracy, ranking, or
  a badge;
- audit is sufficient to reconstruct decisions without retaining raw sensitive evidence;
- every public assertion states its exact scope and lifecycle;
- anonymous browse remains available; and
- no seller path introduces fulfilment or transaction semantics.

## Consequences

- Seller onboarding is slower than awarding an account flag, because place control and
  conflicts require evidence and independent review.
- Roles are reusable without making authentication metadata or a generic policy engine
  the product's authorization authority.
- Contact publication becomes a revocable consent lifecycle rather than a side effect of
  onboarding.
- Seller accuracy can be earned only after contribution integrity and independent
  outcome evidence exist.
- No code, schema, migration, provider call, dashboard, badge, contact publication,
  deployment, pilot, or public rollout is authorized by this documentation change.
