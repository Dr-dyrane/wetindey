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

## 🗂️ Core Constitution & Entry Points

| File | Purpose |
| :--- | :--- |
| 📖 [WETINDEY_BIBLE.md](WETINDEY_BIBLE.md) | **Product Constitution**: Definitive product and engineering core rules. |
| ⚖️ [DECISIONS.md](DECISIONS.md) | **ADR Index**: Index of all accepted, proposed, and rejected ADRs. |
| 🧑‍💻 [CONTRIBUTING.md](CONTRIBUTING.md) | **Developer Guide**: Code standards, lint/compiler pipelines, and contribution workflow. |

---

## 📁 Domain Subfolder Index

| Domain | Guide & Readme | Description & Key Documents |
| :--- | :--- | :--- |
| 📜 **ADRs** | [adr/README.md](adr/README.md) | Official decision records ([ADR-001](adr/001-fulfilment-is-out-of-scope.md), [ADR-002](adr/002-service-architecture-of-record.md), [ADR-014](adr/014-pillar-baselines-and-release-migrations.md)). |
| 🏛️ **Architecture** | [architecture/README.md](architecture/README.md) | System architecture of record ([SERVICE-ARCHITECTURE.md](architecture/SERVICE-ARCHITECTURE.md)) & [APP-MAP.md](architecture/APP-MAP.md). |
| 🎨 **Design System** | [design-system/README.md](design-system/README.md) | Visual canons ([APPLE-HIG-MAPPING.md](design-system/APPLE-HIG-MAPPING.md)), [ACCESSIBILITY.md](design-system/ACCESSIBILITY.md), and [MOTION-SYSTEM.md](design-system/MOTION-SYSTEM.md). |
| 📦 **Product** | [product/README.md](product/README.md) | Core loops ([USER-FLOW.md](product/USER-FLOW.md)), [SEO.md](product/SEO.md), [CATALOG-STEWARDSHIP-WORKFLOW.md](product/CATALOG-STEWARDSHIP-WORKFLOW.md), and [FOUNDER-FEEDBACK.md](product/FOUNDER-FEEDBACK.md). |
| ⚙️ **Operations** | [operations/README.md](operations/README.md) | Worklog protocols ([DEPARTMENT-WORKLOG-PROTOCOL.md](operations/DEPARTMENT-WORKLOG-PROTOCOL.md)) and append-only department logs. |
| 💾 **Database** | [database/README.md](database/README.md) | Database schemas, Drizzle ORM setups, and migration guides. |
| 🗺️ **Plans** | [plans/](plans/) | Release roadmaps and phase milestones. |
| 🔒 **Privacy** | [privacy/](privacy/) | Security boundaries, data retention, and privacy policies. |
| 🧪 **Quality** | [quality/](quality/) | Testing strategy, static checks, and release verification. |
| 🔬 **Research** | [research/](research/) | Background investigations and superseded API research. |
| 📖 **Runbooks** | [runbooks/](runbooks/) | Production ops procedures and maintenance. |
