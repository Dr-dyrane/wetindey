# ADR-012: Observation provenance is explicit and fail-closed

**Date:** 2026-07-17  
**Status:** Accepted  
**Owners:** Dr Dyrane Alexander

## Context

WetinDey currently stores generated demonstration observations and live contributions in
the same immutable `observations` log. A source type describes who or what supplied a
record, while `collection_method` describes how it arrived. Neither answers the separate
question: what is the epistemic origin of this claim?

Without an explicit provenance boundary, generated values can be mistaken for field
observations, confidence can count synthetic rows as corroboration, and future partner,
reference, or inferred data can silently enter a human-report path.

D1 restored reproducible migration lineage through `0008`. D2 can therefore add this
boundary without rewriting applied history.

## Decision

Every immutable observation has one required provenance value:

| Value | Meaning |
|---|---|
| `synthetic` | Generated, demonstration, test, or historically unproven data. |
| `observed` | A direct human report or visit confirmation handled by a live contribution writer. |
| `partner` | A claim supplied by an accountable external organization or feed. |
| `reference` | Static contextual material that is not evidence of current local state. |
| `inferred` | A derived or model-produced claim that is not a direct observation. |

The database enforces these values with a Postgres enum on
`observations.provenance`.

The column is `NOT NULL` and defaults to `synthetic`. This is a deliberate fail-closed
default:

- existing rows are not upgraded to observed without proof;
- a future writer that forgets to classify a record cannot accidentally create live
  human evidence;
- every current live contribution writer still sets `observed` explicitly; and
- the seed writer sets `synthetic` explicitly.

The default is not permission to omit provenance from a known writer. It is the safe
result when origin is unknown.

`source_type`, source identity, collection method, moderation status, and provenance stay
independent. For example, a vendor can submit an observed report or a partner feed, and an
app entry can still be synthetic in a demonstration environment.

`offers_current` does not receive one provenance column. It is a derived projection that
can be supported by mixed-origin observations. A later read-side confidence phase must
summarize the admissible evidence set rather than flattening it into one misleading value.

The reserved `partner`, `reference`, and `inferred` values do not authorize a writer,
ingestion pipeline, ranking rule, or public label. Each capability still requires its own
accepted scope and live call site.

D2 classifies records only. It does not change confidence coefficients, trust bands,
ranking, moderation, reputation, rewards, media, or catalog behavior. The V1 truth-core
lane must decide which provenance classes are admissible and how synthetic data is
labelled or quarantined on each live read.

## Alternatives considered

**Use `source_type`.** Rejected. Actor category and claim origin are different facts.

**Use `collection_method`.** Rejected. Transport or capture method does not prove whether
the underlying information was observed, generated, referenced, or inferred.

**Add only `is_synthetic`.** Rejected. A boolean would immediately collapse partner,
reference, inferred, and observed records into one ambiguous false value.

**Put provenance only on `offers_current`.** Rejected. The immutable evidence log is the
source of truth, and a derived offer can contain mixed provenance.

**Add a generic provenance graph or metadata table.** Rejected for D2. One typed field on
the live observation boundary solves the current integrity problem without speculative
infrastructure.

## Consequences

**Improves.** Generated and directly observed records are durably distinguishable.
Future trust, ranking, analytics, and public explanations can use an enforced origin
instead of guessing from source names.

**Costs.** Adding or renaming provenance values requires a migration. Every observation
writer must classify its output explicitly.

**Constrains.** Synthetic, reference, and inferred rows cannot be presented as direct
human corroboration, learned reputation outcomes, verified decisions, or reward-eligible
evidence.

**Does not solve.** D2 does not establish source independence, public provenance copy,
partner contracts, media evidence, moderation, confidence calibration, or catalog
stewardship.

## Validation or review date

Review before the V1 truth-core lane is closed and again before the first partner,
reference, inferred, or media-evidence writer is accepted.
