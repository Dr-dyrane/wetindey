# ADR-006: The freshness windows are 24h and 72h

**Date:** 2026-07-16  
**Status:** Accepted  
**Owners:** Dr Dyrane Alexander

## Context

This ADR records a decision already made in code and never written down.

WetinDey's claim is "Know before you go." Freshness is not a feature of that claim, it *is* that claim — every badge, every pin colour, every "Confirmed" the app prints is an assertion about age. The windows that define it shipped: `FRESHNESS_POLICY = { staleHours: 24, expirationHours: 72 }` in `src/lib/trust.ts`, consumed by `freshnessOf()` in the same file — over 24h is `stale`, over 72h is `expired`. The same two numbers are duplicated as bare constants in `src/db/seed.ts`. Both write paths that stamp `expiresAt` now import `FRESHNESS_POLICY.expirationHours` rather than re-typing 72 — an earlier version of this ADR said they hardcoded it, which was true when written and was fixed in `2a70fde`.

**Citations here name SYMBOLS, not lines, and that is deliberate.** An earlier version of this ADR carried roughly two dozen `file:NNN` citations and every named one drifted within a day — `rankByConfidence` 514-527 → 591, `getOfferTrustBatch` 1295 → 1607 — moved by ordinary commits that changed nothing this ADR says. This document's whole job is to be checkable later; a citation that rots cannot do that. A symbol is greppable forever.

The hazard is that `WETINDEY_BIBLE.md` Section 40.2 once listed "Exact freshness windows." as an open decision. An agent reading that as genuinely open may pick different numbers, and silently change what every badge in the app means. The numbers are not open. They are in force.

**AMENDED 2026-07-17 — the write half of this landed, and the original text below was written before it.** The original said "freshness does not work today… the good one is dead". That is no longer true, and an agent reading the stale version would conclude the trust work is undone and redo it. Corrected state, verified:

- **The write path now runs the model.** `assessTrust` has three live callers in `src/app/actions.ts` — both observation write paths and the batch reader. It is no longer dead code.
- **The hardcoded constant is gone from the observation write paths.** `grep -c 'trustLevel: "high"' src/app/actions.ts` returns **0**; both writes now set `trustLevel` from `assessment.band`. **That grep is scoped to one file and the scope is load-bearing** — `src/db/seed.ts` still stamps a literal ladder, and it wrote every row currently in the database. See the fourth derivation below.
- **The READ half is still not wired, and that is what remains.** `offerSignal` in `src/app/_components/ItemDetailSheet.tsx` still computes freshness inside a React component, and `src/app/page.tsx` still imports it back out to colour the map pins. `getOfferTrustBatch` still has no component caller. So there are still two derivations; the difference is that the good one now writes, and the rival one still renders.
- **A third derivation is GONE.** `supportingObservationCount * 10` — uncapped, blind to who reported — lived in `getFoodItemCandidates`, which was deleted in `f06dc1b`. The arithmetic exists nowhere in live code; every remaining mention is a comment describing it in the past tense. Its replacement, `confidenceFor` in `ItemDetailSheet.tsx`, buckets instead.
- **A FOURTH derivation was never named here, and it wrote every row you can see.** `src/db/seed.ts` stamps a hardcoded ladder — `freshnessState === "confirmed" ? "high" : "caution" ? "medium" : "low"` — bypassing `trust.ts` entirely. Live database: 235 high / 147 medium / 92 low = **474 rows = all of `offers_current`**. So the model that runs on writes has not yet touched a single row a user has ever seen.

One further fact bounds what the model can currently mean: `sources` is a three-row *category* table, not a table of people — Contributor / Public data / Vendor, seeded in `src/db/seed.ts`.

> **CORRECTION 2026-07-17.** This paragraph said `distinctSourceCount` is "structurally 1". **Measured, it exceeds 1 in 319 of 474 offer groups** — the seed spreads observations across all three categories. The count is CATEGORIES and the copy called them PEOPLE; `trust.ts` now says "sources". Same error as [ADR-003](003-identity-for-contribution-trust.md), which corrects it — I made the claim in two ADRs from one unmeasured assumption and fixed only one.

What remains true: the anti-corroboration machinery — `PER_SOURCE_CAP`, `REPEAT_OBSERVATION_DECAY`, distinct-source aggregation — cannot mean what it claims until observations carry a per-contributor identity, which is the unmet condition ADR-003 records. And per ADR-003, `sources.user_id` alone does not close it: once real per-user rows exist the count MIXES people and categories.

## Decision

The freshness windows are **24 hours (stale) and 72 hours (expired)**, flat, across all categories. This ratifies what is in force.

`src/lib/trust.ts` is named the single place allowed to express that policy. Any surface that needs to know how old is too old imports `FRESHNESS_POLICY` or calls `freshnessOf()`; nothing else states the numbers.

**This is a decision about which model is authoritative, not a claim that it is wired.** When written, `trust.ts` was dead code and the shipping behaviour came from `offerSignal` and a hardcoded `"high"`. **As of 2026-07-17 the write half is wired** — the hardcoded constant is gone and `assessTrust` runs on every observation. The read half is not: `offerSignal` still renders the badges and the pins. So freshness is now derived when it is *stored* and re-derived, differently, when it is *shown*. Roadmap Phase 1 finishes it by routing the live surfaces through `trust.ts` and deleting the rival derivations.

Also ratified, as part of the same model and for the same reason (they are the shape of the answer, and re-deciding them re-defines the badges):

- **Linear age decay**, zero at 144h: `clamp01(1 - ageHours / (expirationHours * 2))` — `ageDecay` in `trust.ts`. No floor — evidence must be able to reach zero, or age stops meaning anything.
- **The newest observation drives freshness and availability** — see `assessTrust` in `trust.ts`. Older reports are history.
- **Confidence-descending ranking**, ties broken on freshness then distinct sources — `rankByConfidence` in `trust.ts`.

Out of scope here: the `TRUST_BANDS` thresholds in `trust.ts` are marked PROVISIONAL in the code and stay open — what earns "high" is a product call. This ADR fixes the windows, not the bands.

## Alternatives considered

Reconstructed after the fact. Where the reasoning is not recorded, this says so rather than inventing one.

- **Per-category windows.** `WETINDEY_BIBLE.md` Section 21.4 contemplates exactly this: ≤6h for highly perishable produce, ≤24h for daily open-market staples, ≤72h for packaged shelf-stable goods, vendor expiry for scheduled stock. **They were never built.** `FRESHNESS_POLICY` is one flat object and `freshnessOf()` takes no category argument; grep finds no category-keyed window anywhere in src/. The Bible calls them "provisional starting rules" needing operational calibration — and the pilot has no operations to calibrate against, which is the most plausible reason they were skipped. But the decision to skip them is not recorded. This ADR ratifies the flat window as what shipped; per-category windows remain a legitimate future change, and this file is where that change gets re-argued.
- **Continuous decay, no bands.** trust.ts already has the continuous curve (`ageDecay`, `scoreFromEvidence`) and could have exposed a bare number. Rejected in effect because the database schema demands a band: `offers_current.freshness_state` is an enum of confirmed|caution|unavailable (see `legacyFreshnessState` in `trust.ts`, which exists solely to collapse back to it), and a badge must say one thing. A percentage is not "Know before you go."
- **Config-driven windows** (env var or database column). No trace of this in the repo. It would put the product's central claim behind a value nobody reviews, and make the app's meaning unreproducible across environments. Rejected on principle; not recorded as having been weighed.

## Consequences

- The Bible's Section 40.2 entry "Exact freshness windows." is closed by this ADR. An agent that reads it as open should read this instead.
- Anyone changing 24 or 72 is changing what every badge in the app means, and must say so here first.
- The duplication is now a known defect, not an ambiguity: the bare constants in `seed.ts` must import from `trust.ts`. `actions.ts` already does. **Two places can drift, not four.**
- The corroboration machinery splits, and the split matters. `PER_SOURCE_CAP` and `REPEAT_OBSERVATION_DECAY` are genuinely **inert** — all 949 (group, source) pairs hold exactly one observation, so repeat-decay never fires. **Distinct-source aggregation is LIVE and mismeasuring**: 319/474 groups sum evidence across 2–3 sources, that feeds `band`, and the write path now stores it. It is not idle; it is counting categories and the copy used to call them people. This ADR does not authorise anyone to "fix" it by inventing identity; see ADR-003.
- Per ADR-002's standing rule — if you write it, wire it — trust.ts is currently a violation. This ADR does not excuse that. It names the target so the wiring has somewhere to land.

## Validation and review

The decision is validated when there is exactly one derivation. Concretely:

1. Grep for `24` and `72` as freshness constants returns only src/lib/trust.ts.
2. **Half met.** `supportingObservationCount * 10` is gone (`f06dc1b`). `offerSignal` remains, and the surfaces that use it must call `trust.ts`.
3. **Not met.** No *observation* write path stamps a literal `trustLevel` — but `src/db/seed.ts` does, and it wrote all 474 rows now in the database. The seed is a write path.

Reconsider when operational data shows the flat window is wrong for a real category — a tomato at 20h is not a bag of rice at 20h, and Section 21.4 is right that it isn't. That is a data-backed change to this file, not a fresh decision.
