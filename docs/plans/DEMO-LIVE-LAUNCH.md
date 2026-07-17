# Demo and live, together — the launch plan

**Date:** 2026-07-17 · **Status:** PROPOSAL for the owner. Not accepted. Nothing below has been built.

---

## The one question the owner must answer first

**Every seeded price in this database claims a human typed it into the app. There is no flag, anywhere, that says otherwise.**

Verified today, against the live DB and the code:

- `src/db/seed.ts:349` — `collectionMethod: "app_entry"` is a hardcoded literal on every seeded observation. 949/949 rows carry it. That value means *a person entered this in the app*.
- `src/db/seed.ts:254-256` — three source rows; the first is `"Contributor"` at `reliabilityScoreInternal: 98`, the highest in the table. `seed.ts:333` round-robins them, which is why **474 observations claim source_type "Contributor"** — they claim to be human reports.
- `src/db/schema/index.ts:286-300` — the `observations` table. `sourceId`, `collectionMethod`, `moderationStatus`, `notes`. There is no fifth column that could carry provenance. Grep for `isDemo|is_demo|synthetic|seed` across the schema returns nothing.
- `src/db/seed.ts:382` — `trustLevel` is stamped by a hardcoded ternary off `freshnessState`, bypassing `src/lib/trust.ts` entirely. The live crosstab is perfectly diagonal: 235 high/confirmed, 147 medium/caution, 92 low/unavailable, zero off-diagonal. **`trust_level` carries no information.**
- `src/core/i18n/strings.ts:464` — `"item.status_confirmed": "E sure"`. `strings.ts:436` defines it: *"we stand behind this evidence."* 235 offers wear it because `Math.random()` at `seed.ts:315-319` returned an age under 24 hours.

**Demo data is indistinguishable from real data by construction.** A real contributor's row tomorrow is byte-for-byte the same shape as a seeded one. No query, no badge, no moderation surface and no export can tell them apart.

The product's only claim is that its answers carry evidence. Today it asserts evidence that does not exist, at real Lagos businesses with real names and real coordinates (`seed.ts:212-226` — Tejuosho Market, Oyinbo Market).

### The options

| | What it is | Cost | What it does to the demo |
|---|---|---|---|
| **A. Delete the seed** | Empty the corpus. Ship with what real users report. | Free. | Kills owner intent #1 and #2. Out-of-Lagos users see an empty map. A price app with no prices does not recruit contributors. |
| **B. Label it** | `observations.provenance` — `'field' \| 'seed'`, one additive migration, backfilled `'seed'` on all 949 rows. Route it to the badge. | One migration, one backfill, one select line in two actions, one branch in the badge. | The demo stays, visible, and says what it is. It self-heals: an offer is `seed` while every backing observation is seed, and flips to `live` on the first real report. That is owner goal #5, mechanised. |
| **C. Weight it to zero** | A 4th `sources` row at `reliability_score_internal: 0` (no migration — `source_type` is `varchar(100)` with no CHECK; `trust.ts:259-264` permits 0). | Two lines in `seed.ts`. | **Makes the demo vanish.** Weight 0 → evidence 0 → band `'none'` → "Nobody has reported this yet." Weight can only ever say *we know nothing*. It cannot say *this is an example*. Contradicts intent #1 and #2. |
| **D. Ship it unlabelled** | Today. | Free. | The app lies to every user, at the exact point it asks to be trusted. |

### Recommendation: **B, and it is item 0, not item 5.**

**The seed must be labelled before a single real user sees it.** Not because a label is nice — because the window closes. Today the backfill is `UPDATE observations SET provenance='seed'` on *all* rows, with no key needed, because every row is seeded. After the first real contribution it needs a forensic key: `submitted_at − observed_at > 60s`, which is true today (949/949 rows exceed 606s; the real path at `actions.ts:504,516` sets both to `now`, gap ≈ 0) but is **an accident of seed construction, not a declared fact** — nothing reads it, nothing protects it, and it breaks permanently the day backdated entry ships. Which is precisely what `observed_at` exists for. Land the column before launch or pay for it forever.

**Two things this recommendation must carry, or it is theatre:**

1. **A provenance column alone changes nothing on screen.** `getOfferTrustBatch` (`actions.ts:1608`) has zero callers outside `actions.ts` and `trust.ts` — `trust.ts:585-586` admits it. The badge comes from `offerSignal` (`ItemDetailSheet.tsx:159-188`), reading the *stored* `offers_current.freshness_state`, written by `seed.ts:365-371` from the clock. Routing provenance to the badge **is** the ADR-006 Phase 1 wiring `trust.ts:570-571` already calls for. The demo problem does not need a new mechanism; it needs that one finished. This roughly doubles the work and is the part a naive plan misses.
2. **Fix `seed.ts:183` while you are in there.** Verified verbatim: `coverageStatus: n.level === "lga" ? "active" : "active"` — both arms identical, under a comment claiming *"Only what the pilot serves is marked active"*. All 17 area rows are `active`, including the country. `coverage_status` is a constant. Any code reading it to decide who is in the pilot reads nothing.

**Precedent for shipping the column ahead of its reader:** `sources.userId` already did exactly this. Hand the schema lane one column, not a wishlist.

**Everything below this section is decoration on that column.** Say so out loud: fixing the pill, the ladder, the region card and the pin change are all *distribution improvements for the corpus*. Improving distribution of an unlabelled corpus makes the problem worse, not better.

---

## What already exists — do not rebuild

| Thing | Where | Status |
|---|---|---|
| Position + **provenance as a required field** | `src/core/state/locationStore.ts:26-52, 88-160` | Shipped. Its docstring (`:7-31`) is the argument this whole plan borrows. |
| Rehydration hook + StrictMode guard | `locationStore.ts:167-180` | Shipped. Returns `hydrated`; `page.tsx:166` is a bare call that **discards it**. |
| "Nobody ever chose" sentinel | `locationStore.ts:79` — `setAt: 0` | Shipped. Zero readers anywhere. |
| Nigeria admin tree, LGA → neighbourhood **push** | `LocationSheet.tsx:520-561`; `NavigationStack.tsx:85` | **Shipped (019f3f3, e4eecc).** Country and state are *stated*, not offered (`LocationSheet.tsx:520-522`). Single-child LGAs collapse into the neighbourhood row (`:525-529`) — 4 of 6 today. `ChevronRight` at `:406`. |
| Four distinct geolocation failures, secure-context check, generation counter | `LocationSheet.tsx:51-60, 196-315` | Shipped, and the best location code in the app. **Unreachable unless the sheet is open** — welded to `setLocate`/`commit`/`onClose`. |
| Coverage probe | `actions.ts:1434-1507` (`getCoverageForPoint`) | Shipped. One caller: `LocationSheet.tsx:233`. |
| Precision → dot shape, exhaustively | `MapboxCanvas.tsx:96-101` (`PRECISION_FOR`, a `Record<LocationProvenance, …>`) | Shipped. The compiler finds every render site if the union changes. |
| **Two** entrances to LocationSheet | `page.tsx:1000` (the pill) and `page.tsx:1386` (`onChangeArea`, from ProfileSheet) | **Both shipped.** `ProfileSheet.tsx:651-652` does `onClose(); onChangeArea();` — dismiss, then present. Not modal-over-modal. It is the correct model, and it is the entrance nearest owner goal #5. |
| Admin tree data | `src/db/lagosAdmin.ts`, `src/db/lagosSouthWest.ts` | Shipped. |

**Owner ask #4 is ~90% shipped.** The honest answer to "design the pin change" is: do not design it, finish it.

---

## Experience A: inside Lagos

**The default is not a loading state — it is an answer.** Nothing blocks first paint, nothing is asked on open, and every rung only *upgrades* a position already on screen. Every rung may fail silently, because the rung below it is already painted.

### The ladder

**Rung 0 — Paint. Unconditional.** Server renders `DEFAULT_POSITION` (`locationStore.ts:73-80`); first client render matches (that is what `skipHydration` at `:152` buys). Map is up. No permission call, no probe, no gate. This rung has no failure mode, which is why the ladder is safe.

**Rung 1 — Rehydrate.** `locationStore.ts:167-178`, already shipped. A persisted position with `setAt > 0` **wins over everything below**. A user who picked Ikeja yesterday is in Ikeja today; no device fix may overrule them. This ordering is non-negotiable and is why Rung 2 cannot live at module scope or in a bare mount effect.

**Rung 2 — Gate. Silent. Usually stops here.** Fire only if **all** hold:
1. `hydrated === true`;
2. `position.setAt === 0 && position.provenance === "default"` — nobody has ever chosen. Both fields exist (`locationStore.ts:76,79`) and neither has a reader today;
3. `window.isSecureContext` (as `LocationSheet.tsx:203`);
4. `"geolocation" in navigator` (as `:213`);
5. `navigator.permissions.query({ name: "geolocation" })` resolves `state === "granted"`.

**Anything else → stop. Never prompt.** `state === "prompt"` stops. A missing `navigator.permissions` (some Safari builds) stops. **Absence of the API means *do not auto-locate*, never *ask anyway*.** `navigator.permissions` appears **zero times in `src/`** — verified. This is the one genuinely new primitive.

**Rung 3 — Acquire silently.** `getCurrentPosition({ enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 })`. The first two are lifted verbatim from `LocationSheet.tsx:310-312` and its reasoning holds: the radius is in kilometres, GPS sharpens a number nothing reads that finely. `maximumAge` deliberately differs from the sheet's 60 000 — the sheet's user tapped *now*; this user opened an app, and a five-minute-old cached fix returns instantly. Flagged as deliberate, not a copy error.

**Rung 4 — Classify. Commit only what needs no explanation.** `getCoverageForPoint({...coords, radiusKm})`, then the same predicate the sheet already uses (`LocationSheet.tsx:236`):
- `placesInRadius > 0` → `setDevicePoint(...)`. Camera follows via the existing effect (`page.tsx:339-341`). **This is Experience A.**
- `placesInRadius === 0` → stay on default, say nothing.
- Any error → stay on default, say nothing.

**The rule:** *the automatic path may only produce states that need no explanation; the gesture path may produce states that need one, because it has somewhere to put the explanation.* A silent commit for an uncovered fix yields `areaName: null` → `useLocationChrome` falls back to `formatCoordinate` → the pill reads **"6.6018, 3.3515"** over an empty map, with no user action to explain either. Unacceptable from an automatic path. `LocationSheet.tsx:461-488` handles that case properly, because a gesture asked for it.

### Ask on open, or on a gesture? — **Gesture. Never on open.**

The ladder never calls `getCurrentPosition` without `permissions.query` already returning `granted` — so when it fires, there is no prompt. The design is not "don't use location". It is **"never spend the prompt"**.

- **HIG:** request authorization in context, at the point of need. A dialog on the first frame is the app's first sentence, before the user knows what the app is. ADR-003 sets the same posture from the other side: reading is anonymous forever, never gated. A system modal over first paint is a gate.
- **The prompt is one-shot.** Chrome on Android hard-blocks the origin after a dismissal. Ask early and lose, and location is gone for that user permanently.
- **We have nothing to trade for it yet.** At first paint the user has seen a map and a pill.
- **The default already works.** WetinDey opens on Festac, the pilot's street. A first-time Festac user needs no permission at all.
- **The payoff is asymmetric.** Once any gesture grants it, `permissions.query` returns `granted` forever after, and every subsequent cold open auto-locates silently. **The gesture path is the acquisition path *for* the automatic experience.**

The gestures already exist and need no new UI: `LocationSheet.tsx:420-439` ("Use my location", reachable from *both* entrances) and the recenter crosshair (`MapboxCanvas.tsx:433-480`).

### What the pill says

`useLocationChrome()` (`locationStore.ts:187-204`) is documented as **a label, not a claim**: *"it says which area is on screen, and nothing about whether the position is really yours."* That docstring is correct and it stays exactly as written. The pill is not the liar.

| State | Pill (`page.tsx:998-1008`) | Map dot (`MapboxCanvas.tsx:370-382`) |
|---|---|---|
| Not hydrated | Skeleton, pill-shaped, `min-w-tap` | — |
| `device`, area known | `Ojo` | Point · "You are here" |
| `device`, area null | coordinate | Point · "You are here" |
| `manual` | `Festac` | Area · "Somewhere around Festac" |
| `default` | `Festac Town` | **Nothing.** |

**The skeleton is the fix for the guaranteed Festac frame.** `hydrated` is documented for exactly this (`locationStore.ts:92-95`) and its consumer does not exist. It costs one frame — a synchronous `localStorage` read — and it must render identically on the server, so it is a skeleton for everyone, not a label for some. Price it honestly: the pill says *nothing* on first paint, on every load, forever. That is the right trade; it is not free. And it is not only cosmetic — `page.tsx:339-341` keys the map-centre effect on `locPosition.lat/lng`, so a returning Ikeja user currently paints Festac **and queries Festac** before rehydration lands. It is a wasted round-trip, not a flash.

**Do not add "Finding you…" to the pill.** Rung 2 only fires on `granted` and Rung 3's `maximumAge` is set so the fix returns instantly — it is a state engineered to be unreachable, and it would put the chrome in contradiction with the map, which is the thing we are trying to stop.

### Do not draw the `default` dot

`PRECISION_FOR.default = "area"` (`MapboxCanvas.tsx:96-101`), so a user in Kano who touches nothing gets a fuzzy circle over Festac labelled **"Somewhere around Festac Town"** (`:381`). The pill is a label and survives that. The dot does not — it is the map asserting where *this person* is, and for `default` **nobody has asserted anything**.

**Pass `null` to `setUserPosition` when provenance is `default`.** The adapter already accepts it (`src/integrations/maps/MapboxAdapter.ts:100` — *"Draw 'you'. `null` removes it"*). No union change, no `PRECISION_FOR` change, one branch, in an unclaimed file. It also makes Rung 4 land with no copy at all: **no dot → the dot appears, precisely, where you are.**

### The recenter control

It commits the camera and discards the fix (`page.tsx:1038-1041`). After a tap the user sees their real position under the crosshair while `searchOrigin` (`page.tsx:379-382`) still measures every distance, radius and "Nearest" from Festac. **The map is the answer, and here the map contradicts the answer.**

The comment at `page.tsx:1031-1037` is right about the mechanism and there is **no cheap fix**: `setDevicePoint` → `page.tsx:339-341` → `setMapCenter` → `MapboxCanvas.tsx:318-322` → `adapter.setCenter` → `flyTo` **without zoom** (`MapboxAdapter.ts:425-433`), racing `recenterTo`'s `flyTo` **with zoom 14.5** (`:442-451`). And committing without `recenterTo` is worse: the effect is keyed on `[locPosition.lat, locPosition.lng]`, and recenter's core case is *"I panned away, bring me back"* — position unchanged, effect never fires, camera never moves. **A position-keyed effect structurally cannot drive recenter.**

The structural fix — one nonce-keyed camera target in `globalStore` — is real work the owner did not ask for, in service of a bug the owner did not report. **File it as an H-row. Do not fund it from ask #3.** Auto-locate has no such problem: it writes the position with no competing imperative call, so the existing effect flies the camera correctly. **Auto-locate ships independently of the camera refactor.** Also: route `MapRecenterControl`'s `enableHighAccuracy: true` / 15 s (`MapboxCanvas.tsx:467`) through the same resolver — today it spins up GPS to sharpen a number it then throws away.

---

## Experience B: outside Lagos

### Be blunt: we cannot tell you are outside Lagos. We can only tell nothing is near you.

**There is no Lagos boundary in this system, at any precision.**
- `src/db/schema/index.ts:75-96` — `areas` has exactly one spatial column, `center`, a point. `geographyPoint`'s decoder returns null unless the type is a Point (`:29`) and `fromDriver` then throws (`:68-70`). **A polygon cannot be read out of that column even if one were written.** `ST_Contains` is off the table without a new spatial column.
- `src/db/lagosAdmin.ts:45-49` — the Lagos state row is a centroid whose own `source` string reads *"Lagos state centre; framing only"*. `AdminNode`'s comment (`:33-34`): *"Rough centre. Only neighbourhoods carry a real, sourced point."*
- `src/lib/validation.ts:116-121` — `NIGERIA_BBOX` is the only in/out geometry the codebase owns. It answers *in Nigeria?*, not *in Lagos?*. There is no `LAGOS_BBOX`.
- No runtime geocoder is wired. And `lagosSouthWest.ts:20-24` records that Mapbox places *"D Close, Lagos 10"* 20 km east of Festac and *"6th Avenue"* 26 km away. We have already caught the vendor lying confidently about the pilot's own street. We are not asking it to name a stranger's state.

What *does* exist is a narrower, deliberately-defined thing: **coverage = at least one place within the user's own search radius** (`actions.ts:1443-1451`, which says so out loud: *"not as a bounding box we drew"*). Coverage is radius-dependent and **user-mutable** — it moves when the slider at `SettingsSheet.tsx:103-123` moves.

**Consequence the owner must accept:** at the default 5 km (`globalStore.ts:49`), Ikeja, Lekki Phase 1, Epe and Badagry all return `placesInRadius = 0` — verified live. **A Lagos resident in Ikeja is inside the region and outside coverage.** "Covered" and "in Lagos" are different sets and the gap is not marginal.

**So: the copy must say coverage, not region.** *"Not yet available in your region"* is a claim we cannot make truthfully. *"Nothing near you yet"* is one we can. A `LAGOS_BBOX` would buy exactly one thing — the choice between those two strings — while classifying Sango Ota (Ogun) as Lagos and needing hand maintenance forever. **Recommend: no bbox now.** It is an open question below.

### The live defect that must be fixed first

`getCoverageForPoint`'s nearest-area query filters **only** on `eq(areas.coverageStatus, "active")` with **no type filter** (`actions.ts:1477-1479`) — unlike `getAreaTree`, which filters `eq(areas.type, "neighborhood")` (`:1368`). Combined with the `seed.ts:183` tautology, the **country row is eligible and is nearest** for anyone far away. Verified live: Abuja → `nearestArea = "Nigeria"`, 140.4 km, 0 places. Kano → 323.1 km. London → 4772.6 km.

So `LocationSheet.tsx:466-486` today tells an Abuja user *"The nearest we cover is Nigeria, about 140 km off"* and offers a live button reading **"Use Nigeria instead"**, wired to `handlePickArea` → `setManualPoint` (`:179-192`), which commits **lat 9.082 / lng 8.6753 — the geographic centroid of Nigeria, an empty patch of Nasarawa — with provenance `"manual"`.**

This ships today. Two one-line fixes, both required: the `type` filter, and `seed.ts:183`. They are correct independently of everything else in this document. Ship them unbundled.

(Note also: five LGA rows sit at coordinates byte-identical to their neighbourhood namesake — `lagosAdmin.ts:52-82` — and the nearest query has no tiebreak. The type filter is also what stops an `lga-mushin` slug, absent from `getAreaTree`'s output, landing in `areaSlug` where the picker can never mark it selected.)

### The out-of-coverage exit records a lie

`"manual"` is documented as *"The user picked their area off the administrative tree. Self-declared… picking the area you are standing in is an answer, not a pretence"* (`locationStore.ts:42-48`). **The single button we offer an out-of-coverage user records them as self-declaring they are standing in Ojo.** Shipping the demo state on `manual` puts the seed-data failure into the location layer — in the one file whose entire docstring exists to prevent it.

**Add a fifth member: `"demo"`.** *The position is Lagos; the user is not. We know, and so do they.* Do **not** reuse `"simulated"` — `locationStore.ts:33-41` records that it rehydrates today from browsers that ran the pre-`e4eecc` build. Reusing it makes a deliberate 2026 state indistinguishable from 2025 junk in localStorage, which is this document's entire subject.

New setter `setDemoPoint`, sibling to `setManualPoint`. **The rule that makes or breaks it:** while the verdict is out-of-coverage, *every* area picked off the tree writes `demo`, not `manual`. `handlePickArea` branches on the verdict, not on the row. Persist: bump to `wetindey.location.v2`, `version: 2`, with a `migrate` that maps `simulated` or any unknown provenance back to `DEFAULT_POSITION`. `locationStore.ts:33-41` records that *not* bumping is precisely why the ghosts are here.

### When does an out-of-Lagos user see anything?

**Only after they, or a prior grant, gave us a fix.** For a first-time Abuja user, `permissions.query` returns `prompt`, Rung 2 stops, and provenance stays `default`. **They see Lagos, on a lit map, with prices, and no dot** — and that is honest: the pill states which area is on screen; the map asserts nothing about them.

There is no way around this and no reason to want one. A region verdict requires a location, a location requires the prompt, and the prompt on frame 1 is the gate ADR-003 forbids. **The demo state is what an out-of-coverage user gets when they ask; the default state is what they get when they don't.** Both are true statements. That is the whole design.

### The card

Level 0 of `LocationSheet`, replacing the `locate.kind === "outside"` card at `:461-488`. Same geometry, `bg-status-caution-bg`, no scrim (the backdrop has no fill — `ModalSheet.tsx:146-158`), map stays lit.

> **Nothing near you yet**
> We're starting in Lagos. You're seeing real Lagos prices from a demo location.
> `Let me know when WetinDey reaches you` ›

**Print no distance** and **delete "Use {nearest} instead"** for this state. Teleporting to coverage is the opposite of "we'll let you know", and it is the mechanism that fabricates the `manual` claim. The remedy is the picker directly below it.

Also fix `LocationSheet.tsx:446` and `:465`: `font-semibold` on status text violates the owner's directive (status is normal weight).

### The demo-location toggle: **there isn't one, and that is the answer**

Interrogate what it toggles between: *demo Lagos* and *your real location*. For an Abuja user, "your real location" is an empty map — and three actions disagree about what an out-of-Nigeria coordinate even means: `getPlacesNear` **throws** (`validation.ts:356-363` via `actions.ts:1412`), `getCoverageForPoint` **answers** by design (`actions.ts:1458-1461`), `getPopularItems` returns **empty** (`actions.ts:100-112`). A control with one useful position is not a control; it is chrome.

**The pill is the toggle.** It is already the position control (`page.tsx:1031-1037` says so), already both entrances' destination, already `min-w-tap`. For `demo` it reads `Demo · Festac Town`.

**Say this plainly rather than hiding it:** composing that prefix inside `useLocationChrome` **overturns** the rule in its own docstring (`locationStore.ts:187-198`: *"Callers that need to qualify the position… must read `provenance` off `useLocationStore` and say so themselves"*). Recommend doing it anyway — the store stating provenance where the user is looking is the docstring's *intent* — but **the diff must rewrite that docstring and say it is overturning it.** Asserting compliance with a rule you are breaking is this codebase's disease at the level of prose.

### What a demo user may and may not do

**May, and should:** read every price, drill every market, change the demo area, search, open item detail, read About, **and create an account.** Nothing about recognition is geographic. A Lagosian in London signing up to contribute when they land next month is goal #5 working.

**May not — Report a price.** Hide the `+` (`page.tsx:1062-1069`) while provenance is `demo`.
**May not — Confirm a visit.** Hide the entry (`page.tsx:1351`). `collection_method: "visit_confirmation"` (`actions.ts:868`) means *I went there*, and its "it wasn't there" branch blanks a stall's inventory on one well-formed POST (`actions.ts:825-839`).
**May not — Contact seller.** Dead today (`contact_visibility` is `private` on 60/60 places). When goal #5 opens it, gate it on `provenance !== "demo"`.

**Say this once and never pretend otherwise: removing those buttons is an honesty measure, not a defence.** `submitObservation` takes `placeId` and **no coordinate** (`actions.ts:464-471`) — there is no proximity to check, and a coordinate the client sends is attacker-controlled. A server-side region check on client-supplied lat/lng is security theatre that would read as a control. The actual defence for the write paths is the Phase 2 device-cookie rate limit `actions.ts:832-839` already names. **And note the order:** guarding this door while the corpus is unlabelled is guarding a building with no walls — the seed already walked through that opening 949 times. That is why the provenance column is item 0.

### "We will let you know"

**No account. One field. And it does not ship unless two things it depends on ship first.**

ADR-003 settles the account question: making a person create an account to be told when we reach their city would be the app's first gate, aimed at the user with the least reason to tolerate one.

Where: **level 1 of `LocationSheet`**, pushed from the card's action row. `AboutSheet.tsx:26,55,63-65` is the template — a string union in one `useState` fills the single detail slot and resets on dismiss; `LocationSheet.tsx:165` already resets `lgaSlug` the same way. The notify form and the pushed LGA compete for that slot, which is correct: only one can be open.

Store the email plus the coordinate **rounded to 1 decimal place** (≈11 km) — enough to say "40 people around Abuja", not enough to find a person. No reverse geocode.

**Prerequisites:** a table (= a migration = the schema lane) and a mailer (does not exist anywhere in `src/`). **If either does not land, the row is not rendered.** The card without the row is still true. The row without the mailer is a promise dropped on the floor, made by a product whose only claim is evidence.

Two hazards for the pushed form: `ModalSheet`'s focus effect fires once at 60 ms and grabs the first DOM match — the Close button precedes everything (`ModalSheet.tsx:121-123`); `ProfileSheet.tsx:246-249` documents the trap and solves it with a step-keyed effect. And level 1 gets `px-6` from the stack (`NavigationStack.tsx:189-193`) — a form is 24 px content, so **no `-mx-6`**, unlike the row list at `LocationSheet.tsx:550`.

---

## The pin change

**This is not a new surface. It is LocationSheet, minus a bug, plus a decision about the door.**

**"Submodal" must be read as "a pushed level of LocationSheet".** If it means a `ModalSheet` inside a `ModalSheet`, that is the defect the owner is complaining about elsewhere — H29, six live stacks (`SheetPicker.tsx:82` presenting from `ReportPriceSheet.tsx:82,91,100,110`, `ItemDetailSheet.tsx:276`, `ReportProblemSheet.tsx:126`). `ModalSheet.tsx:14-19` carries a `presentedCount` *because* those stack two deep. **LocationSheet does not have this problem and must never acquire it:** one `ModalSheet` wrapping one `NavigationStack` (`:537-561`), where presence *is* depth (`NavigationStack.tsx:85`).

| Step | Is it a step? | Where |
|---|---|---|
| Country — Nigeria | **No. Stated.** | `LocationSheet.tsx:520-522`, one footnote line. |
| City / state — Lagos | **No.** Same line. "City Lagos" *is* the state row; the pilot has one. | Same. |
| LGA | **Only when it has >1 child.** | `:525-529`. 4 of 6 collapse. A drill onto a single row is a control lying about having an outcome. |
| Neighbourhood | **Yes. Terminal step, and the commit.** | `areaRow` → `handlePickArea` (`:179-192`) → `setManualPoint` → `commit` → `page.tsx:1367` `setMapCenter`. `searchOrigin` re-memoises for free (`page.tsx:379-382`). |
| Street | **No. Do not build it.** | See below. |

Back affordance is already the HIG one: `ChevronLeft` + label at 44 pt, no divider (`NavigationStack.tsx:147-165`). Dismissal resets to level 0 (`LocationSheet.tsx:165`). `size="page"` is **mandatory** — a `NavigationStack` needs a fixed-height host to translate inside; `size="form"` is `max-h` (`ModalSheet.tsx:204`) and has none. So *"a simple submodal… a simple form"* resolves to the page sheet that already exists.

### Street: kill it

1. **Below the noise floor.** The radius runs 1–20 km, default 5, and coverage is `ST_DWithin` in **kilometres** (`actions.ts:1483-1486`). D Close to the far edge of Festac is a few hundred metres. `LocationSheet.tsx:306-313` already made this call for the device fix and wrote it down: *"the radius is measured in kilometres… Asking for high accuracy would spin up GPS to sharpen a number nothing here reads that finely."* A street picker is that same rejected sharpening, done by hand, as unpaid user labour.
2. **ADR-001: no delivery.** Nothing is ever sent to the user's location. Addresses are for logistics; WetinDey has none.
3. **No data.** `areas.type` only ever holds `neighborhood`/`lga`; `getAreaTree` hard-filters (`actions.ts:1368`); grep for street in `src/db/schema` returns nothing. The pilot's own street is a display label on a constant (`lagosSouthWest.ts:46-51`).
4. **No vendor can source it** (`lagosSouthWest.ts:20-24`).
5. **It doesn't fit the box.** `NavigationStack` is two levels by construction — one `heldDetail` slot (`:69`), one −25 % parallax (`:111`). Growing it to a node array puts `CompactShell.tsx:67`, `RegularShell.tsx:100`, `AboutSheet.tsx:78` and `LocationSheet.tsx:538` in the blast radius.

**What "street" probably means:** *"Festac is big and the area centre isn't where I'm standing."* Real complaint; the fix exists and is one tap — **"Use my location"** (`LocationSheet.tsx:226-264`), the only path that writes `device`, *"the only provenance that is the truth"*. Make that row win; do not build a street list under it. If street survives anyway: free text, on the *report* (`ReportPriceSheet`), never affecting the coordinate, never in `locationStore`.

### The door, not the room

The room is finished. The doors are two, not one: **`page.tsx:1000`** (the pill — a 44 pt `text-footnote` capsule on the map) and **`page.tsx:1386`** (`onChangeArea`, from ProfileSheet). The Profile row is already correct (`ProfileSheet.tsx:651-652`, dismiss-then-present) and was already dead-then-repaired — `ProfileSheet.tsx:22-27`: *"this row spent its whole life `disabled` over a no-op `onClick`"*.

**This is the only genuine design decision in the pin change, and it is blocked by item 0.** Widening the door in front of an unlabelled corpus is a distribution improvement for a lie. Do the column first.

---

## What this unlocks

- **Accounts.** The reliability inversion is already a release prerequisite: the anonymous `Contributor` source sits at **98** (`seed.ts:254`) — the highest in the table — purely because the seed wanted a high-reliability source, while signing in yields `RECOGNISED_CONTRIBUTOR_RELIABILITY = 75` (`actions.ts:317`). **Signing in currently weighs less than not signing in.** Giving the seed its own source row fixes it as a side effect: two problems, one solution.
- **Contributions.** The demo self-heals. An offer is `seed` while every backing observation is seed and flips to `live` on the first real report. Owner goal #5 is not a marketing push; it is the mechanism by which the seed disappears.
- **Contact.** Dead today, and that accidentally caps the blast radius. When it opens: gate on `provenance !== "demo"` **and** on the offer not being seed-derived. Seeded places carry real market names at real coordinates (`seed.ts:212-226`). A stranger phoning a real Festac trader about a price no human reported is the failure this whole plan exists to prevent, and *"the map is the answer"* is not a defence when the answer is a phone number.

---

## Sequenced work

Cut in reverse order. Nothing after step 1 should start before step 1 lands.

| # | Work | File(s) | Lane | Exit criterion |
|---|---|---|---|---|
| **0a** | Two live defects, unbundled: `type = 'neighborhood'` filter on the nearest-area query; kill the `"active" : "active"` tautology | `actions.ts:1477-1479`; `seed.ts:183` | **auth→trust** (actions.ts is hot + contested, `LANES.md:140`); seed owner | A probe at Abuja returns a neighbourhood, not `"Nigeria"`. `coverage_status` is not constant across all 17 rows. |
| **1** | **`observations.provenance`** — migration 0005, `NOT NULL DEFAULT 'field'`; backfill `UPDATE observations SET provenance='seed'` (all 949); write `'field'` at `actions.ts:518, 868, 987`; add to `TrustObservation` (`trust.ts:129-140`) and to the two selects (`actions.ts:442-461, 1613-1639`) | schema + `actions.ts` + `trust.ts` | **schema lane** (mid-write) + **auth→trust** | A `SELECT DISTINCT provenance` returns two values. A real report written through the app lands `'field'`. Backfill ran **before** any real user. |
| **2** | **Route provenance to the badge.** `offers_current` derives `seed` while every backing observation is seed; flips to `live` on the first real report. `offerSignal` (`ItemDetailSheet.tsx:159-188`) reads it. This is ADR-006 Phase 1. | `ItemDetailSheet.tsx`, `actions.ts` | **auth→trust** | No seeded offer wears **"E sure"** unqualified. A seeded offer reads as an example, not as evidence. |
| **3** | **Seed source row** at `reliability_score_internal: 0`, and stop round-robining `"Contributor"` | `seed.ts:253-257, 333` | seed owner | Signing in weighs more than not signing in. No seeded row claims `"Contributor"`. |
| **4** | **Extract the resolver.** Lift acquire → cover → classify out of `handleUseMyLocation` (`LocationSheet.tsx:196-315`) into `src/core/location/resolveDeviceLocation.ts`. Failure **codes** move; failure **strings** stay (`:268-304`). `LocateState` and the generation counter stay with the sheet. | new file + `LocationSheet.tsx` | **unclaimed** — claim in `LANES.md` in a commit before the first edit (`LANES.md:58`) | The sheet behaves identically. The resolver runs with no sheet mounted. |
| **5** | **`demo` provenance + `setDemoPoint` + persist v2 migrate.** Compiler names every render site via `PRECISION_FOR` (`MapboxCanvas.tsx:96-101`). | `locationStore.ts` | **unclaimed** | `tsc` green. A `simulated` position in localStorage rehydrates to `DEFAULT_POSITION`, not into the app. |
| **6** | **No dot for `default`.** Pass `null` to `setUserPosition`. | `MapboxCanvas.tsx:370-382` | **unclaimed** | A cold-open user sees no "you" dot. Granting location makes it appear, as a point. |
| **7** | **Region card, demo badge, `handlePickArea` branch, `measureFrom`.** Delete "Use {nearest} instead". `measureFrom` uses the **demo** position, never the device — "512 km away" on a Festac row is the app arguing with itself. Fix the two `font-semibold` status lines (`:446, :465`). | `LocationSheet.tsx` | **unclaimed** | An out-of-coverage user sees the card, no distance, no teleport button. Picking Ojo writes `demo`. |
| **8** | **Shell wiring:** consume `hydrated` (`page.tsx:166`) → pill skeleton; `Demo ·` prefix (rewriting the `useLocationChrome` docstring); hide `+` (`:1062-1069`) and visit (`:1351`) for `demo`; mount `useAutoLocate()` | `page.tsx` | **auth** — hot, exclusive (`LANES.md:141,151`). **And `LANES.md:H30` says wf_b0fbbf47 is rewriting it right now; the presentation spine lands first, then this builds on `openSurface({type})`, not new `useState` flags.** | A returning Ikeja user never paints Festac. A `demo` user has no `+`. **Without this handoff, steps 4–7 are a library, not a plan** — this is exactly the leaf-file dead-code failure the project memory records. |
| **9** | **Auto-locate hook** — Rungs 2–4, in `src/core/location/useAutoLocate.ts`, **not** in `locationStore.ts` (importing `actions.ts` would drag the server-action graph into every consumer). Module-scoped guard per `locationStore.ts:170-174,180`. Absent permissions API fails closed. | new file | **unclaimed** (mounted by step 8) | A user who granted once, cold-opens into their own area with no prompt. A user who never granted sees no dialog, ever. |
| **10** | **Notify-me.** Table + mailer + pushed level 1. | schema + `LocationSheet.tsx` | schema lane | An address entered arrives in an inbox. **If not: the row is not rendered.** |

**Not in this plan, filed so nobody rediscovers them:** the nonce camera-target refactor (real, correct analysis; wrong budget — file as an H-row); H29's six `SheetPicker` stacks (the fix is the push `LocationSheet` and `AboutSheet` already demonstrate, and it cannot be done inside `SheetPicker`, which owns its `open` locally); `strings.ts` — **do not touch it**, the auth lane holds it, its `location.*` bodies still say *"simulate a position above"* (`strings.ts:388-400`) for a control deleted in `e4eecc`, and `:365-386` is a complete `area.*` block for `AreaPickerSheet.tsx`, a file that does not exist. Keep `LocationSheet` hardcoded English, as it already is (`:557-559`).

**There is no regression net.** `LANES.md` H11: `npm run test` is not defined in `package.json` — verified, not assumed. Every claim above is static reading plus one read-only DB probe. The recenter divergence and the first-paint flash are observable only by driving the app. Drive it at `http://192.168.1.71:3000` via `mcp__Claude_Browser__*` — **not** `localhost` in the owner's Chrome, which serves a different application (H16/H16-CORRECTION). And note the trap: **`localhost` is a secure context by spec**, so `LocationSheet.tsx:203`'s `isSecureContext` branch is invisible there.

---

## Open questions for the owner

1. **The seed: label, delete, or ship it unlabelled?** Recommendation is label (option B), and it is item 0. Everything else is decoration on that column. **If the answer is "ship it", say so explicitly** — that is a decision to assert evidence that does not exist, and it should be made deliberately, not by omission.
2. **What does a seeded offer look like on screen?** A visible sample that says what it is (label), or an offer with no evidence (weight zero → band `none` → *"Nobody has reported this yet"*)? Your stated intent #1 and #2 require the first. This gates the badge work in step 2.
3. **"Not yet available in your region" is a claim we cannot make truthfully.** We can say *"Nothing near you yet"*. A `LAGOS_BBOX` would buy the region wording, misclassify Sango Ota as Lagos, need hand maintenance, and is wrong at the Ogun fringe. Recommendation: no bbox, coverage wording. **Do you accept the wording change, or do you want the approximate rectangle?**
4. **Overturning the `useLocationChrome` rule.** Its docstring (`locationStore.ts:187-198`) forbids the label deriver from qualifying provenance. `Demo · Festac Town` breaks it. Recommendation: overturn it, in the diff, saying so. **Confirm.**
5. **Notify-me: does it ship?** It needs a table (schema lane) and a mailer (does not exist). If not, the card ships without the row. **Confirm that is acceptable** — a promise with no mailer behind it is the same class of failure as the seed.
6. **The `page.tsx` handoff.** Steps 8 is the entire visible payload and it lives in the auth lane's hot file, which `LANES.md:H30` says is being rewritten right now. **Someone has to sequence this.** Without it, steps 4–7 produce correct code with no call sites.