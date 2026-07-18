# Founder Feedback Register

This register records product complaints and requests raised in the founder
orchestrator thread. It is not evidence that work is complete. `LANES.md` owns
execution ownership; this file preserves the request and its current evidence
status.

Status values: `logged`, `proposed`, `claimed`, `in progress`, `blocked`,
`refuted`, `shipped`, and `verified live`.

| ID | Request or complaint | Current status | Required follow-up |
| --- | --- | --- | --- |
| FF-001 | WetinDey must be a live local-information platform, not a price-only app; categories need domain-specific signals. | logged | Keep aligned across product, architecture, schema, APIs, and roadmap. |
| FF-002 | Add the Trust Graph, earned reputation, provenance, confidence, seller trust, rewards separation, reviews, and trust-aware ranking as an evolutionary roadmap. | proposed | Implement only through approved phases and ADRs; do not overbuild V1. |
| FF-003 | Create separate `Catalog Stewardship` and `Observation Evidence Media` lanes. | proposed | Record exact ownership in `LANES.md`; keep product CRUD distinct from report evidence uploads. |
| FF-004 | Add category-aware sheet context, contextual filters, and a shared category capability/configuration model. | proposed | Claim the bounded UI/query paths; Food remains the only enabled V1 category. |
| FF-005 | Remove explanatory disclaimers from the main UI and keep concise copy there; place legal detail on legal/About surfaces. | proposed | Product/legal UI and counsel review must record exact copy changes. |
| FF-006 | Fix the category selector so it is a slim, Apple-HIG-sized rectangular control rather than a tall padded block. | proposed | Verify the current HI lane and record the exact owner/path. |
| FF-007 | Establish Apple-inspired iconography: solid glyphs in dimensional semantic orbs, restrained intent colors, active glow, no generic monochrome outline treatment. | proposed | Foundation, sheet-adoption, and map-symbol lanes require explicit claims and visual/accessibility refutation. |
| FF-008 | Apply iconography to settings, pickers, detail sheets, Get-It, currency, exchange, map markers, and other modal/list surfaces, not only the home header. | proposed | Include the market-details sheet in the Sheet Adoption lane. |
| FF-009 | Redesign the market/detail sheet: better hierarchy, imagery where licensed, useful item icons, more available vertical space, and a stable bottom action. | logged | Exact owner was not recorded after the complaint; controller escalation sent. |
| FF-010 | Improve Mapbox symbols: market/place orbs, avatar-based user location, graceful unsigned-user avatar fallback, selected/active states, and nearby user interaction. | proposed | Presence and map-symbol work require separate privacy, consent, safety, and implementation gates. |
| FF-011 | Support Lagos-scoped browsing for users outside Lagos, including selected centers such as Festac or Badagry, without confusing simulated browsing context with real presence. | proposed | Preserve fail-closed presence rules; browsing location must never unlock real peers. |
| FF-012 | Allow signed-in users to share nearby presence with consent, see eligible nearby users, tap them, and interact safely; add trusted-person controls. | proposed | Requires presence ADR, migration/security proof, allowlist, consent, block/report, retention, and counsel gates. |
| FF-013 | Add seller onboarding, seller RBAC, verification, consented contact publishing, seller dashboards, and reusable scoped roles for other operators. | proposed | Architecture is approved direction; implementation remains separately gated. |
| FF-014 | Support practical item sizes for ordinary consumers, including smaller street-level units rather than only baskets, cartons, and wholesale sizes; update development sample data. | proposed | Claim catalog/schema/fixture paths; do not mislabel sample or source-backed evidence. |
| FF-015 | Use `Sample` instead of `Demo` for synthetic data, place the label unobtrusively at the card top-right, and reserve that visual slot for future verified trust signals. | proposed | Preserve `ee no dey`, Pidgin confirmation copy, and source-backed labels such as NBS attribution. |
| FF-016 | Aboki FX should support flags, more currencies, LemFi-inspired UX, and reverse conversion such as entering NGN 150,000 to calculate foreign currency. | proposed | Follow ADR-017 provider-aware catalog, licensed SVG flags, typed rates, and no amount egress. |
| FF-017 | Verify location sharing and nearby-user behavior with real Festac test accounts, including owner browsing from outside Lagos and selected Badagry browsing. | proposed | Do not use admin bypasses; requires authorized private-pilot and safety evidence. |
| FF-018 | Make page-level architecture genuinely modular for parallel work, with reusable live modules rather than aspirational orphan folders. | proposed | Correctness and active vertical wiring come before broad reorganization. |
| FF-019 | Maintain an Apple-like organization of product, HI, maps, security, privacy, quality, release, operations, and other specialist roles. | logged | Use named roles and bounded lanes; do not create orphan or repeating tasks. |
| FF-020 | Prevent task sprawl: close completed Luna regression monitors, avoid duplicate recurring tasks, reuse browser tabs, and keep release control accountable. | logged | Controller/automation maintenance must report active, dormant, blocked, and archived work. |
| FF-021 | Push completed, independently refuted work promptly so the founder can judge the live consumer experience; do not accumulate unnecessary local commits. | logged | Push only scoped, evidenced commits; monitor Vercel deployment and live smoke state. |
| FF-022 | Add a feedback-to-lane process so every founder complaint is visible, owned, and traceable to a commit and live verification. | in progress | This register is the tracking record; every new complaint must receive an ID and lane status. |

## Operating rule

Every new founder complaint must be added here before it is described as
underway. A request is not `claimed` until `LANES.md` names an owner and exact
paths. A request is not `shipped` until a scoped commit exists. A request is
not `verified live` until the relevant runtime or browser evidence is recorded.

