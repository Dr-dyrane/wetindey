# Delivery Integration: Decision Memo

**Date:** 2026-07-16 · **Audience:** the engineer who has to ship this week

---

## 1. Bottom line

**Integrate Chowdeck Relay first.** It is the only option that clears all four bars at once: it dispatches real riders on-demand inside Lagos, its docs are real and fetchable, auth is a plain `Authorization: Bearer <secret>` header, and signup is self-serve at `dashboard.chowdeck.com` with no sales call or contract in the documented path. Everything else either isn't in Nigeria (Uber Direct), isn't on-demand (Fez, Sendbox, Topship, Shipbubble-ish), needs a salesperson (Glovo LaaS), needs an email and a human to flip a flag (Kwik), or has a live API with a permanently dead key-issuing domain (Gokada). The one thing to be clear-eyed about: nobody has *empirically* confirmed that Chowdeck hands you a working Relay key without a KYC/business-verification step, and no sandbox is documented despite marketing claiming one. So: sign up on day one, and treat the first 48 hours as a spike whose only job is answering "does a key actually arrive, and is there a test mode." If the key doesn't arrive, fall back to Errandlr (also Lagos-only, also on-demand, also open registration), and if neither issues a key, go to the deep-link/WhatsApp workaround in §6 — which is a legitimate v1, not a defeat.

---

## 2. Ranked table

| # | Provider | Lagos on-demand? | API type | Signup gate | Sandbox | Integration ease |
|---|---|---|---|---|---|---|
| 1 | **Chowdeck Relay** | **Yes** — own rider fleet, ~30min core business | First-party dispatch (DaaS) | Self-serve dashboard *(key issuance unverified)* | **Not documented** (marketing claims one; docs don't) | Easy — Bearer, small surface, 2-step fee→create |
| 2 | **Errandlr** | **Yes** — Lagos-only by their own docs | First-party dispatch | Open registration form, no sales wall | Yes — `green.errandlr.com` | Easy-ish — Bearer, wallet must be prefunded |
| 3 | **Shipbubble** | **Partial** — aggregator; ~2h pickup ETAs via Dellyman/Cora/Routely | Aggregator (rates→label) | Self-serve, ₦0/month | **No** — none documented | Easy — but 3-step, `pickup_date` required |
| 4 | **Terminal Africa** | **Partial** — reaches Kwik/Uber/Sendstack as carriers | Aggregator | Self-serve `dashboard.terminal.africa/auth/register` | **Yes** — real, `sandbox.terminal.africa/v1` | Easy — best sandbox story of the lot |
| 5 | **Kwik Delivery** | Yes — genuine on-demand, surge pricing, fleet assignment | First-party dispatch | Email `plugin@kwik.delivery`, staff must enable | **Dead** — documented host is NXDOMAIN | Moderate-to-hard — chained calls, dev against prod |
| 6 | **Glovo LaaS** | Yes — real courier dispatch, live courier position | First-party dispatch | **Sales call** — "your Glovo commercial POC" | Yes — good one, with simulate endpoints | Moderate — OAuth2, but sales gate kills the week |
| 7 | **Fez Delivery** | No — ~24h intra-Lagos window | Batch parcel booking | Self-serve | Yes | Moderate |
| 8 | **Sendbox** | **No** — fastest tier is *5 working days* | Parcel aggregator | Self-serve | Documented, TLS broken | Moderate |
| 9 | **Topship** | No — cross-border first, hub-and-spoke domestic | Parcel | Email `tech@topship.africa` | Yes | Hard — kobo, manual VAT, wallet |
| 10 | **Gokada** | Was yes — API is live and enforcing auth | First-party dispatch | **Impossible** — `business.gokada.ng` is NXDOMAIN | Moot | Blocked |
| 11 | **Uber Direct** | **No** — not a Nigerian market | Real API, wrong continent | Region-gated | Yes (irrelevant) | Blocked |
| 12 | **GIG Logistics / Renda / Nash / Olva / Bolt (all)** | No | No usable public API | — | — | Blocked |

> **Note on Errandlr:** it arrived tagged "refuted," but read the actual finding — it was refuted for *understating* Errandlr. The verifier confirmed live 401-returning endpoints (`POST /v2/estimate`, `POST /request`, `GET /order-status`) on `commerce.errandlr.com`, an open registration form, and vendor docs that literally say "We're only operational in Lagos for now." That is a viable #2, not a dead option. Don't let the bucket label mislead you.

---

## 3. The two you asked about, plainly

### Uber Direct — **not viable. Don't spend an hour on it.**

Uber Direct is exactly the right *shape* of product — white-label on-demand intra-city dispatch with a real public API and a real sandbox. It is not available in Nigeria. Uber Direct rides on the Uber Eats courier network, and **Uber Eats has never operated in Nigeria** — not "left in 2023," never launched. Uber's Nigeria country manager said so on the record in 2019, and Nigeria is absent from the May 2020 Uber Eats exit list because it was never a market to exit. The hard evidence is a locale asymmetry: `merchants.ubereats.com/za/en/services/uber-direct/` serves a full page with signup CTAs; the identical `/ng/en/` path returns **HTTP 404**. Uber's own docs also region-gate account creation ("available only in select regions... contact your Uber Point of Contact"), so the "self-serve signup: yes" you may have seen is wrong for our market anyway.

Two traps to not fall into: (a) Uber **Connect** *does* move parcels intra-city in Lagos — but it's rider-app-only with zero developer surface, and the last confirmation of it is a 2022 press release. The Nigerian capability has no API; the API product has no Nigerian capability. They don't overlap. (b) `ubereats.com/pt-en/category/lagos-algarve/` is **Lagos, Portugal**. It will show up in searches. It means nothing.

The 2023 Nigerian food-delivery shutdown people remember is **Jumia Food** (Dec 2023) and **Bolt Food** (7 Dec 2023). Not Uber.

### Chowdeck — **viable, and it's the pick. But only for delivery, not for prices.**

Chowdeck is not dead and did not pivot away. It took $9M from Novastar/YC in Aug 2025 while already profitable, and as of 2026 is running roughly 1M orders/month and ~40k deliveries/day across Lagos, Ibadan and Abuja. **Relay** is that same rider fleet exposed as delivery-as-a-service, and it's the correct product surface for a third party that wants to dispatch a rider without being a Chowdeck vendor.

The docs are real, not marketing. `POST https://api.chowdeck.com/merchant/{merchantReference}/delivery` is a verified, documented, callable endpoint taking `source_contact`, `destination_contact`, `fee_id`, `item_type`, `user_action`. Auth is `Authorization: Bearer YOUR_SECRET_API_KEY`. Signup is documented as self-serve.

**The one thing Chowdeck cannot do for us — and this matters more than the delivery win:** it cannot be a price-discovery source. There is no vendor search, no vendor discovery, no platform-wide catalog, and no "list all merchants" endpoint anywhere in the full published endpoint index. If someone tells you that because `merchantReference` is a path parameter you can therefore read *any* vendor's menu platform-wide — that is an inference drawn from the absence of a documented restriction, and it's almost certainly wrong. The whole API is merchant-scoped: it sits next to Create Menu Item, Accept Order, Update Discount. It's a vendor managing *their own* store. And even if arbitrary-merchant reads worked, there's no way to *enumerate* merchantReferences, which makes it useless for discovery regardless. **Do not architect WetinDey's price data around Chowdeck menus.** If we ever want that, it's a partnership conversation, and it's unavailable until they say otherwise in writing.

---

## 4. Integration shape — Chowdeck Relay

**Read the Relay docs before writing code.** I have verified the *merchant* delivery endpoint path. I have **not** verified the Relay endpoint paths or Relay's base URL — a guessed slug (`/reference/create-delivery-relay`) returned 404. Relay's endpoints are listed in the index (Get Delivery Fee, Create Delivery, Get Delivery, Cancel Delivery, Get Redelivery Fee, Request Redelivery, Get Virtual Account, Wallet Balance, Wallet History) but their URLs are unconfirmed. Don't copy paths from this memo into code.

### Auth
- `Authorization: Bearer ${CHOWDECK_SECRET_KEY}` on every call.
- A second credential, `merchantReference`, is a path parameter on most endpoints, issued alongside the key.
- Both in env vars. **Server-side only** — the docs are explicit that the secret key must never touch the client. In our stack that means every call goes through a server action or a route handler; nothing from the browser, nothing from the PWA shell.

### The endpoints that matter (shape, not gospel)

1. **Get Delivery Fee** — send pickup + dropoff contacts, get back a price *and a `fee_id`*. The `fee_id` is the load-bearing part: it's the handoff token.
2. **Create Delivery** — `POST` with `source_contact`, `destination_contact`, `fee_id` (from step 1), `item_type`, `user_action`. Optional: delivery note, vendor note, your own `reference`, estimated order amount. Returns the delivery.
3. **Get Delivery** — polling fallback for status.

Pricing is dynamic and distance-based, quoted at runtime. There is **no published rate card**. You cannot compute a fee locally; you must call step 1. Fees presumably expire — assume they do, confirm the TTL, and don't cache a `fee_id` across a user's dithering.

### Webhooks
Non-optional. The Relay getting-started guide requires configuring a webhook URL during setup. Build a route handler before you build the UI, because you can't finish onboarding without a URL to give them. Verify signatures (check the Webhooks Overview + Events pages for the scheme — I haven't read it). Make it idempotent and make it fast; do the work in the DB, not in the handler.

### What WetinDey stores

Two new Drizzle tables, roughly:

**`delivery_order`** — our record, our truth:
- `id`, `userId`, `createdAt`
- `itemId` / snapshot of what was ordered and the price *at order time* (never join live to the price table — prices move, receipts don't)
- pickup: the market/vendor location, lat/lng, contact name + phone
- dropoff: user's address, lat/lng, contact name + phone
- `quotedFeeKobo`, `feeId`, `feeQuotedAt`
- `chowdeckDeliveryId`, `chowdeckReference` (our idempotency key — generate it, send it, dedupe on it)
- `status` (our own enum — see below)
- `statusUpdatedAt`

**`delivery_event`** — append-only, one row per webhook:
- `id`, `deliveryOrderId`, `rawPayload` (jsonb), `providerEventType`, `receivedAt`

Map their statuses onto **our own status enum**, don't leak theirs into the UI. If we ever swap to Errandlr or an aggregator, the mapping layer is the only thing that changes. Keep the raw payload forever; you will need it the first time a rider says one thing and the API says another.

### Operational prerequisite you can't code around
The wallet endpoints (Get Virtual Account / Wallet Balance / Wallet History) strongly imply **prefunded-wallet billing**: you fund a virtual account, deliveries debit it. If that's right, a zero balance means a failed dispatch in production at 8pm on a Friday. Build a balance check + a low-balance alert into week one, not week six.

---

## 5. What public research cannot tell you — call them

Be honest about this list. It's short but every item is load-bearing.

1. **Does Relay's sandbox exist?** Marketing says yes; the technical docs mention only a single production secret key and no test mode. These conflict. Nobody outside Chowdeck can resolve it. **Ask first, before you plan a testing strategy around it.**
2. **Can a non-vendor third party use Relay standalone?** The API's whole vocabulary is merchant-shaped — Create Merchant, menu items, accept orders, wallet. WetinDey is not a Chowdeck vendor; we want to hail a rider. Relay *appears* designed for exactly this, but "appears" is not "confirmed." Get this in writing. **This is the single question that could invalidate the whole pick.**
3. **Is key issuance actually self-serve, or is there KYC?** The docs say sign up → Settings → Developer Settings → key. Nobody has created an account to prove it. A Nigerian fintech-adjacent platform with virtual accounts and wallets plausibly gates keys behind business verification. Budget for CAC docs, a bank account, and a few days.
4. **What does a delivery actually cost?** No rate card exists anywhere. "Usage-based, no minimums" is a marketing claim. You will not know the real per-delivery naira figure until you can call the fee endpoint or someone quotes you.
5. **Relay's base URL and endpoint paths.** Unverified. Read the docs.
6. **Is the wallet prefunded, and what's the minimum float?** Inferred from endpoint names, not stated.
7. **Rate limits and fee TTL.** Not found.

**Concrete ask:** one email to Chowdeck, four questions — (a) can a third-party app that is not a selling vendor use Relay? (b) is there a sandbox/test key? (c) what's required to get a production key, and how long? (d) is billing prefunded-wallet, and what's the minimum? Send it Monday morning. Everything else can proceed in parallel.

---

## 6. Fallback if no key arrives

Say the quiet part: **there may be no obtainable on-demand delivery API for a third-party consumer app in Lagos this month.** Chowdeck might tell us Relay is for merchants only. Errandlr's own docs point at an "API portal box" that no longer exists on their pivoted homepage. Kwik needs a human to flip a flag and has no sandbox. Glovo needs a salesperson. Gokada's key portal is a dead DNS record. If all of that lands badly, the answer is not to keep hunting — it's to ship the workaround, which is probably the right v1 anyway.

**Tier 1 — Deep-link handoff (ship this regardless).**
User taps "Get it delivered" on an item; we hand off to the Chowdeck or Glovo app with as much context as the link scheme carries. Zero integration risk, zero wallet, zero webhooks, no counterparty exposure. It's honest: WetinDey's job is knowing *what things cost and where they are*, and someone else's job is moving them. Caveat: we do not control the deep-link schemes and they can break silently. Ship an analytics event on every handoff so we learn whether anyone actually wants delivery before we build a dispatch stack for it. **This is also the cheapest way to find out if the feature has demand at all.**

**Tier 2 — WhatsApp-based dispatch.**
This is genuinely how a lot of Lagos commerce runs in 2026 and there's no shame in it. Order forms a structured message; a human dispatcher (ours or a partner's) reads it and hails a rider through whatever app they already use. We keep the same `delivery_order` table and just move `status` by hand or via a lightweight ops screen. It doesn't scale past a few dozen a day — but at a few dozen a day, an API wouldn't have paid for itself either. And crucially, **the data model is identical**, so swapping in a real API later touches one adapter and nothing else.

**Tier 3 — Aggregator as insurance.**
If we need programmatic delivery *this week* and Chowdeck stalls, **Terminal Africa** is the least-bad Plan C: genuinely self-serve, genuinely has a working sandbox (`sandbox.terminal.africa/v1`, Bearer, verified 401 on real paths), and reaches Kwik and Uber as domestic carriers. The catch is honest: it's aggregation over third parties, carrier availability resolves at runtime (the ACTIVE/INACTIVE list in their docs is a *static example*, and two of their doc pages contradict each other on the carrier roster), and same-day/on-demand intra-Lagos SLAs are not established by their docs. You'd be finding out with an authenticated rate call between two Lagos addresses. That's a one-hour experiment and worth running Tuesday as a hedge.

**Recommended sequence:** ship Tier 1 this week while the Chowdeck email is in flight. Build the `delivery_order` / `delivery_event` schema now — it's provider-agnostic and it's what you'd need for all three tiers. Wire Relay the moment a key lands. Don't build the dispatch stack before you know anyone wants it.