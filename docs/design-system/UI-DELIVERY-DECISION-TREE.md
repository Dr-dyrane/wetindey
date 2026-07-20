# WetinDey UI Delivery Decision Tree

**Status:** Standing Human Interface operating process  
**Owner:** Human Interface with Product and Quality/Release  
**Authority:** Process guidance beneath code, accepted ADRs, and current `LANES.md`

## Why this exists

WetinDey previously made obvious visual decisions move too slowly because architecture,
governance, and adversarial review were placed before visual convergence. The opposite
failure is equally dangerous: a polished prototype can escape with fake data, broken
states, or inaccessible behavior.

The correct process depends on the kind of uncertainty. Start at the layer that owns the
actual risk, then move forward without reopening settled work.

## Entry decision

```text
What is uncertain?
|
+-- The experience, hierarchy, spacing, copy, or visual state is unclear
|   -> Use the Visual Convergence path.
|
+-- Intended behavior is clear but the implementation is broken
|   -> Use the Behavioral Correction path.
|
+-- The change affects truth, privacy, security, external providers,
|   schema, migrations, identity, consent, retention, or public claims
|   -> Use the Consequential Change path.
|
+-- More than one applies
    -> Separate the paths. Resolve consequential boundaries first only
       where they constrain the visual contract; otherwise converge the
       non-consequential visual shell in parallel.
```

## Path A: Visual Convergence

Use this path when the user can point at the screen and say, “This does not communicate
the decision clearly.”

### 1. Frame one decision

Write one sentence:

> The person needs to decide ________.

Name one hero, one supporting insight, and one primary action. Remove everything that
does not help that decision.

### 2. Preserve truth constraints

Before changing pixels, list the claims the surface may and may not make. Reuse real,
typed data already available. A deterministic fixture is allowed only when an accepted
decision already permits it and the visible surface labels it truthfully. Never invent a
business, price, trust signal, verification, availability state, or provider result to
make a layout look complete.

### 3. Converge in live pixels

Use the existing reusable browser tab and hot reload. Work from the actual compact and
regular surfaces, not an imagined component library.

- Change one hierarchy decision at a time.
- Prefer removal, ordering, spacing, type, and proportion before adding components.
- Keep visible controls slender while preserving at least 44 by 44 CSS-pixel hit regions.
- Do not build architecture for a visual direction that has not been accepted.
- Do not run a full refutation matrix after every small visual adjustment.

### 4. Freeze the visual contract

Once the Founder or designated Human Interface owner accepts the direction, record:

- the single user decision;
- the accepted information order;
- compact and regular behavior;
- light and dark behavior;
- visible control geometry and hit regions;
- copy hierarchy;
- interaction and motion intent;
- explicit exclusions.

After this checkpoint, engineering preserves the visual contract. Functional wiring must
not casually redesign it.

### 5. Functionalize beneath the contract

Replace temporary boundaries with real typed providers, queries, state, and actions.
Implement loading, empty, unavailable, error, stale, saved, offline, and retry behavior
without dumping implementation detail into the primary view.

If real data cannot support the accepted claim, change the claim or fail closed. Never
fabricate completeness.

### 6. Harden once

After source work stops:

1. Verify direct compact and regular pixels.
2. Verify light and dark.
3. Verify keyboard, focus restoration, screen-reader names, zoom, and non-color meaning.
4. Verify reduced motion and failure states.
5. Run focused static, type, and build checks appropriate to the changed paths.
6. Give the frozen candidate to an independent default-to-refuted reviewer.
7. Correct concrete findings without reopening accepted taste decisions.

### 7. Release

Release only the unchanged reviewed candidate. Record what is proven, what remains
unverified, and what external state was not examined. Push promptly after the bounded
release gate passes; do not accumulate unrelated completed commits.

## Path B: Behavioral Correction

Use this path when intended behavior is already clear.

1. Reproduce the failure and identify its exact state transition.
2. Locate the smallest live call path that owns it.
3. Correct that path without redesigning adjacent surfaces.
4. Exercise the repaired behavior and its immediate failure state.
5. Obtain independent refutation for substantive changes.
6. Release the bounded candidate.

Do not create a new architecture, component system, or visual exploration to repair a
known behavioral defect.

## Path C: Consequential Change

Use this path for truth semantics, precise location, identity, consent, privacy, security,
external providers, schemas, migrations, retention, or public capability claims.

1. Read the governing ADR and live code.
2. Establish the exact claim, target, owner, and rollback boundary.
3. Amend or create the decision only when the current authority does not permit the work.
4. Build one complete live vertical slice; no dead service or speculative registry.
5. Fail closed when evidence, consent, configuration, or provider state is missing.
6. Validate the exact external target where authorization is required.
7. Obtain independent technical and, where relevant, privacy/security refutation.
8. Then release and observe.

Visual exploration may run in parallel only inside the accepted truth boundary.

## Stop rules

Stop and reframe when:

- two consecutive visual iterations add containers or copy without improving the primary
  decision;
- the team is discussing architecture before agreeing what the person should understand;
- a visual mock requires a claim the system cannot truthfully support;
- functional wiring changes the accepted hierarchy without Human Interface review;
- a reviewer is being asked to judge taste before the Founder has accepted the direction;
- browser evidence is stale, off-screen, or from a newly spawned duplicate tab;
- one lane begins accumulating unrelated concerns;
- passing static checks is being presented as proof that the experience works.

## Role sequence

| Stage | Accountable role | Required output |
|---|---|---|
| Frame | Product + Human Interface | One decision, one hero, one action |
| Converge | Human Interface implementer | Accepted live pixels and frozen visual contract |
| Functionalize | Owning engineer | Truthful typed live call path and complete states |
| Harden | Accessibility, Reliability, Security as applicable | Focused evidence against the frozen contract |
| Refute | Independent reviewer | Default-to-refuted verdict bound to the candidate |
| Release | Quality/Release | Prompt push/deploy of the unchanged accepted candidate |

## Final test

Before release, ask:

1. Did we solve the person’s decision before optimizing the system?
2. Did we preserve truth while moving quickly?
3. Did engineering retain the accepted visual hierarchy?
4. Did we validate the actual experience only after it stopped changing?
5. Is this the smallest complete solution?

If any answer is no, return to the earliest failed stage rather than restarting the whole
process.
