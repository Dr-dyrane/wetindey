# WD-I-001 One-Tap Outcome Audit

**Type:** Read-only analysis. Authorizes nothing.
**Scope:** The live visit-confirmation flow in the codebase, audited against register entry
WD-I-001.
**Authority:** This document grants no lane, no code, no schema, no migration, no copy
change, and no deployment. It is input to a Founder portfolio review only.
**Register source:** `docs/operations/PORTFOLIO-AND-IDEA-REGISTER.md:336` (WD-I-001, Stage
Candidate).

> This audit does not move the register stage, claim a lane, accept an ADR, or authorize a
> re-enable. It records what the live flow does today and what a future decision would have
> to resolve.

## 1. What was audited

The register describes WD-I-001 as validating and simplifying an "existing return prompt"
so the primary outcome can be confirmed in one tap. That return prompt is the
`ConfirmVisitSheet` surface. The audited path, end to end:

| Stage | Symbol | File |
|---|---|---|
| Snapshot the claim on the way out | `getVisitContext` | `src/app/_actions/food-actions.ts:611` |
| Client fetch of that snapshot when the trip sheet opens | `visitContextRef` effect | `src/app/_components/home-page/hooks/useHomePage.ts:600` |
| Arm the question on the "Go there" tap | `handleArmVisit` then `armVisit` | `src/app/_components/home-page/hooks/useHomePage.ts:623`, `src/app/_components/confirm-visit-sheet/hooks/useConfirmVisitSheet.ts:47` |
| Detect return and decide eligibility | visibility/focus effect then `takeDueVisit` | `src/app/_components/home-page/hooks/useHomePage.ts:527`, `src/app/_components/confirm-visit-sheet/hooks/useConfirmVisitSheet.ts:65` |
| Present the return prompt | `ConfirmVisitSheet` render | `src/app/_components/home-page/views/HomePageView.tsx:265` |
| Render the questions | `ConfirmVisitSheetView` | `src/app/_components/confirm-visit-sheet/views/ConfirmVisitSheetView.tsx:89` |
| Local answer state | `useConfirmVisitSheet` | `src/app/_components/confirm-visit-sheet/hooks/useConfirmVisitSheet.ts:108` |
| Write the outcome | `submitVisitConfirmation` | `src/app/_actions/food-actions.ts:652` |
| Validated write contract | `visitConfirmationInput` | `src/lib/validation.ts:274` |

The live server entrypoints are re-exported at `src/app/_actions/actions.ts:8` and
`src/app/_actions/actions.ts:9`.

## 2. Findings

### (a) How the outcome is confirmed today, and in how many taps

**Today the outcome cannot be confirmed at all. The flow is fully contained, fail-closed,
at both layers.**

1. Server layer. `submitVisitConfirmation` (`src/app/_actions/food-actions.ts:652`) is a
   single statement that throws: `"Visit reports are temporarily unavailable while safety
   checks are added."` (`food-actions.ts:661`). There is no database write on any branch.
2. UI layer. Every control in `ConfirmVisitSheetView` carries a hardcoded `disabled`. The
   "Was it there?" choice is disabled (`views/ConfirmVisitSheetView.tsx:147`), the price
   choice is disabled (`:160`), the actual-price input is disabled (`:182`), and the only
   button is disabled (`:206`). A caution banner at the top of the sheet
   (`:119`) renders `contribution.paused_title` and `contribution.paused_body`, which read
   "Reports temporarily unavailable" and "We are adding safety checks before accepting food
   or visit reports." (`src/core/i18n/strings.ts:596`).
3. Hook layer. `useConfirmVisitSheet` (`hooks/useConfirmVisitSheet.ts:108`) holds answer
   state (`wasThere`, `priceRight`, `didBuy`, `realPrice`) but exposes no submit function,
   no `send`, and no call to `submitVisitConfirmation`. The commit path was removed when the
   surface was contained.

So the live tap count to a recorded outcome is **zero possible taps**. The sheet is a
read-only, disabled shell that explains the pause.

For context, the pre-containment design (git rev `3ba3963`, superseded, not the live path)
did auto-commit: `"was it there? No"` committed in one tap because its completeness gate was
`wasThere === "no"`, while `"was it there? Yes"` required three taps (there, price-right,
did-buy) before auto-submit because the gate also demanded `priceRight !== null` and
`didBuy !== null`, and the price-different path required typing plus an explicit Send button.
That prior design is the friction WD-I-001 names: the primary "was it there" answer on the
available branch could not commit until two further facts were collected.

### (b) Are "was there" and "price matched" kept as distinct facts

**Yes, structurally distinct, at the contract level.** The validated write shape
(`src/lib/validation.ts:274`) is a discriminated union on `wasAvailable`:

- `wasAvailable: false` is a `.strict()` object with no price fields at all. Not-there
  carries no price claim.
- `wasAvailable: true` carries a separate `priceWasRight` boolean, an optional `actualPrice`,
  and an optional `didBuy` boolean.

So availability, price match, and purchase are three separate facts, and "not there" cannot
smuggle a price. This satisfies the WD-I-001 guardrail that "was there" and "price matched"
remain distinct. Note this is the declared contract only; because the writer throws, the
contract is currently unused at runtime.

### (c) What is measured versus not, and is there a baseline

**Nothing is measured. There is no baseline, and the flow currently cannot produce one.**

- There is no analytics or telemetry anywhere in the flow. A search across
  `src/app/_components/confirm-visit-sheet` and `src/app/_components/home-page` finds no
  event emit, no track call, no analytics client. The app has no analytics pipeline wired to
  this surface.
- Nothing records the events a baseline would need: visit armed, prompt eligible, prompt
  shown, prompt dismissed without answer, primary answer given, detail given, or outcome
  submitted.
- The only artifact the flow was ever able to produce is a single evidence row. In the
  superseded writer that row was an `observation` with `collectionMethod: "visit_confirmation"`,
  attributed to one shared "Default Contributor" source, not a per-person identity. That is
  an evidence datum, not outcome telemetry, and it is disabled today.

WD-I-001 asks for a measured baseline and for enough independent outcomes to estimate
false-high and wasted-trip rates. The live flow provides none of that and, in its contained
state, is incapable of providing any of it.

### (d) Gaps against the WD-I-001 guardrails

| Guardrail | Status | Evidence |
|---|---|---|
| No continuous location tracking | Satisfied | Return detection uses `visibilitychange` and `focus` only (`useHomePage.ts:527`). Arming is a synchronous `localStorage` write (`useConfirmVisitSheet.ts:47`). `VisitContext` carries place identity, quoted price, and `quotedAt` only (`useConfirmVisitSheet.ts:13`), no user coordinates. No geolocation is read anywhere in the loop. |
| No coercive prompt | Satisfied, with one note | The prompt is asked at most once. `takeDueVisit` consumes the arm whether or not it fires (`useConfirmVisitSheet.ts:98`), and the sheet is dismissable through `ModalSheet` (Escape and backdrop, `HomePageView.tsx:268`). Note: it auto-opens on return with no user request. That is acceptable but should be named in any re-enable review. |
| No hidden identity linkage | Satisfied today | No writer runs, so nothing is attributed. The superseded writer attributed to a single shared "Default Contributor" source, not a per-user identity, so no per-person linkage existed. Any re-enable that introduces per-user attribution is a new decision. |
| No reward loop or gamification | Satisfied | No rewards, points, streaks, or contributor scoring exist in the flow. |
| No synthetic outcome | Satisfied | The quoted price is snapshotted as the claim under test (`getVisitContext` then `VisitContext.quotedPriceMin`), not fabricated, and the not-there branch deliberately files no price. |
| No self-validating trust | Gap, latent in any re-enable | The superseded writer set the offer to `trustLevel: "high"` and `moderationStatus: "approved"` from one visit, and `visit_confirmation` carries the maximum collection weight of `1.0` (`src/lib/trust.ts:91`). Restoring that writer verbatim would let one person's single tap promote an offer to high trust with no independent corroboration, which collides with the WD-I-001 "no self-validating trust" guardrail and with the ADR-011 reputation boundary the register cites. The contribution-integrity fail-closed boundary is currently the only thing standing between the UI and that behavior. |

Net: the live posture is safe because it is contained. The guardrail risk is not in what runs
today, it is in what a naive re-enable would restore.

### (e) The smallest safe change for a one-tap primary outcome with optional detail after

The one-tap primary is already expressible in the existing contract: the validation union
already accepts `{ wasAvailable: false }` alone, and `{ wasAvailable: true, priceWasRight }`
with `actualPrice` and `didBuy` optional (`src/lib/validation.ts:274`). The UI change to reach
one tap is small: commit the primary "was it there" answer on the first tap for both yes and
no, and demote price match, actual price, and purchase to optional follow-up disclosed after
the primary commit, rather than gating the commit on them.

That UI change, however, is not the smallest safe change, because it cannot ship safely while
three preconditions are open:

1. The server writer is fail-closed (`food-actions.ts:661`), so any UI commit throws.
2. There is no admissible event model and no baseline instrumentation, so a re-enable would
   ship blind against WD-I-001's own success signal.
3. The self-validating-trust behavior of the prior writer is unresolved, so re-enabling the
   old path would breach a guardrail.

Therefore the smallest genuinely safe change is not a UI change. It is, in order:

1. Add trust-neutral, identity-minimal outcome instrumentation that records eligible, shown,
   dismissed, primary-answered, and detail-answered, and that does not mutate offer trust and
   does not attribute to a person, so a baseline can be estimated before any write is
   re-enabled.
2. Only after a baseline exists, re-enable the outcome write behind the contribution-integrity
   boundary with an explicit rule that a single confirmation never sets offer trust to high and
   never self-approves moderation.
3. Only then simplify the prompt so the primary "was it there" outcome commits in one tap with
   price and purchase as optional post-commit detail.

Steps 2 and 3 each require separate authority (contribution-integrity re-enable, and a lane).
This audit recommends none of them and claims none of them. It only sequences them.

## 3. Recommendation

The live flow is correctly and honestly contained. It cannot record an outcome, it leaks no
location, it links no identity, it grants no reward, and it fabricates no outcome. It also
measures nothing, so WD-I-001 has no baseline and, in the flow's current state, cannot get
one. The one-tap simplification the register hypothesizes is downstream of two prior
decisions that this audit is not authorized to make: whether to instrument first, and whether
to re-enable the write behind contribution integrity without restoring the self-validating
trust behavior of the prior writer.

The exact question for the Founder portfolio review:

> Does the Founder approve opening a narrow lane to add trust-neutral, identity-minimal
> outcome instrumentation to the currently fail-closed visit-confirmation path so a baseline
> can be measured first, on the explicit condition that no single confirmation ever sets an
> offer to high trust or self-approves moderation and that the one-tap UI simplification is
> deferred until that baseline exists, or should the flow remain fully contained until the
> separate contribution-integrity re-enable decision is made?
