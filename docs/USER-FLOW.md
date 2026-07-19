# WetinDey — user flow

> Status: **re-audited against the live call graph on 2026-07-18.**
> This is a current-behaviour record, not an implementation promise. Accepted
> [ADR-023](adr/023-browsing-context-and-device-location.md) corrects the
> location architecture but claims no runtime work. Proposed
> [ADR-024](adr/024-progressive-information-to-action-seams.md) authorizes
> nothing; ADR-001 remains binding.

---

## The core loop

```
User opens WetinDey
        ↓
Map loads around a persisted/default browsing point
        ↓
That same point currently also renders as Me/avatar and route origin
        ← AUDIT DEFECT: browsing context is not physical location
        ↓
Location is changeable from:
    • Location pill on map chrome
    • Recenter control (camera-only today)
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
    • Contact seller → display-only and unavailable
        ↓
User may go to the market
        ↓
On return, WetinDey asks:
    • Was it there?
    • Was the price right?
    • Did you buy it?
        ↓
Post-visit submission is currently contained/disabled
```

**The closing loop is still the product thesis, not a current completion claim.**
Visit arming and the confirmation surface exist, but the public contribution write is
contained. The app must not claim that a return answer currently becomes trusted evidence.

**Fulfilment is out.** ADR-001: no delivery, dispatch, courier, cart, checkout
or payment. ADR-024 is only a proposal for bounded external action seams; it does not
supersede that rule.

---

## Step-by-step, against what is actually built

| Step | Today |
|---|---|
| Map loads around persisted/default browsing point | ✅ The point drives search and camera. ❌ It is also reused as physical identity and route origin |
| Location pill on map chrome | ✅ A real button; presents `LocationSheet` (`page.tsx:876-885`) |
| Recenter control | ⚠️ Obtains a device fix and moves the camera, but does not update the persisted browsing point or authoritative self marker |
| Change area from profile | ✅ `ProfileSheet` → `onChangeArea` → `LocationSheet` (`page.tsx:1263`) |
| Search "rice" | ✅ Incl. alias search ("ewa", "dodo") |
| Choose variant → unit | ✅ `ItemDetailSheet` walks item → variant → unit (`ItemDetailSheet.tsx:282-290, 336-339`) |
| Nearby offers, filtered by radius | ✅ Radius reaches the query — PostGIS filters server-side (`actions.ts:79-88`, `actions.ts:769-773`) |
| Rank by nearest / cheapest / freshest | ✅ (`ItemDetailSheet.tsx:264-266`) |
| Compare availability/price/freshness/distance/confidence | ✅ One row; colour carries freshness, confidence is a neutral meter (`ItemDetailSheet.tsx:181-200`) |
| Select a place from a pin | ✅ Detail level with that market's prices (`page.tsx:1073-1185`) |
| Open **Get it** | ❌ Automatically requests Mapbox directions with exact overloaded origin and destination before the user chooses Go there |
| "Get it" → **Go there** | ✅ Platform maps handoff exists, but exact-origin disclosure/freshness is not separated |
| "Get it" → **Share** | ⚠️ Native/clipboard/text fallbacks work; copy says `Price confirmed` without trust/availability qualification and shares a Google Maps pin instead of the existing canonical place route |
| "Get it" → **Contact seller** | ❌ Display-only. No consented contact value is returned and no action fires |
| Place-detail offer action | ❌ Rows are informational and inert |
| Public review read | ❌ Can expose a stable account ID and use account email as the public reviewer name |
| Post-visit confirmation | ⚠️ Arming/surface code exists; public submission remains contained and must not be described as closing the loop |

---

## Location truth boundary

The current point is overloaded. A default, simulated, or manually selected browse point
can become the map's `Me` marker, a signed-in avatar, distance/search origin, and exact
route origin. A device fix outside Lagos coverage is discarded, while accepted fixes
discard browser accuracy and capture time and may persist stale.

ADR-023 settles the architecture: `browsingContext`, `deviceLocation`, `cameraCenter`,
and `selectedPlace` are separate. Until its later implementation is proved, WetinDey
must not describe default/manual/simulated points as physical location or silently send
them as exact origin.

## The action boundary is incomplete

Contact seller requires ADR-022 place control and explicit publication consent. ADR-024
proposes—but does not authorize—seller-approved contact, allowlisted redirects, minimal
disclosed handoff payloads, and provider-returned status. Today the honest exits are
information, canonical sharing once corrected, and an explicit maps handoff.

---

## What is left to build

### 1. Implement ADR-023 as one live location vertical

Separate browsing, device, camera, and selected-place state; retain device accuracy and
capture time even outside coverage; define freshness; unify acquisition; remove personal
identity from non-device points; and disclose exact provider egress. This work is not
claimed by the ADR.

### 2. Correct current privacy and truth defects

Fail closed on public review identity; stop automatic exact-origin routing; make share
copy reflect evidence; share the existing canonical `/place/[slug]` route; and do not
style inert place rows as actions.

### 3. Contact seller only through ADR-022

Build the seller/place-control, scoped authorization, explicit publication consent,
revocation, redacted audit, and discriminated public resolver before exposing a channel.
ADR-024 must be separately accepted before any broader external handoff.

---

## Pages this implies

Map-first, no tab bar, so "pages" are presented surfaces reached from the avatar
or the map — not routes. Only add a route when something must be linkable or
indexable.

**The app is map-first: `/` (`src/app/page.tsx`) is the primary route.** Two
indexable content routes now ship alongside it: `/item/[slug]` and
`/place/[slug]`, server-rendered and already in the sitemap. The only other
route is `src/app/api/auth/[...path]/route.ts`. Rows still marked "Not built"
are wanted, not built.

| Surface | Reached from | Needs a URL? |
|---|---|---|
| Map + results | root | `/` — built |
| Item detail (offers for an item) | search / card tap | Yes, shareable and SEO-relevant. Built: `/item/[slug]` |
| Place detail | pin / offer tap | Yes, shareable and SEO-relevant. Built: `/place/[slug]` |
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

## Remaining governed questions

1. ADR-023 deliberately leaves the numeric device-fix freshness and accuracy thresholds
   to the later implementation evidence.
2. Contact channel types and audiences require ADR-022's seller-consent implementation.
3. ADR-024 remains Proposed; no external commerce/order-status seam is authorized.
