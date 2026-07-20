# Instructions for AI Coding Agents

Welcome to the **WetinDey** repository. You are working on a map-and-sheet live local information Progressive Web App. Food price and availability are the current V1 vertical; price is not the universal product model. The platform promise is to help people understand the current state of nearby reality before they leave.

Before proposing any changes, writing any code, or introducing dependencies, you **MUST** read and adhere to these guidelines.

---

## 0. Read this before you trust anything else in this file

**Read [the Dyrane Constitution](docs/DYRANE-CONSTITUTION.md) before proposing or
merging work.** It is WetinDey's standing human-centered decision test: reduce cognitive
effort while increasing human confidence. Apply the ten-question Dyrane Test during
ideation, implementation, review, refutation, and release. It guides judgment without
overriding live code evidence, accepted ADRs, or the architecture of record.

**For interface work, follow the
[UI Delivery Decision Tree](docs/design-system/UI-DELIVERY-DECISION-TREE.md).** Do not
make visual work wait behind speculative architecture. When the problem is visual,
converge against live pixels first, freeze the accepted visual contract, and then wire
truthful behavior beneath it. Behavioral defects and consequential data, privacy,
provider, schema, migration, or security changes start at their corresponding evidence
or governance boundary instead. Fast visual iteration never permits fake claims, dead
code, inaccessible controls, unclaimed paths, or an unrefuted release.

**Several sessions work this repo at once. Read [LANES.md](LANES.md) and run `git status`
BEFORE your first edit.** Claim your lane; edit only the paths your lane owns. If you spawn
subagents, put your lane's paths in their prompt and forbid them from widening it — an
agent that edits outside its lane is a bug in the prompt. A lane is a lock, not a licence:
scope still comes from the ADRs.

**Department worklogs preserve memory; they do not grant authority.** Follow
[the department worklog protocol](docs/operations/DEPARTMENT-WORKLOG-PROTOCOL.md) when a
bounded lane needs durable rationale, implementation memory, or a branch handoff. Append
only to the one functional-home log whose path is explicitly included in the current
lane. A log entry, department name, branch, commit, or handoff packet never claims a path.
Before receiving work, a branch reconciles the exact committed base/head or pre-commit
base/candidate-tree tuple, changed paths, migration/provider/deployment state, independent
verdict, and conflicts using
[the branch handoff template](docs/operations/BRANCH-HANDOFF-TEMPLATE.md). Current
`LANES.md` alone grants edits. Receiver acknowledgement is a separate append-only
follow-up record under its own exact log lane after receipt; it never unlocks editing.

Two corrections, verified against the code on 16 July 2026. Both exist because agents
have already been misled by this document.

**The modular architecture in Section 2 is aspirational, not actual.** `src/core/module-contract.ts`
defines `WetinDeyModule`. The number of live capabilities implementing it is **zero**.
`src/modules/food/application/FoodModule.ts` is orphaned — imported by nothing, referenced
only inside comments. `src/db/queries/`, where the data layer is documented to live,
contains a single `.gitkeep`. The real application is `src/app/page.tsx` and
`src/app/actions.ts` doing everything directly.

Do **not** write code into `src/modules/` or against `WetinDeyModule` and consider it
wired. This repo has already produced two generations of dead code that way: `FoodModule`,
and then `src/lib/trust.ts`, written to rescue it and orphaned identically — its
`getOfferTrust` / `getOfferTrustBatch` actions have no callers to this day. **If you write
it, wire it to a live call site in the same change, or do not write it.** Own the vertical
slice through to the UI, or leave it alone.

**Fulfilment is out of scope.** See [ADR-001](docs/adr/001-fulfilment-is-out-of-scope.md).
No delivery, dispatch, courier, tracking, cart, checkout, or payments. Buyer and seller
arrange it themselves via Contact seller. `docs/research/DELIVERY-API-LAGOS.md` recommends
integrating a courier API and is **superseded** — do not act on it.

**The multi-category UI is ahead of the domain model.** The current tree exposes category
selection, but observations, offers, details, contributions, sharing, and several SEO
surfaces still assume item + unit + price. Read proposed
[ADR-010](docs/adr/010-typed-live-local-information-platform.md) and the
[architecture evolution addendum](docs/architecture/LIVE-INFORMATION-AND-TRUST-EVOLUTION.md).
Do not model Power, Exchange, Services, Events, or another non-price domain as a Food item
with a price-shaped value. Do not create a `CategoryCapability` registry, generic filter
builder, EAV schema, or empty module during V1. A capability abstraction is justified only
when two complete live verticals wire map, search, sheet, filters, contribution, sort,
markers, copy, and trust in the same coordinated work.

**A Trust Graph is a proposed logical architecture, not permission to add a graph store,
service, generic edge table, reputation score, badge, or reward system.** Read proposed
[ADR-011](docs/adr/011-earned-trust-graph-and-reputation.md). Identity, reputation,
claim-specific confidence, verification assertions, lifecycle status, authorization roles,
and rewards are separate. None may be purchased. Current migration, provenance, and
read-side trust blockers come first.

**Database evolution is governed by
[ADR-014](docs/adr/014-pillar-baselines-and-release-migrations.md).** Drizzle schema
declarations and reviewed SQL are organised as canonical desired-state pillars; numbered
migrations are release deltas, not the permanent desired-state authoring model. Preserve
the exact applied `0000`-`0008` lineage. `0009` is independently validated but has not
been applied to a shared database; final ingestion migration `0010` is also unapplied.
Before `0010` is first applied to a shared database, defects in it MUST be folded back
into regenerated `0010` SQL, snapshot, and journal metadata under one exclusive schema
lane; do not create `0011` or `0012` to repair an unapplied migration. Once a migration
has been applied to any shared environment, its bytes and ledger evidence are immutable:
repair forward. Never run a baseline against an existing database, edit a remote ledger
to imitate deployment, or access a database without exact-target authorization. Start at
[docs/database/README.md](docs/database/README.md).

For the verified state of the system, read the architecture of record,
[docs/architecture/SERVICE-ARCHITECTURE.md](docs/architecture/SERVICE-ARCHITECTURE.md),
ratified by [ADR-002](docs/adr/002-service-architecture-of-record.md). Start with its
*Read this first* section.

**Precedence when documents disagree:** an ADR beats every other document; the architecture
of record beats the Bible and `docs/`; **the code beats all of them**. Several documents —
including `docs/APP-MAP.md` and `docs/USER-FLOW.md` — describe behaviour that does not
exist. If the code contradicts a document, the document is the bug: fix it, or say so.

**Correctness before boundaries (ADR-002).** Do not reorganise code into modules yet.
Roadmap Phases 0-4 — deleting the orphans, and making trust derived rather than the
hardcoded string `"high"` — come first. Reorganising code whose answers are wrong just
produces well-structured wrong answers.

**A green build means very little here. There is no general product/runtime test suite.**
Focused executable contract scripts exist, including static source and documentation
checks, but they prove only the invariants they inspect. `tsc` cannot see a comment that
lies. `audit:tokens` is blind to semantically-wrong-but-tokenised — that is how a
black-on-black modal shipped invisible for weeks. `knip` is blind to code that is imported
and wrong. No general suite checks every write path, rendered string, or whether a number
is *right*. **Never report "the build passes" or "the contract passes" as evidence that
something works** — drive it, or say you did not.

**You cannot review yourself.** The bugs caught here are caught by the owner, by
adversarial verifiers, and by cross-session review — almost never by the session that wrote
the code. For any substantive change, have a subagent try to *refute* your work, and tell it
to default to "refuted" when evidence is thin. This is standing practice, not a flourish.

---

## 1. Core Founding Documents

Before writing code, reference the project constitution and decision log:
1. **[WETINDEY_BIBLE.md](file:///Users/dyrane/Claude/Projects/wetindey/WETINDEY_BIBLE.md)**: The definitive product and engineering constitution.
2. **[DECISIONS.md](file:///Users/dyrane/Claude/Projects/wetindey/DECISIONS.md)**: Guidelines for Architectural Decision Records.

You must not invent domain terms or override policies documented in these files without an approved ADR.

---

## 2. Severe Modular Architecture

> **Status: TARGET STATE, NOT CURRENT STATE.** See Section 0. Nothing below is implemented today.
> It describes where the code should go, not where it is. Do not cite this section as
> evidence that a module layer exists.

WetinDey is built as a **Modular Monolith** (see [Section 25](file:///Users/dyrane/Claude/Projects/wetindey/WETINDEY_BIBLE.md#L2803) and [Section 26](file:///Users/dyrane/Claude/Projects/wetindey/WETINDEY_BIBLE.md#L2902)).

- **Decoupled UI**: The presentation layer (`src/app/`) must never define domain database logic, calculate freshness windows, or invent confidence scores directly. 
- **Module Contracts**: Every application capability must be organized as a vertical module implementing the `WetinDeyModule` contract in [src/core/module-contract.ts](file:///Users/dyrane/Claude/Projects/wetindey/src/core/module-contract.ts).
- **Module Folders**: Keep code inside its respective vertical module folder under `src/modules/<module-name>/`. Avoid giant generic folders or building utility dumping grounds (do not create `utils.ts` files).

---

## 3. Decisions & ADR Process

For any change that modifies:
- Product scope or domain meaning;
- Shared interaction patterns;
- Data trust and confidence calculations;
- External APIs, map adapters, or databases;
- Privacy and security posture;

You **MUST** write an Architectural Decision Record (ADR) in [docs/adr/](file:///Users/dyrane/Claude/Projects/wetindey/docs/adr/) following the template in Section 40.3 of the Bible, and record it in Section 40.1 / 40.2 of [WETINDEY_BIBLE.md](file:///Users/dyrane/Claude/Projects/wetindey/WETINDEY_BIBLE.md#L4363).

---

## 4. Dr. Dyrane's Design Canons (Apple HIG Adapter)

Every user interface element must comply with the following Apple HIG principles:

### A. Border & Depth Rules
- **No Borders (Contrast Surfaces)**: Hairline borders are removed. Use borderless structures (`border-0` or `border-none`) and rely entirely on HSL background surface contrast to establish layout depth and layout containment.
- **Smart Squircles (Continuous Corner Radii)**: Standard square corners are prohibited. Ensure all card containers use a smooth squircle radius (`rounded-[24px]` or `rounded-[32px]`) and all controls/buttons/inputs use (`rounded-[14px]` or `rounded-[16px]`).
- **Surface Contrast Hierarchy**: Depth is established by color contrasts across layers:
  - Base layer (Map Canvas): Bottom-most.
  - Page Background: Light `#F2F2F7` | Dark `#000000`.
  - Sheet Surfaces: Light `#FFFFFF` | Dark `#1C1C1E` (with opacity + backdrop blur).
  - Button/Input Backgrounds: Light `#E5E5EA` | Dark `#2C2C2E`.
- **Spatial Awareness**: Z-indices must align with visual layering: Map canvas (bottom) -> Interactive Context Sheet (middle) -> Floating elements/Modals (top).

### B. Animation Rules
- **Progressive Disclosure**: Hide optional content and secondary options by default. Reveal them on request (progressive disclosure) to prevent visual clutter.
- **Micro-interactions**: Interactive components must provide clear active states, scale effects (e.g. `active:scale-[0.98]`), and smooth color transitions.
- **Icon Feedback**: Icons must animate on loading or touch states to give clear feedback.
- **Sliding Guides**: Use direction-aware sliding animations to guide the user's focus and transition between views smoothly.

---

## 5. Coding Standards & Quality Gates

- **Strict TypeScript**: TypeScript strict mode is enabled. Do not use `any` types. Prefix deliberately unused parameters with an underscore (`_`).
- **Apple HIG Adaptations**: Ensure UI touch targets are at least 44x44px (48px preferred), and layouts respect dynamic safe-area insets.
- **Monolith strangulation & modularization**: Large/monolithic components (e.g., sheets and panels) should be separated into MVC slices consisting of a Controller (`MyComponent.tsx`, max 50 lines), Logic Hook (`useMyComponent.ts`, max 300 lines), JSX View (`MyComponentView.tsx`, max 300 lines), CSS style overrides (`MyComponent.css`, max 100 lines), copy dictionary (`copy.ts`, max 80 lines), and imports (`imports.ts`, max 60 lines). See `.agents/skills/modularize-monolith/SKILL.md` for details.
- **DoD (Definition of Done)**: A feature is not complete until:
  - It handles empty, loading, error, stale, and offline states.
  - Light and Dark modes are verified.
  - Screen reader attributes and focus outlines are complete.
  - Local compiler tests (`npm run lint` and `npm run build`) pass cleanly.
