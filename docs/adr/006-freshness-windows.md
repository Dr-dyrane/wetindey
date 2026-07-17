# ADR-006: The freshness windows are 24h and 72h

**Date:** 2026-07-16  
**Status:** Accepted  
**Owners:** Dr Dyrane Alexander

## Context

This ADR records a decision already made in code and never written down.

WetinDey's claim is "Know before you go." Freshness is not a feature of that claim, it *is* that claim — every badge, every pin colour, every "Confirmed" the app prints is an assertion about age. The windows that define it shipped: `FRESHNESS_POLICY = { staleHours: 24, expirationHours: 72 }` (src/lib/trust.ts:65-68), consumed by `freshnessOf()` (trust.ts:329-336) — over 24h is `stale`, over 72h is `expired`. The same two numbers are duplicated as bare constants in src/db/seed.ts:31-32, and 72h is hardcoded at the two write paths that stamp `expiresAt` (src/app/actions.ts:357, :624).

The hazard is that WETINDEY_BIBLE.md:4401 still lists "Exact freshness windows." as an open decision. An agent reading that as genuinely open may pick different numbers, and silently change what every badge in the app means. The numbers are not open. They are in force.

What *is* true, and must not be dressed up: freshness does not work today. Multiple disagreeing derivations ship at once, and the good one is dead.

- **The good model is unreachable.** `assessTrust` (trust.ts:431) has exactly one caller: `getOfferTrustBatch` (actions.ts:1295), which `getOfferTrust` (actions.ts:1355) wraps. Neither is imported by any component — grep for `getOfferTrust` across src/ returns only those definitions.
- **What is actually written is a constant.** Every observation write stamps the literal string `trustLevel: "high"` (actions.ts:398, :416, :622). No model runs.
- **A second derivation renders the UI.** `offerSignal` (src/app/_components/ItemDetailSheet.tsx:135-164) computes freshness in a React component from `expiresAt <= now` and the stored `freshnessState` column. src/app/page.tsx imports it back out (page.tsx:31) to colour map pins (page.tsx:785). It knows nothing of trust.ts.
- **A third derivation is also dead.** `supportingObservationCount * 10` (actions.ts:239) — uncapped, blind to who reported — sits in `getFoodItemCandidates`, which no component calls.

One further fact bounds what the model can currently mean: `sources` is a three-row *category* table, not a table of people — Contributor/Public data/Vendor, seeded at src/db/seed.ts:253-256. Both write paths resolve to the single "Contributor" row (actions.ts:314-321, :583). So `distinctSourceCount` is structurally 1, and the anti-corroboration machinery — `PER_SOURCE_CAP`, `REPEAT_OBSERVATION_DECAY`, distinct-source aggregation — is arithmetically inert today. It cannot become live until observations carry a per-contributor identity, which is the same unmet condition ADR-003 records.

## Decision

The freshness windows are **24 hours (stale) and 72 hours (expired)**, flat, across all categories. This ratifies what is in force.

`src/lib/trust.ts` is named the single place allowed to express that policy. Any surface that needs to know how old is too old imports `FRESHNESS_POLICY` or calls `freshnessOf()`; nothing else states the numbers.

**This is a decision about which model is authoritative, not a claim that it is wired.** As of this ADR, trust.ts is dead code and the shipping behaviour comes from `offerSignal` and a hardcoded `"high"`. Roadmap Phase 1 makes the decision true by routing the live surfaces through trust.ts and deleting the rival derivations. Until then, a reader should assume freshness in this app is approximately correct by coincidence, not by construction.

Also ratified, as part of the same model and for the same reason (they are the shape of the answer, and re-deciding them re-defines the badges):

- **Linear age decay**, zero at 144h: `clamp01(1 - ageHours / (expirationHours * 2))` (trust.ts:225-230). No floor — evidence must be able to reach zero, or age stops meaning anything.
- **The newest observation drives freshness and availability** (trust.ts:450-471). Older reports are history.
- **Confidence-descending ranking**, ties broken on freshness then distinct sources (`rankByConfidence`, trust.ts:514-527).

Out of scope here: the `TRUST_BANDS` thresholds (trust.ts:347-354) are marked PROVISIONAL in the code and stay open — what earns "high" is a product call. This ADR fixes the windows, not the bands.

## Alternatives considered

Reconstructed after the fact. Where the reasoning is not recorded, this says so rather than inventing one.

- **Per-category windows.** WETINDEY_BIBLE.md Section 21.4 (line 2418) contemplates exactly this: ≤6h for highly perishable produce, ≤24h for daily open-market staples, ≤72h for packaged shelf-stable goods, vendor expiry for scheduled stock. **They were never built.** `FRESHNESS_POLICY` is one flat object and `freshnessOf()` takes no category argument; grep finds no category-keyed window anywhere in src/. The Bible calls them "provisional starting rules" needing operational calibration — and the pilot has no operations to calibrate against, which is the most plausible reason they were skipped. But the decision to skip them is not recorded. This ADR ratifies the flat window as what shipped; per-category windows remain a legitimate future change, and this file is where that change gets re-argued.
- **Continuous decay, no bands.** trust.ts already has the continuous curve (`ageDecay`, `scoreFromEvidence`) and could have exposed a bare number. Rejected in effect because the database schema demands a band: `offers_current.freshness_state` is an enum of confirmed|caution|unavailable (per trust.ts:372-389, which exists solely to collapse back to it), and a badge must say one thing. A percentage is not "Know before you go."
- **Config-driven windows** (env var or database column). No trace of this in the repo. It would put the product's central claim behind a value nobody reviews, and make the app's meaning unreproducible across environments. Rejected on principle; not recorded as having been weighed.

## Consequences

- The Bible's Section 40.2 entry "Exact freshness windows." is closed by this ADR. An agent that reads it as open should read this instead.
- Anyone changing 24 or 72 is changing what every badge in the app means, and must say so here first.
- The duplication is now a known defect, not an ambiguity: seed.ts:31-32 and the hardcoded 72h at actions.ts:357 and :624 must import from trust.ts. Until they do, four places can drift.
- The corroboration machinery in trust.ts is inert and will stay inert while `sources` is a category table. This ADR does not authorise anyone to "fix" it by inventing identity; see ADR-003.
- Per ADR-002's standing rule — if you write it, wire it — trust.ts is currently a violation. This ADR does not excuse that. It names the target so the wiring has somewhere to land.

## Validation and review

The decision is validated when there is exactly one derivation. Concretely:

1. Grep for `24` and `72` as freshness constants returns only src/lib/trust.ts.
2. `offerSignal` and `supportingObservationCount * 10` (actions.ts:239) are gone, and the surfaces that used them call trust.ts.
3. No write path stamps a literal `trustLevel`.

Reconsider when operational data shows the flat window is wrong for a real category — a tomato at 20h is not a bag of rice at 20h, and Section 21.4 is right that it isn't. That is a data-backed change to this file, not a fresh decision.
