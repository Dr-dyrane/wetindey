# ADR-023: Browsing context and device location are separate

**Date:** 2026-07-18
**Status:** Accepted — governance architecture only; implementation unclaimed
**Owners:** Dr Dyrane Alexander

## Context

WetinDey is map-first, but its current location state gives one coordinate four
incompatible meanings. `src/core/state/locationStore.ts` persists one `position` with
`default`, `simulated`, `manual`, or `device` provenance. `src/app/page.tsx` then uses
that coordinate for search and distance, the map camera, the `Me`/avatar marker, route
preview origin, and the origin passed to an external maps application.

The provenance field is sound; the ownership of the coordinate is not. The audit of the
live call graph established:

- the Lagos pilot default and a manually selected area centre can render as `Me`, using
  the signed-in user's avatar even though nobody is standing there;
- a browser device fix is retained only when it is accepted as the browsing point;
  a valid fix outside supported Lagos coverage is reported and then discarded;
- browser `accuracy` and the browser-provided capture timestamp are discarded;
- persisted device coordinates have no bounded freshness policy, so an old fix can
  continue to claim personal position;
- the recenter control obtains a new device fix and moves the camera but does not update
  the authoritative self marker or browsing context;
- opening Get It automatically sends the overloaded origin and exact destination to
  Mapbox Directions before the user chooses an external handoff; and
- manual, simulated, default, and device origins all cross that boundary as the same bare
  `{lat, lng}` pair.

Moving the default Festac coordinate away from a market marker fixed a visual collision.
It did not fix the domain collision. A person physically outside Lagos must still be able
to browse Festac while retaining a truthful physical-position state, and a person in
Lagos must receive the same semantics.

## Decision

WetinDey owns four independent location concepts:

| Concept | Meaning | Persistence and authority |
|---|---|---|
| `browsingContext` | The area or coordinate whose local information is being explored | May persist on the device. It may be the pilot default, a simulated point, a manual area centre, or a device-derived choice |
| `deviceLocation` | The latest browser-provided physical fix, including coordinates, accuracy, captured-at time, received-at time, and freshness | Session-scoped by default. It is physical-location evidence, never search preference |
| `cameraCenter` | The current visual centre and zoom of the map | Presentation state only; panning or fitting the map changes no location claim |
| `selectedPlace` | The market, stall, seller, or venue the user selected | Task context only; it is neither browsing nor personal location |

No single state object may stand for more than one of these concepts. A caller that needs
location must name which concept it accepts. A bare coordinate is not sufficient at a
privacy, routing, Presence, or personal-marker boundary.

### Browsing behavior

- Anonymous reading and map browsing remain permanent.
- The pilot may open around the last deliberately selected browsing context or the Lagos
  default. That is labelled as browsing context, never `Me`, `You are here`, a personal
  avatar, or a precise physical fix.
- Selecting an area changes search and result context. It does not move the user's
  physical identity.
- Panning or fitting the camera changes only `cameraCenter`.
- A neutral browsing-context indicator may show the selected/default centre when useful,
  but it must remain visually and semantically distinct from a device-location marker.

### Device-location behavior

- A valid device fix is retained as `deviceLocation` whether it is inside or outside the
  current viewport, search radius, pilot boundary, or supported-market area.
- The fix retains browser accuracy and capture time. Out-of-order responses cannot replace
  a newer fix.
- A device fix has an explicit, tested freshness limit. The implementation decision must
  name that limit before activation; this ADR does not invent a duration without product
  and device evidence.
- A stale fix may be shown only as an aged last-known position with its limitation. It
  cannot say `You are here`, authorize Nearby Presence, or become an exact route origin.
- Permission denial, timeout, unavailable position, implausible accuracy, and provider
  errors preserve the previous browsing context and produce an honest recoverable state.
- Recenter requests or refreshes device location, updates the truthful self marker, and
  moves the camera to that fix without replacing search context. It must not continuously
  recenter as later fixes arrive.
- A signed-in user's valid avatar may decorate only a fresh device-location marker. A
  guest uses a local WetinDey fallback. Email, contact data, or a remote avatar generator
  may not become the fallback identity.

### Provider transmission

Opening Get It is not consent to transmit an exact device origin. Exact origin egress for
route calculation or maps handoff requires an explicit action-stage disclosure and a
fresh `deviceLocation`. The user may instead continue without an origin.

The public destination coordinate is separate from personal origin and must be labelled
with its own precision/provenance where it is derived or approximate. The disclosure
names the receiving provider and the fields leaving WetinDey. No precise device coordinate
enters logs, analytics, share URLs, public state, or error text.

Mapbox remains the accepted map provider under ADR-005. This decision changes the meaning
and admission of location data; it does not reopen the provider choice or authorize a
geocoder.

### Nearby Presence

ADR-016 Presence may consume only a fresh, explicit foreground `deviceLocation` under its
own reciprocal consent and coarse-lease rules. A browsing context, camera centre,
selected place, simulated coordinate, manual area centre, or default point can never
unlock real peers or publish a self position.

## Immediate containment requirements

Before the separated model is implemented, current behavior must not be described as
truthful physical-location support. The later implementation lane must, in one live
vertical:

1. stop rendering default/manual/simulated browsing points as personal identity;
2. retain valid outside-coverage device fixes independently;
3. retain accuracy and browser capture time and reject stale/out-of-order fixes;
4. unify Location Sheet and recenter acquisition semantics;
5. omit exact route origin unless a fresh fix and explicit disclosure exist; and
6. preserve browsing results when the camera recenters to physical location.

This is a code and state-boundary correction. It requires no database migration. A later
claim may add local/session state types and tests, but this ADR does not allocate paths.

## Alternatives considered

### Keep one persisted position and improve the label

Rejected. Copy cannot turn a selected area centre into a physical fix, and a label cannot
stop that point from reaching routing, Presence, or avatar callers.

### Replace browsing context whenever GPS succeeds

Rejected. It destroys the user's explicit Lagos research context, makes outside-Lagos
browsing unusable, and turns permission grant into an unrelated product-state mutation.

### Show no physical position outside the pilot

Rejected. Coverage is a property of WetinDey information, not proof that the browser's
physical fix is false. Hiding a valid self position would make the map lie.

### Persist exact device location indefinitely

Rejected. It creates a stale-position claim and an unnecessary precise-location retention
surface. Any future persistence beyond the session requires a separate privacy decision.

## Consequences

The model becomes more explicit: several callers that currently accept `{lat, lng}` must
accept a named concept and provenance. That is intentional friction at a privacy boundary.

Users can browse Lagos from anywhere, recenter to their real position without changing
results, and understand whether the map is showing a search context, a physical fix, or a
selected destination. Route preview may require one additional explicit action when exact
origin would leave the app.

## Implementation and release boundary

Acceptance records Founder-approved governance architecture only. It does not authorize
source edits, a location store rewrite, Mapbox work, schema or migration changes, tests,
provider configuration, deployment, Nearby Presence activation, pilot traffic, or public
rollout.

Implementation begins only after the audit report is recorded, conflicting active map and
page paths are released, and the controller assigns one exact live vertical with an
independent privacy and runtime refuter.

## Validation and independent review

The record defaults to **REFUTED** unless independent review can establish:

- browsing context, device location, camera centre, and selected place are distinct in
  every proposed caller;
- Lagos and outside-Lagos device fixes follow identical truth rules;
- default/manual/simulated points cannot render personal identity or become route origin;
- accuracy, capture time, freshness, denial, timeout, stale, out-of-order, and
  low-accuracy states have explicit outcomes;
- recenter changes camera and device state without changing search context;
- no precise fix reaches logs, analytics, public URLs, or Presence without its own consent;
- origin and destination egress are separately disclosed and validated;
- anonymous reading remains intact; and
- no implementation or rollout authority is implied by this ADR.
