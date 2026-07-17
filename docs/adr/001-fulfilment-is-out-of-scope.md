# ADR-001: Fulfilment is out of scope; buyer and seller arrange it themselves

**Date:** 2026-07-16
**Status:** Accepted
**Owners:** Dr Dyrane Alexander

## Context

User research approved "some layer of delivery", which opened the question of how
WetinDey should fulfil an item a user has just found. Three candidate models were
investigated:

1. **Platform delivery API** — integrate a courier API (Chowdeck Relay, Uber Direct,
   Glovo, Kwik, Errandlr, or an aggregator) and dispatch a rider.
2. **Errand / buy-for-me** — a runner goes to the specific market, buys the specific
   item at whatever it costs that day, and delivers it.
3. **Neither** — the buyer and the seller arrange fulfilment between themselves.

The research behind (1) is recorded in `docs/research/DELIVERY-API-LAGOS.md`, which is
**superseded by this ADR** and retained only as market evidence.

Three findings decided this:

**The catalogue does not match any delivery platform's catalogue.** `places.place_type`
is `open_market`, `supermarket`, `kiosk` (`src/db/schema/index.ts:103`) — market stalls.
Courier platforms deliver from their own vendor catalogues. A handoff from a Mile 12
offer lands the user on a different seller, at a different price, for a different item.
That directly contradicts the product's core claim.

**A WetinDey price cannot be quoted.** Prices are observations with an age and a range
(`priceMin`/`priceMax`, `observedAt`), not commitments. `src/lib/trust.ts` encodes a
24h/72h freshness policy and a decay curve precisely because a price is a *report*, not
an *offer*. `GetItSheet.tsx:233` states the rule directly: a price without an age "is a
rumour". Any fulfilment model must answer "what will the customer pay?", and the data
model is structurally unable to answer it. That gap can only be closed with a deposit, a
settlement flow, or someone absorbing the variance — all of which are a different product.

**Fulfilment reverses three accepted decisions.** Bible Section 2.5 lists "a delivery
marketplace" under *What WetinDey is not*. Bible Section 40.1 records `No checkout/delivery in
V1 | Accepted | Protect core decision experience` and `Anonymous browse | Accepted`. An
order needs an identity, an address, and a payment method; none exist, by design.

## Decision

**WetinDey does not fulfil orders.** It answers "what does it cost, where is it, and how
old is that claim". Fulfilment is arranged directly between buyer and seller.

The **Contact seller** affordance in `GetItSheet` is the designated surface for this. Its
job is to hand off a channel, not to broker, track, price, or guarantee a transaction.

Concretely, out of scope until a superseding ADR: courier/delivery API integrations,
dispatch, order tracking, cart, checkout, payments, escrow, wallets, delivery fees, and
any table or module modelling an order or a shipment.

## Alternatives considered

**Chowdeck Relay integration.** The strongest API candidate: real docs, Bearer auth,
self-serve signup, an owned rider fleet doing ~40k deliveries/day across Lagos. Rejected
on product grounds, not technical ones — its API is merchant-scoped with no vendor
discovery, so it cannot represent a Mile 12 stall, and it would deliver a substitute item
at a substitute price. It also cannot serve as a price source: there is no way to
enumerate merchants.

**Uber Direct.** Not available in Nigeria. Uber Eats never launched here; the Nigerian
Uber Direct merchant page 404s while other locales resolve. Not viable at any price.

**Errand / buy-for-me.** The only model honest to the data, since the runner buys *that*
item at *that* market. Rejected as a different company: it requires committing to a price
the data cannot commit to, fronting cash for goods, identity, addresses, payment, and
plausibly CBN-regulated money handling. It also strains physically — the catalogue prices
units like a 50 kg bag, and Lagos errand couriers are predominantly motorcycles.

**Deep-link handoff to a delivery app.** Cheap to build and briefly attractive, but it
inherits the catalogue mismatch: the link cannot carry "this item from this stall", so it
lands the user in a different shop. A trust bug wearing a convenience feature.

## Consequences

**Improves.** Scope stays the decision experience. The three accepted decisions above
hold without amendment. No payments, no PII beyond what already exists, no counterparty
risk, no regulatory exposure. Fulfilment failures cannot be attributed to WetinDey.

**Worsens.** The user reaches the end of the journey inside the app and must leave it to
act. If research showed real demand for delivery, this ADR does not satisfy it — it
declines to satisfy it badly. That demand should be revisited, with evidence, later.

**The load-bearing gap this creates.** Contact seller is now the terminal step of the
core journey, and **it currently works for zero places**:

- `places.contact_visibility` defaults to `'private'` (`src/db/schema/index.ts:109`), so
  `GetItSheet`'s contact row renders "Not shared" for every place in the database.
- `contact_channel_kind` / `contact_channel_value` exist (`src/db/schema/index.ts:129-130`)
  but **nothing writes them, nothing reads them, and no seed data populates them**.
  `getPlaceContactPolicy` (`src/app/actions.ts:1222`) does not even select them.
- No trader has consented to being contacted, because no consent mechanism exists.

This ADR therefore does not complete the journey; it *names who completes it*. Making
Contact seller real requires trader onboarding and consent capture (Bible Section 24, market
operations) — a data-operations problem, not a UI one. Until that exists, the honest
behaviour is the current one: say "Not shared" and do not pretend otherwise.

**Reversibility.** Cheap to reverse. Nothing here is built, so nothing must be unbuilt. A
future ADR may revisit fulfilment if the price-quotability problem is solved first — that
is the precondition, not the delivery integration.

## Validation and review

Reconsider when **all** of the following hold:

1. Trader contact consent exists and a material share of places carry a usable channel —
   without it there is no baseline to compare a delivery feature against.
2. Evidence shows users want fulfilment *after* reaching a seller, not merely in the
   abstract. Instrument the Contact seller handoff; a user who never contacts a seller is
   not asking for delivery.
3. The price-quotability problem has a designed answer. Until a WetinDey price can become
   a number someone will honour, no fulfilment model is coherent.

Until then, treat any proposal to integrate a delivery API as blocked by this ADR.
