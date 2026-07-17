# ADR-007: "Contact belongs to a seller, not a place" — REJECTED

**Date:** 2026-07-16
**Status:** **Rejected.** The argument is false. Kept so nobody rebuilds it.
**Owners:** Dr Dyrane Alexander
**Amends:** nothing. It was written claiming to amend the architecture of record; it did not, and it should not.

## Context

[ADR-001](001-fulfilment-is-out-of-scope.md) made **Contact seller** the terminal step of the
core journey and named the vendor/contact model as its unbuilt precondition. This ADR was an
attempt to decide that model. It failed, and the failure is worth more than the attempt.

## The argument it made, and why it is false

**The claim:** `places` conflates a venue with a vendor. 38/60 places are `open_market` —
"Alaba International Market", "Trade Fair Complex" — so one nullable contact pair per place
asserts *one contact per market*, and Alaba has thousands of traders. Therefore the columns
cannot be correctly filled and a seller entity is required.

**It does not survive contact with the data.** `place_type` is a venue **kind**, not a
granularity claim. Of the 38 `open_market` rows, **19 are already a single stall, line or
annex**: `24 Road Stalls`, `Alaba Rago Food Line`, `Akoka Market Stalls`, `Festac Market
Annex`, `Sabo Market Stall 12`. For those, one contact is exactly right. The three examples
the ADR cited were **all drawn from the ~18 rows that fit its case** — it cherry-picked from
half a table and generalised to the whole.

**The model of record already says the opposite, and the ADR never cited it.**
`WETINDEY_BIBLE.md` Section 20, amended by ADR-001 on the same day: *"The catalogue is market
stalls; **a stall is a `place`**. Contact is `places.contact_visibility` plus the channel pair
above, not a vendor identity."* The schema comment it was arguing about says the same thing in
the singular: *"How **a trader** has agreed to be reached… This is PII belonging to **a real
trader**."* One place = one stall = one trader = one contact. That is the established model,
and this ADR reversed it silently while listing the Bible as merely "related".

**What is actually true is smaller and different.** Roughly 18 seed rows are *named* at market
granularity ("Mile 2 Market") where the model says a place is a stall. That is a **seed-data
naming defect** in `src/db/seedContent.ts` — fixable with data, no schema change, and no ADR.

**Its privacy escalation was alarmism.** It claimed `places.address` leaks "a named
individual's location" for 13/13 kiosks. Measured: kiosk addresses are the **least** precise
of the three types, **none** carries a house number, **none** names a person, and several are
byte-identical to a market's address (`Ojo Road, Ojo` is both `Ojo Market` and `Ojo Road
Kiosk`) — carrying zero additional information. **All 60 rows were created in the same
instant** and are seed fixtures hardcoded in the repo and public in git. There is no trader
and no person to expose. `address` is also a deliberately rendered product feature — the app
prints it, because "know before you go" requires knowing where to go. The ADR framed a
load-bearing UI surface as an accidental leak.

**It also broke ADR-002's own rule while citing it.** It declared `resolveContact(placeId)`
struck and listed the architecture of record under *Amends* — **without editing that
document**, leaving eleven live occurrences, including an exit criterion, still prescribing
the thing it claimed to strike. That is exactly the doc/code drift ADR-002 exists to stop:
*wire it in the same change, or do not write it.*

## Decision

**Rejected.** No decision is taken. `places.contact_channel_kind` / `contact_channel_value`
stand as the contact model, unchanged, and are **not** dropped — not as deferral, but because
nothing here showed anything wrong with them.

The precondition for Contact seller remains what Bible Section 40.2 and ADR-001 already say it
is: **trader consent capture is the blocker, not the schema.** That is a data-operations
problem (Bible Section 24). It needed no ADR, and this one added nothing to it.

## Consequences

**What this costs:** nothing was changed, so nothing must be unchanged.

**What it is worth:** the false argument is now falsified in writing, with the query that kills
it. The next session to look at `places` and think "one contact per Alaba" will find this
first. **A rejected ADR that records why is cheaper than the same wrong ADR written twice.**

**The lesson, which is the real output.** This ADR verified its easy numbers meticulously —
38/60, 60/60 NULL, RLS off, zero policies, all true — and then drew a conclusion the numbers
did not support. **Measuring the countable thing is not the same as checking the claim.** It
is the same failure recorded in [ADR-003](003-identity-for-contribution-trust.md), where
`distinct_source_count` was called "structurally 1" from three seeded rows without ever
counting: reasoning dressed in evidence. An adversarial verifier caught both.

## Validation and review

Reconsider only with evidence that answers the refutation:

1. **A place that genuinely cannot carry one contact**, where the row is a whole market by
   design rather than by seed naming. `SELECT name, place_type FROM places` is the test, and
   today it argues the other way for 19 of 38.
2. **Real trader data.** Every claim in the original rested on 60 fixtures created in one
   instant. No privacy or granularity argument about `places` means anything until a real
   trader is in the table.
3. **The seed-naming defect** — ~18 rows named at market granularity — is worth fixing on its
   own merits. It is data, not architecture, and it does not need this ADR resurrected.
