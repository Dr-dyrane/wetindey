# WetinDey — user flow

> Status: **target flow, not yet built.** This is the plan of record. Each step
> below is marked with what exists today so we can see the gap honestly rather
> than describe the app as if it were finished.

---

## The core loop

```
User opens WetinDey
        ↓
Map automatically loads around the best-known location
        ↓
Location remains changeable from:
    • Location pill on map chrome
    • Recenter control
    • Mini-profile navigation
        ↓
User searches "rice"
        ↓
Chooses "Long-grain rice"
        ↓
Chooses "50 kg bag"
        ↓
WetinDey shows recently confirmed nearby availability
        ↓
User compares availability, price, freshness,
distance and confidence
        ↓
Selects Musa Foods
        ↓
Sees:
    • Available
    • ₦78,500
    • Confirmed 18 minutes ago
    • High confidence
        ↓
Taps "Get it"
        ↓
Chooses:
    • Contact seller
    • Go there
    • Request delivery, when supported
        ↓
User contacts, visits or orders from the seller
        ↓
WetinDey asks whether:
    • The item was available
    • The price was correct
    • The order was completed
        ↓
The result becomes fresher and more trustworthy
for the next user
```

**The last two steps are the whole product.** Everything above them is a price
lookup, which is commoditisable. The closing loop — asking the person who
actually went whether the answer was right — is what makes the next lookup
better, and it is the part that compounds. It is also the part that does not
exist yet.

---

## Step-by-step, against what is actually built

| Step | Today | Gap |
|---|---|---|
| Map loads around best-known location | ✅ Opens on D Close, 6th Ave, Festac | ❌ "Best-known" is hardcoded, not geolocated or remembered |
| Location pill on map chrome | ⚠️ Pill exists ("Showing Festac") | ❌ Not tappable — it's a label, not a control |
| Recenter control | ❌ | Not built |
| Change from mini-profile | ⚠️ Row exists, disabled | Needs an area picker sheet |
| Search "rice" | ✅ Incl. alias search ("ewa", "dodo") | — |
| Choose variant → unit | ⚠️ Exists in the *report* form | ❌ Not in the *search* path — search jumps straight to offers |
| Recently confirmed nearby availability | ✅ Offers list with price + freshness | ❌ Not filtered by recency or radius (`activeRadiusKm` is never used in a query) |
| Compare availability/price/freshness/distance/confidence | ⚠️ All five exist but are scattered | Needs one comparable row |
| Select a seller | ✅ Detail view | — |
| "Get it" → contact / go / deliver | ❌ | Directions & Share buttons are **inert** |
| Post-visit confirmation | ❌ | **The loop never closes** |

---

## What has to be built, in dependency order

### 1. Location is a first-class object
Today `mapCenter` is a coordinate and `selectedAreaName` is a string that
nothing writes. The flow needs location to be **selectable, rememberable and
geolocated**.

- Tappable location pill → area picker sheet
- Recenter control (needs `navigator.geolocation` — nothing calls it today)
- Persist last area to `localStorage`
- Honour `activeRadiusKm` in the query — right now the radius slider changes a
  number that no query reads, and distance is computed client-side after
  fetching every place in the country

### 2. Search resolves down to a unit
`rice → long-grain → 50kg bag` is three decisions; search currently makes one.
The variant/unit taxonomy already exists in the DB and is already used by the
report form — the search path just doesn't walk it.

Presented as sheets, per the HIG mapping: each narrowing pushes a new surface.

### 3. The comparable row
Five dimensions — availability, price, freshness, distance, confidence — have to
be scannable in one row without reading. Colour carries freshness (the status
ramp), weight carries price, and distance/confidence are secondary.

This is where the neutral chrome pays off: five signals only coexist if only one
of them is allowed to be saturated.

### 4. "Get it"
An action sheet, not a menu — HIG: *"Use an action sheet, not a menu, to provide
choices related to an action."*

- **Contact seller** — needs a contact model. `places.contactVisibility` exists
  and defaults to `private`; nothing reads it.
- **Go there** — hand off to the platform maps app
- **Request delivery** — later; needs an order model

### 5. Close the loop
The reason the product exists.

- Trigger: returning to the app after tapping "Go there" on a place, within a
  plausible window
- Ask three questions, one tap each: was it there, was the price right, did you
  buy
- Feed answers back into `observations` → `offers_current` freshness and
  `supporting_observation_count`
- **This changes the trust model**: a confirmation from someone who physically
  went is worth more than a report typed from a sofa, and `sources` already has
  `reliability_score_internal` to hang that on

---

## Pages this implies

WetinDey is map-first with no tab bar, so "pages" are presented surfaces reached
from the avatar or the map — not routes. Only add a route when something must be
linkable or indexable.

| Surface | Reached from | Needs a URL? |
|---|---|---|
| Map + results | root | `/` |
| Item detail (offers for an item) | search / card tap | Yes — shareable ("rice for Festac") |
| Place detail | pin / offer tap | Yes — shareable, and SEO-relevant |
| Report a price | + button | No |
| Area picker | location pill | No |
| My reports | profile | No (needs auth) |
| Saved markets | profile | No (needs auth) |
| Settings | profile | No |
| About / Report a problem | profile | Probably — static, indexable |

**Auth is the gating dependency** for My reports and Saved markets. It does not
exist. The profile sheet is deliberately useful signed-out and shows those rows
disabled rather than hiding them, so the shape is honest.

---

## Open questions

1. **What is "best-known location"?** Geolocation, last-used area, or nearest
   covered area? They conflict: a user in Ikeja opening a Festac pilot should
   probably see Festac, not an empty Ikeja.
2. **How fresh is "recently confirmed"?** `offers_current.expiresAt` is set to
   72h by the seed but the comment says 7 days, and nothing enforces it.
3. **What earns "high confidence"?** Today it's
   `supportingObservationCount * 10` capped by nothing — 10 reports from one
   person reads as 100%.
4. **Contact seller — via what?** Phone reveals a real person's number;
   `contactVisibility` defaults to `private` for a reason.
