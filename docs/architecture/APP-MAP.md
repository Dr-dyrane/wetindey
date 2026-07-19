# WetinDey — the app map (EMPTIED)

**Status: found substantially false on 2026-07-16, verified against commit `cc689ef`.
Contents removed rather than left to mislead.**

This document has been emptied on purpose. It is not deleted, because other docs link
to it and a dangling link is worse than an honest tombstone.

**Read [`docs/architecture/SERVICE-ARCHITECTURE.md`](architecture/SERVICE-ARCHITECTURE.md)
instead. That is the architecture of record.**

## Why it was emptied

The map was checked claim by claim against the tree at `cc689ef`. Its headline finding
was false, and roughly a third of the files it cited as evidence are not on disk.

- **Its headline finding — "a large, complete, well-written body of new code is
  unreachable" (the four sheets it called "the island") — is false.** `src/app/page.tsx`
  imports `ItemDetailSheet` (`:31`), `GetItSheet` (`:32`), `ConfirmVisitSheet`
  (`:33-39`) and `LocationSheet` (`:40`). The sheets are wired. The map called this
  "the most important fact on this page"; sections 2, 4, 6 (D1), 7, 8 and 9 were all
  built on it.
- **It cites files that do not exist.** `src/modules/` is not on disk at all — so
  `FoodModule.ts` and `modules/food/domain/types.ts` are gone, as are
  `src/core/module-contract.ts`, `src/core/state/reportingMachine.ts`,
  `src/app/_components/AreaPickerSheet.tsx`, `MobileShell.tsx` and
  `DesktopTabletShell.tsx` (the shells are now `CompactShell.tsx` / `RegularShell.tsx`).
  Its entire "Dead code" table (section 7) is a table of files that are not there.
- **Named defects are falsified.** D13/section 7 claim `zod` is unused —
  `src/lib/validation.ts:29` imports it and `src/app/actions.ts:11` imports the
  validators. D14 claims "no error boundary exists" — `src/app/error.tsx` and
  `src/app/global-error.tsx` both exist. D19 claims zero declared indexes — the GIST
  indexes it says are missing are declared at
  `src/db/migrations/0002_calm_meteorite.sql:4` (`areas.center`) and `:12`
  (`places.location`).
- **Its own provenance section was already stale.** It pinned itself to HEAD `bd1cf02`
  and to an uncommitted working tree; HEAD is now `cc689ef` and that work has landed.
  Line counts it quotes (`page.tsx` 1,018; `actions.ts` 1,050) are 1,297 and 1,358 today.

## The rule this document broke

A doc that describes code that does not exist is worse than no doc, because agents read
it and act on it. Per ADR-002: **the code beats every document.** If code and a doc
disagree, the doc is the bug. This one was the bug.

If a map of the app is wanted again, generate it from the tree at that moment and pin it
to a commit — do not restore this one from history.
