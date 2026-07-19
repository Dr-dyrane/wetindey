---
name: modularize-monolith
description: Guidelines and workflow reminder for modularizing large monolithic React components and files within the WetinDey repository.
---

# Modularizing Monoliths Workflow Reminder

This skill outlines the strict architectural separation pattern used in the **WetinDey** repository to decompose monolithic components (such as page layouts, panels, and large sheets) into clean, dry, decoupled structures without breaking functionality.

## Core Architectural Blueprint

When refactoring a monolith component (e.g. `MyMonolith.tsx`), split it into the following six specialized files:

1. **Controller (Orchestrator)**: `MyMonolith.tsx`
   - Serves as the thin entry point.
   - Invokes the state logic hook (`useMyMonolith`).
   - Renders the presentational View (`MyMonolithView`).
2. **Logic Hook**: `useMyMonolith.ts`
   - Houses all state logic, side-effects (`useEffect`), React hooks, transitions, global Zustand store selectors, data-fetching triggers, and event callback functions.
   - Returns a single unified object representing the state and handlers.
   - **Constraint**: Must preserve all explanatory developer comments and rollback logic.
3. **JSX View**: `MyMonolithView.tsx`
   - Purely presentational markup component.
   - Destructures and renders layout nodes, modal windows, lists, and secondary sheets.
   - Must contain zero state-logic or hooks lifecycle side-effects.
   - **Constraint**: Must preserve all accessibility tags, role annotations, and layout-specific inline developer comments.
4. **Imports**: `imports.ts`
   - Consolidates external component types, helper functions, and icon/flag definitions.
5. **Copy**: `copy.ts`
   - Houses local copy strings, Pidgin overrides, and button label accessibility text.
6. **CSS Override**: `MyMonolith.css`
   - Declares floating controls offsets, z-index hierarchies, scroll configurations, and surface container styling.

## 📏 Target File Size & Line Limits

To prevent bloated sub-monoliths, adhere to the following target line count limits:

| File Role | File Name | Max Target Lines | Guidelines |
| :--- | :--- | :---: | :--- |
| **Controller** | `MyMonolith.tsx` | **20 – 50 lines** | Thin entry point only. Invokes hook and passes props to View. |
| **Imports** | `imports/imports.ts` | **20 – 60 lines** | Clean, consolidated re-exports of dependencies and icons. |
| **Copy** | `copy/copy.ts` | **20 – 80 lines** | Dictionary object of local copy and Pidgin strings. |
| **Styles** | `styles/MyMonolith.css` | **20 – 100 lines** | Scoped CSS overrides. |
| **JSX View** | `views/MyMonolithView.tsx` | **150 – 300 lines** | Pure presentational layout. Split into sub-views (`SubSectionView.tsx`) if over 300 lines. |
| **Logic Hook** | `hooks/useMyMonolith.ts` | **150 – 300 lines** | State, effects, and event handlers. Extract sub-hooks (`useSubLogic.ts`) if over 300 lines. |

## Execution Checklist

- [ ] **Lane Verification**: Claim the lane in `LANES.md` listing the monolithic file to modify and the five new paths to be created.
- [ ] **Imports Consolidation**: Extract all imports and third-party dependencies from the monolith into `imports.ts`.
- [ ] **State & Logic Extraction**: Relocate hooks and handlers into `useMyMonolith.ts`. Ensure to cast the return type gracefully or use `ReturnType<typeof useMyMonolith>` in the View to avoid interface duplication.
- [ ] **View Assembly**: Move JSX markup into `MyMonolithView.tsx`.
- [ ] **Strict Verification**:
  - Run `npx tsc --noEmit --project tsconfig.test.json` to verify 100% type safety.
  - Run `npm run lint` to assert zero warnings or unused imports.
- [ ] **Lane Release**: Commit changes path-scoped, update `LANES.md` to release the lane, and report the Git commit SHA.
