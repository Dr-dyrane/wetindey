# Instructions for AI Coding Agents

Welcome to the **WetinDey** repository. You are working on a map-and-sheet Progressive Web App designed to confirm local food availability and price ranges. 

Before proposing any changes, writing any code, or introducing dependencies, you **MUST** read and adhere to these guidelines.

---

## 1. Core Founding Documents

Before writing code, reference the project constitution and decision log:
1. **[WETINDEY_BIBLE.md](file:///Users/dyrane/Claude/Projects/wetindey/WETINDEY_BIBLE.md)**: The definitive product and engineering constitution.
2. **[DECISIONS.md](file:///Users/dyrane/Claude/Projects/wetindey/DECISIONS.md)**: Guidelines for Architectural Decision Records.

You must not invent domain terms or override policies documented in these files without an approved ADR.

---

## 2. Severe Modular Architecture

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
- **No Border Zero**: The use of `border-0` is prohibited. All UI elements, buttons, cards, and panel structures must have at least a hairline border (`border border-separator` or `1px` lines).
- **Surface Differentiation**: Depth is created using calculated surface color contrast across layers (e.g. background `#F7F7F5` vs elevated surface `#FFFFFF`) rather than heavy shadows. Drop shadows must be kept minimal and subtle.
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
- **DoD (Definition of Done)**: A feature is not complete until:
  - It handles empty, loading, error, stale, and offline states.
  - Light and Dark modes are verified.
  - Screen reader attributes and focus outlines are complete.
  - Local compiler tests (`npm run lint` and `npm run build`) pass cleanly.
