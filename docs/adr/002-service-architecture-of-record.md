# ADR-002: The service architecture of record, and the sequence to reach it

**Date:** 2026-07-16
**Status:** Accepted
**Owners:** Dr Dyrane Alexander

## Context

WetinDey was documented as a modular monolith in which every capability implements the
`WetinDeyModule` contract. A reverse-engineering audit of the working tree established
that this is not true, and has never been true:

- `src/core/module-contract.ts` has one importer — its own orphaned implementation,
  `src/modules/food/application/FoodModule.ts`. Live capabilities implementing it: **zero**.
- `src/db/queries/`, where the data layer is documented to live, contains one `.gitkeep`.
  Every SQL statement is inline in `src/app/actions.ts`.
- The application is two god-files: `src/app/page.tsx` and `src/app/actions.ts`.
- `src/lib/trust.ts` — a correct, source-weighted trust model — was written to rescue
  `FoodModule` and was orphaned identically. Its `getOfferTrust` / `getOfferTrustBatch`
  actions have no callers.
- The shipped trust level is the string literal `"high"`, hardcoded on every write
  (`src/app/actions.ts:398`, `:416`, `:622`).
- `moderationStatus` defaults to `'pending'` (`src/db/schema/index.ts:236`) while every
  writer hardcodes `'approved'` (`:340`, `:596`). Nothing can ever be pending.
- None of the Bible's named analytics events are emitted, so the launch gates have no
  data source.

Two consequences follow, and they are why this ADR exists rather than a wiki page.

**The drift is an active hazard, not untidiness.** AI agents and new engineers read
`AGENTS.md` and `docs/` as specification, act on them, and produce more orphans. The repo
has already done this twice. Documentation that describes a system that does not exist is
worse than no documentation.

**The product's central claim is unbacked.** "Know before you go" is a claim about
evidence quality. A hardcoded `"high"` is not evidence. Every other item in the audit is
subordinate to this one.

The full audit is `docs/architecture/SERVICE-ARCHITECTURE.md`.

## Decision

**`docs/architecture/SERVICE-ARCHITECTURE.md` is the architecture of record.** Where it
and any other document disagree, it wins. Where it and the code disagree, **the code
wins** and the document must be corrected.

Three commitments:

1. **The target decomposition is accepted as direction, not as a build order.** The
   service boundaries in its sections 4-8 describe where code should end up. They are not
   a licence to start moving code. See commitment 3.

2. **The roadmap's sequence is accepted, including its refusals.** Phases 0-6 are ordered
   by what unblocks a pilot, not by architectural purity. The document's *What to NOT do
   yet* list is as binding as the phases: no microservices, no ~~accounts/auth/RBAC~~
   **RBAC**, no search service, no media pipeline, no premature `ST_DWithin` migration.
   Anyone proposing those is re-litigating this ADR.

   > **AMENDED 16 July 2026 by [ADR-003](003-identity-for-contribution-trust.md).**
   > *User accounts / auth* is **struck** from the refusal list. Optional accounts are
   > accepted; **anonymous browse survives**. RBAC stays refused, and the rest of the list
   > stands unchanged.
   >
   > **This amendment was itself over-stated once, and is corrected here.** It first said
   > this ADR's reasoning — "Phase 2 needs device identity, not users" — *was wrong*. That
   > is too flat. Precisely: it was **wrong about reputation** (device identity cannot
   > carry a score across a cookie clear, and reputation is what the trust model lacks)
   > and **right about rate limiting** (a device cookie is still the correct fix for
   > flooding, and Phase 2 must still ship it). Accounts answer *who*; the device cookie
   > answers *how often*. They are complements, not substitutes — **neither this ADR's
   > Phase 2 nor its device-cookie plan is superseded.**

3. **Boundary work is gated behind correctness work.** Phase 5 — drawing module
   boundaries — may not begin until Phases 0-4 land. Reorganising code whose answers are
   wrong produces well-structured wrong answers. This repo's failure mode is writing
   architecture instead of fixing behaviour; this clause exists to stop it recurring.

**The rule that governs all of it:** *if you write it, wire it to a live call site in the
same change, or do not write it.* Both generations of dead code came from passes that were
forbidden from editing their own call sites. A change that adds an unreferenced export is
not a partial success; it is a regression. `AGENTS.md` Section 0 now carries this rule.

## Alternatives considered

**Keep the module fiction and build toward it.** Rejected. It is what produced
`FoodModule` and then `trust.ts`. The contract has never earned its keep, and a contract
with zero implementations is a costume.

**Delete the aspiration and accept the god-files permanently.** Rejected, but it is closer
to right than it sounds — at this size the god-files are survivable. `actions.ts` at 1,358
lines is not what threatens the product; a hardcoded `"high"` is. Hence the gating in
commitment 3 rather than a decomposition sprint.

**Rewrite into real modules now.** Rejected as the most expensive way to preserve the
bugs. It also repeats the pattern: architecture as displacement activity.

**Accept the audit's decomposition as a build order.** Rejected. It is a target, and
targets drift as the product learns. Committing to it as a plan would over-fit an
architecture to a pre-launch product with 478 offers.

## Consequences

**Improves.** One true description of the system exists. Agents have a document that does
not lie to them. The correctness work is sequenced ahead of the tidiness work, and the
refusals are written down so they stop being re-argued.

**Worsens.** The architecture of record is a snapshot of a dirty working tree at `019f3f3`;
its line numbers rot. It is long, and length is a cost — the *Read this first* section
exists because most readers will not read the rest. Accepting a document nobody re-reads
is a real risk.

**Becomes harder to reverse.** Little. This ADR mostly ratifies deletions and a sequence.
The expensive commitment is 3 — deferring boundary work — and it is reversible by a
superseding ADR the moment Phases 0-4 land.

**Costs accepted deliberately.** The god-files stay for now. The seq-scan predicates stay
for now. Photos stay deferred. Each is cheap at current scale and each has a named trigger
in the roadmap.

## Validation and review

1. **Phase 0 is done when no orphan can survive CI.** The audit's headline finding must
   become mechanically impossible to reintroduce, or it recurs. An unreferenced export
   fails the build.
2. **Phase 1 is done when trust is derived, not asserted.** `grep -rn '"high"' src/app/actions.ts`
   returns nothing, and `assessTrust` has live callers reaching the UI.

   > **Say this out loud, because the roadmap understated it.** There are **zero tests in
   > this repo** — no `npm run test`, no runner, no config, no `*.test.*`. So Phase 1's exit
   > criterion, "a vitest file over `assessTrust` passes", is not *adding a test*. **It is
   > adding testing.** That is a larger and more valuable act than the line implies, and it
   > should be sequenced and resourced as one.
   >
   > `assessTrust` is the right first test and possibly the cheapest one available: a pure
   > function over plain objects, no database, no network, no React. It also carries the
   > product's only claim — *this price is true, and this is how old that claim is*. **The
   > single most important thing in the codebase is the single least verified.**

3. **What checks this repo today, and what each is blind to.** Recorded because an agent
   reading a green build will otherwise believe it means something:

   | Check | Sees | Blind to |
   |---|---|---|
   | `tsc` | Types | A comment that lies. This repo's comments have lied at scale. |
   | `audit:tokens` | Palette names, border utils | Semantically wrong but correctly tokenised. `bg-background` contains no palette word — which is how `ModalSheet` shipped a black panel on a black scrim with a black shadow in dark mode, invisible, for weeks. |
   | `knip` | Unused exports | Code that **is** imported and **is** wrong. |
   | `LANES.md` | Nothing. It is advisory. | Everything. A markdown file is not a lock. |
   | Tests | — | **There are none.** |

   Nothing here checks a write path, a rendered string, or whether a number is *right*.

4. **Adversarial verification is standing practice, not a flourish.** On 16 July 2026 the
   bugs that were caught were caught by: the owner (~7), adversarial subagent verifiers (~5,
   including two blockers that would otherwise have shipped), `knip` (1, on its first run),
   and cross-session review (1). The session doing the work, unaided, caught about one — and
   only because a number looked wrong. **A session cannot review itself.** Any substantive
   change should be verified by an agent whose job is to refute it, and the verifier must be
   told to default to "refuted" when the evidence is thin.
3. **This ADR is reviewed when Phases 0-4 land** — at which point commitment 3 expires and
   the decomposition is re-argued against what was learned, not against this snapshot.
4. **The architecture of record is re-verified at every merge that moves a cited line.**
   If it cannot be kept true, it must be shortened until it can be.

If the document has not been read or corrected within one month, treat that as evidence it
is too long, and cut it rather than pretending it governs.
