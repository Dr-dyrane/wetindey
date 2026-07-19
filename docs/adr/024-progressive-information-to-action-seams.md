# ADR-024: Progressive information-to-action seams

**Date:** 2026-07-18
**Status:** Proposed
**Owners:** Dr Dyrane Alexander

## Context

WetinDey currently helps a person decide where to go. The live path is discovery →
item/place detail → Get It:

- Get It can open Apple Maps, an Android maps application, or Google Maps;
- Share uses the native share sheet, clipboard, or visible text fallback;
- route preview requests exact origin/destination geometry from Mapbox as soon as Get It
  opens;
- Contact seller is display-only because no server result exposes a consented channel;
- place-detail offer rows are informational and inert;
- canonical `/place/[slug]` pages exist, but Get It still shares a Google Maps coordinate;
- share copy says `Price confirmed` whenever it has a timestamp, regardless of
  availability, provenance, or confidence;
- the current public review read can return a stable account identifier and can fall back
  to account email as reviewer name; and
- no cart, checkout, seller-order, courier-dispatch, delivery, or tracking capability
  exists.

ADR-001 correctly blocks WetinDey from pretending that a dated observation is committed
inventory or a quotable transaction. ADR-022 separately requires proved place control and
affirmative contact-publication consent. The Founder has directed a progressive path from
information to action, without turning WetinDey into a marketplace, payment processor, or
logistics operator.

This proposal does not yet supersede ADR-001. Until separately accepted by the Founder,
ADR-001 remains the binding decision and no cart, courier, delivery, tracking, or order
seam is authorized.

## Proposed decision

If accepted, WetinDey may extend only four bounded seams:

1. seller-approved contact;
2. explicit allowlisted external redirects or deep links;
3. minimal structured handoff payloads disclosed before transfer; and
4. read-only display of status actually returned by the external provider.

WetinDey would continue to own the local information and confidence experience, not the
external transaction.

### Progressive action ladder

#### Stage 1 — Information and confidence

The existing foundation remains primary:

- subject, variant, unit, and place;
- observed availability and price or range;
- freshness and evidence timestamp;
- provenance and confidence;
- distance and place detail; and
- limitations, conflict, Sample, and unavailable states.

Stage 1 never describes observed information as inventory, a quote, or a seller promise.

#### Stage 2 — Direct action

Complete the seams already implied by the product:

- Go there;
- share the canonical WetinDey item, offer, or place URL;
- resolve an explicitly published seller contact channel; and
- open a seller-owned ordering destination when the seller has separately approved it.

Contact and ordering destinations are unavailable, not fabricated, when consent,
validation, place control, current authorization, or destination evidence is missing.

#### Stage 3 — External commerce handoff

An explicit user action may hand off to a seller or partner destination. The disclosed
payload may include only the fields necessary for that chosen action:

- item, variant, unit, and user-entered quantity;
- selected observed offer and place;
- displayed price or range, labelled as an observation;
- evidence timestamp and provenance label;
- public destination;
- buyer-selected pickup or delivery intent; and
- an opaque, single-purpose return/correlation value when required.

The user sees the receiving provider and transferred field classes before leaving.
Precise device origin follows ADR-023 and is omitted unless fresh, necessary, separately
disclosed, and explicitly chosen.

The payload excludes stable WetinDey auth IDs, account email, profile phone, unrelated
contact data, hidden seller evidence, trust internals, and any field not required by the
selected provider action.

#### Stage 4 — Provider-returned status

WetinDey may later display a provider's returned status, such as accepted, preparing,
courier assigned, picked up, arriving, delivered, cancelled, failed, or tracking
unavailable. Every value is:

- namespaced to and attributed to the provider;
- accompanied by the provider-observed time;
- presented as an external state, not a WetinDey fact;
- unknown when the provider is unavailable or the correlation cannot be proved; and
- read-only unless a separately accepted decision authorizes a new action.

No status may be inferred from browser blur, page visibility, redirect initiation, return
to the app, or elapsed time.

### Separate state domains

Evidence confidence, handoff state, and provider commerce/order state are different
domains:

| Domain | Examples | Must never imply |
|---|---|---|
| WetinDey evidence | observed, Sample, stale, unavailable, confidence band | seller acceptance, inventory reservation, checkout, dispatch |
| Handoff | not started, opening, returned, failed, unknown | external action success |
| Provider status | provider-returned accepted/preparing/delivered/cancelled | higher Food confidence, seller verification, or WetinDey fulfilment |

A fresh observation does not mean an order was accepted. A seller redirect does not mean
checkout succeeded. A courier redirect does not mean a courier was booked.

## Seller consent and revocation

Contact or ordering publication requires:

- proved current place control under ADR-022;
- current scoped authorization;
- separate affirmative consent for one place, channel, exact value or destination, and
  audience;
- channel/destination validation;
- grant and withdrawal evidence;
- immediate removal from public resolution after withdrawal; and
- redacted audit that stores neither raw contact values nor full handoff URLs.

The server boundary returns a discriminated result. Withheld, missing, expired, revoked,
unauthorized, and error branches have no contact or destination value field.

Onboarding, authentication, business verification, a seller role, a badge, or a
non-null database column never implies publication consent.

## Redirect and payload safety

- Every redirect is initiated by an explicit user action and names the destination.
- HTTPS is required for web destinations. OS schemes such as `tel:`, `sms:`, and `geo:`
  are separately allowlisted by action and validated before use.
- Host, scheme, path contract, catalog/place mapping, and payload fields fail closed.
- New-window handoffs use appropriate opener/referrer isolation; current-tab fallback
  cannot silently add fields.
- A safe cancel/return path preserves the WetinDey information state.
- Failures say that the handoff or status is unavailable; they do not claim an order,
  payment, delivery, or seller failure.
- Any action capable of creating durable external state requires an idempotency or
  provider correlation contract before retry.
- Provider credentials, terms, health, consent, or a kill switch may disable one seam
  independently. Discovery and evidence remain useful without any provider.

Logs, analytics, error reports, and URLs must not capture precise user location, contact
values, tokens, fragments, external order identifiers, or full structured payloads unless
a separately approved minimum-retention contract requires an opaque identifier.

## Explicitly retained exclusions

Even if this proposal is accepted, WetinDey does not:

- run checkout, a cart, wallet, escrow, payment, settlement, refund, or funds flow;
- create or own an order;
- dispatch, assign, employ, or track a courier as WetinDey;
- guarantee price, inventory, seller response, fulfilment, pickup, delivery time, or
  delivery completion;
- automatically enrol a seller, publish contact, or infer consent;
- rewrite provider state as WetinDey evidence;
- promote seller/provider outcomes into Food confidence or seller verification; or
- make browsing or the information path depend on an external commerce provider.

## Architecture and no-dead-service rule

No generic `ActionService`, provider registry, cart/order table, webhook surface,
fulfilment module, or tracking engine is built in anticipation of a provider.

The first implementation must own one complete live vertical in one change: visible call
site, strict server validation, consent/allowlist decision, redirect or provider adapter,
failure/disablement state, and—only when the provider really returns one—attributed status
display. If a path owner cannot wire the live call site, it must not create the
capability.

A second real provider with a second complete live vertical is the earliest point at
which a shared provider-neutral abstraction may be extracted. Interfaces are derived
from those two live contracts, not invented first.

## Schema timing

| Timing | Boundary |
|---|---|
| Required before seller contact | Typed contact channel, normalized value, place control, scoped authorization, explicit publication grant/withdrawal, and audit under ADR-022 |
| Required before a persisted handoff | Only the minimum opaque idempotency/correlation receipt proved necessary by one live provider |
| Required before returned-status history | Append-only provider-attributed status events with access, retention, deletion, and replay rules |
| Not authorized or necessary | Generic orders, carts, payments, shipments, riders, dispatch, delivery fees, or speculative provider registries |

This proposal allocates no migration number and authorizes none of these shapes.

## Immediate safety corrections independent of acceptance

The audit found current truth/privacy defects that do not require accepting commerce:

- exact route origin must not leave merely because Get It opened;
- public review DTOs must not expose stable auth IDs or account email;
- share copy must reflect actual availability, provenance, confidence, and freshness;
- canonical WetinDey place sharing must not be bypassed by a stale no-route assumption;
- Contact seller must remain unavailable until ADR-022 consent resolution exists; and
- informational place rows must not be presented as actionable.

Those corrections require separate exact implementation claims. This proposed ADR does
not authorize them.

## Alternatives considered

### Keep ADR-001 unchanged forever

Safe but incomplete. It preserves the evidence product while leaving every action after
discovery to an ungoverned external improvisation.

### Build a WetinDey marketplace

Rejected. It requires committed inventory, price quotation, buyer identity, funds,
orders, disputes, delivery operations, and regulatory boundaries the evidence model does
not provide.

### Integrate one courier directly into Get It

Rejected. It hard-codes a provider into the map UI, confuses redirect with dispatch, and
creates a dead/provider-specific service before seller contact works.

### Treat provider status as trust evidence

Rejected. External fulfilment outcomes answer a different question from whether a local
price or availability observation was reliable.

## Consequences if accepted

Users could act without WetinDey pretending to fulfil. The product would gain additional
privacy, consent, redirect, provider, failure, and retention obligations. Some actions
would be unavailable more often because malformed, revoked, stale, or unproved
destinations fail closed.

## Proposal and implementation boundary

This ADR is **Proposed**. It does not supersede ADR-001, authorize implementation, claim
paths, allocate schema or migrations, select a provider, permit provider configuration,
or authorize tests, deployment, traffic, or rollout.

Only a separate explicit Founder acceptance can change ADR-001's binding exclusions.
After acceptance, each stage still requires an exact controller claim and independent
privacy, security, product-truth, and runtime evidence.

## Validation and independent review

The proposal defaults to **REFUTED** unless review can establish:

- every permitted action is explicit, consented where necessary, minimal, attributable,
  revocable, and independently disableable;
- withheld/error branches contain no contact or destination value;
- evidence, handoff, and provider-status states cannot be confused in type or copy;
- no redirect, return, or browser lifecycle event is treated as external success;
- privacy and retention cover contact, location, payload, correlation, and status data;
- the architecture creates no dead service, speculative registry, or uncalled interface;
- ADR-001 remains binding while this ADR is Proposed; and
- no implementation authority is implied by recording the proposal.
