# ADR-003: Optional accounts, because contribution trust needs an author

**Date:** 2026-07-16
**Status:** Accepted
**Owners:** Dr Dyrane Alexander
**Supersedes:** Bible Section 40.1 *Anonymous browse — Accepted* (partially — see Decision)
**Amends:** [ADR-002](002-service-architecture-of-record.md) *What to NOT do yet*

## Context

WetinDey's one claim is that its answers carry evidence. The architecture of record found
that claim unbacked, and traced it to a single root cause: **nobody knows who wrote a row.**

- **`sources` is a *category* table, not an identity table.** It is seeded with exactly
  three rows — `Contributor`, `Public data`, `Vendor` (`src/db/seed.ts:254-256`). Every
  contribution resolves to the single `"Contributor"` row (`src/app/actions.ts:313-322`).
  Not one per person — **one, total.**
- `sources.reliability_score_internal` is therefore a constant. (It is **98** on the seeded
  Contributor row, not the schema's default of 70 — an earlier draft of this ADR said 70,
  which was wrong. The number is irrelevant; that it never varies is the point.) It is a
  constant wearing the costume of a signal.
- **`distinct_source_count` counts CATEGORIES and the app called them PEOPLE.** Against the
  live database it exceeds 1 in **319 of 474 offer groups** — 163 count two sources, 156
  count three — because the seed spreads observations across `Contributor`, `Public data`
  and `Vendor`. `src/lib/trust.ts` rendered that as "N different people". A dataset is not
  a person; a shop is not a person; and the shared anonymous row is an unknown number of
  people collapsed into one. Corrected to "N different sources" by the auth→trust lane.

  > **An earlier draft of this ADR said this count was "structurally 1", and that was
  > wrong.** It was reasoned from `seed.ts` seeding three rows, not measured. A subagent
  > refused the premise, counted, and the premise died. The correction is left visible
  > because the error is more instructive than the fact: **this document policed
  > reasoning-instead-of-measuring while doing it.**

  **Why it survived, and this is the general form of every trust bug here:** a constant `1`
  would have looked broken and been caught in a week. A plausible 1–3 spread *looks like
  corroboration and reads like evidence*. **It is camouflaged by being believable.** Same
  family as the offers that once claimed more supporting reports than existed. Measure the
  number; do not reason about it.
- `trustLevel` is the string literal `"high"`, hardcoded on every write
  (`src/app/actions.ts:398`, `:416`, `:622`).
- The code says so itself, twice: *"there is no auth in this app"* (`:296`), and *"A
  competitor can blank a rival stall's inventory with a perfectly well-formed payload.
  That needs auth, not zod"* (`:566-567`).

Without an author, four capabilities are impossible rather than merely unbuilt: per-source
reputation, rate limiting, a moderation subject, and an audit actor. The audit's conclusion
was that fixing identity makes all four cheap.

**What identity does NOT fix, stated up front so this ADR is not over-claimed.** Auth does
not close the stall-blanking hole. The price band is computed by raw `Math.min` / `Math.max`
over a query with **no time filter, no moderation filter, and no source filter**
(`src/app/actions.ts:363-388`) — the variable is named `recentObs` and reads all history.
The recompute ignores `moderation_status`, so *rejecting* a poisoned row does not clean the
band it already pinned. **A signed-in attacker poisons the price band exactly as well as an
anonymous one.** Identity is *necessary and not sufficient* here; the band's own bug is
orthogonal and must be fixed on its own merits (roadmap Phase 1). This correction came from
the session that wrote the auth code, arguing against its own work.

[ADR-002](002-service-architecture-of-record.md) listed *User accounts / auth / RBAC* under
**What to NOT do yet**, reasoning that "Phase 2 needs *device identity*, not users." **That
reasoning was wrong, and this ADR corrects it.** Device identity survives exactly as long
as a cookie: clearing it mints a fresh identity with a clean reputation, which is precisely
the attack reputation exists to stop. A reputation that resets on demand is not a
reputation. Sybil resistance was the requirement; device identity does not meet it.

Authentication shipped at `26350ba` — Neon Auth, email OTP, verified end to end. It is
titled *"recognition, never a gate"*, and that framing is the whole decision.

## Decision

**Optional accounts are accepted. Anonymous browse survives intact.**

The split, which is the entire point:

- **Reading is anonymous, permanently.** No sign-in to open the app, see the map, search,
  or read a price. Bible Section 40.1's reason — *reduce friction and personal-data
  collection* — remains correct and remains in force for the read path. Any proposal to
  gate reading behind sign-in is refused by this ADR.
- **Writing may be attributed.** Signing in is how a contributor earns a reputation that
  weights their reports. Contributing anonymously stays possible; it simply carries the
  trust of an unknown author, which is what it has always actually been worth.

So Bible Section 40.1 is superseded **only in its implication that no account may exist**.
Its substance is preserved and sharpened: *anonymous browse, optional recognition.*

**ADR-002's refusal list is amended.** Strike *User accounts / auth / RBAC*. The rest of
that list — no microservices, no search service, no media pipeline, no premature
`ST_DWithin` migration, no IndexedDB — stands unchanged. **RBAC remains refused**: roles
are not identity, and nothing in this ADR argues for them.

**Mechanism:** `@neondatabase/auth`, email OTP, no separate sign-up step — `signIn.emailOtp`
mints the user, so recognition and registration are one act.

## The decision is conditional, and the condition is not yet met

**Auth is live and delivers none of the benefit above.** This is the honest state as of
2026-07-16:

- `sources` has **no user column**. Contributions are still attributed to the one shared
  `"Contributor"` row.
- `src/app/actions.ts` has **no session awareness**. Its comments still say *"there is no
  auth in this app"* — accurate, for the write path.
- `reliability_score_internal` is still a constant.

So today the app collects an email address and gets nothing for it. **That is the one
outcome worse than having no auth**, and it is the current state. This ADR accepts auth
*for the trust benefit*, and that benefit lives entirely in the unbuilt half.

Per ADR-002's standing rule — *if you write it, wire it to a live call site in the same
change* — **the auth vertical slice is half-written.** The UI recognises a person; the
domain does not. Closing that is not a follow-up nicety; it is the justification.

**The wiring, concretely:** a nullable `user_id` on `sources`; `submitObservation` and the
visit path resolve the session to a per-user source row instead of the shared one, falling
back to the anonymous shared row when there is no session; `assessTrust` weights by
`reliability_score_internal`, which finally varies. Anonymous contributions keep working
throughout — they simply weigh less.

**Note what that wiring changes.** `sources` stops being a three-row *category* table and
becomes an *identity* table with a category column. That is a real change of meaning and it
should be made deliberately, not as a side effect: `source_type` stays the category
(`Contributor` / `Public data` / `Vendor`), while the row becomes one-per-author.

**This wiring does NOT fix `distinct_source_count`, and an earlier draft implied it would.**
It makes it worse. Once per-user rows exist, the count *mixes* people and categories: "3
different sources" may be two humans and a vendor feed. Identity is necessary and not
sufficient — the third time that has been the answer in this ADR, which is itself the
finding. The count must either **count what it says, or say what it counts**; the auth→trust
lane took the second option for now ("N different sources"), and the first — a count admitting
only attributed rows — is not available until attributed rows exist and is a separate change.
Do not let this section be read as "user_id closes it".

**Sign-in currently buys the contributor nothing** — not a reputation, not saved markets,
not tracked reports; it buys an avatar initial. Any UI that promises otherwise is lying
until this wiring lands, and should say nothing rather than promise.

## Alternatives considered

**Signed device cookie (ADR-002's original position).** Cheaper, collects no PII, and
sufficient for rate limiting. Rejected as the primary mechanism for *reputation* because it
cannot carry a score across a cookie clear, a reinstall, or a second device — and reputation
is the thing the trust model lacks.

**Explicitly NOT discarded, and this ADR does not supersede it.** ADR-002's Phase 2
device-cookie rate limit remains the right fix for flooding and **must still ship**. Accounts
answer *who*; the device cookie answers *how often*. They are complements, and the flood
attack is stopped by the cookie, not by the account — a signed-in attacker floods just as
well. Anyone reading this ADR as "auth replaces Phase 2" has misread it.

**Keep the product fully anonymous and weight by corroboration alone.** Genuinely
attractive — it needs no PII and the freshness model already leans on agreement between
reports. Rejected because corroboration without identity is trivially forged: N anonymous
reports agreeing may be one person N times. Corroboration is only evidence if the sources
are known to be distinct.

**Full accounts, sign-in required to read.** Rejected outright. It would trade the
product's reach for a trust signal it can get without the trade, in a market where friction
is the enemy. This is what "recognition, never a gate" refuses.

**Vendor/trader accounts.** Out of scope here. ADR-001 leaves trader contact to a
data-operations consent process, and `vendors` was struck from the Bible. This ADR is about
*contributors*, not sellers.

## Consequences

**Improves.** The trust model gains the author it was missing. `reliability_score_internal`
can become a real number. Rate limiting, moderation, and audit gain a subject. The Section
40.1 tension — a product whose supply is crowd-sourced but whose contributors are
indistinguishable — is resolved without gating the read path.

**Worsens.** WetinDey now stores personal data (email) where it previously stored none.
That is a real cost, it was the stated reason for the original decision, and it brings
Nigeria's Data Protection Act 2023 into scope: lawful basis, retention, deletion, and a
subject-access path are now obligations, not future concerns. **None of that is built.**

`@neondatabase/auth` is pinned at `0.4.2-beta` with an `overrides` entry forcing its `next`
peer. **A beta dependency now sits on the sign-in path.** Accepted deliberately — Neon is
already the database, so this is not a new vendor — but it is a real risk and it must be
revisited before public launch, not after.

**Reversibility.** Moderate, and decaying. Today, deleting the auth lane is cheap. Once
`sources.user_id` carries reputation, contributor history is attached to accounts and
removal means deciding what happens to their reports. **Reverse this before the wiring
lands, or not at all.**

## Validation and review

1. **The condition:** `sources` has a nullable `user_id`, the write paths resolve the
   session to a per-user source, and `grep -rn '"Contributor"' src/app/actions.ts` no
   longer shows every contribution funnelling into one row. **Until this lands, auth is
   collecting PII for nothing and this ADR is unfulfilled.**
2. **The benefit is real when `reliability_score_internal` varies between two sources**,
   and `assessTrust` demonstrably weights them differently. A vitest over `assessTrust`
   proves it.
3. **Anonymous browse still works** — the app opens, searches, and shows a price with no
   session. If this ever fails, this ADR has been violated.
4. **Anonymous contribution still works**, and weighs less than an attributed one.
5. **Before public launch:** the beta dependency is resolved to a stable release, and the
   NDPR obligations above have an owner and a plan.

**Review trigger:** if the wiring in the condition has not landed within one month, revisit
this ADR rather than letting it stand — an accepted decision whose justification was never
built is how the module fiction happened, and this repo has done that twice already.
