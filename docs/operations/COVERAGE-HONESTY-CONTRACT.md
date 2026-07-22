# Coverage honesty contract (user-facing result states)

**Status:** Definition-only contract. It authorizes no shared-database mutation,
no migration application, no deployment, no copy change, and no ranking change.
It defines states and one inert classifier; wiring them into results is a later
lane.
**Owner:** Data/Truth Platform.
**Register entry:** [`WD-I-005` Coverage honesty](PORTFOLIO-AND-IDEA-REGISTER.md).
**Module:** [`src/lib/coverage/coverage-state.ts`](../../src/lib/coverage/coverage-state.ts)
(pure, inert, not yet wired).

This document defines the coverage state a single RESULT can carry to a user,
the exact admissibility rule per state citing the accepted ADRs, and how each
state is intended to map to user-facing language. It changes no shipped string,
no marker colour, and no ranking in this lane. Exact copy and thresholds are a
later Human Interface and product decision, refuted in their own lane.

## 1. What this contract is, and what it is not

This is the USER-FACING contract: the honesty state attached to a result a
person sees on a card, in a list, on the map, or in a sheet.

It is distinct from the operator packet
[`COVERAGE-PACKET.md`](COVERAGE-PACKET.md), which is the internal read-only
gap-and-conflict report for a bounded pilot geography under `WD-I-002`. The
packet answers "where should the field team go next"; this contract answers
"may this result imply that current nearby reality is known". The two share the
same admissibility floor and freshness windows on purpose, and Section 7 maps
their state names to each other, but they are different surfaces with different
audiences.

## 2. The principle

Hiding a gap is more harmful than showing no answer. A sparse local-information
product can accidentally imply that an empty, stale, broad, or weakly sourced
result means the current local state is known. It is not.

Every ambiguous, malformed, or under-evidenced input therefore resolves to the
least confident honest state, never a confident one. The fail-closed default is
`unknown`. No engagement goal may suppress an honest no-answer.

Coverage answers "do we know the current local state of this subject", not "what
is that state". It is orthogonal to availability. A `sufficient` result can
carry either in-stock or out-of-stock; coverage never asserts the availability
value, only whether admissible evidence supports one.

## 3. Admissibility floor (ADR-012 / ADR-015) and freshness (ADR-006)

A coverage state is computed over ADMISSIBLE evidence only. Admissible means a
row is both:

- `observations.provenance = 'observed'` (ADR-012 provenance boundary), and
- moderation-approved (ADR-015 admissibility matrix and moderation gate).

Every other origin contributes zero to a coverage state, per the ADR-015 matrix:

| Provenance | Contribution to a coverage state |
|---|---|
| `observed` | Admissible after the moderation and freshness gates |
| `synthetic` | Demo only. Zero. Labelled `Sample`; never a coverage state |
| `partner` | Quarantined. Zero |
| `reference` | Context only. Zero |
| `inferred` | Quarantined. Zero |

Moderation, source identity, collection method, and provenance stay independent
(ADR-012). A reputable source does not convert an inadmissible provenance class
into evidence, and an `observed` row still has to pass moderation and freshness.

Freshness windows are the flat ADR-006 windows, measured from `observed_at`:

- **fresh:** age ≤ 24h (`staleHours`)
- **stale window:** 24h < age ≤ 72h
- **expired:** age > 72h (`expirationHours`)

The app's single source of truth is `FRESHNESS_POLICY` in `src/lib/trust.ts`.
The inert module mirrors these two numbers with an ADR-006 citation because it
imports no app runtime; the wiring lane passes the live policy in. If ADR-006 or
`FRESHNESS_POLICY` changes the windows, the module default moves with them.

## 4. The six coverage states, exactly

Each state carries an exact admissibility rule over the admissible-evidence
summary. The classifier applies them in the precedence shown; exactly one state
results.

| State | Exact rule (admissible observed rows only) | Cites | Meaning to the user |
|---|---|---|---|
| **sufficient** | A fresh admissible row exists (age ≤ 24h) and ≥ 2 distinct source rows fall in the fresh window, with no fresh availability conflict | ADR-006, ADR-012, ADR-015 | Fresh and corroborated by more than one source row |
| **weak** | A fresh admissible row exists (age ≤ 24h) with 1 distinct source row in the fresh window, no fresh conflict | ADR-006, ADR-012, ADR-015 | Fresh but uncorroborated; a single source row |
| **stale** | Newest admissible row is 24h < age ≤ 72h; nothing inside the fresh window | ADR-006 | Ageing; confirm before relying on it |
| **conflicting** | Inside the fresh window, admissible rows disagree on availability (both available and unavailable appear) | ADR-006, ADR-015 | Hard disagreement; needs a human read, not a verdict |
| **absent** | The subject was observed before, but its newest admissible row is now older than 72h | ADR-006, ADR-012 | Was covered, now no current answer |
| **unknown** | No admissible observed row has ever existed for the subject, or the evidence summary is malformed or internally inconsistent | ADR-012, ADR-015 | Not known; the fail-closed default. A blank is a blank, not a green |

Rules bound to these states:

- **`absent` and `unknown` are different, and the difference is honest.**
  `absent` asserts a history ("we knew, the evidence expired"); `unknown` asserts
  nothing. When the summary cannot support the historical claim, the result is
  `unknown`, never `absent`.
- **The `sufficient` / `weak` split counts SOURCE ROWS, not people.** Per ADR-003
  and ADR-006, today's source rows are largely category rows. A multi-source
  result is a lower bound on independence, never proof that N people reported.
  The corroboration threshold (default 2) is a later product decision; this
  contract fixes the shape, not the exact number.
- **Availability is not a coverage state.** `available` versus `unavailable` is
  what the evidence says; the coverage state is whether we know. They travel
  together and never collapse into one another.

## 5. Precedence

Once configuration and age are valid, the classifier resolves exactly one state:

1. no admissible observed row ever, or malformed age → `unknown`
2. newest age > 72h → `absent`
3. newest age > 24h → `stale`
4. fresh window has an availability conflict → `conflicting`
5. fresh distinct source rows ≥ 2 → `sufficient`
6. fresh distinct source rows = 1 → `weak`
7. otherwise (a fresh age with no fresh source row, an inconsistent summary) →
   `unknown`

Disagreement outranks corroboration: a fresh result that conflicts is
`conflicting`, not `sufficient`, no matter how many sources it carries.

## 6. Mapping to user-facing language (no copy change in this lane)

This contract fixes the STATE and its admissibility; it does not author or
change shipped copy, colour, or ranking. The column below is the presentation
INTENT a later Human Interface lane must satisfy, consistent with the ADR-015
public-surface contract that copy, structured data, colour, counts, and ranking
must agree.

The current status set is `E sure` / `Check am` / `E no dey` (an availability
set) plus the synthetic-origin label `Sample` (ADR-015). Coverage state colours
how confidently that availability answer is presented; it does not add to the
availability set and does not replace `Sample`.

| State | Presentation intent (not shipped copy) |
|---|---|
| **sufficient** | May present the availability answer the evidence supports at full confidence |
| **weak** | Present the answer with a visible uncorroborated qualifier; a single source row, not a confirmed community verdict |
| **stale** | Do not present as current; invite a fresh confirmation rather than assert a verdict |
| **conflicting** | Show the disagreement; do not resolve it into one confident answer |
| **absent** | State that the subject was covered and the evidence has expired; offer no current answer |
| **unknown** | State plainly that it is not known; never imply coverage, never render as a confident or confirmed result |

`synthetic` evidence never produces any of these six states. A synthetic-only
result stays labelled `Sample` and carries no coverage state, exactly as ADR-015
requires; it may not borrow `sufficient`, `weak`, or any confident treatment.

## 7. Relationship to the operator packet states

The user-facing states map one to one onto the operator packet
([`COVERAGE-PACKET.md`](COVERAGE-PACKET.md) Section 4), which uses operator
names for the same admissibility floor and freshness windows:

| This contract (user-facing) | COVERAGE-PACKET (operator) |
|---|---|
| `sufficient` | `fresh` |
| `weak` | `weak_single_source` |
| `stale` | `stale` |
| `conflicting` | `conflicting` |
| `absent` | `absent (expired)` |
| `unknown` | `unknown place` |

The names differ because the audiences differ; the admissibility rule and the
freshness windows are the same in both, and both keep unknown as unknown.

## 8. The inert module

[`src/lib/coverage/coverage-state.ts`](../../src/lib/coverage/coverage-state.ts)
encodes these states: the `CoverageState` union, the
`AdmissibleEvidenceSummary` input shape, per-state admissibility metadata, and
one pure `classifyCoverageState` function that implements Section 5 and fails
closed to `unknown`. It performs no I/O, imports nothing from the app runtime,
and is wired into no read path. Building the admissible-evidence summary from
real observations, and mapping a state to a rendered surface, are later lanes.

## 9. Non-goals (explicit)

- No shared-database mutation, migration application, or deployment.
- No change to shipped copy, marker colour, status set, or ranking in this lane.
- No universal confidence score and no single coverage percentage for Lagos.
- No wiring of the module into any read, write, ranking, or presentation path.
- No synthetic, partner, reference, or inferred row counted as coverage.
- No inferred coverage: unknown stays unknown and is shown, not hidden.
- Distance, freshness, provenance, unit comparability, source independence, and
  conflict remain distinct signals; this contract collapses none of them.
