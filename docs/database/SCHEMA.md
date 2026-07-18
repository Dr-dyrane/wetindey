# Canonical desired-state schema

WetinDey's database desired state is divided into dependency-ordered pillars under
[ADR-014](../adr/014-pillar-baselines-and-release-migrations.md). A pillar is an ownership
and reconstruction boundary, not a runtime microservice and not automatic permission to
implement future product scope.

## Pillar inventory

| Order | Pillar | Canonical responsibility | Depends on |
|---|---|---|---|
| `00` | Foundation and extensions | PostgreSQL foundations, PostGIS, common schemas and foundational types | None |
| `10` | Identity and profile | WetinDey profiles and references to authenticated actors; excludes Neon Auth provider-owned tables | Foundation |
| `20` | Geography and places | Areas, places, coordinates, coverage relationships and geospatial indexes | Foundation |
| `30` | Catalog | Categories, items, variants, aliases, units and catalog constraints | Foundation |
| `40` | Observations, provenance and offers | Immutable observations, provenance classes, current derived offers and evidence relationships | Identity, geography, catalog |
| `50` | Ingestion and evidence | Source registry, captures, extraction, deduplication and quarantined review staging | Catalog, geography, observations |
| `60` | Trust and moderation | Assertions, moderation state and approved earned-trust primitives | Identity, observations, ingestion |
| `70` | Reviews and community | Subjective reviews, community relationships and events | Identity, catalog, geography |
| `80` | Services and RPCs | Functions, views and stable database-side service contracts | Every pillar used by each service |
| `90` | RLS and grants | RLS enablement, policies, roles, grants and revocations | Every protected object and required RPC |

## Source forms

Drizzle TypeScript declarations are canonical for tables, columns, enums, constraints and
indexes they model. Reviewed explicit pillar SQL is canonical for extensions, functions,
triggers, RLS, policies, grants, or other objects Drizzle cannot express completely.

An executable baseline is generated from these sources and independently compared with
their expected fingerprint. It is an immutable artifact, not a second editable schema.
Release deltas are also generated artifacts.

## Cross-pillar invariants

- Provider-owned Neon Auth schemas are referenced through approved contracts, never copied
  into or rewritten by the identity pillar.
- Geography ownership includes coordinate validity and PostGIS prerequisites.
- Catalog identity is separate from live observations.
- Observations remain immutable facts; offers are derived current-state projections.
- Provenance, collection method, moderation and trust are separate dimensions.
- Ingestion remains quarantined until explicit review and promotion decisions.
- Subjective reviews do not become current-state evidence by sharing a subject ID.
- Trust storage requires the relevant accepted ADR and cannot be purchased.
- Services/RPCs expose typed contracts rather than bypassing pillar ownership.
- RLS and grants are fingerprinted behavior, not post-release console configuration.

## Baseline composition

The baseline compiler follows the dependency graph and emits one content-addressed bundle.
Its manifest maps every emitted object back to a pillar source and records the resulting
schema/RPC/RLS/grant fingerprint.

The latest-baseline marker advances only after fresh reconstruction and every supported
existing environment are proven equivalent at the release cutoff. Older baselines and all
release deltas remain archived.

## Current containment

This inventory is the desired organization. It does not authorize moving current schema
files, creating empty modules, adding an EAV model, implementing the proposed Trust Graph,
promoting ingestion evidence, or activating reviews/RLS. ADR-002 correctness-before-
boundaries and every feature-specific ADR continue to govern implementation order.
