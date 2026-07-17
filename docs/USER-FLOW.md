# WetinDey — user flow

> Status: **verified against `cc689ef` on 2026-07-16.**
> This document was written when the flow was a plan. Most of it has since
> shipped, and the parts that had not were still described as gaps. Both halves
> were wrong. Every claim below is now checked against the code, with a
> file:line. Anything unverified says so.

---

## The core loop

```
User opens WetinDey
        ↓
Map loads around the last position the user committed
        ↓
Location is changeable from:
    • Location pill on map chrome
    • Recenter control
    • Profile → Change area
        ↓
User searches "rice"
        ↓
Chooses "Long-grain rice"        ← variant
        ↓
Chooses "50 kg bag"              ← unit
        ↓
WetinDey ranks nearby offers by nearest / cheapest / freshest
        ↓
User compares availability, price, freshness,
distance and confidence
        ↓
Selects Musa Foods
        ↓
Taps "Get it"
        ↓
Chooses:
    • Go there   → hands off to the platform maps app
    • Share      → share sheet, clipboard, or on-screen text
    • Contact seller → DEAD END. See below.
        ↓
User goes to the market
        ↓
On return, WetinDey asks:
    • Was it there?
    • Was the price right?
    • Did you buy it?
        ↓
The result becomes fresher and more trustworthy
for the next user
```

**The last two steps are the whole product.** Everything above them is a price
lookup, which is commoditisable. The closing loop — asking the person who
actually went whether the answer was right — is what makes the next lookup
better, and it is the part that compounds. It is now built
(`ConfirmVisitSheet.tsx`, armed at `page.tsx:567-571`, collected at
`page.tsx:471-485`).

**Fulfilment is out.** ADR-001: no delivery, dispatch, courier, cart, checkout
or payment. Buyer and seller arrange it themselves. The flow ends at "Go there"
or at "Contact seller" — and today one of those two does not work.

---

## Step-by-step, against what is actually built

| Step | Today |
|---|---|
| Map loads around last committed position | ✅ Persisted to `localStorage`, rehydrated on mount (`locationStore.ts:107,140-142`; camera driven at `page.tsx:264-267`). Default before any commit is Festac Town (`locationStore.ts:71-75`) |
| Location pill on map chrome | ✅ A real button; presents `LocationSheet` (`page.tsx:876-885`) |
| Recenter control | ✅ `MapRecenterControl`, real `navigator.geolocation` fix, errors surfaced in `MapNotice` (`page.tsx:908-920`) |
| Change area from profile | ✅ `ProfileSheet` → `onChangeArea` → `LocationSheet` (`page.tsx:1263`) |
| Search "rice" | ✅ Incl. alias search ("ewa", "dodo") |
| Choose variant → unit | ✅ `ItemDetailSheet` walks item → variant → unit (`ItemDetailSheet.tsx:282-290, 336-339`) |
| Nearby offers, filtered by radius | ✅ Radius reaches the query — PostGIS filters server-side (`actions.ts:79-88`, `actions.ts:769-773`) |
| Rank by nearest / cheapest / freshest | ✅ (`ItemDetailSheet.tsx:264-266`) |
| Compare availability/price/freshness/distance/confidence | ✅ One row; colour carries freshness, confidence is a neutral meter (`ItemDetailSheet.tsx:181-200`) |
| Select a place from a pin | ✅ Detail level with that market's prices (`page.tsx:1073-1185`) |
| "Get it" → **Go there** | ✅ Platform-detected handoff: Apple Maps, `geo:` URI with a web-fallback watchdog, or Google Maps (`GetItSheet.tsx:99-123, 181-204, 396-417`) |
| "Get it" → **Share** | ✅ Three tiers: `navigator.share` → clipboard → on-screen selectable text (`GetItSheet.tsx:419-442, 510-519`) |
| "Get it" → **Contact seller** | ❌ **Renders "Not shared" for every place.** See below |
| Post-visit confirmation | ✅ Three questions, one tap each; queued offline and flushed on reconnect (`ConfirmVisitSheet.tsx`; drain at `page.tsx:412-458`) |

---

## The end of the journey is a dead end

ADR-001 hands fulfilment to **Contact seller**. Contact seller does not work,
for any place, and cannot be made to work by the UI:

- `places.contactVisibility` defaults to `'private'` (`src/db/schema/index.ts:109`)
  and no seed or write path sets it otherwise. Private means private.
- `contact_channel_kind` and `contact_channel_value` exist as columns
  (`schema/index.ts:129-130`, migration `0002_calm_meteorite.sql`) but are
  **written by nothing and read by nothing** — `getPlaceContactPolicy`
  (`actions.ts:1222`) does not even select them.

So the row says "Not shared", honestly, forever
(`GetItSheet.tsx:311-320`). The sheet is right; the data is missing. **This is
the single most important open item in the product**: ADR-001 removed
delivery on the promise that Contact seller would carry the handover, and
Contact seller carries nothing.

Fixing it needs a write path for the channel columns and a trader-facing way to
opt in. Neither exists. Until then, "Go there" is the only working exit.

---

## What is left to build

### 1. Contact seller, end to end
The channel columns, a way for a trader to set them, and a reader that honours
`contactVisibility` as a gate. Everything else in "Get it" is done.

### 2. A place-detail route
`sharePinUrl` (`GetItSheet.tsx:161-163`) shares a Google Maps pin because there
is no WetinDey URL that resolves to a market. It should be replaced with the
place-detail URL the moment that route ships.

### 3. Real routing geometry
`route` (`page.tsx:819-825`) draws two points — a bearing and a distance, which
is exactly what we know. `setRoute` takes geometry and asks nothing about its
provenance, so a road-following path is more coordinates through the same seam.
Not a delivery integration; ADR-001 permits directions.

---

## Pages this implies

Map-first, no tab bar, so "pages" are presented surfaces reached from the avatar
or the map — not routes. Only add a route when something must be linkable or
indexable.

**Today there is exactly one app route: `/` (`src/app/page.tsx`).** The only
other route is `src/app/api/auth/[...path]/route.ts`. Everything below marked
"Yes" is wanted, not built.

| Surface | Reached from | Needs a URL? |
|---|---|---|
| Map + results | root | `/` — built |
| Item detail (offers for an item) | search / card tap | Yes — shareable. Not built |
| Place detail | pin / offer tap | Yes — shareable, SEO-relevant. Not built |
| Report a price | + button | No — built |
| Area picker | location pill | No — built |
| Settings | profile | No — built |
| My reports | profile | No. Not built |
| Saved markets | profile | No. Not built |
| About / Report a problem | profile | Probably — static, indexable. Not built |

Optional email-OTP accounts ship (ADR-003, `authClient.useSession` at
`page.tsx:286`). Reading stays anonymous forever. My reports and Saved markets
additionally need writes to be attributable, and ADR-003's condition for that is
unmet: `sources` has no `user_id` and `actions.ts` has no session awareness.

---

## Open questions

1. **What is "best-known location"?** Today it is the last position the user
   committed, defaulting to Festac Town. Geolocation is offered but never
   assumed. Whether a user in Ikeja opening a Festac pilot should see Festac is
   still unanswered.
2. **How fresh is "recently confirmed"?** `offers_current.expiresAt` is set to
   72h on write (`actions.ts:357, 624`). Whether anything *enforces* expiry at
   read time is **unverified** — not traced in this pass.
3. **Contact seller — via what channel, and who opts a trader in?** See above.
   This is question 1 of the product, not question 3.
