# Architectural Decision Records (ADRs)

This directory contains all approved and proposed Architectural Decision Records for the WetinDey platform.

## Overview
ADRs document significant architectural choices, domain definitions, privacy postures, data models, and feature scope boundaries.

* **Primary ADR Index**: [docs/DECISIONS.md](../DECISIONS.md) — Main index listing all ADRs, status, and governance.
* **Template**: [000-template.md](000-template.md) — Follow this structure when proposing a new ADR.

## Priority ADR Highlights

| ADR | Title | Key Governance |
| :--- | :--- | :--- |
| **[ADR-001](001-fulfilment-is-out-of-scope.md)** | Fulfilment is Out of Scope | Locks delivery, cart, checkout, and payments out of V1 scope. |
| **[ADR-002](002-service-architecture-of-record.md)** | Service Architecture of Record | Establishes code-first truth and bans speculative module layers. |
| **[ADR-006](006-freshness-windows.md)** | Freshness Windows | Defines observation freshness decay and window thresholds. |
| **[ADR-010](010-typed-live-local-information-platform.md)** | Typed Live Local Information Platform | Outlines vertical domain models (food vs non-price domains). |
| **[ADR-011](011-earned-trust-graph-and-reputation.md)** | Earned Trust Graph & Reputation | Prevents purchasing trust; defines derived reputation signals. |
| **[ADR-014](014-pillar-baselines-and-release-migrations.md)** | Pillar Baselines & Release Migrations | Governs Drizzle schema authoring and release deltas. |
