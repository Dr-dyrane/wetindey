# Discovery: Seller correction link (WD-I-004)

**Date:** 2026-07-22
**Stage:** Discovery (register entry WD-I-004)
**Accountable function:** Seller/Community Operations
**Author function:** Product & Portfolio, Discovery deliverable
**Authority:** None. This is a Discovery deliverable, permission to learn inside a stated
non-implementation boundary.

> This document records what has been learned and what to decide next. It authorizes no
> lane, schema, migration, provider call, application code, deployment, pilot, or public
> rollout, and it mutates no shared database. It changes no product behavior. A feature it
> describes is built later, if approved, in a separately claimed lane under `LANES.md`,
> fail-closed and default-off, with migrations generated and not applied. Per the register
> movement controls, a Discovery deliverable satisfies no dependency and creates no scope.

## 1. Purpose and boundary

WD-I-004 asks a narrow question: can a seller who sees a wrong price, stock state, contact
detail, or hours reach a simple, safe route to request a correction about their own place or
offers, without that request becoming automatic public truth or purchased trust.

This deliverable produces the four Discovery exits the register requires, an evidence
summary, options, risks, and a recommendation, plus the exact next question. It takes no
product decision.

### Anchoring decisions

The seller-ownership direction for this Discovery is [ADR-022](../../adr/022-earned-seller-and-role-onboarding.md)
(Accepted, architecture and policy only; implementation unclaimed) and its proposed contact
continuation [ADR-029](../../adr/029-seller-contact-ownership.md) (Proposed, pending Founder
acceptance). The correction mechanics are governed by
[ADR-019](../../adr/019-contribution-integrity-and-moderation.md) (Accepted), whose invariant 8
already states that a correction is an append-only new observation entering moderation
independently, never an in-place rewrite.

ADR-029 is the "ADR-029 seller-ownership direction" this Discovery was told to be consistent
with. It is Proposed, not Accepted. Per register movement control 3, a proposed ADR cannot
satisfy an accepted-ADR dependency, so this deliverable anchors seller-ownership on the accepted
ADR-022 and ADR-019 for any dependency, and treats ADR-029 as the proposed directional
continuation to be reconciled if and when it is accepted. ADR-029 is directly on-point: it
resolves contact ownership at the semantics level and, in its invariant 6, names "the
seller-correction route captured as WD-I-004" as a seller-authored, consented, moderated action.
This deliverable is consistent with that direction while depending on none of it.

Also binding: [ADR-001](../../adr/001-fulfilment-is-out-of-scope.md) (contact is a handoff,
never fulfilment), [ADR-003](../../adr/003-identity-for-contribution-trust.md) (a contribution
needs an author; sign-in is recognition, not a publication bypass), and
[ADR-028](../../adr/028-contribution-evidence-media.md) (an optional correction photo enters
the same fail-closed pending boundary). Note that
[ADR-007](../../adr/007-contact-belongs-to-a-seller-not-a-place.md) is Rejected: the model of
record is one place equals one stall equals one trader equals one contact, so "seller" here
means a person with a proved place-control claim over an existing `place`, not a new vendor
entity.

## 2. Evidence summary

Register grade for WD-I-004 is **D**: seller correction is an identified operating need, but no
validated seller workflow, control proof, or abuse model exists. This deliverable does not raise
that grade; it clarifies what is already decided versus what is genuinely open.

What the accepted architecture already settles, so it is not open in Discovery:

1. **The correction mechanism exists in policy.** ADR-019 invariant 8 makes a correction an
   append-only observation linked to the assertion it corrects, entering pending moderation on
   its own. Invariant 1 forbids in-place rewrite of the earlier claim and forbids deleting
   immutable history. So "let a seller correct information" does not need a new write model; it
   reuses the ADR-019 boundary.
2. **A submission is evidence, not truth.** ADR-019 invariants 6 and 7, and ADR-022's
   separation of concepts, mean a seller correction cannot auto-approve, cannot by itself blank
   a result or change a projection, cannot raise confidence, and cannot count as independent
   corroboration when it comes from the seller or a related-control account.
3. **Seller identity is not sign-in.** ADR-022 states that sign-in does not create a seller and
   that place control must be proved separately; a role is not identity, trust, or a status
   shortcut. So a "seller correction link" that trusts self-declared sellerhood asserts
   something the architecture explicitly refuses to assert.
4. **Contact correction is a consent action, not a data fix.** ADR-022 keeps storage,
   verification, place control, role, and contact publication as five separate decisions.
   Editing or publishing a contact channel is an affirmative, previewed, per-place, per-value
   consent event, not a field correction. ADR-029 (Proposed) sharpens this for WD-I-004
   specifically: a contact belongs to a consenting seller identity and never to a place, and
   its invariant 6 already routes the WD-I-004 contact-correction case as a seller-authored,
   consented, moderated action that never auto-publishes and never exposes an unconsented value.
   ADR-001 confirms contact is a handoff only. So the contact dimension of WD-I-004 has a clear
   proposed answer; the open questions concern the non-contact fields.
5. **A correction photo is already governed.** ADR-028 admits an optional corroborating photo
   through the same fail-closed pending boundary, sanitized on ingest and gated to approved
   reports. A seller correction that attaches a photo inherits that, unchanged.

What is genuinely open, and is the real subject of this Discovery:

- **The identity gate for non-contact fields.** Whether the correction link for price, stock,
  and hours must be gated behind ADR-022 proved place-control before it may be presented or
  weighted as a *seller* correction, or whether WD-I-004 is satisfied there by an ordinary
  attributed, moderated correction available to any authenticated contributor with no ownership
  claim and no elevated trust. The *contact* field is not part of this fork: ADR-029 (Proposed)
  already routes contact through the seller identity and consent lifecycle.
- **The unbuilt substrate.** ADR-022's authorization foundation (its P1) and seller onboarding
  and consent (its P2) are unclaimed and reserve no migration number. ADR-019's write boundary
  (migration `0013` or later) is itself not yet activated for public reporting. Any
  ownership-bearing seller path is downstream of work that does not exist yet.
- **No field evidence.** No seller workflow interview, no abuse model, and no control-proof
  design exists (register: Grade D, smallest learning step still outstanding). The register's
  own next step, seller workflow interviews mapping the minimum consent, identity/control,
  reason, evidence, review, status, and appeal states on a non-live prototype, has not been run.

## 3. Options

Discovery presents options; it does not select one.

### Option A: No dedicated seller path

Sellers use the same ADR-019 correction boundary as any contributor. No new surface, no
"seller" label, no ownership claim.

- Cheapest and safest against impersonation and self-dealing, because it grants nothing a
  correction did not already have.
- Does not deliver WD-I-004's stated intent (a route tied to *their own* place), so it answers
  the need only in the weakest sense.

### Option B: Attributed correction with a self-declared "about my place" reason

An authenticated actor files a correction and marks it as concerning a place they say they
control. The mark is a moderator hint and reason code only. It grants no trust, no elevated
weight, and no publication, and it changes nothing until moderated.

- Improves moderator context and gives the seller a felt route, with no place-control proof
  required.
- Risk of misleading UX: calling it a "seller" correction while proving no sellerhood invites
  impersonation framing and self-dealing volume. Must not label the actor "seller" or
  "verified" anywhere public.

### Option C: Gate the seller correction link behind ADR-022 place-control

Only a `seller_owner`, `seller_manager`, or `seller_staff` with a proved, in-scope place-control
claim may use the seller correction affordance (ADR-022 role table already grants staff
"attributed price, availability, hours, and correction claims for assigned places").

- Strongest alignment with the seller-ownership direction and strongest against impersonation
  and self-dealing meaning, because the "seller" claim is backed by evidence-reviewed control.
- Fully downstream of ADR-022 P1 and P2, which are unclaimed and reserve no migration. Not
  available for the near-term Food pilot. Heavy for the problem's current evidence grade.

### Option D: Separate the mechanism from the identity claim, and sequence

Treat the append-only moderated correction (ADR-019, Option A/B mechanics) as the immediately
governable part, and reserve the ownership-bearing "verified seller correction" affordance for
after ADR-022 place-control exists. The correction link ships, if approved, as an attributed
moderated correction with no ownership assertion; the *seller* meaning is added only when
ADR-022 can back it.

- Delivers a safe route sooner without minting an unbacked trust claim, and keeps the harder
  identity decision where it belongs (ADR-022), avoiding a short-circuit of place-control.
- Requires discipline in copy and data so the interim path never implies sellerhood or
  verified status.

## 4. Risks

### Impersonation (primary)

A "seller correction link" that accepts self-declared sellerhood lets anyone assert control of
a place they do not control: to blank or degrade a rival stall, alter a competitor's hours, or
push a contact change. ADR-003 records that without a proved author there is no accountability,
and ADR-022 refuses to treat sign-in, provider metadata, or a profile as place control.
Mitigation is structural, not cosmetic: the correction must remain pending evidence into
moderation (ADR-019), must grant no trust or weight before an authorized decision, and any
*seller* or *verified* framing must be withheld until ADR-022 place-control is proved. A
data-minimized subject and durable rate enforcement (ADR-019 invariants 3 and 4) bound
volume-based impersonation.

### Self-dealing (primary)

A genuine seller correcting their own place has an incentive to misrepresent: favorable price
or availability on self, unfavorable on rivals, or premature publication of a contact channel.
The controls already exist and must not be relaxed: a seller-authored claim is not independent
observed evidence (ADR-022), the seller and related-control accounts do not corroborate
themselves (ADR-022, ADR-019 invariant 7), one report cannot blank a result, a correction
cannot raise confidence or buy accuracy or a badge (ADR-022), and approval is a human
moderation decision, never automatic (ADR-019 invariants 6 and 8). Accuracy earned from later
independently resolved outcomes stays the only path to any seller-accuracy signal, and it is
out of scope here.

### Contact-publication consent (secondary)

A "correction" to a phone, WhatsApp, or email value is not a data fix; it is an affirmative,
previewed, per-place, per-channel, per-value, per-audience consent event that only an owner, or
a manager with the separately enumerated permission, may perform, and it is revocable (ADR-022).
ADR-029 (Proposed) makes this explicit for WD-I-004: the contact belongs to a consenting seller
identity, not to the place, and a contact change is a seller-authored, consented, moderated
action (its invariant 6). Treating contact as an ordinary correction field would leak PII before
consent and cross the ADR-001 handoff boundary. Contact correction must be routed to the seller
consent lifecycle, not the report correction path.

### Immutable history and deletion (secondary)

A correction cannot delete or rewrite the assertion it corrects (ADR-019 invariant 1). Lawful
data-subject handling redacts separately governed personal data without fabricating a different
historical claim. A seller cannot use "correction" to erase conflicting approved evidence.

### Evidence-media abuse (secondary)

If a correction attaches a photo, it inherits ADR-028: sanitized on ingest, fail-closed pending,
no faces or PII in any approved public image, gated to approved reports, and never standalone
truth. No new media surface is opened by a seller correction.

## 5. Recommendation

The correction *mechanism* WD-I-004 asks for is already decided and needs no new decision: an
append-only, attributed, moderated correction into the ADR-019 boundary. The *seller* meaning,
a correction that is trusted or labelled because a person controls the place, is exactly the
place-control claim ADR-022 governs, is downstream of ADR-022 P1 and P2 (unclaimed) and of the
ADR-019 write boundary (not yet activated), and must not be short-circuited by any self-declared
gate.

Therefore the recommended Discovery posture is **Option D**: keep the mechanism where it already
lives (ADR-019), and treat the ownership-bearing seller affordance as blocked on ADR-022
place-control and, for the contact field, on the ADR-029 seller-contact-ownership direction once
it is accepted. Do not build, and do not
advance to Candidate, until the one fork below is answered, because that fork decides whether
WD-I-004 is a small moderation-reason and copy addition on an existing boundary or a downstream
consumer of an unbuilt authorization lane. Before either, run the register's stated smallest
learning step: seller workflow interviews and a non-live prototype mapping the consent,
identity/control, reason, evidence, review, status, and appeal states. This deliverable
authorizes none of that build; it recommends the sequence.

### The exact next question

For the non-contact correction fields (price, stock, hours), does a correction have to be backed
by proved place-control under ADR-022 before it may be labelled or treated as a *seller*
correction, or is WD-I-004 satisfied there by an attributed, moderated, append-only correction
available to any authenticated contributor with no ownership claim, no elevated trust or weight,
and no contact side effect? (The contact field is excluded from this fork: ADR-029, once
accepted, routes it through the seller identity and consent lifecycle.)

Answering "requires place-control" routes WD-I-004 behind ADR-022 P1 and P2 and holds it until
that lane exists. Answering "attributed moderated correction is enough" scopes WD-I-004's
non-contact fields to a reason-code and copy addition on the existing ADR-019 boundary, with
contact corrections still excluded and routed to the ADR-022 and ADR-029 seller consent
lifecycle. Either answer is a Founder-level consequential choice (register: seller identity,
consent, moderation, and abuse policy) and must precede any Candidate decision or lane.

## 6. Non-goals

This Discovery does not design a seller dashboard, a verification workflow, a contact-publication
flow, an accuracy score or badge, a reputation model, a moderation UI, or a rewards mechanism. It
does not revive a `vendors` table or a marketplace, does not add fulfilment, does not change
ADR-015 admissibility or confidence, does not reopen public reporting, and does not claim a
migration number.

## 7. Decision history

- 2026-07-22: Discovery deliverable produced for WD-I-004. Evidence summary, options, risks, and
  recommendation recorded. No approval, no Candidate movement, no lane. Next action is the exact
  question in section 5, to be taken to Founder review with the register's smallest learning step.
