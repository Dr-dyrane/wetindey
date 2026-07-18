# ADR-015: Live confidence admits observed evidence; synthetic data stays labelled demo

**Date:** 2026-07-18
**Status:** Accepted
**Owners:** Dr Dyrane Alexander

## Context

ADR-012 classifies every observation as `synthetic`, `observed`, `partner`, `reference`,
or `inferred`, but deliberately leaves public-read policy to the V1 truth-core lane.

That decision is now blocking. The repository's demonstration observations are explicitly
`synthetic`, while the current trust query admits every non-rejected observation. As a
result, generated rows can receive source weights, count as independent corroboration,
and produce a public confirmation band. The same `offers_current` rows also feed search,
map, detail, Get-It, indexable pages, social cards, and structured data.

T1 made one server assessment authoritative across the interactive read path. It did not
decide which provenance classes that assessment may admit. Leaving the query unchanged
would make the wrong answer consistent rather than trustworthy.

Migration `0009` provides the required provenance column and has passed disposable
reproducibility validation. It remains unapplied to every shared environment. Migration
`0010` is a separate, final, unapplied public-source staging migration and does not
authorize promotion into live observations.

## Decision

### V1 admissibility matrix

| Provenance | V1 current-state use | Confidence and independence | Public treatment |
|---|---|---|---|
| `observed` | Admissible after the existing moderation and freshness gates | May contribute through the existing source-weighted, per-source-capped trust model | May produce current status, confidence, and reported-price projections |
| `synthetic` | Demo fallback only | Must contribute zero confidence, zero corroboration, zero reputation, and zero verified outcomes | Must be visibly labelled `Demo data`; it may not be presented as confirmed or reported evidence |
| `partner` | Quarantined until an accepted promotion and admissibility decision | Zero in V1 | No live writer or public current-state projection is authorized |
| `reference` | Context only, never current local state | Zero | May support future explanatory content, never a current offer |
| `inferred` | Quarantined from direct current-state claims | Zero | Must not be presented as observation, verification, or corroboration |

Moderation, source identity, collection method, and provenance remain independent. An
`observed` row still has to pass the existing moderation and freshness rules. A reputable
source does not convert an inadmissible provenance class into evidence.

### Mixed-origin offer rule

An offer key may have both synthetic and observed history.

1. Confidence, freshness, availability, source counts, and explanations are derived from
   admissible `observed` rows only.
2. Synthetic rows never increase a band, clear an independence threshold, or extend a
   freshness window.
3. Once admissible observed evidence exists for an offer key, its live price and
   availability projection must not merge synthetic values into the observed range.
4. When no observed evidence exists, the current demo projection may remain visible only
   as a clearly labelled demo fallback with caution or neutral map treatment.
5. Partner, reference, and inferred rows do not become fallback live offers.

This preserves the useful demonstration experience without laundering demo fixtures into
community evidence.

### Public-surface contract

Every public projection must preserve the same provenance meaning.

- Landing and search cards may show a demo price, but the status label must say
  `Demo data`, not `E sure`, `confirmed`, or an equivalent claim.
- Offer detail and Get-It may retain the sample price and location for demonstration, but
  confidence must show no admissible reports and the provenance label must remain visible.
- Demo-only map markers use caution or neutral treatment, never confirmed treatment.
- A mixed offer displays only the assessment and live range derived from observed rows.
- Indexable item/place pages may describe the catalog subject or venue, but synthetic-only
  rows must not produce current-price metadata, `Offer`/`AggregateOffer` structured data,
  "reported" claims, or price-bearing social cards.
- Analytics, reputation, rewards, verification, seller accuracy, and review credibility
  must exclude synthetic, reference, and inferred rows.

The label is not a disclaimer that permits contradictory confident styling. Copy,
structured data, color, counts, and ranking must agree.

### Deployment gate

Implementation may be developed and statically refuted on `main`, but it must not be
deployed to an environment whose observation table lacks migration `0009`.

For each target environment:

1. obtain separate authorization for that exact database;
2. prove its current migration ledger and backup/restore readiness;
3. apply the pending lineage in order without rewriting applied SQL;
4. verify the provenance enum, `NOT NULL` column, default, and writer compatibility;
5. then deploy the provenance-aware application code and drive its live read surfaces.

This ADR does not authorize applying `0009` or `0010`, changing a shared database,
promoting staged public-source candidates, or deploying application code.

### Implementation slices

The implementation remains evolutionary:

1. **T2A, trust admission:** summarize all provenance classes for explanation, but pass
   only admissible observed rows into `assessTrust`; update both read and write-side trust
   derivation.
2. **T2B, demo presentation:** carry the provenance summary through cards, offer detail,
   Get-It, and map markers; label synthetic-only fallback consistently.
3. **T2C, projection isolation:** prevent mixed synthetic/observed price and availability
   ranges; observed evidence wins without deleting demonstration history.
4. **T2D, SEO firewall:** exclude synthetic-only offers from current-price metadata,
   structured offers, reported-price copy, and price-bearing social cards.
5. **T2E, runtime refutation:** after authorized migration and deployment, verify the
   same offer across card, detail, map, Get-It, item page, place page, and social metadata.

No graph database, reputation schema, coefficient change, partner writer, reference CRUD,
inference engine, review launch, reward program, or new category is authorized here.

## Alternatives considered

**Count synthetic rows but add a disclaimer.** Rejected. A label cannot undo a confidence
score, green marker, corroboration count, or structured offer generated from demo data.

**Hide all synthetic data immediately.** Rejected for the current demonstration phase.
It would remove the useful product fixture before sufficient observed coverage exists.
Visible, zero-confidence demo fallback preserves the experience without misrepresenting it.

**Treat partner data as observed.** Rejected. ADR-012 and ADR-013 distinguish direct human
observation from accountable external publication. Partner admission requires its own
promotion, independence, correction, and revocation policy.

**Add provenance to `offers_current`.** Rejected for this phase. A projection can contain
mixed-origin history; flattening it to one enum would conceal the evidence set. The
immutable observations remain authoritative.

**Deploy code first and rely on the default.** Rejected. An application query that
references a column missing from a shared database is an outage, not fail-closed behavior.

## Consequences

**Improves.** Confirmation becomes earned from direct, attributable participation.
Demonstration content remains useful and honest. Future partner evidence cannot enter by
accident.

**Costs.** Read and projection queries must carry provenance summaries, demo labels need
surface work, and SEO loses price-bearing markup until observed coverage exists.

**Constrains.** The platform cannot claim current verified coverage from its seed, use
demo rows to bootstrap reputation, or deploy provenance-aware code ahead of migration
`0009`.

## Validation

T2 is not complete until an independent refuter proves:

- synthetic-only evidence yields zero confidence and a visible demo label;
- repeated synthetic rows never change the confidence band;
- mixed offers derive confidence and live ranges from observed rows only;
- partner, reference, and inferred rows remain inadmissible;
- card, detail, map, Get-It, SEO copy, JSON-LD, and social metadata agree;
- no public surface calls demo data reported, confirmed, verified, or current;
- write-side and read-side trust use the same admissibility rule;
- the exact shared database has `0009` before provenance-aware code is deployed; and
- no migration, deployment, or public-source promotion is inferred from this ADR.
