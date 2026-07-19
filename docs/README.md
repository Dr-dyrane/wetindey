# WetinDey Documentation Index

This directory serves as the central documentation repository for the WetinDey platform. Refer to this index to quickly locate platform constitutions, architecture records, active decision files, or operational protocols.

---

## ⚖️ Precedence Hierarchy
When documents disagree, the following order of precedence applies (established in `AGENTS.md` and `docs/architecture/SERVICE-ARCHITECTURE.md`):
1. 💻 **The Code**: The codebase represents the absolute source of truth. If code contradicts a document, the document is considered out of date (the bug).
2. 📜 **Architectural Decision Records (ADRs)**: Stored in `docs/adr/`. An approved ADR overrides any older documentation or design guidelines.
3. 🏛️ **Architecture of Record**: Located at `docs/architecture/SERVICE-ARCHITECTURE.md` — ratifies what exists on disk with concrete citations.
4. 📖 **Product Constitution**: Located at `docs/WETINDEY_BIBLE.md` — product vision and engineering foundation.
5. 📂 **Other Documentation (`docs/`)**: Domain-specific memos, guidelines, and research notes.

---

## 🗂️ Core Documentation Files (Root)

| File | Purpose |
| :--- | :--- |
| 📖 [WETINDEY_BIBLE.md](WETINDEY_BIBLE.md) | **Product Constitution**: Definitive product and engineering core rules. |
| ⚖️ [DECISIONS.md](DECISIONS.md) | **ADR Index**: Index of all accepted, proposed, and rejected ADRs. |
| 🧑‍💻 [CONTRIBUTING.md](CONTRIBUTING.md) | **Developer Guide**: Code standards, lint/compiler pipelines, and contribution workflow. |
| 🔄 [USER-FLOW.md](USER-FLOW.md) | **Core Platform Loop**: Verifiable flow definitions from user browse to action details. |
| 🎨 [APPLE-HIG-MAPPING.md](APPLE-HIG-MAPPING.md) | **UX Canons**: Apple HIG adaptations (borderless hierarchy, continuous corner radii/squircles). |
| ♿ [ACCESSIBILITY.md](ACCESSIBILITY.md) | **Accessibility Mandates**: Strict requirements for screen reader flow, contrast ratio, and touch target sizes. |
| 🔍 [SEO.md](SEO.md) | **Search Optimization**: SEO meta tags, layout structures, and indexability guidelines. |
| 🪦 [APP-MAP.md](APP-MAP.md) | **Tombstone**: Deprecated app-map, preserved solely to prevent broken links. |

---

## 📁 Domain Directories

### 📜 [adr/](adr/)
Contains the official **Architectural Decision Records** defining the product boundaries and critical technical pivots:
* `001-fulfilment-is-out-of-scope.md` (Locks logistics/checkout/delivery out of scope)
* `002-service-architecture-of-record.md` (Ratifies code-first architecture boundaries)
* `014-pillar-baselines-and-release-migrations.md` (Governs database migrations and schema lifecycle)

### 🏛️ [architecture/](architecture/)
Technical system architecture references and evolution plans:
* `SERVICE-ARCHITECTURE.md` (The verified **Architecture of Record**)
* `LIVE-INFORMATION-AND-TRUST-EVOLUTION.md` (Details on derived confidence and trust validation)

### 💾 [database/](database/)
Database designs, entity relationship definitions, and migration protocols:
* `README.md` (Neon Serverless PostgreSQL connection, migration instructions, Drizzle configurations)

### 🎨 [design-system/](design-system/)
Visual patterns and design tokens:
* Layout, spacing systems, continuous squircles, color palette variables.

### ⚙️ [operations/](operations/)
Coordination records, handoff rules, and functional department worklogs:
* `DEPARTMENT-WORKLOG-PROTOCOL.md` (Defines append-only field records and handoff logs)
* `BRANCH-HANDOFF-TEMPLATE.md` (Template for branching transfer evidence between workers)
* `WETINDEY-OPERATING-SYSTEM.md` (Platform coordination workflow)
* `departments/README.md` (Links to the 16 department-specific append-only log files)

### 🗺️ [plans/](plans/)
Roadmaps, release milestones, and execution phases.

### 🔒 [privacy/](privacy/)
Privacy policies, data retention timelines, and GDPR/CCPA boundary rules.

### 📦 [product/](product/)
Product requirements documents (PRDs) and founder feedback lists:
* `CATALOG-STEWARDSHIP-WORKFLOW.md` (How catalog moderators verify live observations)
* `FOUNDER-FEEDBACK.md` (Visual design corrections and core vertical instructions)

### 🧪 [quality/](quality/)
Release validation checklists, testing protocols, and static gates.

### 🔬 [research/](research/)
Research papers, feasibility analyses, and external API investigations:
* `DELIVERY-API-LAGOS.md` (*Superseded* courier analysis, kept for history)

### 📖 [runbooks/](runbooks/)
Operations procedures, backup recovery, and production maintenance workflows.
