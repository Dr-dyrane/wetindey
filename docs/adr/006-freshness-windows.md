# ADR-006: The freshness windows are 24h and 72h

**Date:** 2026-07-16  
**Status:** Accepted  
**Owners:** Dr Dyrane Alexander

## Context

This ADR records a decision already made in code and never written down.

WetinDey's claim is "Know before you go." Freshness is not a feature of that claim, it *is* that claim — every badge, every pin colour, every "Confirmed" the app prints is an assertion about age. The windows that define it shipped: `FRESHNESS_POLICY = { staleHours: 24, expirationHours: 72 }` in `src/lib/trust.ts`, consumed by `freshnessOf()` in the same file — over 24h is `stale`, over 72h is `expired`. The same two numbers are duplicated as bare constants in `src/db/seed.ts`. Both write paths that stamp `expiresAt` now import `FRESHNESS_POLICY.expirationHours` rather than re-typing 72 — an earlier version of this ADR said they hardcoded it, which was true when written and was fixed in `2a70fde`.

**Citations here name symbols and full paths, not lines, and that is deliberate.** An
earlier version carried roughly two dozen line-number citations; ordinary commits moved
the symbols without changing anything this ADR says. This document's whole job is to be
checkable later, and a path-plus-symbol reference remains greppable when surrounding code
moves.

The hazard is that `WETINDEY_BIBLE.md` Section 40.2 once listed "Exact freshness windows." as an open decision. An agent reading that as genuinely open may pick different numbers, and silently change what every badge in the app means. The numbers are not open. They are in force.

**AMENDED 2026-07-17 — the write half of this landed, and the original text below was written before it.** The original said "freshness does not work today… the good one is dead". That is no longer true, and an agent reading the stale version would conclude the trust work is undone and redo it. Corrected state, verified:

- **The write path now runs the model.** The evidence-bearing `assessTrust` call sites in
  `src/app/actions.ts` are `submitObservation`, `submitVisitConfirmation`, and
  `getOfferTrustBatch`. Two additional presentation-fallback sites—`readTrustForKey` and
  `searchItems`'s local `classifiedFallbackTrust`—call `assessTrust([])` to construct an
  empty assessment rather than to evaluate observations. `assessTrust` in
  `src/lib/trust.ts` is no longer dead code.
- **The hardcoded constant is gone from the observation write paths.** `grep -c 'trustLevel: "high"' src/app/actions.ts` returns **0**; both writes now set `trustLevel` from `assessment.band`. **That grep is scoped to one file and the scope is load-bearing** — `src/db/seed.ts` still stamps a literal ladder, and it wrote every row currently in the database. See the fourth derivation below.
- **The live read path is now wired.** `searchItems`, `getPopularItems`, and
  `getOffersNarrowed` in `src/app/actions.ts` call `getOfferTrustBatch`. `offerSignal` and
  `confidenceFor` in `src/app/_components/ItemDetailSheet.tsx` do not derive freshness or
  confidence; they translate the server-owned `offer.trust` result into presentation.
  `src/app/page.tsx` imports `offerSignal` so map markers and rows share that presentation,
  not to introduce another model.
- **A third derivation is GONE.** `supportingObservationCount * 10` — uncapped, blind to
  who reported — lived in the deleted `getFoodItemCandidates`; commit `f06dc1b` removed
  its live definition. The arithmetic exists nowhere in live code. Remaining occurrences
  are stale comments outside this ADR's documentation-only lane. `confidenceFor` in
  `src/app/_components/ItemDetailSheet.tsx` now maps the server-decided band rather than
  replacing the deleted arithmetic with a client model.
- **A FOURTH derivation was never named here, and it wrote every row you can see.**
  `src/db/seed.ts` stamps a hardcoded ladder —
  `freshnessState === "confirmed" ? "high" : "caution" ? "medium" : "low"` — bypassing
  `assessTrust` in `src/lib/trust.ts` entirely. Live database: 235 high / 147 medium /
  92 low = **474 rows = all of `offers_current`**. So the model that runs on observation
  writes has not yet touched a single row a user has ever seen.

One further fact bounds what the model can currently mean: `sources` is a three-row *category* table, not a table of people — Contributor / Public data / Vendor, seeded in `src/db/seed.ts`.

> **CORRECTION 2026-07-17.** This paragraph said `distinctSourceCount` is "structurally 1". **Measured, it exceeds 1 in 319 of 474 offer groups** — the seed spreads observations across all three categories. The count is CATEGORIES and the copy called them PEOPLE; `describe` in `src/lib/trust.ts` now says "sources". Same error as [ADR-003](003-identity-for-contribution-trust.md), which corrects it — I made the claim in two ADRs from one unmeasured assumption and fixed only one.

What remains true: the anti-corroboration machinery — `PER_SOURCE_CAP`,
`REPEAT_OBSERVATION_DECAY`, and `distinctSourceCount` in `src/lib/trust.ts` — cannot mean
what it claims until observations carry a per-contributor identity, which is the unmet
condition ADR-003 records. And per ADR-003, `sources.userId` in
`src/db/schema/index.ts` alone does not close it: once real per-user rows exist the count
mixes people and categories.

## Decision

The freshness windows are **24 hours (stale) and 72 hours (expired)**, flat, across all categories. This ratifies what is in force.

`src/lib/trust.ts` is named the single place allowed to express that policy. Any surface that needs to know how old is too old imports `FRESHNESS_POLICY` or calls `freshnessOf()`; nothing else states the numbers.

**This is a decision about which model is authoritative, not a claim that every data
producer complies.** When written, `src/lib/trust.ts` was dead code and shipping behavior
came from client derivations and a hardcoded `"high"`. The observation write paths now
call `assessTrust`, and the live read paths named above call `getOfferTrustBatch`;
`offerSignal` and `confidenceFor` only present that server-derived answer. The remaining
rival is `src/db/seed.ts`, which still stamps its own ladder. Roadmap completion therefore
requires bringing that seed path under the same authority, not recreating trust in the
client.

Also ratified, as part of the same model and for the same reason (they are the shape of the answer, and re-deciding them re-defines the badges):

- **Linear age decay**, zero at 144h: `clamp01(1 - ageHours / (expirationHours * 2))` —
  `ageDecay` in `src/lib/trust.ts`. No floor — evidence must be able to reach zero, or age
  stops meaning anything.
- **The newest observation drives freshness and availability** — `assessTrust` in
  `src/lib/trust.ts`. Older reports are history.
- **Confidence-descending ranking**, ties broken on freshness then distinct sources —
  `rankByConfidence` in `src/lib/trust.ts`.

Out of scope here: `TRUST_BANDS` in `src/lib/trust.ts` is marked PROVISIONAL and stays
open — what earns "high" is a product call. This ADR fixes the windows, not the bands.

## Alternatives considered

Reconstructed after the fact. Where the reasoning is not recorded, this says so rather than inventing one.

- **Per-category windows.** `WETINDEY_BIBLE.md` Section 21.4 contemplates exactly this: ≤6h for highly perishable produce, ≤24h for daily open-market staples, ≤72h for packaged shelf-stable goods, vendor expiry for scheduled stock. **They were never built.** `FRESHNESS_POLICY` is one flat object and `freshnessOf()` takes no category argument; grep finds no category-keyed window anywhere in src/. The Bible calls them "provisional starting rules" needing operational calibration — and the pilot has no operations to calibrate against, which is the most plausible reason they were skipped. But the decision to skip them is not recorded. This ADR ratifies the flat window as what shipped; per-category windows remain a legitimate future change, and this file is where that change gets re-argued.
- **Continuous decay, no bands.** `ageDecay` and `scoreFromEvidence` in
  `src/lib/trust.ts` already form the continuous curve and could have exposed a bare
  number. Rejected in effect because `offersCurrent.freshnessState` in
  `src/db/schema/index.ts` demands confirmed|caution|unavailable; `legacyFreshnessState`
  in `src/lib/trust.ts` exists solely to collapse back to it. A percentage is not "Know
  before you go."
- **Config-driven windows** (env var or database column). No trace of this in the repo. It would put the product's central claim behind a value nobody reviews, and make the app's meaning unreproducible across environments. Rejected on principle; not recorded as having been weighed.

## Consequences

- The Bible's Section 40.2 entry "Exact freshness windows." is closed by this ADR. An agent that reads it as open should read this instead.
- Anyone changing 24 or 72 is changing what every badge in the app means, and must say so here first.
- The duplication is now a known defect, not an ambiguity: the bare constants in
  `src/db/seed.ts` must import `FRESHNESS_POLICY` from `src/lib/trust.ts`;
  `src/app/actions.ts` already does. **Two places can drift, not four.**
- The corroboration machinery splits, and the split matters. `PER_SOURCE_CAP` and `REPEAT_OBSERVATION_DECAY` are genuinely **inert** — all 949 (group, source) pairs hold exactly one observation, so repeat-decay never fires. **Distinct-source aggregation is LIVE and mismeasuring**: 319/474 groups sum evidence across 2–3 sources, that feeds `band`, and the write path now stores it. It is not idle; it is counting categories and the copy used to call them people. This ADR does not authorise anyone to "fix" it by inventing identity; see ADR-003.
- Per ADR-002's standing rule — if you write it, wire it — the live observation and read
  paths now use `src/lib/trust.ts`. That does not excuse the separate seed ladder; it names
  the authority that path must eventually use.

## Validation and review

The decision is validated when there is exactly one derivation. Concretely:

1. Grep for `24` and `72` as freshness constants returns only `src/lib/trust.ts`.
2. **Met for live reads.** `supportingObservationCount * 10` is gone (`f06dc1b`).
   `searchItems`, `getPopularItems`, and `getOffersNarrowed` in `src/app/actions.ts` call
   `getOfferTrustBatch`; `offerSignal` and `confidenceFor` in
   `src/app/_components/ItemDetailSheet.tsx` only present the returned trust assessment.
3. **Not met.** No *observation* write path stamps a literal `trustLevel` — but `src/db/seed.ts` does, and it wrote all 474 rows now in the database. The seed is a write path.

Reconsider when operational data shows the flat window is wrong for a real category — a tomato at 20h is not a bag of rice at 20h, and Section 21.4 is right that it isn't. That is a data-backed change to this file, not a fresh decision.
